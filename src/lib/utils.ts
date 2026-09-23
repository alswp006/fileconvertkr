export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

export function formatCurrency(n: number, currency = 'KRW'): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(n);
}

/**
 * 1,048,576B 미만은 KB 정수 반올림(예: 498KB), 그 이상은 MB 소수 첫째 자리(예: 7.0MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
