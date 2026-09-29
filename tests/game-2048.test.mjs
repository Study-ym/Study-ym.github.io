import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLine, moveBoard, spawnTile, newBoard, canMove, takeTurn } from '../src/lib/game-2048.mjs';

const board = (...rows) => rows.flat();
const empty = [0, 0, 0, 0];

test('merges each tile only once, closes gaps and awards merged values', () => {
  assert.deepEqual(mergeLine([2, 2, 4, 0]), { line: [4, 4, 0, 0], score: 4 });
  assert.deepEqual(mergeLine([2, 2, 2, 2]), { line: [4, 4, 0, 0], score: 8 });
  assert.deepEqual(mergeLine([4, 0, 4, 4]), { line: [8, 4, 0, 0], score: 8 });
});

test('all four directions align and merge correctly without mutating input', () => {
  const input = board([2, 0, 0, 2], empty, empty, [2, 0, 0, 2]);
  const original = [...input];
  const expected = {
    left: board([4, 0, 0, 0], empty, empty, [4, 0, 0, 0]),
    right: board([0, 0, 0, 4], empty, empty, [0, 0, 0, 4]),
    up: board([4, 0, 0, 4], empty, empty, empty),
    down: board(empty, empty, empty, [4, 0, 0, 4]),
  };
  for (const direction of ['left', 'right', 'up', 'down']) {
    assert.deepEqual(moveBoard(input, direction), { board: expected[direction], score: 8, moved: true });
  }
  assert.deepEqual(input, original);
});

test('a no-op turn never calls rng or spawns a tile', () => {
  const input = board([2, 4, 8, 16], empty, empty, empty);
  const result = takeTurn(input, 'left', () => { throw new Error('rng must not be called'); });
  assert.equal(result.moved, false);
  assert.equal(result.score, 0);
  assert.deepEqual(result.board, input);
});

test('an effective turn spawns exactly one tile and keeps the merge score', () => {
  const result = takeTurn(board([2, 2, 0, 0], empty, empty, empty), 'left', () => 0);
  assert.deepEqual(result.board, board([4, 2, 0, 0], empty, empty, empty));
  assert.equal(result.score, 4);
  assert.equal(result.moved, true);
});

test('new boards have two tiles; spawn supports deterministic 2 and 4 values', () => {
  assert.deepEqual(newBoard(() => 0), board([2, 2, 0, 0], empty, empty, empty));
  assert.equal(spawnTile(Array(16).fill(0), () => 0.99)[15], 4);
  const full = Array(16).fill(2);
  assert.deepEqual(spawnTile(full, () => { throw new Error('full board'); }), full);
});

test('game over requires no empty cells and no horizontal or vertical merge', () => {
  const full = board([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]);
  assert.equal(canMove(full), false);
  assert.equal(takeTurn(full, 'up').over, true);
  const horizontal = [...full]; horizontal[1] = 2;
  assert.equal(canMove(horizontal), true);
  const vertical = [...full]; vertical[4] = 2;
  assert.equal(canMove(vertical), true);
  const vacancy = [...full]; vacancy[15] = 0;
  assert.equal(canMove(vacancy), true);
  // Equal values wrapping across a row boundary are not adjacent.
  const wrapped = board([2, 4, 8, 16], [16, 8, 4, 2], [2, 4, 8, 16], [16, 8, 4, 2]);
  assert.equal(canMove(wrapped), false);
});

test('2048 reports a win and logic permits continued play afterward', () => {
  const result = takeTurn(board([1024, 1024, 0, 0], empty, empty, empty), 'left', () => 0);
  assert.equal(result.won, true);
  assert.equal(result.score, 2048);
  assert.equal(result.over, false);
  const continued = takeTurn(result.board, 'down', () => 0);
  assert.equal(continued.moved, true);
  assert.equal(continued.won, true);
});

test('game-over detection includes the tile spawned by the final move', () => {
  const input = board([2, 2, 8, 16], [8, 16, 2, 4], [16, 2, 4, 8], [2, 4, 8, 16]);
  assert.equal(canMove(input), true);
  const result = takeTurn(input, 'left', () => 0);
  assert.equal(result.moved, true);
  assert.equal(result.score, 4);
  assert.equal(result.over, true);
});
