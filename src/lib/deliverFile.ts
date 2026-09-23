import type { ConversionOutput } from "./types";

/**
 * deliverFile: Save base64-encoded file to native storage.
 *
 * - Call saveBase64Data with { fileName, mimeType, data (base64 without prefix) }
 * - mimeType determined from output.mimeType
 * - On saveBase64Data failure: fallback to anchor click for download
 */
export async function deliverFile(output: ConversionOutput): Promise<void> {
  // TODO: Implement
  throw new Error("deliverFile not yet implemented");
}
