import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { site } from "@/config/site";
import { renderMarkdown } from "@/lib/markdown";

type DocName = "offer" | "privacy";

/** Документы статичны: читаем файл один раз при сборке. */
async function loadDoc(name: DocName): Promise<string> {
  "use cache";
  cacheLife("max");
  return readFile(path.join(process.cwd(), "content", `${name}.md`), "utf8");
}

/** Страница документа из content/<name>.md. Тексты — черновики до согласования с юристом. */
export async function LegalPage({ name }: { name: DocName }) {
  const source = await loadDoc(name);
  const filled = source
    .replaceAll("{{SITE}}", site.name)
    .replaceAll("{{SELLER}}", site.requisites.name)
    .replaceAll("{{INN}}", site.requisites.inn)
    .replaceAll("{{EMAIL}}", site.contacts.email)
    .replaceAll("{{PRICE}}", String(site.mainPriceRub));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-display text-lg font-bold">
        <span className="font-mono text-xs text-santa" aria-hidden="true">
          ●
        </span>
        {site.shortName}
      </Link>
      <p className="mt-6">
        <span className="inline-block rounded-full border border-garland/40 px-3 py-1 font-mono text-xs text-garland uppercase">
          Черновик
        </span>
      </p>
      <article className="mt-4 text-text/90">{renderMarkdown(filled)}</article>
    </main>
  );
}
