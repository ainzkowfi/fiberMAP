import { describe, expect, it } from "vitest";
import { readBlobWithProgress } from "./download";

/** Builds a Response whose body streams the given chunks. */
function streamingResponse(chunks: number[], total?: number) {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode("x".repeat(chunks[index])));
      index++;
    },
  });
  const headers = new Headers();
  headers.set("content-length", String(total ?? chunks.reduce((a, b) => a + b, 0)));
  headers.set("content-type", "application/octet-stream");
  return new Response(body, { headers });
}

describe("download progress", () => {
  it("reports bytes as they arrive", async () => {
    const seen: number[] = [];
    const blob = await readBlobWithProgress(streamingResponse([100, 200, 300]), (p) =>
      seen.push(p.received),
    );

    expect(seen).toEqual([100, 300, 600]);
    expect(blob.size).toBe(600);
  });

  it("reports the total from content-length", async () => {
    const totals: number[] = [];
    await readBlobWithProgress(streamingResponse([50, 50], 4096), (p) =>
      totals.push(p.total),
    );
    expect(totals[0]).toBe(4096);
  });

  it("still returns the whole body when no callback is given", async () => {
    const blob = await readBlobWithProgress(streamingResponse([10, 20, 30]));
    expect(blob.size).toBe(60);
  });

  it("reports once at the end when there is no readable stream", async () => {
    const seen: Array<{ received: number; total: number }> = [];
    const response = new Response("hello", {
      headers: { "content-length": "5" },
    });
    // Response.body exists here, so force the fallback by hiding it.
    Object.defineProperty(response, "body", { value: null });
    await readBlobWithProgress(response, (p) => seen.push(p));
    expect(seen).toEqual([{ received: 5, total: 5 }]);
  });
});
