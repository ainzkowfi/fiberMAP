/**
 * Storage durability and the backup file.
 *
 * The records live in IndexedDB, which the browser is free to throw away when
 * the phone runs out of room. Asking for persistence buys a promise that the
 * browser will not clear the data on its own, and a backup file is the copy
 * that survives even that.
 */

/** Asks the browser to keep this site's data when it runs out of room. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Whether the browser has already promised to keep the data. */
export async function isPersisted(): Promise<boolean> {
  try {
    if (!navigator.storage?.persisted) return false;
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

/** Gzips text. A backup of the province is a few hundred kilobytes this way. */
export async function gzipText(text: string): Promise<Blob> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Blob([buffer], { type: "application/gzip" });
}

/** Reads a gzipped file back into text. */
export async function gunzipText(blob: Blob): Promise<string> {
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** The name a backup file gets: fibermap-YYYY-MM-DD.fmap */
export function backupFileName(when = new Date()): string {
  return `fibermap-${when.toISOString().slice(0, 10)}.fmap`;
}

/** Hands a file to the phone: the share sheet if it takes files, a download if not. */
export async function shareOrDownload(
  file: File,
  title: string,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.canShare?.({ files: [file] }) && typeof navigator.share === "function") {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (err) {
      // The crew closed the share sheet. That is a choice, not a failure.
      if ((err as Error).name === "AbortError") return "cancelled";
      // The share sheet is not usable here. A backup that never gets written
      // is worse than one that lands as a download, so fall through.
    }
  }
  downloadBlob(file, file.name);
  return "downloaded";
}

/** Saves a file to the phone. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
