/** Единый формат ответов API. */
export function jsonError(status: number, code: string, message: string, extra?: object) {
  return Response.json({ ok: false, error: { code, message, ...extra } }, { status });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
