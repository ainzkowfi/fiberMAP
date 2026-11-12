import QRCode from "qrcode";

export interface QrFrame {
  index: number;
  totalCount: number;
  transferId: string;
  payload: string;
  crc32: number;
  /** The payload is deflate-compressed and base64url encoded. */
  compressed: boolean;
}

/** What a scanned frame carries once its envelope has been read. */
export interface FrameEnvelope {
  transferId: string;
  index: number;
  totalCount: number;
  crc32: number;
  payload: string;
  compressed: boolean;
}

/** CRC-32 (IEEE) over UTF-8 bytes. */
export function crc32(text: string): number {
  const bytes = new TextEncoder().encode(text);
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Deflates the payload and encodes it as base64url.
 *
 * A bundle is mostly JSON, which squashes well. The frames the crew has to
 * scan drop from a handful to one or two, and the QR stays readable in bad
 * light because there is less of it.
 */
export async function compressPayload(text: string): Promise<string> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Undoes compressPayload. */
export async function decompressPayload(data: string): Promise<string> {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Response(stream).text();
}

/**
 * Splits a payload into QR-sized frames.
 *
 * The whole payload is compressed first and the compressed text is what gets
 * split, so the checksum on each frame covers what the scanner actually read.
 */
export async function chunkPayload(
  fullText: string,
  chunkSize = 1200,
): Promise<QrFrame[]> {
  const transferId = Math.abs(hashString(fullText))
    .toString(16)
    .slice(-6)
    .toUpperCase()
    .padStart(6, "0");
  const compressed = await compressPayload(fullText);
  const chunks: string[] = [];
  for (let i = 0; i < compressed.length; i += chunkSize) {
    chunks.push(compressed.slice(i, i + chunkSize));
  }
  const total = Math.max(1, chunks.length);

  return chunks.map((chunk, idx) => ({
    index: idx + 1,
    totalCount: total,
    transferId,
    payload: chunk,
    crc32: crc32(chunk),
    compressed: true,
  }));
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Renders a frame as a real, scannable QR code. The envelope keeps the
 * transfer id, frame position and checksum in the payload so the receiving
 * app can reassemble and verify.
 */
export async function frameToDataUrl(frame: QrFrame): Promise<string> {
  const envelope = JSON.stringify({
    t: frame.transferId,
    i: frame.index,
    n: frame.totalCount,
    c: frame.crc32,
    p: frame.payload,
    // z marks the payload as deflate-compressed. Frames without it are the
    // older plain ones, which are still read.
    ...(frame.compressed ? { z: 1 } : {}),
  });
  return QRCode.toDataURL(envelope, {
    errorCorrectionLevel: "L",
    margin: 2,
    width: 512,
    color: { dark: "#16242B", light: "#FFFFFF" },
  });
}

/**
 * Reads a scanned frame. Returns null for anything that is not a fiberMAP
 * frame, so a QR code of something else in the room is ignored rather than
 * breaking the transfer.
 */
export function parseFrameEnvelope(text: string): FrameEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const raw = parsed as Record<string, unknown>;
  if (typeof raw.t !== "string" || typeof raw.p !== "string") return null;
  if (typeof raw.i !== "number" || typeof raw.n !== "number") return null;
  if (typeof raw.c !== "number") return null;
  return {
    transferId: raw.t,
    index: raw.i,
    totalCount: raw.n,
    crc32: raw.c,
    payload: raw.p,
    compressed: raw.z === 1,
  };
}

export interface Reassembled {
  ok: boolean;
  payload: string;
  error?: string;
}

/**
 * Reassembles frames received in any order, with duplicates, and validates
 * every checksum before the payload is handed on.
 */
export async function reassembleFrames(frames: FrameEnvelope[]): Promise<Reassembled> {
  if (frames.length === 0) return { ok: false, payload: "", error: "No frames" };
  const transferId = frames[0].transferId;
  const totalCount = frames[0].totalCount;

  // The same frame can be scanned twice. Keep the first copy of each index.
  const byIndex = new Map<number, FrameEnvelope>();
  for (const frame of frames) {
    if (frame.transferId !== transferId || frame.totalCount !== totalCount) continue;
    if (!byIndex.has(frame.index)) byIndex.set(frame.index, frame);
  }

  if (byIndex.size !== totalCount) {
    return {
      ok: false,
      payload: "",
      error: `Expected ${totalCount} frames, got ${byIndex.size}`,
    };
  }

  const ordered = [...byIndex.values()].sort((a, b) => a.index - b.index);
  for (const frame of ordered) {
    if (crc32(frame.payload) !== frame.crc32) {
      return { ok: false, payload: "", error: `CRC mismatch on frame ${frame.index}` };
    }
  }

  const joined = ordered.map((frame) => frame.payload).join("");
  if (!ordered[0].compressed) {
    return { ok: true, payload: joined };
  }
  try {
    return { ok: true, payload: await decompressPayload(joined) };
  } catch {
    return { ok: false, payload: "", error: "The frames could not be unpacked" };
  }
}
