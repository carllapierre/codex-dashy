import type { CodexUsageQuery, CodexUsageSnapshot } from '../../domain/codex/codex-usage';

export class GetCodexUsageUseCase {
    public constructor(private readonly query: CodexUsageQuery) {}

    public execute(): Promise<CodexUsageSnapshot> {
        return this.query.getSnapshot();
    }
}
