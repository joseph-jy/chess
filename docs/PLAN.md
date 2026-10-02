# 구현 계획

요구사항은 [`AGENTS.md`](../AGENTS.md) 참고. 이 문서는 **어떻게** 만들지와 **어디까지 했는지**를 기록한다.
각 단계가 끝나면 체크박스를 갱신하고, 결정이 바뀌면 "결정 기록"에 남긴다.

## 진행 상황

- [x] Phase 0. 프로젝트 셋업
- [x] Phase 1. 엔진: 보드 모델 & 수 생성
- [x] Phase 2. 엔진: 게임 상태 & 종료 판정
- [x] Phase 3. UI: 보드 렌더링 & 마우스 조작
- [x] Phase 4. UI: 키보드 조작 (명령 팔레트)
- [x] Phase 5. 배치 편집 모드
- [x] Phase 6. 마무리 (기보, 무르기, 무승부/기권, 다듬기)

**모든 Phase 완료.** 다음 작업 후보는 아래 "미결정 / 다음에 확인할 것" 참고.

---

## 아키텍처

```
src/
  engine/              # 순수 로직. DOM 의존 금지
    types.ts           # Color, PieceType, Piece, Square, Move, CastlingRights
    square.ts          # 0..63 인덱스 <-> "e4"/"4e" 변환, 파싱
    board.ts           # Board 클래스: 64칸 배열, get/set, clone
    position.ts        # Position: board + sideToMove + castling + epSquare + halfmove + fullmove
    fen.ts             # FEN 파싱/직렬화 (테스트·편집 모드·반복 판정에 사용)
    movegen.ts         # 의사 합법 수 생성 + 합법성 필터(자기 킹 체크 여부)
    attacks.ts         # isSquareAttacked(pos, sq, byColor)
    game.ts            # Game: 수 적용/무르기, 히스토리, 결과 판정
    san.ts             # Move -> SAN 문자열 ("Nxe5+", "O-O", "e8=Q#")
    setup.ts           # 편집 배치 검증 (validateSetup)
  ui/
    main.ts            # 진입점, 화면 전환 (편집 <-> 대국)
    boardView.ts       # 보드 렌더링, 하이라이트, 클릭 처리
    palette.ts         # 키보드 명령 팔레트 (입력창 + 후보 목록)
    shortcuts.ts       # 단축키 설정 상수 + keydown 핸들러
    gameView.ts        # 대국 화면 컨트롤러 (선택 상태, 클릭/팔레트/프로모션 연결)
    pieces.ts          # 기물 글리프·이름
    promotionDialog.ts
    editorView.ts      # 배치 편집 화면
    sidePanel.ts       # 차례, 기보, 버튼(무르기/기권/무승부)
  styles.css
index.html
tests/                 # Vitest. engine 위주
```

### 핵심 설계 결정
- **보드 표현**: 길이 64 배열 (`a1 = 0`, `h8 = 63`, `index = rank * 8 + file`). 성능이 중요하지 않으므로 비트보드는 쓰지 않는다.
- **불변성**: `Game.makeMove()` 는 내부적으로 Position 을 복제해서 히스토리 스택에 쌓는다. 무르기 = pop. 단순하고 버그가 적다.
- **합법 수 생성**: 의사 합법 수를 만든 뒤, 각 수를 적용한 위치에서 자기 킹이 공격받는지 검사해 걸러낸다.
- **Move 타입**: `{ from, to, piece, captured?, promotion?, flags: 'normal' | 'double' | 'ep' | 'castleK' | 'castleQ' | 'promo' }`
- **프로모션**: 엔진은 프로모션 수를 4개(Q/R/B/N) 각각 생성한다. UI는 목적지 클릭 시 해당 수들이 여러 개면 선택 다이얼로그를 띄운다.
- **엔진 공개 API** (UI는 이것만 사용):
  - `new Game(fen?)`, `game.position`, `game.turn`
  - `game.legalMoves()`, `game.legalMovesFrom(sq)`
  - `game.move(move)`, `game.undo()`
  - `game.status()` → `{ kind: 'playing' } | { kind: 'checkmate', winner } | { kind: 'stalemate' } | { kind: 'draw', reason: 'fifty-move' | 'threefold' | 'insufficient' | 'agreement' } | { kind: 'resigned', winner }`
  - `game.move({ from, to, promotion? })` — 합법 수가 아니면 `IllegalMoveError`. 게임이 끝나면 `legalMoves()` 는 빈 배열
  - `game.resign(color)`, `game.agreeDraw()`, `game.canUndo()`, `game.lastMove()`, `game.fen()`
  - `game.inCheck()`, `game.history()` (SAN 목록)
  - `validateSetup(position)` → `{ ok: true } | { ok: false, errors: string[] }`

---

