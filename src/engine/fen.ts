import { Board } from './board';
import type { Position } from './position';
import { makeSquare, parseSquare, squareName } from './square';
import type { CastlingRights, Color, Piece, PieceType } from './types';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export class FenError extends Error {}

const PIECE_CHARS = 'pnbrqk';

function pieceFromChar(ch: string): Piece | null {
  const lower = ch.toLowerCase();
  if (!PIECE_CHARS.includes(lower)) return null;
  return { color: ch === lower ? 'b' : 'w', type: lower as PieceType };
}

export function pieceToChar(piece: Piece): string {
  return piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
}

/** FEN 을 파싱한다. 형식이 잘못되면 FenError. 배치의 체스 규칙상 타당성은 검사하지 않는다(setup.ts 참고). */
export function parseFen(fen: string): Position {
  const fields = fen.trim().split(/\s+/);
  if (fields.length < 4 || fields.length > 6) throw new FenError(`필드 개수가 잘못됨: ${fen}`);
  const [placement, side, castlingStr, ep, half = '0', full = '1'] = fields as [
    string, string, string, string, string?, string?,
  ];

  const ranks = placement.split('/');
  if (ranks.length !== 8) throw new FenError(`랭크 개수가 8이 아님: ${placement}`);
  const board = new Board();
  ranks.forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        file += Number(ch);
      } else {
        const piece = pieceFromChar(ch);
        if (!piece) throw new FenError(`알 수 없는 기물 문자: ${ch}`);
        if (file > 7) throw new FenError(`랭크가 8칸을 넘음: ${row}`);
        board.set(makeSquare(file, rank), piece);
        file++;
      }
    }
    if (file !== 8) throw new FenError(`랭크가 8칸이 아님: ${row}`);
  });

  if (side !== 'w' && side !== 'b') throw new FenError(`차례가 잘못됨: ${side}`);

  if (!/^(-|K?Q?k?q?)$/.test(castlingStr) || castlingStr === '') {
    throw new FenError(`캐슬링 필드가 잘못됨: ${castlingStr}`);
  }
  const castling: CastlingRights = {
    wK: castlingStr.includes('K'),
    wQ: castlingStr.includes('Q'),
    bK: castlingStr.includes('k'),
    bQ: castlingStr.includes('q'),
  };

  let epSquare = null;
  if (ep !== '-') {
    epSquare = /^[a-h][36]$/.test(ep) ? parseSquare(ep) : null;
    if (epSquare === null) throw new FenError(`앙파상 칸이 잘못됨: ${ep}`);
  }

  const halfmove = Number(half);
  const fullmove = Number(full);
  if (!Number.isInteger(halfmove) || halfmove < 0) throw new FenError(`halfmove 가 잘못됨: ${half}`);
  if (!Number.isInteger(fullmove) || fullmove < 1) throw new FenError(`fullmove 가 잘못됨: ${full}`);

  return { board, sideToMove: side as Color, castling, epSquare, halfmove, fullmove };
}

export function placementToFen(board: Board): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = board.get(makeSquare(file, rank));
      if (p) {
        if (empty) row += empty;
        empty = 0;
        row += pieceToChar(p);
      } else {
        empty++;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}

export function castlingToFen(c: Readonly<CastlingRights>): string {
  const s = (c.wK ? 'K' : '') + (c.wQ ? 'Q' : '') + (c.bK ? 'k' : '') + (c.bQ ? 'q' : '');
  return s || '-';
}

export function toFen(pos: Position): string {
  return [
    placementToFen(pos.board),
    pos.sideToMove,
    castlingToFen(pos.castling),
    pos.epSquare === null ? '-' : squareName(pos.epSquare),
    pos.halfmove,
    pos.fullmove,
  ].join(' ');
}
