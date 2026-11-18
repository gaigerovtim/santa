import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: { default: "Админка", template: "%s — Админка" }, robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex min-h-11 items-center gap-2 font-display text-lg font-bold">
            <span className="font-mono text-xs text-santa" aria-hidden="true">●</span>
            Админка
          </Link>
          <Link href="/" className="text-sm text-muted hover:text-garland">На сайт</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