## Phase 0. 프로젝트 셋업
- [x] ~~`npm create vite@latest . -- --template vanilla-ts`~~ 수동 구성 (기존 파일이 있는 디렉터리라서)
- [x] Vitest 추가, `npm test` 스크립트 (`vitest run`, 감시 모드는 `npm run test:watch`)
- [x] `tsconfig` strict 모드 (+ `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`)
- [x] `.gitignore` (node_modules, dist)
- [x] 빈 `src/engine`, `src/ui`, `tests` 디렉터리와 스모크 테스트 1개 (`tests/smoke.test.ts`)
- [x] `npm run dev`, `npm test`, `npm run build` 모두 동작 확인

설치된 버전: TypeScript 7.0, Vite 8.3, Vitest 5.0. 진입점은 `index.html` → `src/ui/main.ts`, 엔진 공개 API 는 `src/engine/index.ts` 에서 re-export 한다.

## Phase 1. 엔진: 보드 모델 & 수 생성
- [x] `types.ts`, `square.ts` — 칸 파싱: `"e4"`, `"E4"`, `"4e"` 모두 같은 칸. 잘못된 입력은 `null`
- [x] `board.ts`, `position.ts`, `fen.ts` — 시작 FEN 왕복 테스트
- [x] `attacks.ts` — 각 기물별 공격 칸
- [x] `movegen.ts`
  - [x] 폰: 1칸/2칸 전진, 대각 잡기, 앙파상, 프로모션
  - [x] 나이트, 킹, 슬라이딩(비숍/룩/퀸)
  - [x] 캐슬링: 권한, 사이 칸 비어있음, 킹이 체크 중/통과 칸/도착 칸 공격받지 않음
  - [x] 합법성 필터 (핀, 체크 회피)
- [x] **perft 테스트** — 아래 표준 포지션으로 수 생성 정확성 검증

| 포지션 | FEN | depth 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| 시작 | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | 20 | 400 | 8902 | 197281 |
| Kiwipete | `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1` | 48 | 2039 | 97862 | 4085603 |
| Position 3 | `8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1` | 14 | 191 | 2812 | 43238 |
| Position 4 | `r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1` | 6 | 264 | 9467 | 422333 |
| Position 5 | `rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8` | 44 | 1486 | 62379 | 2103487 |

`npm test` 는 depth 3 까지 (~1초). depth 4 는 `npm run perft` (~26초) — 엔진 변경 시 둘 다 돌린다.
수 적용은 `applyMove(pos, move)` (새 Position 반환), 합법 수는 `legalMoves(pos)` (movegen.ts).

## Phase 2. 엔진: 게임 상태 & 종료 판정
- [x] `game.ts` — move/undo, 히스토리, halfmove/fullmove 갱신, 캐슬링 권한 갱신(킹/룩 이동, 룩 잡힘)
- [x] 체크메이트 / 스테일메이트
- [x] 50수 규칙 (halfmove ≥ 100)
- [x] 3회 동형 반복 (FEN 의 앞 4필드를 키로 카운트. 단 앙파상 칸은 실제로 앙파상이 합법일 때만 포함)
- [x] 기물 부족: K vs K, K+B vs K, K+N vs K, K+B vs K+B (같은 색 칸 비숍) — 일반화: 폰/룩/퀸 없고 마이너 ≤ 1개이거나 마이너가 모두 같은 색 칸 비숍
- [x] 기권, 합의 무승부 (`game.resign(color)`, `game.agreeDraw()`)
- [x] `san.ts` — 동일 기물 모호성 해소(`Nbd2`, `R1e1`), `+`/`#` 표기
- [x] 각 항목 단위 테스트

## Phase 3. UI: 보드 렌더링 & 마우스 조작
- [x] 8×8 그리드, 좌표 라벨(a–h, 1–8), 기물은 유니코드 문자(♔♕…)로 시작 (나중에 SVG 교체 가능)
- [x] 클릭으로 선택 → 합법 목적지 표시 (빈 칸: 점, 잡기: 테두리 링)
- [x] 목적지 클릭 시 이동. 다른 자기 기물 클릭 시 선택 변경. 빈 곳/같은 칸 클릭 시 선택 해제
- [x] 마지막 수, 체크 중인 킹 하이라이트
- [x] 프로모션 선택 다이얼로그
- [x] 사이드 패널: 현재 차례, 게임 결과 표시
- [x] 보드 뒤집기 버튼

## Phase 4. UI: 키보드 조작 (명령 팔레트)
- [x] `shortcuts.ts`: `SELECT = Ctrl+S`, `MOVE = Ctrl+M` (설정 상수). `preventDefault()` 로 브라우저 저장 동작 차단
- [x] 선택 팔레트: 입력창 + 후보 목록 = 현재 차례에 합법 수가 있는 기물들 (`♘ g1`, `♙ e2` …)
  - 입력하면 목록 필터링, `↑/↓` 로 고르기, `Enter` 확정, `Esc` 닫기
  - 칸을 직접 입력(`e2`/`2e`)하고 Enter 해도 확정. 움직일 수 없는 기물이면 에러 메시지
