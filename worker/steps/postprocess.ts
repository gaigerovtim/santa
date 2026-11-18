/**
 * Шаг postprocess, пресет camera: настоящая ffmpeg-обработка ролика под запись камеры наблюдения —
 * чёрно-белый кадр, шум, виньетка, идущий таймкод, мигающая метка REC, подпись камеры, звук.
 * Шрифт: assets/fonts/JetBrainsMono-Regular.ttf, если положить; иначе DejaVu Sans Mono из образа воркера.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ASSETS = path.join(process.cwd(), "assets");
const SFX = path.join(ASSETS, "sfx", "steps-bells.wav");
const FONT_CANDIDATES = [
  path.join(ASSETS, "fonts", "JetBrainsMono-Regular.ttf"),
  "/usr/share/fonts/dejavu/DejaVuSansMono.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
];

export interface CameraPreset {
  /** Подпись камеры в нижнем углу. */
  label: string;
  /** С какого момента идёт таймкод (UTC). По умолчанию — 31.12.2026 03:14:07. */
  startAt: Date;
  width: number;
  height: number;
}

export const DEFAULT_CAMERA: CameraPreset = {
  label: "КАМЕРА 2 · ГОСТИНАЯ",
  startAt: new Date(Date.UTC(2026, 11, 31, 3, 14, 7)),
  width: 1280,
  height: 720,
};

export function findFont(): string {
  const font = FONT_CANDIDATES.find((f) => existsSync(f));
  if (!font) throw new Error("Не найден моноширинный шрифт для таймкода (assets/fonts или DejaVu)");
  return font;
}

/**
 * Подпись камеры задаётся в конфиге, поэтому вместо многоуровневого экранирования ffmpeg
 * просто убираем символы, которые ломают фильтр: кавычку меняем на типографскую, \ % : удаляем.
 */
export function drawtextSafe(s: string) {
  return s.replace(/'/g, "’").replace(/[\\%:]/g, "");
}

/** Граф фильтров ffmpeg для пресета camera. Отдельная функция — чтобы проверять без ffmpeg. */
export function cameraFilter(preset: CameraPreset, font: string): string {
  const { width: w, height: h } = preset;
  const fs = Math.round(h / 24);
  const pad = Math.round(h / 22);
  const epoch = Math.floor(preset.startAt.getTime() / 1000);
  const text = `fontfile=${font}:fontsize=${fs}:fontcolor=white@0.92:borderw=2:bordercolor=black@0.6`;
  const dot = Math.round(fs * 0.55);
  return [
    `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,`,
    // ночная камера: без цвета, приподнятые тени, зерно, затемнённые края
    `hue=s=0,eq=contrast=1.08:brightness=0.06:gamma=1.35,`,
    `noise=alls=16:allf=t+u,vignette=PI/4.5,`,
    // таймкод: время начала + время от начала ролика
    `drawtext=${text}:x=w-tw-${pad}:y=${pad}:text='%{pts\\:gmtime\\:${epoch}\\:%d-%m-%Y  %H\\\\\\:%M\\\\\\:%S}',`,
    // мигающая метка записи и REC
    `drawbox=x=${pad}:y=${pad + Math.round((fs - dot) / 2)}:w=${dot}:h=${dot}:color=white@0.95:t=fill:enable='lt(mod(t\\,1)\\,0.6)',`,
    `drawtext=${text}:x=${pad + dot + Math.round(fs * 0.4)}:y=${pad}:text='REC',`,
    `drawtext=${text}:x=${pad}:y=h-th-${pad}:text='${drawtextSafe(preset.label)}',`,
    `format=yuv420p[v]`,
  ].join("\n");
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg: нет результата за ${timeoutMs / 1000} с`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg не запустился: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg завершился с кодом ${code}: ${stderr.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

/** Обрабатывает ролик и возвращает готовый MP4 (H.264 + AAC, faststart — играет сразу в браузере). */
export async function postprocessCamera(clip: Buffer, preset: CameraPreset = DEFAULT_CAMERA): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "santa-pp-"));
  try {
    const input = path.join(dir, "clip.mp4");
    const filter = path.join(dir, "camera.filter");
    const output = path.join(dir, "final.mp4");
    await writeFile(input, clip);
    await writeFile(filter, cameraFilter(preset, findFont()));

    const hasSfx = existsSync(SFX);
    const args = [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", input,
      ...(hasSfx ? ["-i", SFX] : []),
      "-filter_complex_script", filter,
      "-map", "[v]",
      ...(hasSfx ? ["-map", "1:a", "-c:a", "aac", "-b:a", "128k", "-shortest"] : ["-an"]),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      output,
    ];
    await run("ffmpeg", args, 5 * 60 * 1000);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
