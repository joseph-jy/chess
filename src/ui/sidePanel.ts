import type { DrawReason, Game, GameStatus } from '../engine';
import { opposite } from '../engine';
import { COLOR_NAMES } from './pieces';

export interface SidePanelHandlers {
  onUndo(): void;
  onDraw(): void;
  onResign(): void;
  onFlip(): void;
  onNewGame(): void;
}

const DRAW_REASONS: Record<DrawReason, string> = {
  'fifty-move': '50수 규칙',
  threefold: '3회 동형 반복',
  insufficient: '기물 부족',
  agreement: '합의',
};

export function statusText(status: GameStatus): string {
  switch (status.kind) {
    case 'playing':
      return '';
    case 'checkmate':
      return `체크메이트 — ${COLOR_NAMES[status.winner]} 승`;
    case 'stalemate':
      return '스테일메이트 — 무승부';
    case 'draw':
      return `무승부 (${DRAW_REASONS[status.reason]})`;
    case 'resigned':
      return `${COLOR_NAMES[opposite(status.winner)]} 기권 — ${COLOR_NAMES[status.winner]} 승`;
  }
}

export class SidePanel {
  readonly el: HTMLElement;
  private readonly turnEl: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;
  private readonly movesEl: HTMLOListElement;
  private readonly buttons: Record<'undo' | 'draw' | 'resign' | 'flip' | 'newGame', HTMLButtonElement>;

  constructor(handlers: SidePanelHandlers) {
    this.el = document.createElement('aside');
    this.el.className = 'side-panel';

    this.turnEl = document.createElement('div');
    this.turnEl.className = 'turn';
    this.statusEl = document.createElement('div');
    this.statusEl.className = 'status';
    this.statusEl.setAttribute('role', 'status');

    const movesTitle = document.createElement('h2');
    movesTitle.textContent = '기보';
    this.movesEl = document.createElement('ol');
    this.movesEl.className = 'move-list';

    const button = (label: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    };
    this.buttons = {
      undo: button('무르기', handlers.onUndo),
      draw: button('무승부 제안', handlers.onDraw),
      resign: button('기권', handlers.onResign),
      flip: button('보드 뒤집기', handlers.onFlip),
      newGame: button('새 게임', handlers.onNewGame),
    };
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(...Object.values(this.buttons));

    this.el.append(this.turnEl, this.statusEl, movesTitle, this.movesEl, actions);
  }

  render(game: Game): void {
    const status = game.status();
    const over = status.kind !== 'playing';

    this.turnEl.replaceChildren();
    const swatch = document.createElement('span');
    swatch.className = `swatch swatch-${game.turn}`;
    this.turnEl.append(swatch, over ? '대국 종료' : `${COLOR_NAMES[game.turn]} 차례`);

    this.statusEl.textContent = over ? statusText(status) : game.inCheck() ? '체크!' : '';
    this.statusEl.classList.toggle('game-over', over);

    this.renderMoves(game);

    this.buttons.undo.disabled = !game.canUndo();
    this.buttons.draw.disabled = over;
    this.buttons.resign.disabled = over;
  }

  private renderMoves(game: Game): void {
    const sans = game.history();
    const start = game.startPosition;
    // 흑 차례로 시작한 배치면 첫 줄의 백 자리를 비운다
    const plies: (string | null)[] = start.sideToMove === 'b' ? [null, ...sans] : sans;
    const rows: HTMLLIElement[] = [];
    for (let i = 0; i < plies.length; i += 2) {
      const li = document.createElement('li');
      const num = document.createElement('span');
      num.className = 'move-number';
      num.textContent = `${start.fullmove + i / 2}.`;
      li.append(num, sanCell(plies[i] ?? null), sanCell(plies[i + 1] ?? null));
      rows.push(li);
    }
    rows.at(-1)?.querySelectorAll('.san').forEach((el, idx, all) => {
      if (idx === all.length - 1 && el.textContent) el.classList.add('latest');
    });
    this.movesEl.replaceChildren(...rows);
    this.movesEl.scrollTop = this.movesEl.scrollHeight;
  }
}

function sanCell(san: string | null): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'san';
  span.textContent = san ?? '';
  if (san === null) span.classList.add('empty');
  return span;
}
