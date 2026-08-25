import type { FastifyReply, FastifyRequest } from 'fastify';
import { GetModelRatesUseCase } from '../../../application/settings/get-model-rates.use-case';
import {
    InvalidModelRateError,
    UpdateModelRateUseCase,
} from '../../../application/settings/update-model-rate.use-case';
import type { ModelRateValues } from '../../../domain/settings/model-rate';

type ModelRateParams = {
    model: string;
};

type ModelRateBody = Partial<ModelRateValues>;

export class ModelRatesController {
    public constructor(
        private readonly getModelRates: GetModelRatesUseCase,
        private readonly updateModelRate: UpdateModelRateUseCase,
    ) {}

    public list = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        return reply.send(this.getModelRates.execute());
    };

    public update = async (
        request: FastifyRequest<{ Params: ModelRateParams; Body: ModelRateBody }>,
        reply: FastifyReply,
    ): Promise<void> => {
        try {
            return reply.send(
                this.updateModelRate.execute(request.params.model, request.body ?? {}),
            );
        } catch (error) {
            if (error instanceof InvalidModelRateError) {
                return reply.code(400).send({ error: error.message });
            }

            throw error;
        }
    };
}
