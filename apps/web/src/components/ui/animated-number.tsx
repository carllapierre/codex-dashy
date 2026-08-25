import { useEffect, useRef, useState } from 'react';

type AnimatedNumberProps = {
    value: number;
    format?: (value: number) => string;
};

const compactFormatter = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
});

export function formatCompactNumber(value: number): string {
    return compactFormatter.format(value);
}

export function AnimatedNumber({ value, format = formatCompactNumber }: AnimatedNumberProps) {
    const [displayValue, setDisplayValue] = useState(value);
    const previousValue = useRef(value);

    useEffect(() => {
        const startValue = previousValue.current;
        const difference = value - startValue;

        if (difference === 0) {
            return undefined;
        }

        const startTime = performance.now();
        const duration = 650;
        let frameId = 0;

        const animate = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const easedProgress = 1 - (1 - progress) ** 3;
            setDisplayValue(startValue + difference * easedProgress);

            if (progress < 1) {
                frameId = requestAnimationFrame(animate);
            } else {
                previousValue.current = value;
            }
        };

        frameId = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(frameId);
    }, [value]);

    return <span>{format(displayValue)}</span>;
}
