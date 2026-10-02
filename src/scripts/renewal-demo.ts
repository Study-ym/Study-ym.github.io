import { SAMPLE_CLIENTS, SAMPLE_TODAY, buildQueue } from '../lib/renewal-demo.mjs';

const root = document.querySelector<HTMLElement>('#renewal-demo')!;
const date = document.querySelector<HTMLInputElement>('#demo-date')!;
const lead = document.querySelector<HTMLSelectElement>('#demo-lead')!;
const list = document.querySelector<HTMLUListElement>('#renewal-queue')!;
const error = document.querySelector<HTMLElement>('#demo-error')!;
const status = document.querySelector<HTMLElement>('#demo-status')!;
const handledButton = document.querySelector<HTMLButtonElement>('#demo-handled')!;
const handled = new Set<string>();
let selected: string = SAMPLE_CLIENTS[0].id;
let queue = buildQueue(SAMPLE_CLIENTS, SAMPLE_TODAY, 14);
const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
function label(entry: (typeof queue)[number]) {
  if (entry.status === 'handled') return 'Followed up';
  if (entry.daysUntil < 0) return `${-entry.daysUntil} days overdue`;
  if (entry.daysUntil === 0) return 'Due today';
  return `Due in ${entry.daysUntil} days`;
}
function renderPreview() {
  const entry = queue.find(item => item.id === selected)!;
  document.querySelector('#preview-state')!.textContent = entry.status === 'later' ? 'Outside the current reminder window. Preview only.' : entry.status === 'handled' ? 'Marked followed up. Removed from the action count.' : 'Ready for follow-up in this demo.';
  document.querySelector('#preview-subject')!.textContent = `Subject: ${entry.name} — ${entry.service}`;
  document.querySelector('#preview-body')!.textContent = `${entry.name} has ${entry.service.toLowerCase()} due on ${formatDate(entry.dueDate)}. ${entry.daysUntil < 0 ? 'That date has passed.' : entry.daysUntil === 0 ? 'That is today.' : `That is ${entry.daysUntil} days from the demo date.`}`;
  handledButton.textContent = handled.has(selected) ? 'Undo follow-up' : 'Mark followed up';
}
function render() {
  try { queue = buildQueue(SAMPLE_CLIENTS, date.value, Number(lead.value), [...handled]); }
  catch { error.textContent = 'Choose a valid demo date to update the list.'; error.hidden = false; date.setAttribute('aria-invalid', 'true'); handledButton.disabled = true; return; }
  error.hidden = true; date.removeAttribute('aria-invalid'); handledButton.disabled = false;
  list.replaceChildren();
  for (const entry of queue) {
    const item = document.createElement('li');
    const button = document.createElement('button'); button.type = 'button'; button.className = 'client-row'; button.dataset.state = entry.status; button.setAttribute('aria-pressed', String(entry.id === selected));
    const identity = document.createElement('span'); identity.className = 'client-identity';
    const name = document.createElement('strong'); name.textContent = entry.name;
    const service = document.createElement('span'); service.textContent = entry.service;
    const timing = document.createElement('span'); timing.className = 'client-timing';
    const due = document.createElement('time'); due.dateTime = entry.dueDate; due.textContent = formatDate(entry.dueDate);
    const state = document.createElement('span'); state.className = 'client-state'; state.textContent = label(entry);
    identity.append(name, service); timing.append(due, state); button.append(identity, timing); item.append(button); list.append(item);
    button.addEventListener('click', () => { selected = entry.id; list.querySelectorAll('button').forEach(row => row.setAttribute('aria-pressed', String(row === button))); renderPreview(); });
  }
  const count = queue.filter(entry => entry.status === 'due' || entry.status === 'overdue').length;
  document.querySelector('#queue-count')!.textContent = `${count} to follow up`;
  document.querySelector<HTMLElement>('#queue-empty')!.hidden = count > 0;
  renderPreview();
}
date.addEventListener('change', () => { status.textContent = ''; render(); });
lead.addEventListener('change', () => { status.textContent = ''; render(); });
handledButton.addEventListener('click', () => {
  const name = queue.find(entry => entry.id === selected)!.name;
  const undo = handled.has(selected);
  if (undo) handled.delete(selected); else handled.add(selected);
  render();
  list.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  status.textContent = `${name}: ${undo ? 'follow-up undone' : 'marked followed up'}. Demo only; no email was sent.`;
});
document.querySelector('#demo-reset')!.addEventListener('click', () => { date.value = SAMPLE_TODAY; lead.value = '14'; handled.clear(); selected = SAMPLE_CLIENTS[0].id; render(); status.textContent = 'Demo reset to 2 October 2026. All sample clients restored.'; });
const copy = document.querySelector<HTMLButtonElement>('#copy-brief')!;
copy.hidden = false;
copy.addEventListener('click', async () => {
  const brief = document.querySelector<HTMLTextAreaElement>('#enquiry-brief')!;
  const copyStatus = document.querySelector('#copy-status')!;
  try { await navigator.clipboard.writeText(brief.value); copyStatus.textContent = 'Template copied. Nothing has been sent.'; }
  catch { brief.focus(); brief.select(); copyStatus.textContent = 'Copy is unavailable. The template is selected; use your device’s copy command.'; }
});
render(); root.hidden = false;
