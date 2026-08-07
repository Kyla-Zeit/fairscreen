import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className,
      icon,
      type = "button",
      variant = "primary",
      ...props
    },
    ref,
  ) {
    const classes = ["button", `button--${variant}`, className]
      .filter(Boolean)
      .join(" ");

    return (
      <button className={classes} ref={ref} type={type} {...props}>
        {icon ? <span className="button__icon">{icon}</span> : null}
        <span>{children}</span>
      </button>
    );
  },
);
