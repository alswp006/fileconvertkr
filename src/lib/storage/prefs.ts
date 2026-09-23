import { getItem, setItem } from '@/lib/storage';
import { historyRepo } from '@/lib/storage/historyRepo';
import type { ConvertPrefs, ConvertPrefsValues, ToolType } from '@/lib/types';

const KEY = 'fileconvertkr:prefs:v1';

const DEFAULTS: ConvertPrefsValues = {
  heicFormat: 'jpg',
  compressTargetKB: 500,
  pdfImageFormat: 'jpg',
  pdfImageScale: 1.5,
};

function isValidIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

function normalize(raw: Record<string, unknown> | null): ConvertPrefs {
  const heicFormat = raw?.heicFormat === 'png' ? 'png' : DEFAULTS.heicFormat;
  const compressTargetKB =
    typeof raw?.compressTargetKB === 'number' && raw.compressTargetKB >= 50 && raw.compressTargetKB <= 10240
      ? raw.compressTargetKB
      : DEFAULTS.compressTargetKB;
  const pdfImageFormat = raw?.pdfImageFormat === 'png' ? 'png' : DEFAULTS.pdfImageFormat;
  const pdfImageScale = raw?.pdfImageScale === 2 ? 2 : DEFAULTS.pdfImageScale;
  const createdAt = isValidIso(raw?.createdAt) ? (raw!.createdAt as string) : null;
  const updatedAt = isValidIso(raw?.updatedAt) ? (raw!.updatedAt as string) : null;

  return { id: 'prefs', createdAt, updatedAt, heicFormat, compressTargetKB, pdfImageFormat, pdfImageScale };
}

function load(): ConvertPrefs {
  const raw = getItem<Record<string, unknown>>(KEY);
  if (!raw || typeof raw !== 'object') {
    return { id: 'prefs', createdAt: null, updatedAt: null, ...DEFAULTS };
  }
  return normalize(raw);
}

function save(partial: Partial<ConvertPrefsValues>): void {
  const current = load();
  const merged: ConvertPrefsValues = {
    heicFormat: partial.heicFormat ?? current.heicFormat,
    compressTargetKB: partial.compressTargetKB ?? current.compressTargetKB,
    pdfImageFormat: partial.pdfImageFormat ?? current.pdfImageFormat,
    pdfImageScale: partial.pdfImageScale ?? current.pdfImageScale,
  };

  const changed = (Object.keys(merged) as (keyof ConvertPrefsValues)[]).some(
    (key) => merged[key] !== current[key]
  );
  if (!changed) return;

  const now = new Date().toISOString();
  const next: ConvertPrefs = {
    id: 'prefs',
    createdAt: current.createdAt ?? now,
    updatedAt: now,
    ...merged,
  };
  setItem(KEY, next);
}

export const prefs = { load, save };

// contract.ts prefsStoreFn 호환 어댑터. compressTargetKB/historyRepo가 실제 데이터 소스다.
async function getTargetSize(): Promise<number> {
  return load().compressTargetKB;
}

async function setTargetSize(kb: number): Promise<void> {
  save({ compressTargetKB: kb });
}

async function getLastToolType(): Promise<ToolType | null> {
  const [latest] = historyRepo.load();
  return latest?.tool ?? null;
}

export const prefsStore = { getTargetSize, setTargetSize, getLastToolType };
