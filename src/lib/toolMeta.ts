import type { ToolType } from '@/lib/types';

export interface ToolMetaEntry {
  tool: ToolType;
  route: string;
  title: string;
  subtitle: string;
  accept: string;
  extensions: string[];
  mimeTypes: string[];
  minFiles: number;
  maxFiles: number;
  maxFileSizeBytes: number;
  maxTotalSizeBytes: number;
  unsupportedTypeMessage: string;
}

export const TOOL_ORDER: ToolType[] = ['heic', 'compress', 'pdf-merge', 'pdf-to-image', 'pdf-split'];

const MB = 1024 * 1024;

export const toolMeta: Record<ToolType, ToolMetaEntry> = {
  heic: {
    tool: 'heic',
    route: '/convert/heic',
    title: 'HEIC → JPG/PNG',
    subtitle: '아이폰 사진을 어디서나 열리게',
    accept: '.heic,.heif,image/heic,image/heif',
    extensions: ['.heic', '.heif'],
    mimeTypes: ['image/heic', 'image/heif'],
    minFiles: 1,
    maxFiles: 20,
    maxFileSizeBytes: 30 * MB,
    maxTotalSizeBytes: 100 * MB,
    unsupportedTypeMessage: 'HEIC 파일만 선택할 수 있어요',
  },
  compress: {
    tool: 'compress',
    route: '/convert/compress',
    title: '이미지 용량 줄이기',
    subtitle: '원하는 용량으로 압축',
    accept: 'image/jpeg,image/png,image/webp,.heic,.heif',
    extensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    minFiles: 1,
    maxFiles: 20,
    maxFileSizeBytes: 30 * MB,
    maxTotalSizeBytes: 100 * MB,
    unsupportedTypeMessage: 'JPG·PNG·WEBP·HEIC 파일만 선택할 수 있어요',
  },
  'pdf-merge': {
    tool: 'pdf-merge',
    route: '/pdf/merge',
    title: 'PDF 합치기',
    subtitle: '여러 PDF를 하나로',
    accept: 'application/pdf,.pdf',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    minFiles: 2,
    maxFiles: 20,
    maxFileSizeBytes: 30 * MB,
    maxTotalSizeBytes: 100 * MB,
    unsupportedTypeMessage: 'PDF 파일만 선택할 수 있어요',
  },
  'pdf-to-image': {
    tool: 'pdf-to-image',
    route: '/pdf/to-image',
    title: 'PDF → 이미지',
    subtitle: '페이지를 사진으로 저장',
    accept: 'application/pdf,.pdf',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    minFiles: 1,
    maxFiles: 1,
    maxFileSizeBytes: 30 * MB,
    maxTotalSizeBytes: 30 * MB,
    unsupportedTypeMessage: 'PDF 파일만 선택할 수 있어요',
  },
  'pdf-split': {
    tool: 'pdf-split',
    route: '/pdf/split',
    title: 'PDF 나누기',
    subtitle: '페이지별·범위별로 분할',
    accept: 'application/pdf,.pdf',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    minFiles: 1,
    maxFiles: 1,
    maxFileSizeBytes: 30 * MB,
    maxTotalSizeBytes: 30 * MB,
    unsupportedTypeMessage: 'PDF 파일만 선택할 수 있어요',
  },
};
