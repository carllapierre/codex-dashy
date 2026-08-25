import type { FastifyReply, FastifyRequest } from 'fastify';
import { GetCodexUsageUseCase } from '../../../application/codex/get-codex-usage.use-case';

export class CodexUsageController {
    public constructor(private readonly getCodexUsage: GetCodexUsageUseCase) {}

    public read = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        return reply.send(await this.getCodexUsage.execute());
    };
}
