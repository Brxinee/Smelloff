"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBodyScrollLock, useFocusTrap, useMounted } from "@/lib/hooks";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Full-screen variant (used by CheckoutOverlay). */
  fullScreen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  fullScreen = false,
  children,
  className,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  useBodyScrollLock(open);
  useFocusTrap(panelRef, open, onClose);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22 }}
            className={cn(
              "relative flex w-full flex-col bg-bg",
              fullScreen
                ? "h-full sm:h-[92vh] sm:max-w-3xl sm:rounded-2xl"
                : "max-w-lg rounded-2xl shadow-header",
              className
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-surface"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
