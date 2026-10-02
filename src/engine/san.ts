import { isInCheck } from './attacks';
import { applyMove, legalMoves } from './movegen';
import type { Position } from './position';
import { fileOf, rankOf, squareName } from './square';
import type { Move } from './types';

/** 수를 SAN 으로 표기한다. move 는 pos 에서의 합법 수여야 한다. */
export function toSan(pos: Position, move: Move): string {
  let san: string;
  if (move.flags === 'castleK') {
    san = 'O-O';
  } else if (move.flags === 'castleQ') {
    san = 'O-O-O';
  } else if (move.piece.type === 'p') {
    san = move.captured ? `${squareName(move.from)[0]}x${squareName(move.to)}` : squareName(move.to);
    if (move.promotion) san += `=${move.promotion.toUpperCase()}`;
  } else {
    san = move.piece.type.toUpperCase() + disambiguation(pos, move) + (move.captured ? 'x' : '') + squareName(move.to);
  }

  const next = applyMove(pos, move);
  if (isInCheck(next.board, next.sideToMove)) {
    san += legalMoves(next).length === 0 ? '#' : '+';
  }
  return san;
}

/** 같은 종류의 다른 기물도 같은 칸으로 갈 수 있을 때 출발 파일/랭크/칸을 덧붙인다 */
function disambiguation(pos: Position, move: Move): string {
  const rivals = legalMoves(pos).filter(
    (m) => m.to === move.to && m.from !== move.from && m.piece.type === move.piece.type,
  );
  if (rivals.length === 0) return '';
  const name = squareName(move.from);
  if (rivals.every((m) => fileOf(m.from) !== fileOf(move.from))) return name[0]!;
  if (rivals.every((m) => rankOf(m.from) !== rankOf(move.from))) return name[1]!;
  return name;
}
