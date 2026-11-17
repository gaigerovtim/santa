import Link from "next/link";
import { site } from "@/config/site";

export function SiteFooter() {
  const { contacts, requisites } = site;
  return (
    <footer className="mt-auto border-t border-line bg-surface/40">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-display text-base font-bold text-text">{site.name}</p>
          <p className="mt-2 max-w-xs">Запись с камеры наблюдения, где Дед Мороз приносит подарок.</p>
        </div>

        <nav aria-label="Документы и контакты">
          <ul className="space-y-1">
            <li>
              <a className="inline-flex min-h-11 items-center hover:text-garland" href={`mailto:${contacts.email}`}>
                {contacts.email}
              </a>
            </li>
            <li>
              <Link className="inline-flex min-h-11 items-center hover:text-garland" href="/offer">
                Договор-оферта
              </Link>
            </li>
            <li>
              <Link className="inline-flex min-h-11 items-center hover:text-garland" href="/privacy">
                Политика конфиденциальности
              </Link>
            </li>
          </ul>
        </nav>

        <div className="space-y-1">
          <p>{requisites.name}</p>
          <p>{requisites.status}</p>
          <p>ИНН {requisites.inn}</p>
          <p className="pt-3 font-mono text-xs">© {site.copyrightYear}</p>
        </div>
      </div>
    </footer>
  );
}
