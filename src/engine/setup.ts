import { isInCheck } from './attacks';
import { Board } from './board';
import { parseFen, START_FEN } from './fen';
import type { Position } from './position';
import { rankOf, squareName } from './square';
import { opposite, type CastlingRights, type Color, type Piece, type Square } from './types';

/*
 * 배치 편집 규칙. 편집 중에도 양 진영 킹은 항상 정확히 1개여야 한다:
 * 킹은 지우거나 덮어쓸 수 없고 새로 놓을 수도 없으며, 이동만 가능하다.
 */

/** sq 에 piece 를 놓는다(null 이면 지운다). 킹을 없애거나 추가하게 되면 null(편집 불가). */
export function editPlace(board: Board, sq: Square, piece: Piece | null): Board | null {
  if (board.get(sq)?.type === 'k') return null;
  if (piece?.type === 'k') return null;
  const next = board.clone();
  next.set(sq, piece);
  return next;
}

/** from 의 기물을 to 로 옮긴다(to 의 기물은 사라짐). 킹을 덮어쓰게 되면 null. */
export function editMove(board: Board, from: Square, to: Square): Board | null {
  const piece = board.get(from);
  if (!piece || from === to) return null;
  if (board.get(to)?.type === 'k') return null;
  const next = board.clone();
  next.set(from, null);
  next.set(to, piece);
  return next;
}

/** 킹/룩이 원래 칸에 있어서 부여 가능한 캐슬링 권한 */
export function availableCastling(board: Board): CastlingRights {
  const is = (sq: Square, color: Color, type: Piece['type']) => {
    const p = board.get(sq);
    return p !== null && p.color === color && p.type === type;
  };
  const wKing = is(4, 'w', 'k');
  const bKing = is(60, 'b', 'k');
  return {
    wK: wKing && is(7, 'w', 'r'),
    wQ: wKing && is(0, 'w', 'r'),
    bK: bKing && is(63, 'b', 'r'),
    bQ: bKing && is(56, 'b', 'r'),
  };
}

export type SetupResult = { ok: true } | { ok: false; errors: string[] };

const COLOR_NAME: Record<Color, string> = { w: '백', b: '흑' };

/** 대국을 시작할 수 있는 배치인지 검사한다. */
export function validateSetup(pos: Position): SetupResult {
  const errors: string[] = [];
  const { board } = pos;

  for (const color of ['w', 'b'] as const) {
    const kings = board.find(color, 'k').length;
    if (kings !== 1) errors.push(`${COLOR_NAME[color]} 킹이 정확히 1개여야 합니다 (현재 ${kings}개).`);
  }

  const badPawns = board
    .pieces()
    .filter(({ square, piece }) => piece.type === 'p' && (rankOf(square) === 0 || rankOf(square) === 7))
    .map(({ square }) => squareName(square));
  if (badPawns.length > 0) errors.push(`1·8랭크에는 폰을 둘 수 없습니다: ${badPawns.join(', ')}`);

  const avail = availableCastling(board);
  const badCastling = (Object.keys(avail) as (keyof CastlingRights)[]).filter((k) => pos.castling[k] && !avail[k]);
  if (badCastling.length > 0) errors.push('킹과 룩이 원래 칸에 없으면 캐슬링 권한을 줄 수 없습니다.');

  if (errors.length === 0) {
    const waiting = opposite(pos.sideToMove);
    if (isInCheck(board, waiting)) {
      errors.push(`${COLOR_NAME[pos.sideToMove]} 차례인데 ${COLOR_NAME[waiting]} 킹이 이미 체크당한 상태입니다.`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** 편집기 프리셋 */
export const PRESETS: { id: string; name: string; fen: string }[] = [
  { id: 'standard', name: '정식 배치', fen: START_FEN },
  { id: 'kings', name: '빈 보드 (킹만)', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1' },
  { id: 'all-queens', name: '올퀸', fen: 'qqqqkqqq/qqqqqqqq/8/8/8/8/QQQQQQQQ/QQQQKQQQ w - - 0 1' },
  { id: 'no-pawns', name: '폰 없음', fen: 'rnbqkbnr/8/8/8/8/8/8/RNBQKBNR w KQkq - 0 1' },
];

export function presetBoard(id: string): Board {
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[0]!;
  return parseFen(preset.fen).board;
}
