/** Вызовы API из браузера: загрузка фото с прогрессом и создание заказа. */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Сеть недоступна или запрос оборвался — можно повторить. */
export class NetworkError extends Error {
  constructor() {
    super("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз");
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    const err = data?.error;
    throw new ApiError(
      err?.message ?? "Что-то пошло не так. Попробуйте ещё раз",
      err?.code ?? "unknown",
      res.status,
      err?.fields,
    );
  }
  return data as T;
}

interface UploadTicket {
  key: string;
  url: string;
  fields: Record<string, string>;
}

/** Загружает фото в хранилище по подписанной форме. Возвращает ключ файла. */
export async function uploadPhoto(
  blob: Blob,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const ticket = await postJson<UploadTicket>("/api/upload-url", {
    contentType: blob.type,
    size: blob.size,
  });

  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
  form.append("file", blob); // файл — последним полем формы

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", ticket.url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError("Хранилище не приняло фото. Попробуйте ещё раз", "storage", xhr.status));
    };
    xhr.onerror = () => reject(new NetworkError());
    xhr.onabort = () => reject(new DOMException("Загрузка отменена", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });

  onProgress(1);
  return ticket.key;
}

export function createOrder(body: {
  photoKey: string;
  email: string;
  consentPersonal: boolean;
  consentOffer: boolean;
}) {
  return postJson<{ token: string; url: string }>("/api/orders", body);
}
