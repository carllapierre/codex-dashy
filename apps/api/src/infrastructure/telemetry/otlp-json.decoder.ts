import { createHash } from 'node:crypto';
import type {
    NormalizedTelemetryEvent,
    OtlpBatch,
    OtlpLogsDecoder,
    TelemetryAttribute,
} from '../../domain/telemetry/otel-batch';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): JsonObject[] {
    return Array.isArray(value) ? value.filter(isObject) : [];
}

function readAttributeValue(value: unknown): TelemetryAttribute {
    if (!isObject(value)) {
        return null;
    }

    if (typeof value.stringValue === 'string') {
        return value.stringValue;
    }

    if (typeof value.intValue === 'string' || typeof value.intValue === 'number') {
        return Number(value.intValue);
    }

    if (typeof value.doubleValue === 'string' || typeof value.doubleValue === 'number') {
        return Number(value.doubleValue);
    }

    if (typeof value.boolValue === 'boolean') {
        return value.boolValue;
    }

    return null;
}

function readAttributes(value: unknown): Record<string, TelemetryAttribute> {
    return Object.fromEntries(
        asArray(value)
            .map((attribute) => {
                const key = typeof attribute.key === 'string' ? attribute.key : null;
                return key ? [key, readAttributeValue(attribute.value)] : null;
            })
            .filter((entry): entry is [string, TelemetryAttribute] => entry !== null),
    );
}

function getString(
    attributes: Record<string, TelemetryAttribute>,
    ...keys: string[]
): string | null {
    for (const key of keys) {
        const value = attributes[key];
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }

    return null;
}

function sanitize(value: unknown, key = ''): unknown {
    const sensitive =
        /(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|user\.email|account[_-]?id)/i.test(
            key,
        );
    if (sensitive) {
        return '[REDACTED]';
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitize(item));
    }

    if (!isObject(value)) {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value).map(([childKey, childValue]) => [
            childKey,
            sanitize(childValue, childKey),
        ]),
    );
}

function unwrapPayload(payload: unknown): unknown {
    if (!isObject(payload) || typeof payload.payload !== 'string') {
        return payload;
    }

    try {
        return JSON.parse(payload.payload) as unknown;
    } catch {
        return payload;
    }
}

function collectProjectCandidates(attributes: Record<string, TelemetryAttribute>): string[] {
    return Object.entries(attributes)
        .filter(([key, value]) => {
            const normalizedKey = key.toLowerCase();
            return (
                typeof value === 'string' &&
                (normalizedKey.includes('cwd') ||
                    normalizedKey.includes('working_directory') ||
                    normalizedKey.includes('project.path') ||
                    normalizedKey.includes('project_path') ||
                    normalizedKey.includes('workspace.root') ||
                    normalizedKey.includes('repository'))
            );
        })
        .map(([, value]) => value)
        .filter((value): value is string => typeof value === 'string');
}

function sanitizeAttributes(
    attributes: Record<string, TelemetryAttribute>,
): Record<string, TelemetryAttribute> {
    return Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [key, sanitize(value, key)]),
    ) as Record<string, TelemetryAttribute>;
}

export const otlpJsonDecoder: OtlpLogsDecoder = {
    decode(payload, receivedAt): OtlpBatch {
        const unwrappedPayload = unwrapPayload(payload);
        const resourceLogs = isObject(unwrappedPayload)
            ? asArray(unwrappedPayload.resourceLogs)
            : [];
        const events: NormalizedTelemetryEvent[] = [];
        const projectCandidates = new Set<string>();

        for (const resourceLog of resourceLogs) {
            const resourceAttributes = isObject(resourceLog.resource)
                ? readAttributes(resourceLog.resource.attributes)
                : {};

            for (const candidate of collectProjectCandidates(resourceAttributes)) {
                projectCandidates.add(candidate);
            }

            for (const scopeLog of asArray(resourceLog.scopeLogs)) {
                for (const logRecord of asArray(scopeLog.logRecords)) {
                    const attributes = {
                        ...resourceAttributes,
                        ...readAttributes(logRecord.attributes),
                    };
                    const sanitizedAttributes = sanitizeAttributes(attributes);
                    const eventName =
                        getString(attributes, 'event.name') ??
                        (typeof logRecord.eventName === 'string' ? logRecord.eventName : null);
                    const conversationId = getString(
                        attributes,
                        'conversation.id',
                        'conversation_id',
                    );
                    const model = getString(attributes, 'model', 'slug');
                    const observedAt =
                        getString(attributes, 'event.timestamp') ?? receivedAt.toISOString();

                    for (const candidate of collectProjectCandidates(attributes)) {
                        projectCandidates.add(candidate);
                    }

                    events.push({
                        eventName,
                        observedAt,
                        conversationId,
                        model,
                        attributes: sanitizedAttributes,
                    });
                }
            }
        }

        const sanitizedPayload = sanitize(unwrappedPayload);
        const dedupeKey = createHash('sha256')
            .update(JSON.stringify(sanitizedPayload))
            .digest('hex');

        return {
            dedupeKey,
            receivedAt: receivedAt.toISOString(),
            eventCount: events.length,
            eventNames: [
                ...new Set(events.map((event) => event.eventName).filter(Boolean)),
            ] as string[],
            conversationIds: [
                ...new Set(events.map((event) => event.conversationId).filter(Boolean)),
            ] as string[],
            models: [...new Set(events.map((event) => event.model).filter(Boolean))] as string[],
            projectCandidates: [...projectCandidates],
            events,
            sanitizedPayload,
        };
    },
};
