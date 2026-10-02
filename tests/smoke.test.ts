import { describe, expect, it } from 'vitest';
import * as engine from '../src/engine';

describe('smoke', () => {
  it('엔진 모듈을 불러올 수 있다', () => {
    expect(engine).toBeDefined();
  });
});
