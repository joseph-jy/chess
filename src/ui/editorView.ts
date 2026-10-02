import {
  PRESETS, availableCastling, editMove, editPlace, presetBoard, toFen, validateSetup,
  type Board, type CastlingRights, type Color, type Piece, type PieceType, type Position, type Square,
} from '../engine';
import { BoardView } from './boardView';
import { COLOR_NAMES, PIECE_NAMES, pieceElement } from './pieces';

export interface EditorViewOptions {
  onStart(fen: string): void;
  onBack(): void;
}

type Tool = { kind: 'hand' } | { kind: 'erase' } | { kind: 'piece'; piece: Piece };

// 킹은 추가할 수 없으므로 팔레트에 없다 (항상 양 진영 1개씩 유지)
const PLACEABLE: PieceType[] = ['q', 'r', 'b', 'n', 'p'];
const CASTLING_LABELS: [keyof CastlingRights, string][] = [
  ['wK', '백 O-O'], ['wQ', '백 O-O-O'], ['bK', '흑 O-O'], ['bQ', '흑 O-O-O'],
];

/** 배치 편집 화면 */
export function mountEditorView(root: HTMLElement, opts: EditorViewOptions): () => void {
  let board: Board = presetBoard('standard');
  let tool: Tool = { kind: 'hand' };
  let pickup: Square | null = null; // 손 도구로 집어 든 기물
  let sideToMove: Color = 'w';
  let flipped = false;
  // 사용자가 원하는 캐슬링 권한. 실제 부여는 킹/룩이 원래 칸에 있을 때만
  const wantCastling: CastlingRights = { wK: true, wQ: true, bK: true, bQ: true };
  let message = '';

  const boardView = new BoardView({
    onSquareClick,
    onDragMove(from, to) {
      pickup = null;
      applyEdit(editMove(board, from, to));
    },
  });

  const screen = document.createElement('div');
  screen.className = 'editor-screen';

  // 도구 팔레트
  const tools = document.createElement('div');
  tools.className = 'editor-tools';
  const toolButtons: { tool: Tool; el: HTMLButtonElement }[] = [];
  const addTool = (t: Tool, content: Node | string, title: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool';
    b.title = title;
    b.append(content);
    b.addEventListener('click', () => {
      tool = t;
      pickup = null;
      render();
    });
    toolButtons.push({ tool: t, el: b });
    tools.append(b);
  };
  addTool({ kind: 'hand' }, '✋', '이동 (기물을 클릭해서 집고, 놓을 칸을 클릭)');
  addTool({ kind: 'erase' }, '⌫', '지우개');
  for (const color of ['w', 'b'] as const) {
    for (const type of PLACEABLE) {
      const piece = { color, type };
      addTool({ kind: 'piece', piece }, pieceElement(piece), `${COLOR_NAMES[color]} ${PIECE_NAMES[type]} 놓기`);
    }
  }

  const boardWrap = document.createElement('div');
  boardWrap.className = 'board-wrap';
  boardWrap.append(boardView.el);

  // 설정 패널
  const panel = document.createElement('aside');
  panel.className = 'side-panel';

  const presetRow = section('프리셋');
  for (const p of PRESETS) {
    presetRow.append(button(p.name, () => {
      board = presetBoard(p.id);
      pickup = null;
      message = '';
      render();
    }));
  }

  const sideRow = section('먼저 둘 진영');
  const sideInputs = (['w', 'b'] as const).map((color) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'side-to-move';
    input.addEventListener('change', () => {
      sideToMove = color;
      render();
    });
    label.append(input, ` ${COLOR_NAMES[color]}`);
    sideRow.append(label);
    return { color, input };
  });

  const castlingRow = section('캐슬링 권한');
  const castlingInputs = CASTLING_LABELS.map(([key, text]) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => {
      wantCastling[key] = input.checked;
      render();
    });
    label.append(input, ` ${text}`);
    castlingRow.append(label);
    return { key, input, label };
  });

  const messageEl = document.createElement('div');
  messageEl.className = 'editor-message';
  messageEl.setAttribute('role', 'status');
  const errorsEl = document.createElement('ul');
  errorsEl.className = 'setup-errors';
  const fenEl = document.createElement('input');
  fenEl.className = 'fen';
  fenEl.readOnly = true;
  fenEl.setAttribute('aria-label', 'FEN');

  const actions = document.createElement('div');
  actions.className = 'actions';
  const startBtn = button('대국 시작', () => {
    if (validateSetup(currentPosition()).ok) opts.onStart(toFen(currentPosition()));
  });
  startBtn.classList.add('primary');
  actions.append(
    startBtn,
    button('보드 뒤집기', () => {
      flipped = !flipped;
      render();
    }),
    button('뒤로', opts.onBack),
  );

  panel.append(presetRow, sideRow, castlingRow, messageEl, errorsEl, fenEl, actions);
  screen.append(tools, boardWrap, panel);
  const help = document.createElement('footer');
  help.className = 'shortcut-bar';
  help.textContent = '도구를 고르고 칸을 클릭하세요 · 기물은 드래그로도 옮길 수 있습니다 · 킹은 이동만 가능합니다';
  root.replaceChildren(screen, help);

  render();

  function currentPosition(): Position {
    const avail = availableCastling(board);
    const castling = {
      wK: avail.wK && wantCastling.wK,
      wQ: avail.wQ && wantCastling.wQ,
      bK: avail.bK && wantCastling.bK,
      bQ: avail.bQ && wantCastling.bQ,
    };
    return { board, sideToMove, castling, epSquare: null, halfmove: 0, fullmove: 1 };
  }

  function applyEdit(next: Board | null): void {
    if (next) {
      board = next;
      message = '';
    } else {
      message = '킹은 지우거나 덮어쓸 수 없습니다. 킹은 이동만 가능합니다.';
    }
    render();
  }

  function onSquareClick(sq: Square): void {
    const here = board.get(sq);
    switch (tool.kind) {
      case 'hand':
        if (pickup === null) {
          pickup = here ? sq : null;
          render();
        } else if (pickup === sq) {
          pickup = null;
          render();
        } else {
          const from = pickup;
          pickup = null;
          applyEdit(editMove(board, from, sq));
        }
        break;
      case 'erase':
        if (here) applyEdit(editPlace(board, sq, null));
        break;
      case 'piece': {
        // 같은 기물이 있는 칸을 다시 클릭하면 지운다
        const same = here && here.color === tool.piece.color && here.type === tool.piece.type;
        applyEdit(editPlace(board, sq, same ? null : tool.piece));
        break;
      }
    }
  }

  function render(): void {
    boardView.render({ board, flipped, selected: pickup });
    for (const { tool: t, el } of toolButtons) {
      const active =
        t.kind === tool.kind &&
        (t.kind !== 'piece' || (tool.kind === 'piece' && t.piece.color === tool.piece.color && t.piece.type === tool.piece.type));
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', String(active));
    }
    for (const { color, input } of sideInputs) input.checked = color === sideToMove;

    const pos = currentPosition();
    const avail = availableCastling(board);
    for (const { key, input, label } of castlingInputs) {
      input.disabled = !avail[key];
      input.checked = pos.castling[key];
      label.classList.toggle('disabled', !avail[key]);
      label.title = avail[key] ? '' : '킹과 룩이 원래 칸에 있어야 합니다';
    }

    const result = validateSetup(pos);
    errorsEl.replaceChildren(
      ...(result.ok ? [] : result.errors).map((e) => {
        const li = document.createElement('li');
        li.textContent = e;
        return li;
      }),
    );
    startBtn.disabled = !result.ok;
    messageEl.textContent = message;
    fenEl.value = toFen(pos);
  }

  return () => {};
}

function section(title: string): HTMLElement {
  const el = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = title;
  el.append(legend);
  return el;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
