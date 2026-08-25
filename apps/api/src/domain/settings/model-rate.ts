export type ModelRateValues = {
    inputPerMillionUsd: number;
    cachedInputPerMillionUsd: number;
    outputPerMillionUsd: number;
};

export type ModelRate = ModelRateValues & {
    model: string;
    updatedAt: string;
};

export type ModelRateQueryRepository = {
    listModelRates: () => ModelRate[];
};

export type ModelRateRepository = ModelRateQueryRepository & {
    updateModelRate: (model: string, values: ModelRateValues) => ModelRate;
};
