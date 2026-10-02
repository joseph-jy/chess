import { describe, expect, it } from 'vitest';
import { FenError, START_FEN, parseFen, toFen } from '../src/engine/fen';
import { parseSquare } from '../src/engine/square';

describe('fen', () => {
  it('시작 FEN 왕복', () => {
    expect(toFen(parseFen(START_FEN))).toBe(START_FEN);
  });

  it('여러 FEN 왕복', () => {
    for (const fen of [
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
      '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
      'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    ]) {
      expect(toFen(parseFen(fen))).toBe(fen);
    }
  });

  it('시작 배치 내용', () => {
    const pos = parseFen(START_FEN);
    expect(pos.board.get(parseSquare('e1')!)).toEqual({ color: 'w', type: 'k' });
    expect(pos.board.get(parseSquare('d8')!)).toEqual({ color: 'b', type: 'q' });
    expect(pos.board.get(parseSquare('e4')!)).toBeNull();
    expect(pos.sideToMove).toBe('w');
    expect(pos.castling).toEqual({ wK: true, wQ: true, bK: true, bQ: true });
    expect(pos.epSquare).toBeNull();
  });

  it('halfmove/fullmove 생략 허용', () => {
    expect(toFen(parseFen('4k3/8/8/8/8/8/8/4K3 b - -'))).toBe('4k3/8/8/8/8/8/8/4K3 b - - 0 1');
  });

  it('잘못된 FEN 은 FenError', () => {
    for (const fen of [
      '',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1',
      'rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KX - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e4 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - -1 1',
    ]) {
      expect(() => parseFen(fen), fen).toThrow(FenError);
    }
  });
});
