export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionType = 'q' | 'r' | 'b' | 'n';

export interface Piece {
  readonly color: Color;
  readonly type: PieceType;
}

/** 0..63, `a1 = 0`, `h8 = 63`, `index = rank * 8 + file` */
export type Square = number;

export type MoveFlag = 'normal' | 'double' | 'ep' | 'castleK' | 'castleQ' | 'promo';

export interface Move {
  readonly from: Square;
  readonly to: Square;
  readonly piece: Piece;
  readonly captured?: Piece;
  readonly promotion?: PromotionType;
  readonly flags: MoveFlag;
}

export interface CastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export const PROMOTION_TYPES: readonly PromotionType[] = ['q', 'r', 'b', 'n'];

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}
