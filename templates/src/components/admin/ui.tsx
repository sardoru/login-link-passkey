"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import { cx } from "../auth/cx";

// ── Layout ──────────────────────────────────────────────────────────────────

export function Panel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-inksoft">{description}</p>
          )}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** Horizontally scrollable table wrapper — wide matrices must never blow out the page. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-12 text-center text-sm text-inkfaint">{children}</div>
  );
}

export function Spinner() {
  return (
    <div className="grid place-items-center px-5 py-12">
      <Loader2 className="h-5 w-5 animate-spin text-brass" />
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

export function Btn({
  variant = "default",
  busy,
  className,
  children,
  ...props
}: {
  variant?: "default" | "primary" | "danger" | "ghost";
  busy?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    default: "border border-line bg-surface text-ink hover:bg-surface2",
    primary: "bg-ink text-paper hover:opacity-90",
    danger: "border border-neg/40 bg-negsoft text-neg hover:border-neg",
    ghost: "text-inksoft hover:bg-surface2 hover:text-ink",
  }[variant];
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-60",
        styles,
        className
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-9 w-full min-w-0 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none placeholder:text-inkfaint focus:border-brass",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      // iPadOS 26 renders <select> as a capsule without this.
      style={{ appearance: "none", ...props.style }}
      className={cx(
        "h-9 w-full min-w-0 rounded-lg border border-line bg-paper px-2.5 text-sm text-ink outline-none focus:border-brass",
        props.className
      )}
    />
  );
}

export function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-inkfaint">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-inkfaint">{hint}</span>}
    </label>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "pos" | "neg" | "warn" | "brass";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-line bg-surface2 text-inksoft",
    pos: "border-pos/30 bg-possoft text-pos",
    neg: "border-neg/30 bg-negsoft text-neg",
    warn: "border-warn/30 bg-warnsoft text-warn",
    brass: "border-brass/40 bg-transparent text-brass",
  }[tone];
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        tones
      )}
    >
      {children}
    </span>
  );
}

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Btn
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked — the value is selectable on screen */
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-pos" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Btn>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  description,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10">
      <div
        className={cx(
          "animate-rise w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            {description && (
              <p className="mt-0.5 text-sm text-inksoft">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-inkfaint transition hover:bg-surface2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Notices ─────────────────────────────────────────────────────────────────

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "success" | "warn";
  children: React.ReactNode;
}) {
  if (!children) return null;
  const tones = {
    error: "border-neg/30 bg-negsoft text-neg",
    success: "border-pos/30 bg-possoft text-pos",
    warn: "border-warn/30 bg-warnsoft text-warn",
  }[tone];
  return (
    <div className={cx("animate-rise rounded-lg border px-3 py-2 text-sm", tones)}>
      {children}
    </div>
  );
}

// ── Data fetching ───────────────────────────────────────────────────────────

/** Tiny JSON loader with a manual `reload` — every admin panel uses this. */
export function useJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      setData(j as T);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setError };
}

/** POST/PATCH/PUT/DELETE helper that surfaces the API's error text. */
export async function mutate(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<{ ok: boolean; data: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, data, error: String(data.error ?? "Request failed") };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, data: {}, error: "Network error" };
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
