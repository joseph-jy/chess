# 구현 계획

요구사항은 [`AGENTS.md`](../AGENTS.md) 참고. 이 문서는 **어떻게** 만들지와 **어디까지 했는지**를 기록한다.
각 단계가 끝나면 체크박스를 갱신하고, 결정이 바뀌면 "결정 기록"에 남긴다.

## 진행 상황

- [ ] Phase 0. 프로젝트 셋업
- [ ] Phase 1. 엔진: 보드 모델 & 수 생성
- [ ] Phase 2. 엔진: 게임 상태 & 종료 판정
- [ ] Phase 3. UI: 보드 렌더링 & 마우스 조작
- [ ] Phase 4. UI: 키보드 조작 (명령 팔레트)
- [ ] Phase 5. 배치 편집 모드
- [ ] Phase 6. 마무리 (기보, 무르기, 무승부/기권, 다듬기)

**다음 세션은 Phase 0부터 시작한다.**

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
  - `game.status()` → `{ kind: 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned', reason?, winner? }`
  - `game.inCheck()`, `game.history()` (SAN 목록)
  - `validateSetup(position)` → `{ ok: true } | { ok: false, errors: string[] }`

---

## Phase 0. 프로젝트 셋업
- [ ] `npm create vite@latest . -- --template vanilla-ts` (또는 수동 구성)
- [ ] Vitest 추가, `npm test` 스크립트
- [ ] `tsconfig` strict 모드
- [ ] `.gitignore` (node_modules, dist)
- [ ] 빈 `src/engine`, `src/ui`, `tests` 디렉터리와 스모크 테스트 1개
- [ ] `npm run dev`, `npm test`, `npm run build` 모두 동작 확인

## Phase 1. 엔진: 보드 모델 & 수 생성
- [ ] `types.ts`, `square.ts` — 칸 파싱: `"e4"`, `"E4"`, `"4e"` 모두 같은 칸. 잘못된 입력은 `null`
- [ ] `board.ts`, `position.ts`, `fen.ts` — 시작 FEN 왕복 테스트
- [ ] `attacks.ts` — 각 기물별 공격 칸
- [ ] `movegen.ts`
  - [ ] 폰: 1칸/2칸 전진, 대각 잡기, 앙파상, 프로모션
  - [ ] 나이트, 킹, 슬라이딩(비숍/룩/퀸)
  - [ ] 캐슬링: 권한, 사이 칸 비어있음, 킹이 체크 중/통과 칸/도착 칸 공격받지 않음
  - [ ] 합법성 필터 (핀, 체크 회피)
- [ ] **perft 테스트** — 아래 표준 포지션으로 수 생성 정확성 검증

| 포지션 | FEN | depth 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| 시작 | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | 20 | 400 | 8902 | 197281 |
| Kiwipete | `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1` | 48 | 2039 | 97862 | 4085603 |
| Position 3 | `8/2p5/3p4/KP5r/1R3p2/8/4P3/8 w - - 0 1` | 14 | 191 | 2812 | 43238 |
| Position 4 | `r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1` | 6 | 264 | 9467 | 422333 |
| Position 5 | `rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8` | 44 | 1486 | 62379 | 2103487 |

(depth 4 가 느리면 기본 테스트는 depth 3 까지, depth 4 는 별도 스크립트로)

## Phase 2. 엔진: 게임 상태 & 종료 판정
- [ ] `game.ts` — move/undo, 히스토리, halfmove/fullmove 갱신, 캐슬링 권한 갱신(킹/룩 이동, 룩 잡힘)
- [ ] 체크메이트 / 스테일메이트
- [ ] 50수 규칙 (halfmove ≥ 100)
- [ ] 3회 동형 반복 (FEN 의 앞 4필드를 키로 카운트)
- [ ] 기물 부족: K vs K, K+B vs K, K+N vs K, K+B vs K+B (같은 색 칸 비숍)
- [ ] 기권, 합의 무승부 (`game.resign(color)`, `game.agreeDraw()`)
- [ ] `san.ts` — 동일 기물 모호성 해소(`Nbd2`, `R1e1`), `+`/`#` 표기
- [ ] 각 항목 단위 테스트

