export function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

/**
 * 네이티브 파일 저장. WebView 밖(브라우저/검수자 PC/jsdom)에서는 SDK가 throw하므로
 * 호출부(deliverFile)가 실패를 잡아 다운로드 링크로 폴백한다 — 여기서는 삼키지 않는다.
 */
export async function saveBase64Data(params: {
  fileName: string;
  mimeType: string;
  data: string;
}): Promise<void> {
  const { saveBase64Data: sdkSaveBase64Data } = await import("@apps-in-toss/web-framework");
  await sdkSaveBase64Data({ data: params.data, fileName: params.fileName, mimeType: params.mimeType });
}
