/**
 * Client helper: trigger browser download from base64 payload (server action).
 */

export type FileDownloadPayload = {
  filename: string;
  contentType: string;
  base64: string;
};

export function triggerBrowserDownload(payload: FileDownloadPayload): void {
  const binary = atob(payload.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: payload.contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payload.filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
