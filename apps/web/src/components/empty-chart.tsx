export function EmptyChart() {
    return (
        <div className="empty-chart" role="img" aria-label="No token history yet">
            <svg viewBox="0 0 800 180" preserveAspectRatio="none" aria-hidden="true">
                <line x1="0" y1="150" x2="800" y2="150" />
                <line x1="0" y1="90" x2="800" y2="90" />
                <line x1="0" y1="30" x2="800" y2="30" />
            </svg>
            <div className="empty-chart__message">
                Token history will appear here after collection starts.
            </div>
        </div>
    );
}
