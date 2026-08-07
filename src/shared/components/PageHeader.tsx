import type { ReactNode } from "react";

interface PageHeaderProps {
  readonly actions?: ReactNode;
  readonly eyebrow?: string;
  readonly lead?: ReactNode;
  readonly title: string;
}

export function PageHeader({ actions, eyebrow, lead, title }: PageHeaderProps) {
  return (
    <header className="page-header">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 tabIndex={-1}>{title}</h1>
      {lead ? <div className="lead">{lead}</div> : null}
      {actions ? <div className="action-row">{actions}</div> : null}
    </header>
  );
}
