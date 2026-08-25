import { useEffect, useState } from 'react';
import { EmptyChart } from './components/empty-chart';
import { Sidebar } from './components/sidebar';
import { StatCard } from './components/ui/stat-card';

type HealthResponse = {
    status: 'ok';
};

export function App() {
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let active = true;

        fetch('/api/health')
            .then((response) => response.json() as Promise<HealthResponse>)
            .then((health) => {
                if (active) {
                    setConnected(health.status === 'ok');
                }
            })
            .catch(() => {
                if (active) {
                    setConnected(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    return (
        <div className="app-shell">
            <Sidebar connected={connected} />
            <main className="main-content">
                <header className="page-header">
                    <div>
                        <h1>Overview</h1>
                        <p className="page-header__description">
                            Global overview of your Codex usage on this machine.
                        </p>
                    </div>
                    <div className="live-pill">
                        <span
                            className={`connection-dot ${connected ? 'connection-dot--live' : ''}`}
                        />
                        Live updates ready
                    </div>
                </header>

                <section className="stats-grid" aria-label="Usage summary">
                    <StatCard label="Total tokens" value={0} icon="✦" />
                    <StatCard label="Estimated cost" value={0} suffix="USD" icon="$" />
                    <StatCard label="Sessions" value={0} icon="◎" />
                    <StatCard label="Projects" value={0} icon="⌘" />
                </section>

                <section className="content-card chart-card">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Usage trend</p>
                            <h2>Token activity</h2>
                        </div>
                        <span className="muted-label">No events yet</span>
                    </div>
                    <EmptyChart />
                </section>

                <section className="content-card empty-state">
                    <div className="empty-state__orb" aria-hidden="true">
                        ✦
                    </div>
                    <h2>Your telemetry home is ready.</h2>
                    <p>
                        Connect Codex&apos;s local OTEL exporter in the next setup pass and your
                        real sessions will start appearing here.
                    </p>
                </section>
            </main>
        </div>
    );
}
