import { describe, expect, it } from 'vitest';
import { parseFen, toFen } from '../src/engine/fen';
import { applyMove, legalMoves } from '../src/engine/movegen';
import { parseSquare, squareName } from '../src/engine/square';
import type { Move } from '../src/engine/types';

const sq = (s: string) => parseSquare(s)!;
const movesFrom = (fen: string, from: string): Move[] => legalMoves(parseFen(fen)).filter((m) => m.from === sq(from));
const targets = (fen: string, from: string) => movesFrom(fen, from).map((m) => squareName(m.to)).sort();

describe('movegen: 폰', () => {
  it('시작 칸에서 1칸/2칸 전진', () => {
    expect(targets('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'e2')).toEqual(['e3', 'e4']);
  });

  it('막혀 있으면 전진 불가, 2칸 전진은 사이 칸도 비어야 한다', () => {
    expect(targets('4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1', 'e2')).toEqual([]);
    expect(targets('4k3/8/8/8/4n3/8/4P3/4K3 w - - 0 1', 'e2')).toEqual(['e3']);
  });

  it('대각 잡기 (자기 기물은 못 잡음)', () => {
    expect(targets('4k3/8/8/3p1P2/4P3/8/8/4K3 w - - 0 1', 'e4')).toEqual(['d5', 'e5']);
  });

  it('앙파상', () => {
    const fen = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
    const ep = movesFrom(fen, 'e5').find((m) => m.flags === 'ep')!;
    expect(squareName(ep.to)).toBe('f6');
    expect(ep.captured).toEqual({ color: 'b', type: 'p' });
    const after = applyMove(parseFen(fen), ep);
    expect(after.board.get(sq('f5'))).toBeNull();
    expect(after.board.get(sq('f6'))).toEqual({ color: 'w', type: 'p' });
    // d5 는 앙파상 대상이 아님
    expect(targets(fen, 'e5')).toEqual(['e6', 'f6']);
  });

  it('앙파상으로 자기 킹이 열리면 불가 (가로 핀)', () => {
    expect(movesFrom('8/8/8/KPp4r/8/8/8/4k3 w - c6 0 1', 'b5').some((m) => m.flags === 'ep')).toBe(false);
  });

  it('프로모션은 Q/R/B/N 4개 수를 만든다 (잡기 포함)', () => {
    const moves = movesFrom('3r3k/4P3/8/8/8/8/8/4K3 w - - 0 1', 'e7');
    expect(moves).toHaveLength(8);
    expect(moves.every((m) => m.flags === 'promo')).toBe(true);
    expect(moves.filter((m) => m.captured).map((m) => m.promotion).sort()).toEqual(['b', 'n', 'q', 'r']);
    const after = applyMove(parseFen('3r3k/4P3/8/8/8/8/8/4K3 w - - 0 1'), moves.find((m) => m.promotion === 'n' && !m.captured)!);
    expect(after.board.get(sq('e8'))).toEqual({ color: 'w', type: 'n' });
  });

  it('2칸 전진 후 epSquare 설정', () => {
    const pos = parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    const m = legalMoves(pos).find((m) => m.flags === 'double')!;
    expect(squareName(applyMove(pos, m).epSquare!)).toBe('e3');
  });
});

describe('movegen: 캐슬링', () => {
  const base = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';

  it('양쪽 캐슬링 가능', () => {
    expect(targets(base, 'e1')).toContain('g1');
    expect(targets(base, 'e1')).toContain('c1');
  });

  it('캐슬링 적용 시 룩도 이동, 권한 소멸', () => {
    const pos = parseFen(base);
    const m = legalMoves(pos).find((m) => m.flags === 'castleK')!;
    expect(toFen(applyMove(pos, m))).toBe('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1');
    const q = legalMoves(pos).find((m) => m.flags === 'castleQ')!;
    expect(toFen(applyMove(pos, q))).toBe('r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1');
  });

  it('권한이 없으면 불가', () => {
    expect(targets('r3k2r/8/8/8/8/8/8/R3K2R w Qkq - 0 1', 'e1')).not.toContain('g1');
  });

  it('사이 칸이 막혀 있으면 불가 (퀸사이드는 b 파일도)', () => {
    expect(targets('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1', 'e1')).not.toContain('c1');
  });

  it('체크 중이면 불가', () => {
    const t = targets('r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1', 'e1');
    expect(t).not.toContain('g1');
    expect(t).not.toContain('c1');
  });

  it('통과 칸/도착 칸이 공격받으면 불가, b1 공격은 상관없음', () => {
    expect(targets('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1', 'e1')).not.toContain('g1'); // f1 공격(f2 룩은 e1 도 공격 X)
    expect(targets('r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1', 'e1')).not.toContain('g1');
    expect(targets('r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1', 'e1')).toContain('c1');
  });

  it('룩이 잡히면 권한 소멸', () => {
    const pos = parseFen('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1');
    const m = legalMoves(pos).find((m) => m.from === sq('g2') && m.to === sq('h1'))!;
    expect(applyMove(pos, m).castling).toEqual({ wK: false, wQ: true, bK: true, bQ: true });
  });
});

describe('movegen: 합법성 필터', () => {
  it('핀된 기물은 핀 라인 밖으로 못 움직인다', () => {
    expect(targets('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1', 'e2')).toEqual([]);
    expect(targets('4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1', 'e2')).toEqual(['e3', 'e4', 'e5', 'e6', 'e7']);
  });

  it('체크 중에는 체크를 피하는 수만', () => {
    const moves = legalMoves(parseFen('4k3/8/8/8/8/8/3P4/r3K3 w - - 0 1'));
    expect(moves.map((m) => squareName(m.to)).sort()).toEqual(['e2', 'f2']);
  });

  it('킹은 공격받는 칸으로 못 간다', () => {
    expect(targets('4k3/8/8/8/8/8/8/r3K3 w - - 0 1', 'e1')).toEqual(['d2', 'e2', 'f2']);
  });
});
