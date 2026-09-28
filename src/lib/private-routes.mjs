// Only allow known private destinations; never redirect login to a supplied external URL.
export function privateReturnPath(value) {
  return ['/private/', '/private/cycle/'].includes(value) ? value : '/private/';
}
export function loginUrl(value) {
  return `/account/?next=${encodeURIComponent(privateReturnPath(value))}`;
}
