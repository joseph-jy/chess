import type { Color, Piece, PieceType, Square } from './types';

export class Board {
  private readonly squares: (Piece | null)[];

  constructor(squares?: readonly (Piece | null)[]) {
    this.squares = squares ? [...squares] : new Array<Piece | null>(64).fill(null);
  }

  get(sq: Square): Piece | null {
    return this.squares[sq] ?? null;
  }

  set(sq: Square, piece: Piece | null): void {
    this.squares[sq] = piece;
  }

  clone(): Board {
    return new Board(this.squares);
  }

  /** 해당 기물이 놓인 칸들 */
  find(color: Color, type: PieceType): Square[] {
    const result: Square[] = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = this.squares[sq];
      if (p && p.color === color && p.type === type) result.push(sq);
    }
    return result;
  }

  kingSquare(color: Color): Square | null {
    return this.find(color, 'k')[0] ?? null;
  }

  /** 기물이 있는 칸과 기물 목록 */
  pieces(): { square: Square; piece: Piece }[] {
    const result: { square: Square; piece: Piece }[] = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = this.squares[sq];
      if (p) result.push({ square: sq, piece: p });
    }
    return result;
  }
}
