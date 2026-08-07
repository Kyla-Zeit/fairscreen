import type { ReactNode } from "react";
import { AlertTriangle, Info, ShieldCheck, XCircle } from "lucide-react";

export type NoticeVariant = "info" | "privacy" | "warning" | "error";

interface NoticeProps {
  readonly children: ReactNode;
  readonly title: string;
  readonly variant?: NoticeVariant;
}

const noticeIcons: Record<NoticeVariant, ReactNode> = {
  error: <XCircle aria-hidden="true" size={20} />,
  info: <Info aria-hidden="true" size={20} />,
  privacy: <ShieldCheck aria-hidden="true" size={20} />,
  warning: <AlertTriangle aria-hidden="true" size={20} />,
};

export function Notice({ children, title, variant = "info" }: NoticeProps) {
  const role = variant === "error" ? "alert" : "note";

  return (
    <section className={`notice notice--${variant}`} role={role}>
      <div className="notice__icon">{noticeIcons[variant]}</div>
      <div>
        <h2 className="notice__title">{title}</h2>
        <div className="notice__body">{children}</div>
      </div>
    </section>
  );
}
