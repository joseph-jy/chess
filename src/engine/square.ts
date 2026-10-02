import type { Square } from './types';

const FILES = 'abcdefgh';

export function fileOf(sq: Square): number {
  return sq & 7;
}

export function rankOf(sq: Square): number {
  return sq >> 3;
}

export function makeSquare(file: number, rank: number): Square {
  return rank * 8 + file;
}

export function isOnBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

/** 표준 대수 표기 ("e4") */
export function squareName(sq: Square): string {
  return `${FILES[fileOf(sq)]}${rankOf(sq) + 1}`;
}

/**
 * 칸 이름을 파싱한다. `"e4"`(파일+랭크)와 `"4e"`(랭크+파일) 모두 허용하고 대소문자를 무시한다.
 * 앞뒤 공백은 무시한다. 잘못된 입력이면 `null`.
 */
export function parseSquare(input: string): Square | null {
  const s = input.trim().toLowerCase();
  const m = /^(?:([a-h])([1-8])|([1-8])([a-h]))$/.exec(s);
  if (!m) return null;
  const fileCh = m[1] ?? m[4]!;
  const rankCh = m[2] ?? m[3]!;
  return makeSquare(FILES.indexOf(fileCh), Number(rankCh) - 1);
}
