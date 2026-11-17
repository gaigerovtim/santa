import { SiteFooter } from "@/components/SiteFooter";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-garland px-4 py-2 font-semibold text-night focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Перейти к содержанию
      </a>
      <div id="main" className="flex flex-1 flex-col">
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
