import type { FastifyReply, FastifyRequest } from 'fastify';
import { GetHealthUseCase } from '../../../application/health/get-health.use-case';

export class HealthController {
    public constructor(private readonly getHealth: GetHealthUseCase) {}

    public handle = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        reply.send(this.getHealth.execute());
    };
}
