/**
 * Stream-bounded JSON body reader for report API endpoints.
 * Enforces the 128 KB request body cap before buffering/parsing JSON.
 */

export const MAX_REPORT_BODY_BYTES = 128 * 1024;

export type BodyReadResult =
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 413; error: string };

export async function readJsonBodyWithLimit(
  req: Request,
  maxBytes = MAX_REPORT_BODY_BYTES
): Promise<BodyReadResult> {
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return {
        ok: false,
        status: 413,
        error: 'Request payload exceeds 128 KB limit',
      };
    }
  }

  let rawText = '';

  if (req.body) {
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            await reader.cancel().catch(() => {});
            return {
              ok: false,
              status: 413,
              error: 'Request payload exceeds 128 KB limit',
            };
          }
          chunks.push(value);
        }
      }
    } catch {
      return {
        ok: false,
        status: 400,
        error: 'Failed to read request body',
      };
    }

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    rawText = new TextDecoder().decode(merged);
  } else {
    try {
      rawText = await req.text();
    } catch {
      return {
        ok: false,
        status: 400,
        error: 'Failed to read request body',
      };
    }
    if (new TextEncoder().encode(rawText).byteLength > maxBytes) {
      return {
        ok: false,
        status: 413,
        error: 'Request payload exceeds 128 KB limit',
      };
    }
  }

  try {
    const data: unknown = JSON.parse(rawText);
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Invalid JSON request body',
    };
  }
}
