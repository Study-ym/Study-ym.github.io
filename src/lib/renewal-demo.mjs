/** @typedef {{ id: string, name: string, service: string, dueDate: string }} RenewalClient */
/** @typedef {'overdue' | 'due' | 'later' | 'handled'} RenewalStatus */

export const SAMPLE_TODAY = '2026-10-02';

/** Fictional demonstration data; dates intentionally cover each reminder state. */
export const SAMPLE_CLIENTS = Object.freeze([
  Object.freeze({ id: 'sample-overdue', name: 'Northline Studio', service: 'Website maintenance', dueDate: '2026-09-28' }),
  Object.freeze({ id: 'sample-today', name: 'Willow Workshop', service: 'Annual support', dueDate: '2026-10-02' }),
  Object.freeze({ id: 'sample-soon', name: 'Fieldwork Books', service: 'Domain renewal', dueDate: '2026-10-16' }),
  Object.freeze({ id: 'sample-boundary', name: 'Harbour Creative', service: 'Website hosting', dueDate: '2026-11-01' }),
  Object.freeze({ id: 'sample-later', name: 'Orbit Makers', service: 'Technical support', dueDate: '2026-12-01' }),
]);

/** @param {string} value @param {string} label */
function dateNumber(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${label} must be a valid ISO calendar date (YYYY-MM-DD)`);
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError(`${label} must be a valid ISO calendar date (YYYY-MM-DD)`);
  }
  return timestamp / 86_400_000;
}

/** @param {string} left @param {string} right */
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Build a fresh queue with calendar-day arithmetic, independent of local time.
 * Handled clients remain visible at the end but are never actionable.
 * @param {readonly RenewalClient[]} clients
 * @param {string} today
 * @param {number} leadDays
 * @param {readonly string[]} [handledIds]
 * @returns {(RenewalClient & { daysUntil: number, status: RenewalStatus })[]}
 */
export function buildQueue(clients, today, leadDays, handledIds = []) {
  const currentDay = dateNumber(today, 'today');
  if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 365) {
    throw new RangeError('leadDays must be an integer from 0 to 365');
  }
  if (!Array.isArray(clients)) throw new TypeError('clients must be an array');
  if (!Array.isArray(handledIds) || handledIds.some((id) => typeof id !== 'string')) {
    throw new TypeError('handledIds must be an array of string IDs');
  }
  const handled = new Set(handledIds);
  const seenIds = new Set();
  const queue = clients.map((client, index) => {
    if (!client || ['id', 'name', 'service'].some((key) => typeof client[key] !== 'string' || !client[key].trim())) {
      throw new TypeError(`clients[${index}] must have nonempty id, name and service strings`);
    }
    if (seenIds.has(client.id)) throw new RangeError(`Duplicate client ID: ${client.id}`);
    seenIds.add(client.id);
    const daysUntil = dateNumber(client.dueDate, `clients[${index}].dueDate`) - currentDay;
    /** @type {RenewalStatus} */
    const status = handled.has(client.id) ? 'handled' : daysUntil < 0 ? 'overdue' : daysUntil <= leadDays ? 'due' : 'later';
    return { ...client, daysUntil, status };
  });
  const group = { overdue: 0, due: 0, later: 1, handled: 2 };
  return queue.sort((left, right) =>
    group[left.status] - group[right.status]
    || left.daysUntil - right.daysUntil
    || compareText(left.name, right.name)
    || compareText(left.id, right.id));
}
