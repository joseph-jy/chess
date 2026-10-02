/**
 * 단축키 설정. 여기만 바꾸면 된다.
 * `code` 는 KeyboardEvent.code 기준이라 한글 입력 상태에서도 동작한다.
 * 참고: Ctrl+T / Ctrl+N / Ctrl+W 는 브라우저가 예약해서 웹 페이지가 가로챌 수 없다.
 */
export const SHORTCUTS = {
  select: { code: 'KeyS', ctrl: true, label: 'Ctrl+S', description: '기물 선택' },
  move: { code: 'KeyM', ctrl: true, label: 'Ctrl+M', description: '이동' },
  undo: { code: 'KeyZ', ctrl: true, label: 'Ctrl+Z', description: '무르기' },
  cancel: { code: 'Escape', ctrl: false, label: 'Esc', description: '선택 해제' },
} as const;

export type ShortcutAction = keyof typeof SHORTCUTS;

interface Shortcut {
  readonly code: string;
  readonly ctrl: boolean;
}

export function matchesShortcut(e: KeyboardEvent, s: Shortcut): boolean {
  return e.code === s.code && e.ctrlKey === s.ctrl && !e.altKey && !e.shiftKey && !e.metaKey;
}

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/** 단축키를 등록한다. 반환값을 호출하면 해제된다. */
export function bindShortcuts(handlers: Partial<Record<ShortcutAction, () => void>>): () => void {
  const listener = (e: KeyboardEvent) => {
    for (const action of Object.keys(SHORTCUTS) as ShortcutAction[]) {
      const handler = handlers[action];
      if (!handler || !matchesShortcut(e, SHORTCUTS[action])) continue;
      // 입력창 안에서는 브라우저 기본 동작(텍스트 되돌리기 등)을 살린다
      if ((action === 'undo' || action === 'cancel') && isTextInput(e.target)) return;
      e.preventDefault();
      handler();
      return;
    }
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}

export function shortcutHelp(): string {
  return Object.values(SHORTCUTS)
    .map((s) => `${s.label} ${s.description}`)
    .join(' · ');
}
