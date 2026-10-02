import type { Color, Piece, PieceType } from '../engine';

// 흰/검 기물 모두 채워진 글리프를 쓰고 색은 CSS 로 칠한다. ︎ 는 이모지 렌더링 방지.
const GLYPHS: Record<PieceType, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

export function pieceGlyph(type: PieceType): string {
  return GLYPHS[type] + '︎';
}

export const PIECE_NAMES: Record<PieceType, string> = {
  k: '킹', q: '퀸', r: '룩', b: '비숍', n: '나이트', p: '폰',
};

export const COLOR_NAMES: Record<Color, string> = { w: '백', b: '흑' };

export function pieceElement(piece: Piece): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `piece piece-${piece.color}`;
  span.textContent = pieceGlyph(piece.type);
  span.setAttribute('aria-label', `${COLOR_NAMES[piece.color]} ${PIECE_NAMES[piece.type]}`);
  return span;
}

/** 받침 유무에 따라 '으로'/'로' 를 붙인다 (ㄹ 받침은 '로') */
export function withEuro(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}으로`;
  const jong = code % 28;
  return word + (jong === 0 || jong === 8 ? '로' : '으로');
}
