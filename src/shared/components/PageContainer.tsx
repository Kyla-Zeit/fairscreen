import type { HTMLAttributes, ReactNode } from "react";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
}

export function PageContainer({
  children,
  className,
  ...props
}: PageContainerProps) {
  const classes = ["page-container", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
