import { isInCheck } from './attacks';
import { START_FEN, castlingToFen, parseFen, placementToFen, toFen } from './fen';
import { applyMove, legalMoves } from './movegen';
import type { Position } from './position';
import { toSan } from './san';
import { fileOf, rankOf, squareName } from './square';
import { opposite, type Color, type Move, type PromotionType, type Square } from './types';

export type DrawReason = 'fifty-move' | 'threefold' | 'insufficient' | 'agreement';

export type GameStatus =
  | { kind: 'playing' }
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'stalemate' }
  | { kind: 'draw'; reason: DrawReason }
  | { kind: 'resigned'; winner: Color };

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PromotionType;
}

export class IllegalMoveError extends Error {}

type ManualResult = { kind: 'resigned'; winner: Color } | { kind: 'draw'; reason: 'agreement' };

export class Game {
  private positions: Position[];
  private moves: Move[] = [];
  private sans: string[] = [];
  private manualResult: ManualResult | null = null;

  constructor(fen: string = START_FEN) {
    this.positions = [parseFen(fen)];
  }

  get position(): Position {
    return this.positions[this.positions.length - 1]!;
  }

  get turn(): Color {
    return this.position.sideToMove;
  }

  fen(): string {
    return toFen(this.position);
  }

  /** 현재 차례의 합법 수. 게임이 끝났으면 빈 배열 */
  legalMoves(): Move[] {
    return this.isOver() ? [] : legalMoves(this.position);
  }

  legalMovesFrom(sq: Square): Move[] {
    return this.legalMoves().filter((m) => m.from === sq);
  }

  /** 합법 수를 둔다. 프로모션 수는 promotion 을 지정해야 한다. 적용된 Move 를 반환한다. */
  move(input: MoveInput): Move {
    const candidates = this.legalMoves().filter((m) => m.from === input.from && m.to === input.to);
    const move = candidates.find((m) => m.promotion === input.promotion);
    if (!move) {
      const desc = `${squareName(input.from)}-${squareName(input.to)}${input.promotion ?? ''}`;
      const why = candidates.length > 0 ? '프로모션 기물을 지정해야 함' : '합법 수가 아님';
      throw new IllegalMoveError(`${desc}: ${why}`);
    }
    this.sans.push(toSan(this.position, move));
    this.moves.push(move);
    this.positions.push(applyMove(this.position, move));
    return move;
  }

  /**
   * 마지막 동작을 되돌린다. 기권/합의 무승부로 끝났으면 그 결과를 취소하고, 아니면 마지막 수를 무른다.
   * 되돌릴 것이 없으면 false.
   */
  undo(): boolean {
    if (this.manualResult) {
      this.manualResult = null;
      return true;
    }
    if (this.moves.length === 0) return false;
    this.positions.pop();
    this.moves.pop();
    this.sans.pop();
    return true;
  }

  canUndo(): boolean {
    return this.manualResult !== null || this.moves.length > 0;
  }

  resign(color: Color): void {
    if (this.isOver()) return;
    this.manualResult = { kind: 'resigned', winner: opposite(color) };
  }

  agreeDraw(): void {
    if (this.isOver()) return;
    this.manualResult = { kind: 'draw', reason: 'agreement' };
  }

  inCheck(): boolean {
    return isInCheck(this.position.board, this.turn);
  }

  /** 지금까지 둔 수의 SAN 목록 */
  history(): string[] {
    return [...this.sans];
  }

  /** 지금까지 둔 수 목록 */
  moveList(): Move[] {
    return [...this.moves];
  }

  lastMove(): Move | null {
    return this.moves[this.moves.length - 1] ?? null;
  }

  /** 시작 위치의 수 번호와 차례 (기보 번호 매기기용) */
  get startPosition(): Position {
    return this.positions[0]!;
  }

  isOver(): boolean {
    return this.status().kind !== 'playing';
  }

  status(): GameStatus {
    if (this.manualResult) return this.manualResult;
    const pos = this.position;
    if (legalMoves(pos).length === 0) {
      return isInCheck(pos.board, pos.sideToMove)
        ? { kind: 'checkmate', winner: opposite(pos.sideToMove) }
        : { kind: 'stalemate' };
    }
    if (isInsufficientMaterial(pos)) return { kind: 'draw', reason: 'insufficient' };
    if (pos.halfmove >= 100) return { kind: 'draw', reason: 'fifty-move' };
    if (this.repetitionCount() >= 3) return { kind: 'draw', reason: 'threefold' };
    return { kind: 'playing' };
  }

  /** 현재 위치가 지금까지 몇 번 나왔는지 (현재 포함) */
  repetitionCount(): number {
    const key = repetitionKey(this.position);
    return this.positions.filter((p) => repetitionKey(p) === key).length;
  }
}

/**
 * 동형 판정 키: 배치 + 차례 + 캐슬링 권한 + 앙파상 칸.
 * 앙파상 칸은 실제로 앙파상 잡기가 합법일 때만 포함한다 (FIDE 규칙).
 */
export function repetitionKey(pos: Position): string {
  const ep = pos.epSquare !== null && legalMoves(pos).some((m) => m.flags === 'ep') ? squareName(pos.epSquare) : '-';
  return [placementToFen(pos.board), pos.sideToMove, castlingToFen(pos.castling), ep].join(' ');
}

/**
 * 어느 쪽도 체크메이트할 수 없는 기물 구성인지.
 * 폰/룩/퀸이 없고, (마이너 기물이 1개 이하) 또는 (마이너 기물이 모두 같은 색 칸의 비숍).
 * K vs K, K+B vs K, K+N vs K, K+B vs K+B(같은 색 칸) 를 포함한다.
 */
export function isInsufficientMaterial(pos: Position): boolean {
  const minors = pos.board.pieces().filter(({ piece }) => piece.type !== 'k');
  if (minors.some(({ piece }) => piece.type === 'p' || piece.type === 'r' || piece.type === 'q')) return false;
  if (minors.length <= 1) return true;
  if (minors.some(({ piece }) => piece.type === 'n')) return false;
  const squareColor = (sq: Square) => (fileOf(sq) + rankOf(sq)) % 2;
  return new Set(minors.map(({ square }) => squareColor(square))).size === 1;
}
