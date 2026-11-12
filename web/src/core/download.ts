export interface DownloadProgress {
  received: number;
  total: number;
}

/**
 * Reads a response body as a Blob, reporting bytes as they arrive.
 *
 * On a weak connection the difference between a 9 second download and a 9
 * minute one is the difference between the crew waiting and the crew giving
 * up, so the progress has to be real rather than a spinner.
 */
export async function readBlobWithProgress(
  response: Response,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<Blob> {
  const total = Number(response.headers.get("content-length")) || 0;

  if (!response.body || !onProgress) {
    const blob = await response.blob();
    onProgress?.({ received: blob.size, total: total || blob.size });
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress({ received, total });
  }

  return new Blob(chunks as BlobPart[], {
    type: response.headers.get("content-type") ?? "application/octet-stream",
  });
}
