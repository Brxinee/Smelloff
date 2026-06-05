"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBodyScrollLock, useFocusTrap, useMounted } from "@/lib/hooks";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title: string;
  labelId?: string;
  children: React.ReactNode;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  side = "right",
  title,
  children,
  className,
}: DrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  useBodyScrollLock(open);
  useFocusTrap(panelRef, open, onClose);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" aria-hidden={!open}>
          <motion.div
            className="absolute inset-0 bg-ink/40"
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
            initial={{ x: side === "right" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "right" ? "100%" : "-100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className={cn(
              "absolute top-0 flex h-full w-full max-w-md flex-col bg-bg shadow-header",
              side === "right" ? "right-0" : "left-0",
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
