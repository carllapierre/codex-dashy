import type { ReactNode } from 'react';

type WarningMessageProps = {
    children: ReactNode;
};

export function WarningMessage({ children }: WarningMessageProps) {
    return (
        <p className="warning-message" role="status">
            <span className="warning-message__icon" aria-hidden="true">
                !
            </span>
            {children}
        </p>
    );
}
