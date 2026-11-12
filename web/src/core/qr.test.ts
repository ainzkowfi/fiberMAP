import { describe, expect, it } from "vitest";
import { crc32, chunkPayload, reassembleFrames } from "./qr";

describe("qr transfer", () => {
  it("computes a stable CRC-32", () => {
    expect(crc32("fiberMAP")).toBe(crc32("fiberMAP"));
    expect(crc32("fiberMAP")).not.toBe(crc32("fiberMaP"));
    expect(crc32("")).toBe(0);
  });

  it("chunks a payload into frames", () => {
    const frames = chunkPayload("x".repeat(2500));
    expect(frames).toHaveLength(3);
    expect(frames[0].index).toBe(1);
    expect(frames[2].index).toBe(3);
    expect(frames.every((f) => f.totalCount === 3)).toBe(true);
  });

  it("reassembles frames in any order and validates checksums", () => {
    const payload = JSON.stringify({ lines: [1, 2, 3] }).repeat(600);
    const frames = chunkPayload(payload);
    expect(frames.length).toBeGreaterThan(1);
    const shuffled = [frames[1], frames[0]];
    const result = reassembleFrames(shuffled);
    expect(result.ok).toBe(false); // only half the frames are present
    expect(result.error).toMatch(/Expected/);
  });

  it("reassembles a complete shuffled set", () => {
    const payload = JSON.stringify({ lines: [1, 2, 3] }).repeat(600);
    const frames = chunkPayload(payload);
    const result = reassembleFrames([...frames].reverse());
    expect(result.ok).toBe(true);
    expect(result.payload).toBe(payload);
  });

  it("rejects a corrupted frame", () => {
    const frames = chunkPayload("hello world");
    const broken = [{ ...frames[0], crc32: frames[0].crc32 ^ 0xff }];
    const result = reassembleFrames(broken);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/CRC/);
  });
});
