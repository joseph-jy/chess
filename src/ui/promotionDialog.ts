import type { Color, PromotionType } from '../engine';
import { PROMOTION_TYPES } from '../engine';
import { PIECE_NAMES, pieceElement } from './pieces';

/** 프로모션 기물을 고르는 대화상자. 취소하면 null. 키보드: Q/R/B/N, ←/→, Enter, Esc */
export function choosePromotion(color: Color): Promise<PromotionType | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const box = document.createElement('div');
    box.className = 'promotion-dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '프로모션 기물 선택');

    const title = document.createElement('div');
    title.className = 'palette-title';
    title.textContent = '프로모션: 기물을 고르세요 (Q/R/B/N)';

    const row = document.createElement('div');
    row.className = 'promotion-choices';
    const buttons = PROMOTION_TYPES.map((type) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'promotion-choice';
      btn.title = `${PIECE_NAMES[type]} (${type.toUpperCase()})`;
      btn.append(pieceElement({ color, type }));
      btn.addEventListener('click', () => finish(type));
      return btn;
    });
    row.append(...buttons);
    box.append(title, row);
    backdrop.append(box);
    document.body.append(backdrop);

    const finish = (result: PromotionType | null) => {
      backdrop.remove();
      resolve(result);
    };

    box.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if ((PROMOTION_TYPES as readonly string[]).includes(key)) {
        finish(key as PromotionType);
      } else if (e.code === 'KeyQ' || e.code === 'KeyR' || e.code === 'KeyB' || e.code === 'KeyN') {
        finish(e.code.slice(3).toLowerCase() as PromotionType); // 한글 입력 상태
      } else if (e.key === 'Escape') {
        finish(null);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const step = e.key === 'ArrowRight' ? 1 : -1;
        buttons[(idx + step + buttons.length) % buttons.length]?.focus();
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    });
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) finish(null);
    });

    buttons[0]?.focus();
  });
}
