import type { ReactNode } from "react";

export type StatusTone = "info" | "success" | "warning" | "error";

interface StatusProps {
  readonly children: ReactNode;
  readonly tone?: StatusTone;
}

export function Status({ children, tone = "info" }: StatusProps) {
  return (
    <p
      className={`status status--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
