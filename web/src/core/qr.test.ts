import { describe, expect, it } from "vitest";
import {
  chunkPayload,
  compressPayload,
  crc32,
  decompressPayload,
  parseFrameEnvelope,
  reassembleFrames,
  type FrameEnvelope,
} from "./qr";

/** Text that does not compress, so the frames really do span several codes. */
function pseudoRandom(seed: number, length: number): string {
  let state = seed;
  let out = "";
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) % 2147483648;
    out += String.fromCharCode(33 + (state % 90));
  }
  return out;
}

const payload = JSON.stringify({
  format: "fiberMAP-bundle",
  version: 2,
  lines: [1, 2, 3],
}) + pseudoRandom(7, 4000);

describe("qr transfer", () => {
  it("computes a stable CRC-32", () => {
    expect(crc32("fiberMAP")).toBe(crc32("fiberMAP"));
    expect(crc32("fiberMAP")).not.toBe(crc32("fiberMaP"));
    expect(crc32("")).toBe(0);
  });

  it("compresses a payload and puts it back", async () => {
    const compressed = await compressPayload(payload);
    expect(compressed.length).toBeLessThan(payload.length);
    expect(compressed).not.toContain("+");
    expect(compressed).not.toContain("/");
    expect(await decompressPayload(compressed)).toBe(payload);
  });

  it("chunks a payload into frames that carry the compressed flag", async () => {
    const frames = await chunkPayload(payload);
    expect(frames.length).toBeGreaterThan(1);
    expect(frames[0].index).toBe(1);
    expect(frames[frames.length - 1].index).toBe(frames.length);
    expect(frames.every((f) => f.totalCount === frames.length)).toBe(true);
    expect(frames.every((f) => f.compressed)).toBe(true);
  });

  it("reads a frame envelope back", () => {
    const envelope = parseFrameEnvelope(
      JSON.stringify({ t: "ABC123", i: 2, n: 7, c: 123, p: "abc", z: 1 }),
    );
    expect(envelope).not.toBeNull();
    expect(envelope?.transferId).toBe("ABC123");
    expect(envelope?.index).toBe(2);
    expect(envelope?.compressed).toBe(true);
    expect(parseFrameEnvelope("not a frame")).toBeNull();
    expect(parseFrameEnvelope('{"hello":"world"}')).toBeNull();
  });

  it("reassembles frames that arrive out of order", async () => {
    const frames = await chunkPayload(payload);
    const shuffled = [...frames].reverse();
    const result = await reassembleFrames(shuffled);
    expect(result.ok).toBe(true);
    expect(result.payload).toBe(payload);
  });

  it("accepts the same frame scanned twice", async () => {
    const frames = await chunkPayload(payload);
    const withDuplicates = [...frames, frames[0], frames[frames.length - 1], frames[0]];
    const result = await reassembleFrames(withDuplicates);
    expect(result.ok).toBe(true);
    expect(result.payload).toBe(payload);
  });

  it("refuses a set that is missing a frame", async () => {
    const frames = await chunkPayload(payload);
    const result = await reassembleFrames(frames.slice(0, frames.length - 1));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Expected/);
  });

  it("refuses a corrupted frame", async () => {
    const frames = await chunkPayload("hello world");
    const broken = [{ ...frames[0], crc32: frames[0].crc32 ^ 0xff }];
    const result = await reassembleFrames(broken);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/CRC/);
  });

  it("still reads frames that were sent without compression", async () => {
    const plain = "a plain payload from the older app";
    const frame: FrameEnvelope = {
      transferId: "OLD001",
      index: 1,
      totalCount: 1,
      crc32: crc32(plain),
      payload: plain,
      compressed: false,
    };
    const result = await reassembleFrames([frame]);
    expect(result.ok).toBe(true);
    expect(result.payload).toBe(plain);
  });
});
