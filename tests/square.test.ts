import { describe, expect, it } from 'vitest';
import { parseSquare, squareName } from '../src/engine/square';

describe('square', () => {
  it('a1 = 0, h8 = 63, e4 = 28', () => {
    expect(parseSquare('a1')).toBe(0);
    expect(parseSquare('h8')).toBe(63);
    expect(parseSquare('e4')).toBe(28);
  });

  it('"e4", "E4", "4e", "4E" 는 모두 같은 칸', () => {
    for (const s of ['e4', 'E4', '4e', '4E', ' e4 ']) expect(parseSquare(s)).toBe(28);
  });

  it('잘못된 입력은 null', () => {
    for (const s of ['', 'e', 'e9', 'i4', '44', 'ee', 'e4e', 'e0', '9e', 'e 4']) {
      expect(parseSquare(s), s).toBeNull();
    }
  });

  it('squareName 은 parseSquare 의 역함수', () => {
    for (let sq = 0; sq < 64; sq++) expect(parseSquare(squareName(sq))).toBe(sq);
  });
});