- [x] 이동 팔레트: 선택된 기물의 합법 목적지 목록. 선택된 기물이 없으면 선택 팔레트를 대신 연다
  - 프로모션이면 목록에 `e8=Q`, `e8=N` … 로 나눠서 표시
- [x] 마우스 선택 상태와 키보드 선택 상태는 같은 상태를 공유한다
- [x] 화면 하단에 단축키 안내 표시
- 단축키는 `KeyboardEvent.code` 로 매칭 → 한글 입력 상태에서도 동작. `Esc` 는 선택 해제
- 이동 팔레트에서 칸만 입력(`e8`)하면 프로모션 대화상자가 뜨고, `e8=Q`/`e8q` 처럼 입력하거나 목록에서 고르면 바로 둔다

## Phase 5. 배치 편집 모드
- [x] 시작 화면: "정식 배치로 시작" / "배치 편집"
- [x] 편집 화면: 기물 팔레트(백/흑 × 6종) + 지우개. 팔레트에서 고르고 칸 클릭으로 놓기, 보드 위 기물 드래그/클릭으로 이동
- [x] 프리셋: 정식 배치, 빈 보드(킹만), 올퀸 등
- [x] 킹은 지우개/덮어쓰기로 제거 불가 (킹은 이동만 가능). 킹 추가 버튼도 없음 → 항상 각 1개 보장
- [x] 먼저 둘 진영 선택
- [x] 캐슬링 권한 자동 계산 (킹 e1/e8, 룩 a/h 코너에 있을 때만) + 사용자가 끌 수 있게 체크박스
- [x] 편집 규칙(킹 보호, 캐슬링 권한 계산)과 검증은 엔진 `setup.ts` (`editPlace`, `editMove`, `availableCastling`, `validateSetup`, `PRESETS`)
- [x] `validateSetup` 실패 시 시작 버튼 비활성 + 이유 표시
  - 킹 개수 ≠ 1, 1·8랭크 폰, 차례가 아닌 쪽 킹이 체크당함, 킹/룩이 원래 칸에 없는데 캐슬링 권한
- [x] 편집 배치 → FEN → `new Game(fen)` 으로 대국 시작

## Phase 6. 마무리
- [x] 기보 패널 (SAN, 수 번호)
- [x] 무르기 버튼 (+ 단축키 `Ctrl+Z`)
- [x] 기권 / 무승부 제안 버튼
- [x] 새 게임 (시작 화면으로 돌아가서 정식 배치/배치 편집 선택)
- [x] 반응형 레이아웃 (좁은 화면에서 패널이 보드 아래로), 다크 모드 (`prefers-color-scheme`)

---

## 결정 기록
- 2026-10-02: 웹 앱(TypeScript + Vite, 프레임워크 없음)으로 결정. 마우스+키보드+입력창 UI를 만들기 쉽고 설치가 필요 없다.
- 2026-10-02: `Ctrl+T` 는 브라우저가 가로챌 수 없어서 이동 단축키를 `Ctrl+M` 으로 변경.
- 2026-10-02: Phase 0 은 `npm create vite` 대신 수동 구성. Vitest 설정은 `vite.config.ts` 의 `test` 필드에 둔다.
- 2026-10-02: PLAN 의 Position 3 FEN 이 잘못 적혀 있었음(흑 킹·g2 폰 누락). chessprogramming.org 표준 FEN 으로 수정.
- 2026-10-02: `game.undo()` 는 "마지막 동작"을 되돌린다 — 기권/합의 무승부로 끝났으면 그 결과만 취소하고, 아니면 마지막 수를 무른다.
- 2026-10-02: 50수 규칙과 3회 반복은 (FIDE 의 "청구" 방식이 아니라) 조건이 되면 자동 무승부로 처리. 체크메이트가 50수 규칙보다 우선.
- 2026-10-02: 무승부 제안/기권은 핫시트라 `confirm()` 으로 확인. 기권은 현재 차례 쪽이 한다.
- 2026-10-02: 칸 입력은 `e4` 와 `4e` 둘 다 허용 (요구사항 예시가 `4e` 형식).

## 미결정 / 다음에 확인할 것
- 기물 그래픽: 유니코드 글리프(흑백 모두 채워진 글리프 + CSS 색). 폰트에 따라 모양이 달라지므로 SVG 세트 교체를 검토할 만함.
- UI 는 단위 테스트가 없다 (브라우저에서 수동/Playwright 로 확인함). 필요하면 jsdom 기반 테스트 추가.
- 시간 제한(체스 클락)은 요구사항에 없음 — 필요하면 Phase 6 이후 추가.
- 게임 저장/불러오기(FEN/PGN 입출력)는 요구사항에 없음 — 엔진에 FEN 이 있으므로 나중에 쉽게 추가 가능.
