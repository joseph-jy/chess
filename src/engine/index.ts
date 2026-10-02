// 엔진 공개 API. UI는 이 모듈에서 export 된 것만 사용한다.
export * from './types';
export { Board } from './board';
export type { Position } from './position';
export { emptyPosition, clonePosition } from './position';
export { parseSquare, squareName, fileOf, rankOf, makeSquare } from './square';
export { START_FEN, FenError, parseFen, toFen, pieceToChar } from './fen';
export { Game, IllegalMoveError } from './game';
export type { GameStatus, DrawReason, MoveInput } from './game';
