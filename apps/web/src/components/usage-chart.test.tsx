import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsageChart } from './usage-chart';

describe('UsageChart', () => {
    it('shows the exact token count for the hovered point', () => {
        const { container } = render(
            <UsageChart
                points={[
                    { label: 'Aug 25, 9 AM', totalTokens: 1_000 },
                    { label: 'Aug 25, 10 AM', totalTokens: 2_345 },
                ]}
            />,
        );
        const svg = container.querySelector('svg');

        if (!svg) {
            throw new Error('Expected chart SVG');
        }

        const line = container.querySelector('.usage-chart__line');
        expect(line?.tagName).toBe('polyline');
        expect(line).toHaveAttribute('pathLength', '1');

        Object.defineProperty(svg, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({ left: 0, width: 800 }),
        });
        fireEvent.mouseMove(svg, { clientX: 800 });

        expect(screen.getByRole('status')).toHaveTextContent('2,345 tokens');
        expect(screen.getByRole('status')).toHaveTextContent('Aug 25, 10 AM');
    });
});
