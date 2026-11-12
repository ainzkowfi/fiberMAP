import QRCode from "qrcode";

export interface QrFrame {
  index: number;
  totalCount: number;
  transferId: string;
  payload: string;
  crc32: number;
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
 * Splits a payload into QR-sized frames. The Android app used 180-char chunks
 * because it drew its own matrix; a real QR code holds ~2.9 KB at version 40-L,
 * so we use much larger frames to cut the number of screens a tech must scan.
 */
export function chunkPayload(fullText: string, chunkSize = 1200): QrFrame[] {
  const transferId = Math.abs(hashString(fullText))
    .toString(16)
    .slice(-6)
    .toUpperCase()
    .padStart(6, "0");
  const chunks: string[] = [];
  for (let i = 0; i < fullText.length; i += chunkSize) {
    chunks.push(fullText.slice(i, i + chunkSize));
  }
  const total = Math.max(1, chunks.length);

  return chunks.map((chunk, idx) => ({
    index: idx + 1,
    totalCount: total,
    transferId,
    payload: chunk,
    crc32: crc32(chunk),
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
  });
  return QRCode.toDataURL(envelope, {
    errorCorrectionLevel: "L",
    margin: 2,
    width: 512,
    color: { dark: "#16242B", light: "#FFFFFF" },
  });
}

/** Reassembles frames received out of order and validates the checksums. */
export function reassembleFrames(
  frames: Array<{
    transferId: string;
    index: number;
    totalCount: number;
    crc32: number;
    payload: string;
  }>,
): { ok: boolean; payload: string; error?: string } {
  if (frames.length === 0) return { ok: false, payload: "", error: "No frames" };
  const transferId = frames[0].transferId;
  const totalCount = frames[0].totalCount;
  const same = frames.filter(
    (f) => f.transferId === transferId && f.totalCount === totalCount,
  );
  if (same.length !== totalCount) {
    return {
      ok: false,
      payload: "",
      error: `Expected ${totalCount} frames, got ${same.length}`,
    };
  }
  same.sort((a, b) => a.index - b.index);
  for (const f of same) {
    if (crc32(f.payload) !== f.crc32) {
      return { ok: false, payload: "", error: `CRC mismatch on frame ${f.index}` };
    }
  }
  return { ok: true, payload: same.map((f) => f.payload).join("") };
}
