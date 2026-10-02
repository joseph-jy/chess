import '../styles.css';
import { mountEditorView } from './editorView';
import { mountGameView } from './gameView';

const app = document.querySelector<HTMLDivElement>('#app')!;
let unmount: () => void = () => {};

function show(mount: () => () => void): void {
  unmount();
  unmount = mount();
}

function showStart(): void {
  show(() => {
    const screen = document.createElement('div');
    screen.className = 'start-screen';
    const title = document.createElement('h1');
    title.textContent = '♚︎ 체스';
    const desc = document.createElement('p');
    desc.textContent = '한 컴퓨터에서 백과 흑이 번갈아 두는 1:1 대국';
    const standard = document.createElement('button');
    standard.type = 'button';
    standard.className = 'primary';
    standard.textContent = '정식 배치로 시작';
    standard.addEventListener('click', () => showGame());
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = '배치 편집';
    edit.addEventListener('click', showEditor);
    const buttons = document.createElement('div');
    buttons.className = 'start-buttons';
    buttons.append(standard, edit);
    screen.append(title, desc, buttons);
    app.replaceChildren(screen);
    standard.focus();
    return () => {};
  });
}

function showEditor(): void {
  show(() => mountEditorView(app, { onStart: showGame, onBack: showStart }));
}

function showGame(fen?: string): void {
  show(() => mountGameView(app, fen, { onNewGame: showStart }));
}

showStart();
