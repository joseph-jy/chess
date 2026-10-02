import { makeSquare, squareName, type Board, type Square } from '../engine';
import { pieceElement } from './pieces';

export type TargetKind = 'move' | 'capture';

export interface BoardViewState {
  board: Board;
  flipped: boolean;
  selected?: Square | null;
  /** 합법 목적지: 빈 칸 이동과 잡기를 구분해서 표시 */
  targets?: ReadonlyMap<Square, TargetKind>;
  /** 클릭해서 선택할 수 있는 칸 (커서 표시용) */
  movable?: ReadonlySet<Square>;
  lastMove?: { from: Square; to: Square } | null;
  check?: Square | null;
}

export interface BoardViewHandlers {
  onSquareClick(sq: Square): void;
  /** 지정하면 기물을 드래그해서 옮길 수 있다 */
  onDragMove?(from: Square, to: Square): void;
}

export class BoardView {
  readonly el: HTMLDivElement;

  constructor(private readonly handlers: BoardViewHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.el.setAttribute('role', 'grid');
    this.el.addEventListener('click', (e) => {
      const sq = squareFromEvent(e);
      if (sq !== null) handlers.onSquareClick(sq);
    });
    if (handlers.onDragMove) {
      this.el.addEventListener('dragstart', (e) => {
        const sq = squareFromEvent(e);
        if (sq === null || !e.dataTransfer) return;
        e.dataTransfer.setData('text/plain', String(sq));
        e.dataTransfer.effectAllowed = 'move';
      });
      this.el.addEventListener('dragover', (e) => e.preventDefault());
      this.el.addEventListener('drop', (e) => {
        e.preventDefault();
        const to = squareFromEvent(e);
        const from = Number(e.dataTransfer?.getData('text/plain'));
        if (to !== null && Number.isInteger(from) && from >= 0 && from < 64) handlers.onDragMove?.(from, to);
      });
    }
  }

  render(state: BoardViewState): void {
    const cells: HTMLElement[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const rank = state.flipped ? row : 7 - row;
        const file = state.flipped ? 7 - col : col;
        cells.push(this.renderCell(state, makeSquare(file, rank), row, col));
      }
    }
    this.el.replaceChildren(...cells);
  }

  private renderCell(state: BoardViewState, sq: Square, row: number, col: number): HTMLElement {
    const cell = document.createElement('div');
    const name = squareName(sq);
    const isLight = (sq % 8) % 2 !== Math.floor(sq / 8) % 2;
    const classes = ['square', isLight ? 'light' : 'dark'];
    if (state.selected === sq) classes.push('selected');
    if (state.lastMove && (state.lastMove.from === sq || state.lastMove.to === sq)) classes.push('last-move');
    if (state.check === sq) classes.push('in-check');
    if (state.movable?.has(sq)) classes.push('movable');
    const target = state.targets?.get(sq);
    if (target) classes.push(`target-${target}`);
    cell.className = classes.join(' ');
    cell.dataset.square = String(sq);
    cell.setAttribute('role', 'gridcell');
    cell.title = name;

    const piece = state.board.get(sq);
    if (piece) {
      const el = pieceElement(piece);
      if (this.handlers.onDragMove) el.draggable = true;
      cell.append(el);
    }

    if (col === 0) cell.append(coord('coord-rank', name[1]!));
    if (row === 7) cell.append(coord('coord-file', name[0]!));
    return cell;
  }
}

function coord(className: string, text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `coord ${className}`;
  span.textContent = text;
  return span;
}

function squareFromEvent(e: Event): Square | null {
  const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-square]');
  return cell ? Number(cell.dataset.square) : null;
}
