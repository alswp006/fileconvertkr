import { getItem, removeItem } from '@/lib/storage';
import type { HistoryEntry, ToolType } from '@/lib/types';

const KEY = 'fileconvertkr:history:v1';
const MAX_ENTRIES = 100;
const EVICT_ON_QUOTA = 20;
const MAX_NAMES = 5;
const MAX_NAME_LENGTH = 40;

function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizeNames(names: string[] | undefined): string[] {
  return (names ?? []).slice(0, MAX_NAMES).map((name) => {
    const chars = Array.from(name);
    if (chars.length <= MAX_NAME_LENGTH) return name;
    return chars.slice(0, MAX_NAME_LENGTH - 1).join('') + '…';
  });
}

function isQuotaExceeded(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'QuotaExceededError';
}

// localStorage.setItem을 프로토타입 메서드로 호출한다. 진짜 브라우저 Storage에서는 직접 호출과
// 동일하게 동작하지만, this가 Storage 인스턴스가 아니면(테스트 더블 등) 여기서 걸러
// 일반 호출로 넘어간다 — QuotaExceededError는 여기서 가로채지 않고 그대로 던져 재시도 로직으로 보낸다.
function rawSetItem(key: string, json: string): void {
  try {
    Storage.prototype.setItem.call(localStorage, key, json);
  } catch (err) {
    if (isQuotaExceeded(err)) throw err;
    localStorage.setItem(key, json);
  }
}

function load(): HistoryEntry[] {
  const raw = getItem<HistoryEntry[]>(KEY);
  return Array.isArray(raw) ? raw : [];
}

function persist(entries: HistoryEntry[]): { ok: boolean } {
  try {
    rawSetItem(KEY, JSON.stringify(entries));
    return { ok: true };
  } catch (err) {
    if (!isQuotaExceeded(err)) return { ok: false };
    try {
      const trimmed = entries.slice(0, Math.max(0, entries.length - EVICT_ON_QUOTA));
      rawSetItem(KEY, JSON.stringify(trimmed));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}

export type HistoryAppendInput = Pick<HistoryEntry, 'tool' | 'inputNames' | 'inputCount'> &
  Partial<Omit<HistoryEntry, 'id' | 'createdAt' | 'tool' | 'inputNames' | 'inputCount'>>;

function append(entry: HistoryAppendInput): { ok: boolean } {
  const current = load();
  const normalized: HistoryEntry = {
    id: createId(),
    createdAt: new Date().toISOString(),
    tool: entry.tool as ToolType,
    status: entry.status ?? 'success',
    inputCount: entry.inputCount,
    outputCount: entry.outputCount ?? entry.inputCount,
    failedCount: entry.failedCount ?? 0,
    inputTotalBytes: entry.inputTotalBytes ?? 0,
    outputTotalBytes: entry.outputTotalBytes ?? 0,
    inputNames: normalizeNames(entry.inputNames),
    outputNames: normalizeNames(entry.outputNames),
  };
  const next = [normalized, ...current].slice(0, MAX_ENTRIES);
  return persist(next);
}

function clear(): void {
  removeItem(KEY);
}

export const historyRepo = { append, load, clear };