## Phase 3. UI: 보드 렌더링 & 마우스 조작
- [ ] 8×8 그리드, 좌표 라벨(a–h, 1–8), 기물은 유니코드 문자(♔♕…)로 시작 (나중에 SVG 교체 가능)
- [ ] 클릭으로 선택 → 합법 목적지 표시 (빈 칸: 점, 잡기: 테두리 링)
- [ ] 목적지 클릭 시 이동. 다른 자기 기물 클릭 시 선택 변경. 빈 곳/같은 칸 클릭 시 선택 해제
- [ ] 마지막 수, 체크 중인 킹 하이라이트
- [ ] 프로모션 선택 다이얼로그
- [ ] 사이드 패널: 현재 차례, 게임 결과 표시
- [ ] 보드 뒤집기 버튼 (선택 사항)

## Phase 4. UI: 키보드 조작 (명령 팔레트)
- [ ] `shortcuts.ts`: `SELECT = Ctrl+S`, `MOVE = Ctrl+M` (설정 상수). `preventDefault()` 로 브라우저 저장 동작 차단
- [ ] 선택 팔레트: 입력창 + 후보 목록 = 현재 차례에 합법 수가 있는 기물들 (`♘ g1`, `♙ e2` …)
  - 입력하면 목록 필터링, `↑/↓` 로 고르기, `Enter` 확정, `Esc` 닫기
  - 칸을 직접 입력(`e2`/`2e`)하고 Enter 해도 확정. 움직일 수 없는 기물이면 에러 메시지
- [ ] 이동 팔레트: 선택된 기물의 합법 목적지 목록. 선택된 기물이 없으면 선택 팔레트를 대신 연다
  - 프로모션이면 목록에 `e8=Q`, `e8=N` … 로 나눠서 표시
- [ ] 마우스 선택 상태와 키보드 선택 상태는 같은 상태를 공유한다
- [ ] 화면 하단에 단축키 안내 표시

## Phase 5. 배치 편집 모드
- [ ] 시작 화면: "정식 배치로 시작" / "배치 편집"
- [ ] 편집 화면: 기물 팔레트(백/흑 × 6종) + 지우개. 팔레트에서 고르고 칸 클릭으로 놓기, 보드 위 기물 드래그/클릭으로 이동
- [ ] 프리셋: 정식 배치, 빈 보드(킹만), 올퀸 등
- [ ] 킹은 지우개/덮어쓰기로 제거 불가 (킹은 이동만 가능). 킹 추가 버튼도 없음 → 항상 각 1개 보장
- [ ] 먼저 둘 진영 선택
- [ ] 캐슬링 권한 자동 계산 (킹 e1/e8, 룩 a/h 코너에 있을 때만) + 사용자가 끌 수 있게 체크박스
- [ ] `validateSetup` 실패 시 시작 버튼 비활성 + 이유 표시
  - 킹 개수 ≠ 1, 1·8랭크 폰, 차례가 아닌 쪽 킹이 체크당함
- [ ] 편집 배치 → FEN → `new Game(fen)` 으로 대국 시작

## Phase 6. 마무리
- [ ] 기보 패널 (SAN, 수 번호)
- [ ] 무르기 버튼 (+ 단축키 `Ctrl+Z`)
- [ ] 기권 / 무승부 제안 버튼
- [ ] 새 게임 (편집 화면으로 돌아가기)
- [ ] 반응형 레이아웃, 다크 모드는 선택 사항

---

## 결정 기록
- 2026-10-02: 웹 앱(TypeScript + Vite, 프레임워크 없음)으로 결정. 마우스+키보드+입력창 UI를 만들기 쉽고 설치가 필요 없다.
- 2026-10-02: `Ctrl+T` 는 브라우저가 가로챌 수 없어서 이동 단축키를 `Ctrl+M` 으로 변경.
- 2026-10-02: 칸 입력은 `e4` 와 `4e` 둘 다 허용 (요구사항 예시가 `4e` 형식).

## 미결정 / 다음에 확인할 것
- 기물 그래픽: 유니코드로 시작. SVG 세트를 쓸지는 Phase 3 이후 결정.
- 시간 제한(체스 클락)은 요구사항에 없음 — 필요하면 Phase 6 이후 추가.
- 게임 저장/불러오기(FEN/PGN 입출력)는 요구사항에 없음 — 엔진에 FEN 이 있으므로 나중에 쉽게 추가 가능.
