import { describe, expect, it } from 'vitest';
import { START_FEN, parseFen } from '../src/engine/fen';
import { Game, IllegalMoveError, isInsufficientMaterial } from '../src/engine/game';
import { parseSquare } from '../src/engine/square';
import type { PromotionType } from '../src/engine/types';

const sq = (s: string) => parseSquare(s)!;

/** "e2e4", "e7e8q" 형식의 수들을 둔다 */
function play(game: Game, ...uci: string[]): void {
  for (const u of uci) {
    game.move({ from: sq(u.slice(0, 2)), to: sq(u.slice(2, 4)), promotion: (u[4] as PromotionType) || undefined });
  }
}

describe('Game: move/undo', () => {
  it('수를 두면 차례·halfmove·fullmove 가 갱신된다', () => {
    const g = new Game();
    play(g, 'e2e4');
    expect(g.fen()).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    play(g, 'g8f6', 'g1f3');
    expect(g.fen()).toBe('rnbqkb1r/pppppppp/5n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 2');
  });

  it('잡기와 폰 이동은 halfmove 를 0 으로', () => {
    const g = new Game('4k3/8/8/3p4/8/2N5/8/4K3 w - - 7 30');
    play(g, 'c3d5');
    expect(g.position.halfmove).toBe(0);
  });

  it('불법 수는 IllegalMoveError, 상태는 그대로', () => {
    const g = new Game();
    expect(() => play(g, 'e2e5')).toThrow(IllegalMoveError);
    expect(() => play(g, 'e7e5')).toThrow(IllegalMoveError); // 흑 차례 아님
    expect(g.fen()).toBe(START_FEN);
  });

  it('프로모션 기물을 지정하지 않으면 불법', () => {
    const g = new Game('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(() => g.move({ from: sq('a7'), to: sq('a8') })).toThrow(IllegalMoveError);
    play(g, 'a7a8n');
    expect(g.position.board.get(sq('a8'))).toEqual({ color: 'w', type: 'n' });
  });

  it('undo 는 이전 위치로 되돌린다', () => {
    const g = new Game();
    play(g, 'e2e4', 'e7e5', 'g1f3');
    expect(g.undo()).toBe(true);
    expect(g.undo()).toBe(true);
    expect(g.fen()).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    expect(g.history()).toEqual(['e4']);
    expect(g.undo()).toBe(true);
    expect(g.undo()).toBe(false);
    expect(g.fen()).toBe(START_FEN);
  });

  it('캐슬링 권한: 킹/룩 이동, 룩 잡힘', () => {
    const g = new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    play(g, 'h1h8'); // 룩으로 h8 룩을 잡음 -> wK, bK 소멸
    expect(g.position.castling).toEqual({ wK: false, wQ: true, bK: false, bQ: true });
    play(g, 'e8d7'); // 흑 킹 이동 -> bQ 소멸
    expect(g.position.castling).toEqual({ wK: false, wQ: true, bK: false, bQ: false });
    play(g, 'a1a2');
    expect(g.position.castling).toEqual({ wK: false, wQ: false, bK: false, bQ: false });
  });

  it('legalMovesFrom', () => {
    const g = new Game();
    expect(g.legalMovesFrom(sq('g1'))).toHaveLength(2);
    expect(g.legalMovesFrom(sq('e7'))).toHaveLength(0);
  });
});

describe('Game: 종료 판정', () => {
  it('진행 중', () => {
    expect(new Game().status()).toEqual({ kind: 'playing' });
  });

  it('체크메이트 (바보의 메이트)', () => {
    const g = new Game();
    play(g, 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(g.status()).toEqual({ kind: 'checkmate', winner: 'b' });
    expect(g.inCheck()).toBe(true);
    expect(g.legalMoves()).toEqual([]);
    expect(g.history()).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
  });

  it('스테일메이트', () => {
    const g = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(g.status()).toEqual({ kind: 'stalemate' });
    expect(g.inCheck()).toBe(false);
  });

  it('50수 규칙: halfmove ≥ 100', () => {
    const g = new Game('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
    expect(g.status().kind).toBe('playing');
    play(g, 'a1a2');
    expect(g.status()).toEqual({ kind: 'draw', reason: 'fifty-move' });
  });

  it('50수째에 체크메이트면 체크메이트가 우선', () => {
    const g = new Game('6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80');
    play(g, 'a1a8');
    expect(g.status()).toEqual({ kind: 'checkmate', winner: 'w' });
  });

  it('3회 동형 반복', () => {
    const g = new Game();
    play(g, 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    expect(g.repetitionCount()).toBe(2);
    expect(g.status().kind).toBe('playing');
    play(g, 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    expect(g.repetitionCount()).toBe(3);
    expect(g.status()).toEqual({ kind: 'draw', reason: 'threefold' });
  });

  it('캐슬링 권한이 다르면 같은 위치가 아니다', () => {
    const g = new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    play(g, 'e1e2', 'e8e7', 'e2e1', 'e7e8'); // 권한 소멸 -> 처음 위치와 다름
    play(g, 'e1e2', 'e8e7', 'e2e1', 'e7e8');
    expect(g.repetitionCount()).toBe(2);
    expect(g.status().kind).toBe('playing');
  });

  it('잡을 수 없는 앙파상 칸은 반복 판정에 영향 없음', () => {
    // 1.e4 후의 위치(ep=e3, 하지만 흑이 잡을 수 없음)는 나중에 같은 배치가 나오면 같은 위치
    const g = new Game('4k3/8/8/8/8/8/4P3/4K1Nn w - - 0 1');
    play(g, 'e2e4', 'h1g3', 'g1f3', 'g3h1', 'f3g1');
    play(g, 'h1g3', 'g1f3', 'g3h1', 'f3g1');
    expect(g.repetitionCount()).toBe(3);
  });

  it('기권', () => {
    const g = new Game();
    g.resign('w');
    expect(g.status()).toEqual({ kind: 'resigned', winner: 'b' });
    expect(g.legalMoves()).toEqual([]);
    expect(() => play(g, 'e2e4')).toThrow(IllegalMoveError);
    expect(g.undo()).toBe(true); // 기권 취소
    expect(g.status().kind).toBe('playing');
  });

  it('합의 무승부', () => {
    const g = new Game();
    g.agreeDraw();
    expect(g.status()).toEqual({ kind: 'draw', reason: 'agreement' });
  });
});

describe('기물 부족', () => {
  const insufficient = (fen: string) => isInsufficientMaterial(parseFen(fen));

  it('부족한 경우', () => {
    expect(insufficient('4k3/8/8/8/8/8/8/4K3 w - - 0 1')).toBe(true); // K vs K
    expect(insufficient('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1')).toBe(true); // K+B vs K
    expect(insufficient('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1')).toBe(true); // K+N vs K
    expect(insufficient('2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1')).toBe(false); // c8(밝은) vs c1(어두운)
    expect(insufficient('3bk3/8/8/8/8/8/8/2B1K3 w - - 0 1')).toBe(true); // d8 과 c1 은 둘 다 어두운 칸
  });

  it('충분한 경우', () => {
    expect(insufficient('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')).toBe(false);
    expect(insufficient('4k3/8/8/8/8/8/8/R3K3 w - - 0 1')).toBe(false);
    expect(insufficient('4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1')).toBe(false);
    expect(insufficient('1n2k3/8/8/8/8/8/8/2B1K3 w - - 0 1')).toBe(false);
    expect(insufficient('4k3/8/8/8/8/8/8/1BB1K3 w - - 0 1')).toBe(false);
  });

  it('Game.status 에 반영', () => {
    const g = new Game('4k3/8/8/8/8/8/3p4/4K3 w - - 0 1');
    play(g, 'e1d2');
    expect(g.status()).toEqual({ kind: 'draw', reason: 'insufficient' });
  });
});
