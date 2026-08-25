import type { ReactNode } from 'react';
import { AnimatedNumber } from './animated-number';

type StatCardProps = {
    label: string;
    value: number;
    suffix?: string;
    icon: ReactNode;
};

export function StatCard({ label, value, suffix, icon }: StatCardProps) {
    return (
        <article className="stat-card">
            <div className="stat-card__topline">
                <span className="stat-card__label">{label}</span>
                <span className="stat-card__icon">{icon}</span>
            </div>
            <div className="stat-card__value">
                <AnimatedNumber value={value} />
                {suffix ? <span className="stat-card__suffix">{suffix}</span> : null}
            </div>
        </article>
    );
}
