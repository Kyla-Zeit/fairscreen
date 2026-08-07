import { type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

import type { ButtonVariant } from "./Button";

export interface LinkButtonProps extends LinkProps {
  readonly variant?: Exclude<ButtonVariant, "danger">;
  readonly icon?: ReactNode;
}

export function LinkButton({
  children,
  className,
  icon,
  variant = "primary",
  ...props
}: LinkButtonProps) {
  const classes = ["button", `button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <Link className={classes} {...props}>
      {icon ? <span className="button__icon">{icon}</span> : null}
      <span>{children}</span>
    </Link>
  );
}
