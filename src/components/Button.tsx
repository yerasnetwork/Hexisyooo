import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold cursor-pointer transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] focus-visible:ring-[var(--color-accent)]";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[#06240f] hover:bg-[var(--color-accent-strong)] hover:-translate-y-px shadow-[var(--shadow-sm)]",
  secondary:
    "bg-transparent text-[var(--color-text)] border border-[var(--color-border-strong)] hover:border-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]",
  ghost: "bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]",
  danger: "bg-transparent text-[var(--color-danger)] border border-[var(--color-danger)]/40 hover:bg-[var(--color-danger-soft)]",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  children,
  className = "",
  href,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </Link>
  );
}
