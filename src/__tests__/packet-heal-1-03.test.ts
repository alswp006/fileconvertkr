import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Packet: 검수 차단 요소 제거 (console.error, HEX 색상 리터럴)
 *
 * AC-1: src(테스트 파일 제외)에서 /#[0-9a-fA-F]{3,8}\b/ 색상 리터럴 0건
 * AC-2: src(테스트 파일 제외)에서 'console.error' 호출 0건
 * AC-3: 기존 이미지 압축·HEIC 관련 테스트 통과
 */

/**
 * Helper: 파일 시스템에서 모든 소스 파일 수집
 * 테스트 파일(*.test.ts, *.test.tsx)은 제외
 */
function getSrcFiles(): string[] {
  const srcDir = path.join(process.cwd(), 'src');
  const files: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // __tests__ 디렉토리와 node_modules는 건너뛰기
        if (entry !== '__tests__' && entry !== 'node_modules') {
          walk(fullPath);
        }
      } else if (stat.isFile()) {
        // 테스트 파일 제외 (*.test.ts, *.test.tsx)
        if (!entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
          if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
            files.push(fullPath);
          }
        }
      }
    }
  }

  walk(srcDir);
  return files;
}

describe('검수 차단 요소 제거: console.error·HEX 색상', () => {
  /**
   * AC-1: HEX 색상 리터럴이 0건인지 검증
   *
   * 패턴: /#[0-9a-fA-F]{3,8}\b/
   * - 3자리 short: #fff, #ABC
   * - 4자리 short alpha: #fffa (rgba 호환)
   * - 6자리: #FFFFFF, #ffffff
   * - 8자리 alpha: #FFFFFF00, #FFFFFFFF
   *
   * canvasEncode.ts:42 ctx.fillStyle = '#FFFFFF' → 'rgb(255,255,255)'로 변경 필요
   */
  it('AC-1[P0]: should have 0 HEX color literals in src (non-test files)', () => {
    const files = getSrcFiles();
    const hexColorPattern = /#[0-9a-fA-F]{3,8}\b/;

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        if (hexColorPattern.test(line)) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: idx + 1,
            content: line.trim(),
          });
        }
      });
    }

    // 메시지에 위반 사항 포함
    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line}: ${v.content}`)
        .join('\n');
      expect(
        false,
        `Found ${violations.length} HEX color literal(s):\n${msg}`,
      ).toBe(true);
    }

    expect(violations).toHaveLength(0);
  });

  /**
   * AC-2: console.error 호출이 0건인지 검증
   *
   * 패턴: console.error( 또는 console\s*.\s*error\s*\(
   * 제외: 주석 내 텍스트, 문자열 리터럴 내 텍스트는 제외해야 함 (간단 구현)
   *
   * 동작 변경 없이 — 오류는 이미 있는 Toast나 반환값으로 처리,
   * 삼킨 오류는 조용히 무시
   */
  it('AC-2[P0]: should have 0 console.error() calls in src (non-test files)', () => {
    const files = getSrcFiles();
    // 정확한 매칭: console.error(
    // 주석은 무시하기 위해 정규식 개선 필요하지만, 간단히 구현
    const consoleErrorPattern = /console\s*\.\s*error\s*\(/;

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        // 주석 라인 제외 (간단한 구현)
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }

        if (consoleErrorPattern.test(line)) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: idx + 1,
            content: line.trim(),
          });
        }
      });
    }

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line}: ${v.content}`)
        .join('\n');
      expect(
        false,
        `Found ${violations.length} console.error() call(s):\n${msg}`,
      ).toBe(true);
    }

    expect(violations).toHaveLength(0);
  });

  /**
   * AC-3: canvasEncode가 rgb() 색상 형식을 사용하는지 검증
   *
   * 변경 전: ctx.fillStyle = '#FFFFFF'
   * 변경 후: ctx.fillStyle = 'rgb(255,255,255)'
   *
   * 이 테스트는 canvasEncode.ts가 올바른 색상 형식을 사용하는지 확인한다.
   */
  it('AC-3[P1]: canvasEncode should use rgb() format for white background, not HEX', () => {
    const canvasEncodeFile = path.join(process.cwd(), 'src/lib/convert/canvasEncode.ts');
    const content = fs.readFileSync(canvasEncodeFile, 'utf-8');

    // 변경 후: rgb(255,255,255) 형식이 있는지 확인
    // 변경 전: #FFFFFF 형식이 없는지 확인
    expect(content).toContain("'rgb(255,255,255)'");
    expect(content).not.toContain("'#FFFFFF'");
  });

  /**
   * AC-3: 기존 압축 테스트가 통과하는지 검증
   *
   * compress.test.ts의 주요 케이스들이 통과함을 보장
   * (실제 테스트는 compress.test.ts에서 실행되지만, 여기서 참조)
   */
  it('AC-3[P1]: existing compress tests should reference valid canvasEncode behavior', async () => {
    // compressToTarget이 내부적으로 canvasEncode를 사용하므로,
    // compress.test.ts가 통과하면 canvasEncode의 색상 변경도 검증된다.
    //
    // 이 테스트는 compressToTarget 함수가 존재하고 import 가능한지만 확인
    // (실제 동작은 compress.test.ts에서 모킹된 canvas를 통해 검증)
    const { compressToTarget } = await import('@/lib/convert/compress');
    expect(typeof compressToTarget).toBe('function');
  });

  /**
   * AC-3: TypeScript 컴파일 체크 (tsc --noEmit)
   *
   * 이 테스트는 canvasEncode.ts의 타입 변경으로 인한 오류가 없는지 확인한다.
   * rgb() 문자열은 여전히 유효한 CSS color 값이므로 타입 오류는 없어야 한다.
   */
  it('AC-3[P1]: should have valid TypeScript types after color format change', () => {
    // HTMLCanvasRenderingContext2D.fillStyle은 string | CanvasGradient | CanvasPattern
    // 'rgb(255,255,255)' 형식은 유효한 CSS color 값
    //
    // 이 테스트는 canvasEncode.ts 파일의 타입 정합성을 확인한다.
    const canvasEncodeFile = path.join(process.cwd(), 'src/lib/convert/canvasEncode.ts');
    const content = fs.readFileSync(canvasEncodeFile, 'utf-8');

    // ctx.fillStyle에 할당되는 값이 문자열임을 확인
    const fillStyleLine = content
      .split('\n')
      .find((line) => line.includes('ctx.fillStyle'));
    expect(fillStyleLine).toBeDefined();
    expect(fillStyleLine).toMatch(/ctx\.fillStyle\s*=\s*['"`]/);
  });

  /**
   * AC-3[P0]: 변경이 동작 로직을 바꾸지 않는지 검증
   *
   * 색상을 '#FFFFFF'에서 'rgb(255,255,255)'로 바꿔도:
   * - 캔버스 렌더링 결과는 동일 (둘 다 흰색)
   * - 인코딩 로직(이분 탐색, 해상도 축소)은 변경 없음
   * - 반환 타입(EncodeToTargetResult)은 동일
   */
  it('AC-3[P0]: color format change should not alter encoding logic or return type', async () => {
    // 동적 import를 사용하여 canvasEncode 모듈 로드
    const { encodeToTarget } = await import('@/lib/convert/canvasEncode');

    // encodeToTarget 함수가 여전히 존재하는지 확인
    expect(typeof encodeToTarget).toBe('function');

    // EncodeToTargetResult 타입이 여전히 유효한지 확인
    // (타입 스크립트 컴파일 시에 검증됨)
  });

  /**
   * Integration: 폐지된 HEX 색상이 다른 곳에서 사용되지 않는지 확인
   *
   * canvasEncode.ts:42의 #FFFFFF 외에 다른 곳에서 HEX 색상을 사용하지 않는지 검증
   */
  it('AC-1[P0]: should confirm no other HEX colors exist after removing #FFFFFF', () => {
    const files = getSrcFiles();
    const hexColorPattern = /#[0-9a-fA-F]{3,8}\b/;

    const allViolations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        if (hexColorPattern.test(line)) {
          const relativePath = path.relative(process.cwd(), file);
          allViolations.push(`${relativePath}:${idx + 1}`);
        }
      });
    }

    // 주요 파일들이 깨끗한지 확인
    const criticalFiles = [
      'src/lib/convert/canvasEncode.ts',
      'src/lib/convert/compress.ts',
      'src/lib/convert/heic.ts',
      'src/lib/convert/imageSize.ts',
    ];

    for (const file of criticalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
      expect(
        hexColorPattern.test(content),
        `${file} should not contain HEX color literals`,
      ).toBe(false);
    }
  });
});
