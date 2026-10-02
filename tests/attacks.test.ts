import { describe, expect, it } from 'vitest';
import { isInCheck, isSquareAttacked } from '../src/engine/attacks';
import { parseFen } from '../src/engine/fen';
import { parseSquare } from '../src/engine/square';

const sq = (s: string) => parseSquare(s)!;
const attacked = (fen: string, s: string, by: 'w' | 'b') => isSquareAttacked(parseFen(fen).board, sq(s), by);

describe('attacks', () => {
  it('폰은 대각선 앞만 공격한다', () => {
    const fen = '4k3/8/8/8/4P3/8/8/4K3 w - - 0 1';
    expect(attacked(fen, 'd5', 'w')).toBe(true);
    expect(attacked(fen, 'f5', 'w')).toBe(true);
    expect(attacked(fen, 'e5', 'w')).toBe(false);
    expect(attacked(fen, 'd3', 'w')).toBe(false);
  });

  it('흑 폰은 아래 방향 대각선을 공격한다', () => {
    const fen = '4k3/8/8/4p3/8/8/8/4K3 w - - 0 1';
    expect(attacked(fen, 'd4', 'b')).toBe(true);
    expect(attacked(fen, 'd6', 'b')).toBe(false);
  });

  it('나이트', () => {
    const fen = '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1';
    for (const s of ['c2', 'e2', 'b3', 'f3', 'b5', 'f5', 'c6', 'e6']) expect(attacked(fen, s, 'w'), s).toBe(true);
    expect(attacked(fen, 'd5', 'w')).toBe(false);
  });

  it('슬라이딩 기물은 가로막히면 그 너머를 공격하지 못한다', () => {
    const fen = '4k3/8/8/8/R2p3q/8/8/4K3 w - - 0 1';
    expect(attacked(fen, 'd4', 'w')).toBe(true);
    expect(attacked(fen, 'e4', 'w')).toBe(false);
    expect(attacked(fen, 'e1', 'b')).toBe(true); // h4 퀸 -> e1 대각선
    expect(attacked(fen, 'a1', 'w')).toBe(true);
  });

  it('킹', () => {
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    expect(attacked(fen, 'd2', 'w')).toBe(true);
    expect(attacked(fen, 'e3', 'w')).toBe(false);
  });

  it('isInCheck', () => {
    expect(isInCheck(parseFen('4k3/8/8/8/8/8/8/4K2r w - - 0 1').board, 'w')).toBe(true);
    expect(isInCheck(parseFen('4k3/8/8/8/8/8/8/4K2r w - - 0 1').board, 'b')).toBe(false);
  });
});
