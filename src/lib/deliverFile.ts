import type { ConversionOutput } from "./types";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function fallbackDownload(output: ConversionOutput): void {
  const url = URL.createObjectURL(output.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = output.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

/**
 * deliverFile: Save base64-encoded file to native storage.
 *
 * - Call saveBase64Data with { fileName, mimeType, data (base64 without prefix) }
 * - mimeType determined from output.mimeType
 * - On saveBase64Data failure: fallback to anchor click for download
 */
export async function deliverFile(output: ConversionOutput): Promise<void> {
  const data = await blobToBase64(output.blob);
  try {
    const { saveBase64Data } = await import("./storage");
    await saveBase64Data({
      fileName: output.fileName,
      mimeType: output.mimeType,
      data,
    });
  } catch {
    fallbackDownload(output);
  }
}
