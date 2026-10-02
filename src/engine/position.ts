import { Board } from './board';
import type { CastlingRights, Color, Square } from './types';

export interface Position {
  readonly board: Board;
  readonly sideToMove: Color;
  readonly castling: Readonly<CastlingRights>;
  /** 직전 수가 폰 2칸 전진이면 그 통과 칸, 아니면 null */
  readonly epSquare: Square | null;
  /** 50수 규칙용: 마지막 폰 이동/잡기 이후 반수 */
  readonly halfmove: number;
  readonly fullmove: number;
}

export function clonePosition(pos: Position): Position {
  return { ...pos, board: pos.board.clone(), castling: { ...pos.castling } };
}

export function emptyPosition(): Position {
  return {
    board: new Board(),
    sideToMove: 'w',
    castling: { wK: false, wQ: false, bK: false, bQ: false },
    epSquare: null,
    halfmove: 0,
    fullmove: 1,
  };
}
