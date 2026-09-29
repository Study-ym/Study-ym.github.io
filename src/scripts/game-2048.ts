import { newBoard, takeTurn } from '../lib/game-2048.mjs';

type Direction = 'left' | 'right' | 'up' | 'down';
const root = document.querySelector<HTMLElement>('[data-game-2048]');
if (root) {
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const boardElement = get<HTMLElement>('[data-board]');
  const cells = [...boardElement.querySelectorAll<HTMLElement>('[data-cell]')];
  const status = get<HTMLElement>('[data-status]');
  const continueButton = get<HTMLButtonElement>('[data-continue]');
  const restart = get<HTMLButtonElement>('[data-restart]');
  const restartDialog = get<HTMLDialogElement>('[data-restart-dialog]');
  const directionButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-direction]')];
  const storageKey = 'garden-2048-best-v1';
  let best = 0;
  let storageAvailable = true;
  try {
    const stored = Number(localStorage.getItem(storageKey));
    if (Number.isSafeInteger(stored) && stored > 0) best = stored;
  } catch { storageAvailable = false; }
  let board = newBoard();
  let score = 0;
  let moves = 0;
  let over = false;
  let winAcknowledged = false;
  let winPending = false;

  function render(message: string) {
    cells.forEach((cell, index) => {
      const value = board[index];
      cell.textContent = value ? String(value) : '';
      cell.dataset.value = value ? String(Math.min(value, 2048)) : '0';
      cell.setAttribute('aria-label', `第 ${Math.floor(index / 4) + 1} 行，第 ${index % 4 + 1} 列：${value || '空'}`);
    });
    get('[data-score]').textContent = String(score);
    get('[data-best]').textContent = String(best);
    get('[data-moves]').textContent = String(moves).padStart(3, '0');
    status.textContent = message;
    continueButton.hidden = !winPending || over;
    directionButtons.forEach(button => { button.disabled = over || winPending; });
    get('[data-storage]').textContent = storageAvailable
      ? '最高分仅保存在此浏览器。当前棋局不保存，刷新后重新开始。'
      : '此浏览器无法保存最高分，本次仍可正常游玩。刷新后重新开始。';
  }

  function move(direction: Direction) {
    if (over || winPending) return;
    const result = takeTurn(board, direction);
    over = result.over;
    if (result.moved) {
      board = result.board;
      score += result.score;
      moves++;
      if (score > best) {
        best = score;
        try { localStorage.setItem(storageKey, String(best)); } catch { storageAvailable = false; }
      }
    }
    winPending = result.won && !winAcknowledged;
    render(over ? `本局结束，得分 ${score}。没有可移动的方块了，重新开始再试一次。`
      : winPending ? '已合成 2048！挑战完成。选择「继续挑战」可以冲向更大的数字。'
      : result.moved ? (result.score ? `合并成功，获得 ${result.score} 分。当前 ${score} 分。` : '已移动，继续寻找可以合并的方块。')
      : '这个方向无法移动，试试其他方向。');
  }

  directionButtons.forEach(button => button.addEventListener('click', () => move(button.dataset.direction as Direction)));
  const keys: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  // Listen only on the board: search fields and page scrolling keep their own keys.
  boardElement.addEventListener('keydown', event => {
    if (!keys[event.key] || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    move(keys[event.key]);
  });
  let pointer: { id: number; x: number; y: number } | null = null;
  boardElement.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    boardElement.setPointerCapture(event.pointerId);
    boardElement.focus({ preventScroll: true });
  });
  boardElement.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  boardElement.addEventListener('pointercancel', () => { pointer = null; });
  continueButton.addEventListener('click', () => {
    winAcknowledged = true;
    winPending = false;
    render('继续挑战！看看下一次能合成多大的数字。');
    boardElement.focus({ preventScroll: true });
  });
  function restartGame() {
    board = newBoard(); score = 0; moves = 0; over = false; winAcknowledged = false; winPending = false;
    render('新棋局已准备好。合并相同数字，向 2048 前进。');
    boardElement.focus({ preventScroll: true });
  }
  restart.addEventListener('click', () => {
    if (moves > 0 && !over) restartDialog.showModal();
    else restartGame();
  });
  get('[data-restart-cancel]').addEventListener('click', () => restartDialog.close());
  get('[data-restart-confirm]').addEventListener('click', () => { restartDialog.close(); restartGame(); });
  render('合并相同数字，向 2048 前进。点击棋盘后使用方向键，或直接滑动。');
}
