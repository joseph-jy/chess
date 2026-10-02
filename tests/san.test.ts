import { describe, expect, it } from 'vitest';
import { parseFen } from '../src/engine/fen';
import { legalMoves } from '../src/engine/movegen';
import { toSan } from '../src/engine/san';
import { parseSquare } from '../src/engine/square';

function san(fen: string, uci: string): string {
  const pos = parseFen(fen);
  const from = parseSquare(uci.slice(0, 2));
  const to = parseSquare(uci.slice(2, 4));
  const promo = uci[4];
  const move = legalMoves(pos).find((m) => m.from === from && m.to === to && (promo ? m.promotion === promo : true));
  if (!move) throw new Error(`no move ${uci}`);
  return toSan(pos, move);
}

describe('san', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('기본', () => {
    expect(san(start, 'e2e4')).toBe('e4');
    expect(san(start, 'g1f3')).toBe('Nf3');
  });

  it('잡기', () => {
    expect(san('4k3/8/8/3p4/4P3/2N5/8/4K3 w - - 0 1', 'e4d5')).toBe('exd5');
    expect(san('4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1', 'c3d5')).toBe('Nxd5');
  });

  it('앙파상', () => {
    expect(san('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5d6')).toBe('exd6');
  });

  it('캐슬링', () => {
    expect(san('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1g1')).toBe('O-O');
    expect(san('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1c1')).toBe('O-O-O');
  });

  it('프로모션', () => {
    expect(san('8/P3k3/8/8/8/8/8/4K3 w - - 0 1', 'a7a8q')).toBe('a8=Q');
    expect(san('1r6/P3k3/8/8/8/8/8/4K3 w - - 0 1', 'a7b8n')).toBe('axb8=N');
  });

  it('체크와 체크메이트', () => {
    expect(san('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8')).toBe('Ra8+');
    expect(san('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8')).toBe('Ra8#');
  });

  it('모호성 해소: 파일', () => {
    expect(san('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1', 'b1d2')).toBe('Nbd2');
  });

  it('모호성 해소: 랭크', () => {
    expect(san('k7/8/8/8/8/4R3/8/4R2K w - - 0 1', 'e1e2')).toBe('R1e2');
  });

  it('모호성 해소: 파일+랭크', () => {
    expect(san('8/8/k7/8/4Q2Q/8/8/K6Q w - - 0 1', 'h4e1')).toBe('Qh4e1');
  });

  it('핀된 기물은 모호성 후보가 아니다', () => {
    // c3 나이트는 핀되어 있어 d5 로 갈 수 없으므로 Ncd5/Nfd5 가 아니라 Nd5
    expect(san('4k3/8/8/8/1b3N2/2N5/8/4K3 w - - 0 1', 'f4d5')).toBe('Nd5');
  });
});
