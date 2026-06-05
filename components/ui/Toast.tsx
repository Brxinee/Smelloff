"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useMounted } from "@/lib/hooks";

interface ToastMessage {
  id: number;
  text: string;
}

interface ToastContextValue {
  notify: (text: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const mounted = useMounted();

  const notify = React.useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
            aria-live="polite"
            aria-atomic="true"
          >
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="pointer-events-auto flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-bg shadow-header"
                >
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                  {t.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
