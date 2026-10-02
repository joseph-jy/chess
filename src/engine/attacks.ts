import type { Board } from './board';
import { fileOf, isOnBoard, makeSquare, rankOf } from './square';
import type { Color, Square } from './types';

export type Delta = readonly [df: number, dr: number];

export const KNIGHT_DELTAS: readonly Delta[] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
export const KING_DELTAS: readonly Delta[] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
export const ROOK_DIRS: readonly Delta[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const BISHOP_DIRS: readonly Delta[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** sq 에서 delta 만큼 떨어진 칸. 보드 밖이면 null */
export function offset(sq: Square, [df, dr]: Delta): Square | null {
  const f = fileOf(sq) + df;
  const r = rankOf(sq) + dr;
  return isOnBoard(f, r) ? makeSquare(f, r) : null;
}

/** byColor 진영의 기물이 sq 를 공격하는지 (sq 에 무엇이 있든 상관없이) */
export function isSquareAttacked(board: Board, sq: Square, byColor: Color): boolean {
  // 폰: 공격하는 폰은 sq 기준 반대 방향 대각선에 있다
  const pawnDr = byColor === 'w' ? -1 : 1;
  for (const df of [-1, 1]) {
    const from = offset(sq, [df, pawnDr]);
    if (from === null) continue;
    const p = board.get(from);
    if (p && p.color === byColor && p.type === 'p') return true;
  }

  for (const d of KNIGHT_DELTAS) {
    const from = offset(sq, d);
    if (from === null) continue;
    const p = board.get(from);
    if (p && p.color === byColor && p.type === 'n') return true;
  }

  for (const d of KING_DELTAS) {
    const from = offset(sq, d);
    if (from === null) continue;
    const p = board.get(from);
    if (p && p.color === byColor && p.type === 'k') return true;
  }

  const slides: [readonly Delta[], 'r' | 'b'][] = [[ROOK_DIRS, 'r'], [BISHOP_DIRS, 'b']];
  for (const [dirs, slider] of slides) {
    for (const d of dirs) {
      let cur = offset(sq, d);
      while (cur !== null) {
        const p = board.get(cur);
        if (p) {
          if (p.color === byColor && (p.type === slider || p.type === 'q')) return true;
          break;
        }
        cur = offset(cur, d);
      }
    }
  }
  return false;
}

export function isInCheck(board: Board, color: Color): boolean {
  const king = board.kingSquare(color);
  return king !== null && isSquareAttacked(board, king, color === 'w' ? 'b' : 'w');
}
