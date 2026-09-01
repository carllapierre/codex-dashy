import type { TelemetryAttribute } from './otel-batch';

export function readTelemetryNumber(
    attributes: Record<string, TelemetryAttribute>,
    key: string,
): number {
    const value = attributes[key];
    const number = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function readTelemetryString(
    attributes: Record<string, TelemetryAttribute>,
    key: string,
): string | null {
    const value = attributes[key];

    return typeof value === 'string' && value.length > 0 ? value : null;
}

export function isTitleGenerationPrompt(prompt: string): boolean {
    return prompt.includes('Generate a concise UI title') && prompt.includes('User prompt:');
}

export function readUserPrompt(attributes: Record<string, TelemetryAttribute>): string | null {
    const prompt = readTelemetryString(attributes, 'prompt');

    if (!prompt) {
        return null;
    }

    if (!isTitleGenerationPrompt(prompt)) {
        return prompt;
    }

    return prompt.slice(prompt.lastIndexOf('User prompt:') + 'User prompt:'.length).trim() || null;
}

export function readTelemetryTimestamp(value: string | null | undefined): number | null {
    if (!value) {
        return null;
    }

    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp) ? null : timestamp;
}
