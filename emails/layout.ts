/**
 * Общий макет писем в стиле сайта: ночной фон, тёплая кнопка, «камерная» строка сверху.
 * Табличная вёрстка и инлайн-стили — так письмо одинаково выглядит в Gmail, Яндекс и Mail.ru.
 */
import { site } from "@/config/site";

export const colors = {
  night: "#0E1424",
  surface: "#182033",
  line: "#2C3752",
  santa: "#C8102E",
  garland: "#F2C46D",
  text: "#F5F1E8",
  muted: "#A8B0C2",
};

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

interface LayoutParams {
  preheader: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  footnote?: string;
}

export function renderLayout(p: LayoutParams): string {
  const font = "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  const mono = "'SFMono-Regular', Menlo, Consolas, monospace";
  const body = p.paragraphs
    .map((t) => `<p style="margin:0 0 16px;font:16px/1.55 ${font};color:${colors.text};">${escapeHtml(t)}</p>`)
    .join("");
  const button = p.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr>
         <td style="border-radius:14px;background:${colors.santa};">
           <a href="${escapeHtml(p.button.url)}" style="display:inline-block;padding:16px 28px;font:600 17px/1 ${font};color:#ffffff;text-decoration:none;border-radius:14px;">${escapeHtml(p.button.label)}</a>
         </td></tr></table>`
    : "";
  const footnote = p.footnote
    ? `<p style="margin:0;font:14px/1.5 ${font};color:${colors.muted};">${escapeHtml(p.footnote)}</p>`
    : "";

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>${escapeHtml(p.title)}</title></head>
<body style="margin:0;padding:0;background:${colors.night};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(p.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.night};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="padding:0 4px 16px;font:700 18px/1 Georgia, serif;color:${colors.text};">
        <span style="color:${colors.santa};font-size:12px;">&#9679;</span>&nbsp;${escapeHtml(site.shortName)}
      </td></tr>
      <tr><td style="background:${colors.surface};border:1px solid ${colors.line};border-radius:20px;padding:32px 28px;">
        <p style="margin:0 0 12px;font:600 12px/1 ${mono};letter-spacing:3px;text-transform:uppercase;color:${colors.garland};">${escapeHtml(p.eyebrow)}</p>
        <h1 style="margin:0 0 20px;font:700 28px/1.2 Georgia, 'Times New Roman', serif;color:${colors.text};">${escapeHtml(p.title)}</h1>
        ${body}${button}${footnote}
      </td></tr>
      <tr><td style="padding:20px 4px;font:13px/1.5 ${font};color:${colors.muted};">
        ${escapeHtml(site.name)} · ${escapeHtml(site.requisites.name)}, ИНН ${escapeHtml(site.requisites.inn)}<br>
        Вопросы — ответьте на это письмо или напишите на ${escapeHtml(site.contacts.email)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function renderText(p: LayoutParams): string {
  return [
    p.title,
    "",
    ...p.paragraphs.flatMap((t) => [t, ""]),
    ...(p.button ? [`${p.button.label}: ${p.button.url}`, ""] : []),
    ...(p.footnote ? [p.footnote, ""] : []),
    "—",
    `${site.name} · ${site.contacts.email}`,
  ].join("\n");
}
