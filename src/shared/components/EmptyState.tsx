import type { ReactNode } from "react";
import { CircleDashed } from "lucide-react";

interface EmptyStateProps {
  readonly actions?: ReactNode;
  readonly availability: string;
  readonly children?: ReactNode;
  readonly icon?: ReactNode;
  readonly title: string;
}

export function EmptyState({
  actions,
  availability,
  children,
  icon = <CircleDashed aria-hidden="true" size={28} />,
  title,
}: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      <div className="empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="empty-state__body">
        <h2 id="empty-state-title">{title}</h2>
        <p>{availability}</p>
        {children}
        {actions ? <div className="action-row">{actions}</div> : null}
      </div>
    </section>
  );
}
