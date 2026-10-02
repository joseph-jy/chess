import { describe, expect, it } from 'vitest';
import { parseFen, toFen } from '../src/engine/fen';
import { Game } from '../src/engine/game';
import { PRESETS, availableCastling, editMove, editPlace, validateSetup } from '../src/engine/setup';
import { parseSquare } from '../src/engine/square';

const sq = (s: string) => parseSquare(s)!;
const KINGS = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';

describe('editPlace / editMove', () => {
  it('빈 칸이나 일반 기물 위에 놓기/지우기', () => {
    const b = parseFen(KINGS).board;
    const b2 = editPlace(b, sq('d4'), { color: 'w', type: 'q' })!;
    expect(b2.get(sq('d4'))).toEqual({ color: 'w', type: 'q' });
    expect(b.get(sq('d4'))).toBeNull(); // 원본 불변
    const b3 = editPlace(b2, sq('d4'), { color: 'b', type: 'n' })!;
    expect(b3.get(sq('d4'))).toEqual({ color: 'b', type: 'n' });
    expect(editPlace(b3, sq('d4'), null)!.get(sq('d4'))).toBeNull();
  });

  it('킹은 지우거나 덮어쓸 수 없고 추가할 수도 없다', () => {
    const b = parseFen(KINGS).board;
    expect(editPlace(b, sq('e1'), null)).toBeNull();
    expect(editPlace(b, sq('e8'), { color: 'w', type: 'q' })).toBeNull();
    expect(editPlace(b, sq('d4'), { color: 'w', type: 'k' })).toBeNull();
  });

  it('킹은 이동할 수 있고, 다른 기물로 킹을 덮을 수는 없다', () => {
    const b = editPlace(parseFen(KINGS).board, sq('d4'), { color: 'w', type: 'r' })!;
    const moved = editMove(b, sq('e1'), sq('d4'))!; // 킹이 룩 자리로 (룩은 사라짐)
    expect(moved.get(sq('d4'))).toEqual({ color: 'w', type: 'k' });
    expect(moved.find('w', 'r')).toEqual([]);
    expect(editMove(b, sq('d4'), sq('e8'))).toBeNull();
    expect(editMove(b, sq('e1'), sq('e8'))).toBeNull();
    expect(editMove(b, sq('a5'), sq('a6'))).toBeNull(); // 빈 칸
  });
});

describe('availableCastling', () => {
  it('킹과 룩이 원래 칸에 있을 때만', () => {
    expect(availableCastling(parseFen('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1').board)).toEqual({ wK: true, wQ: true, bK: true, bQ: true });
    expect(availableCastling(parseFen('r3k1r1/8/8/8/8/8/8/R2K3R w - - 0 1').board)).toEqual({ wK: false, wQ: false, bK: false, bQ: true });
    expect(availableCastling(parseFen('R3k2r/8/8/8/8/8/8/r3K2R w - - 0 1').board)).toEqual({ wK: true, wQ: false, bK: true, bQ: false });
  });
});

describe('validateSetup', () => {
  it('정상 배치', () => {
    for (const p of PRESETS) expect(validateSetup(parseFen(p.fen)), p.name).toEqual({ ok: true });
  });

  it('킹 개수', () => {
    const r = validateSetup(parseFen('4k3/8/8/8/8/8/8/8 w - - 0 1'));
    expect(r.ok).toBe(false);
    expect(validateSetup(parseFen('4k3/8/8/8/8/8/8/K3K3 w - - 0 1')).ok).toBe(false);
  });

  it('1·8랭크 폰', () => {
    const r = validateSetup(parseFen('4k2P/8/8/8/8/8/8/4K3 w - - 0 1'));
    expect(r).toEqual({ ok: false, errors: [expect.stringContaining('h8')] });
    expect(validateSetup(parseFen('4k3/8/8/8/8/8/8/p3K3 w - - 0 1')).ok).toBe(false);
  });

  it('차례가 아닌 쪽이 체크당한 상태', () => {
    expect(validateSetup(parseFen('4k3/8/8/8/8/8/8/4K2r w - - 0 1')).ok).toBe(true); // 백 차례에 백이 체크: 가능
    expect(validateSetup(parseFen('4k3/8/8/8/8/8/8/4K2r b - - 0 1')).ok).toBe(false); // 흑 차례인데 백이 체크
  });

  it('맞붙은 킹은 시작 불가', () => {
    expect(validateSetup(parseFen('8/8/8/8/8/8/3k4/4K3 w - - 0 1')).ok).toBe(false);
  });

  it('원래 칸에 없는 킹/룩의 캐슬링 권한', () => {
    expect(validateSetup(parseFen('4k3/8/8/8/8/8/8/R3K3 w K - 0 1')).ok).toBe(false);
    expect(validateSetup(parseFen('4k3/8/8/8/8/8/8/R3K3 w Q - 0 1')).ok).toBe(true);
  });

  it('흑 선 배치로 대국 시작', () => {
    const g = new Game('4k3/8/8/8/8/8/8/QQQQKQQQ b - - 0 1');
    expect(g.turn).toBe('b');
    expect(toFen(g.position)).toBe('4k3/8/8/8/8/8/8/QQQQKQQQ b - - 0 1');
  });
});
