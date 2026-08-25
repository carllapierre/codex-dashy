import type { ReactNode } from 'react';
import { AnimatedNumber } from './animated-number';

type StatCardProps = {
    label: string;
    value: number | null;
    suffix?: string;
    icon: ReactNode;
    format?: (value: number) => string;
};

export function StatCard({ label, value, suffix, icon, format }: StatCardProps) {
    return (
        <article className="stat-card">
            <div className="stat-card__topline">
                <span className="stat-card__label">{label}</span>
                <span className="stat-card__icon">{icon}</span>
            </div>
            <div className="stat-card__value">
                {value === null ? <span>—</span> : <AnimatedNumber value={value} format={format} />}
                {suffix && value !== null ? (
                    <span className="stat-card__suffix">{suffix}</span>
                ) : null}
            </div>
        </article>
    );
}
