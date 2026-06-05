import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

let idCounter = 0;
function useFieldId(provided?: string): string {
  const [id] = React.useState(() => provided ?? `field-${++idCounter}`);
  return id;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Render-prop receives the wiring for the control. */
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const id = useFieldId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-medium text-ink">
        {label}
        {required && (
          <span className="text-error" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-ink-3">
          {hint}
        </p>
      )}
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
      })}
      {error && (
        <p id={errId} className="flex items-center gap-1.5 text-sm text-error">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-[48px] rounded-lg border border-border bg-surface-2 px-3 text-base text-ink placeholder:text-ink-3",
        "focus:border-brand focus:bg-bg focus:outline-none",
        "aria-[invalid=true]:border-error",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[120px] rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-ink placeholder:text-ink-3",
        "focus:border-brand focus:bg-bg focus:outline-none",
        "aria-[invalid=true]:border-error",
        className
      )}
      {...props}
    />
  );
});
