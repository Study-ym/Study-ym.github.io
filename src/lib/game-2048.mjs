/** @typedef {'left' | 'right' | 'up' | 'down'} Direction */

/** Collapse a row toward its first cell; each tile merges at most once.
 * @param {number[]} line
 */
export function mergeLine(line) {
  const values = line.filter(Boolean);
  const merged = [];
  let score = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const value = values[i] * 2;
      merged.push(value);
      score += value;
      i++;
    } else merged.push(values[i]);
  }
  return { line: [...merged, ...Array(line.length - merged.length).fill(0)], score };
}

/** @param {number[]} board @param {Direction} direction */
export function moveBoard(board, direction) {
  const next = [...board];
  let score = 0;
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, cell) => {
      if (direction === 'left') return line * 4 + cell;
      if (direction === 'right') return line * 4 + 3 - cell;
      if (direction === 'up') return cell * 4 + line;
      return (3 - cell) * 4 + line;
    });
    const merged = mergeLine(indices.map(index => board[index]));
    indices.forEach((index, cell) => { next[index] = merged.line[cell]; });
    score += merged.score;
  }
  return { board: next, score, moved: next.some((value, index) => value !== board[index]) };
}

/** @param {number[]} board @param {() => number} [rng] */
export function spawnTile(board, rng = Math.random) {
  const empty = board.flatMap((value, index) => value === 0 ? [index] : []);
  if (!empty.length) return [...board];
  const next = [...board];
  next[empty[Math.min(empty.length - 1, Math.floor(rng() * empty.length))]] = rng() < 0.9 ? 2 : 4;
  return next;
}

/** @param {() => number} [rng] */
export function newBoard(rng = Math.random) {
  return spawnTile(spawnTile(Array(16).fill(0), rng), rng);
}

/** @param {number[]} board */
export function canMove(board) {
  return board.some((value, index) => value === 0
    || (index % 4 < 3 && value === board[index + 1])
    || (index < 12 && value === board[index + 4]));
}

/** A turn spawns one tile only when the board actually changes.
 * @param {number[]} board @param {Direction} direction @param {() => number} [rng]
 */
export function takeTurn(board, direction, rng = Math.random) {
  const result = moveBoard(board, direction);
  const next = result.moved ? spawnTile(result.board, rng) : result.board;
  return { ...result, board: next, won: next.some(value => value >= 2048), over: !canMove(next) };
}
