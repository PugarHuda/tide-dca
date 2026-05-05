"use client";

/**
 * Lightweight toast system. Single ToastProvider near the root of the app,
 * useToast() in any client component to push.
 *
 *   const toast = useToast();
 *   toast.success("DCA position created", { explorerSig: sig });
 *   toast.error("Window not yet expired");
 *
 * Auto-dismiss after 5 s by default. Click to dismiss early.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { CURRENT_NETWORK } from "@/lib/constants";

type ToastKind = "success" | "error" | "info";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  explorerSig?: string;
};

type ToastOptions = {
  /** Tx signature; renders an explorer link below the message. */
  explorerSig?: string;
  /** Custom duration in ms (default 5000). 0 = sticky. */
  durationMs?: number;
};

type ToastApi = {
  push: (kind: ToastKind, message: string, opts?: ToastOptions) => void;
  success: (message: string, opts?: ToastOptions) => void;
  error: (message: string, opts?: ToastOptions) => void;
  info: (message: string, opts?: ToastOptions) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const counter = useRef(0);
  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastApi["push"]>(
    (kind, message, opts) => {
      const id = ++counter.current;
      setToasts((ts) => [...ts, { id, kind, message, explorerSig: opts?.explorerSig }]);
      const ms = opts?.durationMs ?? 5000;
      if (ms > 0) {
        setTimeout(() => dismiss(id), ms);
      }
    },
    [dismiss],
  );

  const api: ToastApi = {
    push,
    success: (m, o) => push("success", m, o),
    error: (m, o) => push("error", m, o),
    info: (m, o) => push("info", m, o),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="toast-wrap" role="status" aria-live="polite">
            {toasts.map((t) => (
              <button
                key={t.id}
                className={`toast toast--${t.kind}`}
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
              >
                <span className="toast__icon">
                  {t.kind === "success" ? "✓" : t.kind === "error" ? "✗" : "ⓘ"}
                </span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <span style={{ display: "block" }}>{t.message}</span>
                  {t.explorerSig && (
                    <a
                      href={`https://explorer.solana.com/tx/${t.explorerSig}?cluster=${CURRENT_NETWORK}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="toast__link"
                    >
                      View on Solana Explorer ↗
                    </a>
                  )}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
