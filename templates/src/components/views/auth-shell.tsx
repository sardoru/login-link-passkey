"use client";

import { ShieldCheck } from "lucide-react";
import { BrandMark } from "../brand-mark";
import { BRAND } from "@/lib/auth/brand";

/**
 * The card chrome shared by /login, /invite, /join and /waitlist — brass rule,
 * wordmark, radial wash. Keeps the four public entrances visually identical.
 */
export function AuthShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-paper px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.6]"
        style={{
          background:
            "radial-gradient(620px 360px at 50% -8%, color-mix(in srgb, var(--brass) 16%, transparent), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_50px_-20px_rgba(0,0,0,0.35)]">
          <div className="rule-brass h-[3px]" />
          <div className="p-7 sm:p-9">
            <div className="mb-7 flex items-center gap-3">
              <BrandMark size={40} />
              <div className="leading-tight">
                <p className="text-lg font-bold tracking-tight text-ink">
                  {BRAND.appName.toUpperCase()}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wider text-inkfaint">
                  {BRAND.tagline}
                </p>
              </div>
            </div>
            {children}
          </div>
        </div>
        {footer ?? (
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-inkfaint">
            <ShieldCheck className="h-3.5 w-3.5" />
            {BRAND.footerNote}
          </p>
        )}
      </div>
    </div>
  );
}

/** Standard 44px-tall labelled text input used across the public auth pages. */
export function Field({
  label,
  icon,
  ...props
}: {
  label: string;
  icon?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <span className="flex h-11 items-center rounded-lg border border-line bg-paper focus-within:border-brass">
        {icon ? <span className="ml-3 text-inkfaint">{icon}</span> : null}
        <input
          {...props}
          className="h-full w-full bg-transparent px-3 text-sm text-ink outline-none placeholder:text-inkfaint"
        />
      </span>
    </label>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-rise mt-4 rounded-lg border border-neg/30 bg-negsoft px-3 py-2 text-sm text-neg">
      {children}
    </div>
  );
}
