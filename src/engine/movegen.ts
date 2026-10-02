import {
  BISHOP_DIRS, KING_DELTAS, KNIGHT_DELTAS, ROOK_DIRS,
  isInCheck, isSquareAttacked, offset, type Delta,
} from './attacks';
import type { Position } from './position';
import { fileOf, makeSquare, rankOf } from './square';
import { PROMOTION_TYPES, opposite, type CastlingRights, type Move, type Piece, type Square } from './types';

const SLIDER_DIRS: Partial<Record<Piece['type'], readonly Delta[]>> = {
  b: BISHOP_DIRS,
  r: ROOK_DIRS,
  q: [...ROOK_DIRS, ...BISHOP_DIRS],
};

/** 자기 킹 체크 여부를 고려하지 않은 의사 합법 수 */
export function pseudoLegalMoves(pos: Position): Move[] {
  const { board, sideToMove: us } = pos;
  const moves: Move[] = [];

  for (const { square: from, piece } of board.pieces()) {
    if (piece.color !== us) continue;

    if (piece.type === 'p') {
      genPawnMoves(pos, from, piece, moves);
      continue;
    }

    const sliderDirs = SLIDER_DIRS[piece.type];
    if (sliderDirs) {
      for (const d of sliderDirs) {
        let to = offset(from, d);
        while (to !== null) {
          const target = board.get(to);
          if (target) {
            if (target.color !== us) moves.push({ from, to, piece, captured: target, flags: 'normal' });
            break;
          }
          moves.push({ from, to, piece, flags: 'normal' });
          to = offset(to, d);
        }
      }
      continue;
    }

    const deltas = piece.type === 'n' ? KNIGHT_DELTAS : KING_DELTAS;
    for (const d of deltas) {
      const to = offset(from, d);
      if (to === null) continue;
      const target = board.get(to);
      if (target?.color === us) continue;
      moves.push(target ? { from, to, piece, captured: target, flags: 'normal' } : { from, to, piece, flags: 'normal' });
    }

    if (piece.type === 'k') genCastling(pos, from, piece, moves);
  }
  return moves;
}

function genPawnMoves(pos: Position, from: Square, piece: Piece, moves: Move[]): void {
  const { board } = pos;
  const dir = piece.color === 'w' ? 1 : -1;
  const startRank = piece.color === 'w' ? 1 : 6;
  const lastRank = piece.color === 'w' ? 7 : 0;

  const push = (to: Square, captured?: Piece) => {
    if (rankOf(to) === lastRank) {
      for (const promotion of PROMOTION_TYPES) {
        moves.push(captured ? { from, to, piece, captured, promotion, flags: 'promo' } : { from, to, piece, promotion, flags: 'promo' });
      }
    } else {
      moves.push(captured ? { from, to, piece, captured, flags: 'normal' } : { from, to, piece, flags: 'normal' });
    }
  };

  const one = offset(from, [0, dir]);
  if (one !== null && !board.get(one)) {
    push(one);
    const two = offset(from, [0, 2 * dir]);
    if (rankOf(from) === startRank && two !== null && !board.get(two)) {
      moves.push({ from, to: two, piece, flags: 'double' });
    }
  }

  for (const df of [-1, 1]) {
    const to = offset(from, [df, dir]);
    if (to === null) continue;
    const target = board.get(to);
    if (target && target.color !== piece.color) {
      push(to, target);
    } else if (to === pos.epSquare && !target) {
      const capturedSq = makeSquare(fileOf(to), rankOf(from));
      const captured = board.get(capturedSq);
      if (captured && captured.type === 'p' && captured.color !== piece.color) {
        moves.push({ from, to, piece, captured, flags: 'ep' });
      }
    }
  }
}

function genCastling(pos: Position, from: Square, piece: Piece, moves: Move[]): void {
  const { board } = pos;
  const us = piece.color;
  const them = opposite(us);
  const rank = us === 'w' ? 0 : 7;
  if (from !== makeSquare(4, rank)) return;
  if (isSquareAttacked(board, from, them)) return;

  const sides: { right: keyof CastlingRights; rookFile: number; between: number[]; kingPath: number[]; flags: 'castleK' | 'castleQ' }[] = [
    { right: us === 'w' ? 'wK' : 'bK', rookFile: 7, between: [5, 6], kingPath: [5, 6], flags: 'castleK' },
    { right: us === 'w' ? 'wQ' : 'bQ', rookFile: 0, between: [1, 2, 3], kingPath: [3, 2], flags: 'castleQ' },
  ];
  for (const side of sides) {
    if (!pos.castling[side.right]) continue;
    const rook = board.get(makeSquare(side.rookFile, rank));
    if (!rook || rook.type !== 'r' || rook.color !== us) continue;
    if (side.between.some((f) => board.get(makeSquare(f, rank)))) continue;
    if (side.kingPath.some((f) => isSquareAttacked(board, makeSquare(f, rank), them))) continue;
    moves.push({ from, to: makeSquare(side.kingPath[1]!, rank), piece, flags: side.flags });
  }
}

/** 수를 적용한 새 Position 을 반환한다 (원본은 변경하지 않음). 합법성은 검사하지 않는다. */
export function applyMove(pos: Position, move: Move): Position {
  const board = pos.board.clone();
  const { from, to, piece } = move;
  const us = piece.color;

  board.set(from, null);
  board.set(to, move.promotion ? { color: us, type: move.promotion } : piece);

  if (move.flags === 'ep') {
    board.set(makeSquare(fileOf(to), rankOf(from)), null);
  } else if (move.flags === 'castleK' || move.flags === 'castleQ') {
    const rank = rankOf(from);
    const [rookFrom, rookTo] = move.flags === 'castleK' ? [7, 5] : [0, 3];
    const rookSq = makeSquare(rookFrom, rank);
    board.set(makeSquare(rookTo, rank), board.get(rookSq));
    board.set(rookSq, null);
  }

  const castling = { ...pos.castling };
  if (piece.type === 'k') {
    if (us === 'w') castling.wK = castling.wQ = false;
    else castling.bK = castling.bQ = false;
  }
  // 룩이 원래 칸에서 움직이거나, 그 칸에서 잡히면 해당 권한 소멸
  for (const sq of [from, to]) {
    if (sq === 0) castling.wQ = false;
    if (sq === 7) castling.wK = false;
    if (sq === 56) castling.bQ = false;
    if (sq === 63) castling.bK = false;
  }

  const epSquare = move.flags === 'double' ? (from + to) / 2 : null;
  const halfmove = piece.type === 'p' || move.captured ? 0 : pos.halfmove + 1;
  const fullmove = us === 'b' ? pos.fullmove + 1 : pos.fullmove;

  return { board, sideToMove: opposite(us), castling, epSquare, halfmove, fullmove };
}

/** 합법 수: 의사 합법 수 중 자기 킹을 체크 상태로 두지 않는 수 */
export function legalMoves(pos: Position): Move[] {
  return pseudoLegalMoves(pos).filter((m) => !isInCheck(applyMove(pos, m).board, pos.sideToMove));
}

export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(applyMove(pos, m), depth - 1);
  return n;
}
