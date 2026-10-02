import {
  Game, opposite, parseSquare, squareName,
  type Move, type MoveInput, type PromotionType, type Square,
} from '../engine';
import { BoardView, type TargetKind } from './boardView';
import { closePalette, isPaletteOpen, openPalette, type PaletteItem } from './palette';
import { COLOR_NAMES, PIECE_NAMES, pieceGlyph, withEuro } from './pieces';
import { choosePromotion } from './promotionDialog';
import { bindShortcuts, shortcutHelp } from './shortcuts';
import { SidePanel } from './sidePanel';

export interface GameViewOptions {
  onNewGame(): void;
}

/** 대국 화면. 마우스 선택과 키보드 선택은 같은 selected 상태를 공유한다. */
export function mountGameView(root: HTMLElement, fen: string | undefined, opts: GameViewOptions): () => void {
  const game = new Game(fen);
  let selected: Square | null = null;
  let flipped = false;
  let busy = false; // 프로모션 대화상자가 열려 있는 동안

  const boardView = new BoardView({ onSquareClick });
  const panel = new SidePanel({
    onUndo: undo,
    onDraw() {
      if (confirm(`${COLOR_NAMES[game.turn]}이 무승부를 제안합니다. ${COLOR_NAMES[opposite(game.turn)]}도 동의합니까?`)) {
        game.agreeDraw();
        deselectAndRender();
      }
    },
    onResign() {
      if (confirm(`${COLOR_NAMES[game.turn]}이 기권합니까?`)) {
        game.resign(game.turn);
        deselectAndRender();
      }
    },
    onFlip() {
      flipped = !flipped;
      render();
    },
    onNewGame() {
      const playing = game.status().kind === 'playing' && game.history().length > 0;
      if (!playing || confirm('진행 중인 대국을 끝내고 새 게임을 시작할까요?')) opts.onNewGame();
    },
  });

  const screen = document.createElement('div');
  screen.className = 'game-screen';
  const boardWrap = document.createElement('div');
  boardWrap.className = 'board-wrap';
  boardWrap.append(boardView.el);
  screen.append(boardWrap, panel.el);
  const help = document.createElement('footer');
  help.className = 'shortcut-bar';
  help.textContent = `${shortcutHelp()} · 칸은 e4 또는 4e 로 입력`;
  root.replaceChildren(screen, help);

  const unbind = bindShortcuts({
    select: () => !busy && openSelectPalette(false),
    move: () => !busy && openMovePalette(),
    undo: () => !busy && !isPaletteOpen() && undo(),
    cancel: () => !busy && !isPaletteOpen() && deselectAndRender(),
  });

  render();

  function render(): void {
    const targets = new Map<Square, TargetKind>();
    if (selected !== null) {
      for (const m of game.legalMovesFrom(selected)) targets.set(m.to, m.captured ? 'capture' : 'move');
    }
    const last = game.lastMove();
    boardView.render({
      board: game.position.board,
      flipped,
      selected,
      targets,
      movable: new Set(game.legalMoves().map((m) => m.from)),
      lastMove: last && { from: last.from, to: last.to },
      check: game.inCheck() ? game.position.board.kingSquare(game.turn) : null,
    });
    panel.render(game);
  }

  function deselectAndRender(): void {
    selected = null;
    render();
  }

  function select(sq: Square | null): void {
    selected = sq !== null && game.legalMovesFrom(sq).length > 0 ? sq : null;
    render();
  }

  function onSquareClick(sq: Square): void {
    if (busy) return;
    if (selected !== null && sq !== selected && game.legalMovesFrom(selected).some((m) => m.to === sq)) {
      void tryMove({ from: selected, to: sq });
    } else if (sq === selected) {
      select(null);
    } else {
      select(sq); // 움직일 수 없는 칸이면 선택 해제
    }
  }

  function undo(): void {
    if (game.undo()) deselectAndRender();
  }

  /** 수를 둔다. 프로모션 기물이 정해지지 않았으면 대화상자로 묻는다. */
  async function tryMove(input: MoveInput): Promise<void> {
    const candidates = game.legalMovesFrom(input.from).filter((m) => m.to === input.to);
    if (candidates.length === 0) return;
    let promotion: PromotionType | undefined = input.promotion;
    if (!promotion && candidates.some((m) => m.promotion)) {
      busy = true;
      const chosen = await choosePromotion(game.turn);
      busy = false;
      if (!chosen) return render();
      promotion = chosen;
    }
    game.move({ from: input.from, to: input.to, promotion });
    deselectAndRender();
  }

  /** 선택 팔레트. thenMove 면 기물을 고른 뒤 바로 이동 팔레트를 연다. */
  function openSelectPalette(thenMove: boolean): void {
    const movable = [...new Set(game.legalMoves().map((m) => m.from))].sort((a, b) => a - b);
    const items: PaletteItem<Square>[] = movable.map((sq) => {
      const piece = game.position.board.get(sq)!;
      const name = squareName(sq);
      return {
        label: `${pieceGlyph(piece.type)} ${name}`,
        hint: PIECE_NAMES[piece.type],
        search: [name, reversed(name), PIECE_NAMES[piece.type]],
        value: sq,
      };
    });
    openPalette<Square>({
      title: `기물 선택 — ${COLOR_NAMES[game.turn]} 차례`,
      placeholder: '칸 입력 (예: e2, 2e) 또는 목록에서 선택',
      items,
      emptyText: game.isOver() ? '대국이 끝났습니다' : '움직일 수 있는 기물이 없습니다',
      resolve(text) {
        const sq = parseSquare(text);
        if (sq === null) return null;
        if (movable.includes(sq)) return { value: sq };
        const piece = game.position.board.get(sq);
        if (!piece) return { error: `${squareName(sq)} 은 빈 칸입니다` };
        if (piece.color !== game.turn) return { error: `${squareName(sq)} 은 상대 기물입니다` };
        return { error: `${squareName(sq)} 의 ${PIECE_NAMES[piece.type]}은 움직일 수 있는 수가 없습니다` };
      },
      onPick(sq) {
        select(sq);
        if (thenMove) openMovePalette();
      },
    });
  }

  /** 이동 팔레트. 선택된 기물이 없으면 선택 팔레트를 먼저 연다. */
  function openMovePalette(): void {
    if (selected === null) return openSelectPalette(true);
    const from = selected;
    const piece = game.position.board.get(from)!;
    const moves = game.legalMovesFrom(from);
    const items: PaletteItem<MoveInput>[] = moves.map((m) => moveItem(m));
    openPalette<MoveInput>({
      title: `이동 — ${pieceGlyph(piece.type)} ${squareName(from)}`,
      placeholder: '목적지 입력 (예: e4, 4e, e8=Q) 또는 목록에서 선택',
      items,
      resolve(text) {
        const t = text.replace(/[\s=]/g, '');
        let sq = parseSquare(t);
        let promotion: PromotionType | undefined;
        if (sq === null) {
          const m = /^(.{2})([qrbn])$/i.exec(t);
          sq = m ? parseSquare(m[1]!) : null;
          if (sq === null) return null;
          promotion = m![2]!.toLowerCase() as PromotionType;
        }
        const found = moves.filter((mv) => mv.to === sq && (!promotion || mv.promotion === promotion));
        if (found.length === 0) return { error: `${squareName(from)} → ${squareName(sq)} 은 둘 수 없는 수입니다` };
        // 프로모션 기물을 안 정했으면 tryMove 가 대화상자로 묻는다
        return { value: { from, to: sq, promotion } };
      },
      onPick(input) {
        void tryMove(input);
      },
    });
  }

  return () => {
    unbind();
    closePalette();
  };
}

function moveItem(m: Move): PaletteItem<MoveInput> {
  const to = squareName(m.to);
  const promo = m.promotion ? `=${m.promotion.toUpperCase()}` : '';
  let hint = '';
  if (m.flags === 'castleK') hint = '캐슬링 O-O';
  else if (m.flags === 'castleQ') hint = '캐슬링 O-O-O';
  else if (m.flags === 'ep') hint = '앙파상';
  else if (m.captured) hint = `잡기 ${pieceGlyph(m.captured.type)}`;
  if (m.promotion) hint = [hint, `${withEuro(PIECE_NAMES[m.promotion])} 승진`].filter(Boolean).join(', ');
  const search = [to + promo, reversed(to) + promo];
  if (m.flags === 'castleK') search.push('O-O');
  if (m.flags === 'castleQ') search.push('O-O-O');
  return {
    label: `${m.captured ? '×' : '→'} ${to}${promo}`,
    hint,
    search,
    value: { from: m.from, to: m.to, promotion: m.promotion },
  };
}

function reversed(name: string): string {
  return name[1]! + name[0]!;
}
