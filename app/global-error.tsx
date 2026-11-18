"use client";

/** Последний рубеж: ошибка в корневом макете. Без общих стилей — всё внутри. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, minHeight: "100vh", background: "#0E1424", color: "#F5F1E8", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 16px" }}>
          <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>Что-то пошло не так</h1>
          <p style={{ color: "#A8B0C2", margin: "0 0 24px" }}>Попробуйте обновить страницу через минуту.</p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 48, padding: "0 24px", border: 0, borderRadius: 14, background: "#C8102E", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            Попробовать ещё раз
          </button>
        </main>
      </body>
    </html>
  );
}
