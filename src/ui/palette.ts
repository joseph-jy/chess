/**
 * 키보드 명령 팔레트: 입력창 + 후보 목록.
 * 입력하면 목록이 필터링되고, ↑/↓ 로 고르고 Enter 로 확정, Esc 로 닫는다.
 */

export interface PaletteItem<T> {
  label: string;
  hint?: string;
  /** 필터링에 쓰는 문자열들 (정규화해서 부분 일치) */
  search: string[];
  value: T;
}

export type ResolveResult<T> = { value: T } | { error: string } | null;

export interface PaletteOptions<T> {
  title: string;
  placeholder: string;
  items: PaletteItem<T>[];
  /** 목록이 비었을 때 보여줄 문구 */
  emptyText?: string;
  /**
   * Enter 시 입력 문자열을 직접 해석한다 (예: 칸 이름).
   * null 이면 목록에서 강조된 항목을 고른다.
   */
  resolve?(text: string): ResolveResult<T>;
  onPick(value: T): void;
  onClose?(): void;
}

let current: { close(): void } | null = null;

export function isPaletteOpen(): boolean {
  return current !== null;
}

export function closePalette(): void {
  current?.close();
}

export function normalizeQuery(s: string): string {
  return s.toLowerCase().replace(/[\s=\-]/g, '');
}

export function openPalette<T>(opts: PaletteOptions<T>): void {
  closePalette();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const box = document.createElement('div');
  box.className = 'palette';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', opts.title);

  const title = document.createElement('div');
  title.className = 'palette-title';
  title.textContent = opts.title;

  const input = document.createElement('input');
  input.className = 'palette-input';
  input.placeholder = opts.placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');

  const error = document.createElement('div');
  error.className = 'palette-error';
  error.setAttribute('role', 'alert');

  const list = document.createElement('ul');
  list.className = 'palette-list';
  list.setAttribute('role', 'listbox');
  list.id = 'palette-list';
  input.setAttribute('aria-controls', list.id);

  box.append(title, input, error, list);
  backdrop.append(box);
  document.body.append(backdrop);

  let visible: PaletteItem<T>[] = [];
  let highlight = 0;
  // 사용자가 화살표로 직접 고른 경우에는 입력 문자열 해석보다 목록 선택을 우선한다
  let navigated = false;

  const renderList = () => {
    const q = normalizeQuery(input.value);
    visible = opts.items.filter((it) => q === '' || it.search.some((s) => normalizeQuery(s).includes(q)));
    highlight = Math.min(highlight, Math.max(visible.length - 1, 0));
    list.replaceChildren(
      ...visible.map((it, i) => {
        const li = document.createElement('li');
        li.className = 'palette-item' + (i === highlight ? ' active' : '');
        li.id = `palette-item-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === highlight));
        const label = document.createElement('span');
        label.textContent = it.label;
        li.append(label);
        if (it.hint) {
          const hint = document.createElement('span');
          hint.className = 'palette-hint';
          hint.textContent = it.hint;
          li.append(hint);
        }
        li.addEventListener('mousedown', (e) => {
          e.preventDefault(); // 입력창 포커스 유지
          pick(it.value);
        });
        return li;
      }),
    );
    if (visible.length === 0) {
      const li = document.createElement('li');
      li.className = 'palette-empty';
      li.textContent = opts.items.length === 0 ? (opts.emptyText ?? '후보가 없습니다') : '일치하는 항목이 없습니다';
      list.append(li);
    }
    input.setAttribute('aria-activedescendant', visible.length ? `palette-item-${highlight}` : '');
    list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  };

  const close = () => {
    if (current !== handle) return;
    current = null;
    backdrop.remove();
    opts.onClose?.();
  };

  const pick = (value: T) => {
    close();
    opts.onPick(value);
  };

  const submit = () => {
    const text = input.value.trim();
    const highlighted = visible[highlight];
    if (navigated && highlighted) return pick(highlighted.value);
    if (text && opts.resolve) {
      const r = opts.resolve(text);
      if (r && 'value' in r) return pick(r.value);
      if (r && 'error' in r) {
        error.textContent = r.error;
        return;
      }
    }
    if (highlighted) return pick(highlighted.value);
    error.textContent = text ? `'${text}' 에 해당하는 항목이 없습니다` : (opts.emptyText ?? '후보가 없습니다');
  };

  input.addEventListener('input', () => {
    error.textContent = '';
    highlight = 0;
    navigated = false;
    renderList();
  });

  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (visible.length === 0) break;
        const step = e.key === 'ArrowDown' ? 1 : -1;
        highlight = (highlight + step + visible.length) % visible.length;
        navigated = true;
        renderList();
        break;
      }
      case 'Enter':
        submit();
        break;
      case 'Escape':
        close();
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  });

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });

  const handle = { close };
  current = handle;
  renderList();
  input.focus();
}
