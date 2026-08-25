import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedNumber, formatCompactNumber } from './animated-number';

describe('AnimatedNumber', () => {
    it('formats compact values without inventing a value', () => {
        expect(formatCompactNumber(0)).toBe('0');
        expect(formatCompactNumber(7_000)).toBe('7K');
        expect(formatCompactNumber(1_000_000)).toBe('1M');
    });

    it('renders the provided value', () => {
        render(<AnimatedNumber value={0} />);
        expect(screen.getByText('0')).toBeVisible();
    });
});
