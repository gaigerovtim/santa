import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] font-semibold " +
  "transition-[background-color,box-shadow,transform,color] duration-200 select-none " +
  "disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary: "bg-santa text-white hover:bg-santa-hover hover:shadow-glow-red",
  secondary:
    "border border-garland/50 text-garland hover:border-garland hover:bg-garland/10 hover:shadow-glow",
  ghost: "text-text hover:bg-surface-2",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-base",
  lg: "min-h-14 px-7 text-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  className,
  children,
  type = "button",
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
