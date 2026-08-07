import type { ReactNode } from "react";

interface DisclosureProps {
  readonly children: ReactNode;
  readonly summary: string;
}

export function Disclosure({ children, summary }: DisclosureProps) {
  return (
    <details className="disclosure">
      <summary className="disclosure__summary">{summary}</summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}
