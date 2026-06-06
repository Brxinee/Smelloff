import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

const variants: Record<Variant, string> = {
  // Primary CTA — the only thing that wears warm orange. Keep it scarce.
  primary:
    "bg-cta text-on-cta shadow-[0_6px_16px_-6px_rgba(201,78,18,0.6)] hover:bg-cta-strong hover:shadow-[0_10px_24px_-8px_rgba(201,78,18,0.7)]",
  // Secondary — outlined teal.
  secondary:
    "border-2 border-brand bg-transparent text-brand hover:bg-brand-tint",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
};

const sizes: Record<Size, string> = {
  sm: "min-h-[44px] px-4 text-sm",
  md: "min-h-[48px] px-6 text-base",
  lg: "min-h-[52px] px-8 text-lg",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

type LinkButtonProps = CommonProps &
  Omit<React.ComponentProps<typeof Link>, keyof CommonProps>;

export function LinkButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        "no-underline",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
