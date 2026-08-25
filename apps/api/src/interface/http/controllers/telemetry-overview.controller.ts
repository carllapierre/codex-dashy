import type { FastifyReply, FastifyRequest } from 'fastify';
import type { TelemetryRange } from '../../../domain/telemetry/telemetry-overview';
import { GetTelemetryOverviewUseCase } from '../../../application/telemetry/get-telemetry-overview.use-case';

type OverviewQuery = {
    range?: string;
    model?: string;
    timezone?: string;
};

function readRange(value: string | undefined): TelemetryRange {
    return value === '1d' || value === '30d' ? value : '7d';
}

function readTimeZone(value: string | undefined): string {
    if (!value) {
        return 'UTC';
    }

    try {
        new Intl.DateTimeFormat('en', { timeZone: value }).format();
        return value;
    } catch {
        return 'UTC';
    }
}

export class TelemetryOverviewController {
    public constructor(private readonly getOverview: GetTelemetryOverviewUseCase) {}

    public handle = async (
        request: FastifyRequest<{ Querystring: OverviewQuery }>,
        reply: FastifyReply,
    ): Promise<void> => {
        const range = readRange(request.query.range);
        const model =
            request.query.model && request.query.model !== 'all' ? request.query.model : null;
        const timeZone = readTimeZone(request.query.timezone);

        return reply.send(this.getOverview.execute(range, model, timeZone));
    };
}
