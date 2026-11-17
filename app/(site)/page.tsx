import { site } from "@/config/site";

// Заготовка главной. Полная страница со всеми блоками — этап 2.
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="font-mono text-sm tracking-widest text-garland">● REC · КАМЕРА 2</p>
      <h1 className="text-3xl font-semibold sm:text-5xl">{site.name}</h1>
      <p className="max-w-xl text-muted">{site.description}</p>
      <p className="text-sm text-muted">Сайт в разработке.</p>
    </main>
  );
}
