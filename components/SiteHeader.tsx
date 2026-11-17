import Link from "next/link";
import { site } from "@/config/site";
import { ButtonLink } from "./Button";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 font-display text-lg font-bold"
          aria-label={`${site.name} — на главную`}
        >
          <span className="font-mono text-xs text-santa" aria-hidden="true">
            ●
          </span>
          {site.shortName}
          <span className="hidden font-sans text-sm font-normal text-muted sm:inline">у вашей ёлки</span>
        </Link>
        <div className="hidden md:block">
          <ButtonLink href="/create" variant="secondary">
            Сделать видео
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
