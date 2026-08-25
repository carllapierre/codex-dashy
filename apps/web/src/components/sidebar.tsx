type SidebarProps = {
    connected: boolean;
};

export function Sidebar({ connected }: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand__mark">C</div>
                <div>
                    <div className="brand__name">Codex Dashy</div>
                    <div className="brand__caption">local telemetry</div>
                </div>
            </div>

            <nav className="sidebar__nav" aria-label="Main navigation">
                <button className="nav-item nav-item--active" type="button">
                    <span aria-hidden="true">◈</span>
                    Overview
                </button>
                <button className="nav-item" type="button" disabled>
                    <span aria-hidden="true">▦</span>
                    Projects
                    <span className="nav-item__count">0</span>
                </button>
            </nav>

            <div className="sidebar__footer">
                <span className={`connection-dot ${connected ? 'connection-dot--live' : ''}`} />
                {connected ? 'API connected' : 'Waiting for API'}
            </div>
        </aside>
    );
}
