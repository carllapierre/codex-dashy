import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelRatesPage } from './model-rates-page';

const rate = {
    model: 'gpt-5.6-luna',
    inputPerMillionUsd: 0.2,
    cachedInputPerMillionUsd: 0.02,
    outputPerMillionUsd: 1.2,
    updatedAt: '2026-08-25T12:00:00.000Z',
};

describe('ModelRatesPage', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('loads and saves editable model rates', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => [rate] })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ...rate, inputPerMillionUsd: 0.3 }),
            });
        vi.stubGlobal('fetch', fetchMock);
        const onSaved = vi.fn();

        render(<ModelRatesPage onSaved={onSaved} />);

        const input = await screen.findByRole('spinbutton', {
            name: 'gpt-5.6-luna Input / 1M',
        });
        fireEvent.change(input, { target: { value: '0.3' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save rates' }));

        await waitFor(() =>
            expect(fetchMock).toHaveBeenLastCalledWith(
                '/api/settings/model-rates/gpt-5.6-luna',
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify({
                        inputPerMillionUsd: 0.3,
                        cachedInputPerMillionUsd: 0.02,
                        outputPerMillionUsd: 1.2,
                    }),
                }),
            ),
        );
        expect(onSaved).toHaveBeenCalledOnce();
    });
});
