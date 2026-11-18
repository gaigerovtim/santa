import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { delayedEmail, paidEmail, readyEmail } from "@/emails/templates";
import { escapeHtml } from "@/emails/layout";
import { cameraFilter, DEFAULT_CAMERA, drawtextSafe, postprocessCamera } from "@/worker/steps/postprocess";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const data = { orderUrl: "http://localhost:3000/order/abc", amountRub: 390 };

describe("письма", () => {
  it.each([
    ["оплачено", paidEmail, "Дед Мороз уже в пути"],
    ["готово", readyEmail, "Ваше видео готово"],
    ["задержка", delayedEmail, "Мы уже разбираемся"],
  ] as const)("«%s»: тема, HTML и текстовая версия со ссылкой на заказ", (_n, tpl, title) => {
    const m = tpl(data);
    expect(m.subject.length).toBeGreaterThan(10);
    expect(m.html).toContain(title);
    expect(m.html).toContain('href="http://localhost:3000/order/abc"');
    expect(m.text).toContain("http://localhost:3000/order/abc");
    expect(m.text).not.toContain("<");
  });

  it("в письме об оплате — сумма", () => {
    expect(paidEmail(data).text).toContain("390 ₽");
  });

  it("HTML экранируется", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  });
});

describe("постобработка: фильтр камеры", () => {
  const filter = cameraFilter(DEFAULT_CAMERA, "/fonts/mono.ttf");

  it("чёрно-белый кадр, шум, виньетка", () => {
    expect(filter).toContain("hue=s=0");
    expect(filter).toContain("noise=");
    expect(filter).toContain("vignette");
  });

  it("таймкод идёт от 31.12.2026 03:14:07", () => {
    expect(filter).toContain(`gmtime\\:${Date.UTC(2026, 11, 31, 3, 14, 7) / 1000}`);
  });

  it("подпись камеры и метка REC", () => {
    expect(filter).toContain("КАМЕРА 2 · ГОСТИНАЯ");
    expect(filter).toContain("text='REC'");
  });

  it("опасные для ffmpeg символы в подписи убираются", () => {
    expect(drawtextSafe("КАМ'ЕРА: 100% \\ X")).toBe("КАМ’ЕРА 100  X");
  });

  const hasFfmpeg = (() => {
    try {
      execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  // Локально на Mac ffmpeg может не быть — тогда тест проверяется в образе воркера.
  it.skipIf(!hasFfmpeg)("настоящий ffmpeg: ролик-заглушка → MP4 1280×720 со звуком", async () => {
    const clip = await readFile(path.join(process.cwd(), "assets", "mock", "clip.mp4"));
    const out = await postprocessCamera(clip);
    const file = path.join(tmpdir(), `pp-test-${Date.now()}.mp4`);
    await writeFile(file, out);
    const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "compact", file]).toString();
    await rm(file, { force: true });
    expect(probe).toContain("codec_name=h264|width=1280|height=720");
    expect(probe).toContain("codec_name=aac");
  }, 60_000);
});
