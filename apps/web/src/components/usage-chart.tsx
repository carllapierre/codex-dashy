import { formatCompactNumber } from './ui/animated-number';

type UsageChartProps = {
    points: Array<{ label: string; totalTokens: number }>;
};

export function UsageChart({ points }: UsageChartProps) {
    const maxValue = Math.max(...points.map((point) => point.totalTokens), 0);

    if (points.length === 0 || maxValue === 0) {
        return (
            <div
                className="usage-chart usage-chart--empty"
                role="img"
                aria-label="No token history yet"
            >
                <span>No token activity in this window.</span>
            </div>
        );
    }

    const width = 800;
    const height = 220;
    const inset = 12;
    const chartWidth = width - inset * 2;
    const chartHeight = height - inset * 2;
    const coordinates = points.map((point, index) => {
        const x = inset + (index / Math.max(points.length - 1, 1)) * chartWidth;
        const y = inset + chartHeight - (point.totalTokens / maxValue) * chartHeight;

        return { x, y };
    });
    const line = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
    const area = `${inset},${height - inset} ${line} ${width - inset},${height - inset}`;

    return (
        <div className="usage-chart" role="img" aria-label="Token activity over time">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id="usage-area-gradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-violet-4)" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="var(--color-violet-4)" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <line
                    className="usage-chart__gridline"
                    x1={inset}
                    x2={width - inset}
                    y1={inset}
                    y2={inset}
                />
                <line
                    className="usage-chart__gridline"
                    x1={inset}
                    x2={width - inset}
                    y1={height / 2}
                    y2={height / 2}
                />
                <line
                    className="usage-chart__gridline"
                    x1={inset}
                    x2={width - inset}
                    y1={height - inset}
                    y2={height - inset}
                />
                <polygon className="usage-chart__area" points={area} />
                <polyline
                    key={`${points.length}-${points.at(-1)?.totalTokens ?? 0}`}
                    className="usage-chart__line"
                    points={line}
                />
                {coordinates.length > 1 ? (
                    <circle
                        className="usage-chart__latest"
                        cx={coordinates.at(-1)?.x}
                        cy={coordinates.at(-1)?.y}
                        r="4"
                    />
                ) : null}
            </svg>
            <div className="usage-chart__labels">
                <span>{points[0]?.label}</span>
                <span>{formatCompactNumber(maxValue)} peak</span>
                <span>{points.at(-1)?.label}</span>
            </div>
        </div>
    );
}
