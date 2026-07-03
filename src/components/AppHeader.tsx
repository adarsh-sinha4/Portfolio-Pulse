"use client";

import Link from "next/link";
import { VALUATION_DATE } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-bold text-white"
          >
            P
          </span>
          <span className="text-base font-semibold tracking-tight">Portfolio Pulse</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-ink-muted sm:inline">
            Valued as of {formatDate(VALUATION_DATE)}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
