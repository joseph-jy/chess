import { describe, expect, it } from 'vitest';
import { parseFen } from '../src/engine/fen';
import { perft } from '../src/engine/movegen';

// https://www.chessprogramming.org/Perft_Results
const CASES: [name: string, fen: string, counts: number[]][] = [
  ['시작', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
  ['Kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, 4085603]],
  ['Position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['Position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['Position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, 2103487]],
];

// src 에 node 타입이 섞이지 않도록 @types/node 대신 필요한 것만 선언한다
declare const process: { env: Record<string, string | undefined> };

// depth 4 는 느리므로 PERFT_DEEP=1 일 때만 실행한다 (npm run perft)
const maxDepth = process.env.PERFT_DEEP ? 4 : 3;

describe('perft', () => {
  for (const [name, fen, counts] of CASES) {
    counts.slice(0, maxDepth).forEach((expected, i) => {
      it(`${name} depth ${i + 1} = ${expected}`, { timeout: 600_000 }, () => {
        expect(perft(parseFen(fen), i + 1)).toBe(expected);
      });
    });
  }
});
