import { toolMeta } from '@/lib/toolMeta';
import type { ToolType, ValidationError } from '@/lib/types';

function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx).toLowerCase();
}

function isSupportedType(file: File, meta: (typeof toolMeta)[ToolType]): boolean {
  const type = (file.type || '').toLowerCase();
  if (type && meta.mimeTypes.includes(type)) return true;
  return meta.extensions.includes(getExtension(file.name));
}

export function validateFiles(
  files: File[],
  tool: ToolType
): { accepted: File[]; errors: ValidationError[] } {
  const meta = toolMeta[tool];
  const errors: ValidationError[] = [];
  const candidates: File[] = [];

  for (const file of files) {
    if (!isSupportedType(file, meta)) {
      errors.push({ fileName: file.name, type: 'UNSUPPORTED_TYPE', message: meta.unsupportedTypeMessage });
      continue;
    }
    if (file.size > meta.maxFileSizeBytes) {
      errors.push({
        fileName: file.name,
        type: 'FILE_TOO_LARGE',
        message: `파일당 최대 ${meta.maxFileSizeBytes / (1024 * 1024)}MB까지 선택할 수 있어요`,
      });
      continue;
    }
    candidates.push(file);
  }

  let limited = candidates;
  if (candidates.length > meta.maxFiles) {
    limited = candidates.slice(0, meta.maxFiles);
    errors.push({
      fileName: '',
      type: 'TOO_MANY_FILES',
      message: `한 번에 최대 ${meta.maxFiles}개까지 선택할 수 있어요`,
    });
  }

  const accepted: File[] = [];
  let totalBytes = 0;
  let totalExceeded = false;
  for (const file of limited) {
    if (totalBytes + file.size <= meta.maxTotalSizeBytes) {
      accepted.push(file);
      totalBytes += file.size;
    } else {
      totalExceeded = true;
    }
  }
  if (totalExceeded) {
    errors.push({
      fileName: '',
      type: 'TOTAL_TOO_LARGE',
      message: '전체 용량은 최대 100MB까지 가능해요',
    });
  }

  return { accepted, errors };
}
