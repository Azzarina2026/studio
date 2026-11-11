/* Funzioni di base: importi, date, identificativi. Nessuna dipendenza. */

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
/* arrotonda al centesimo senza gli errori dei decimali binari (75,115 → 75,12) */
export const r2 = n => Math.round(Number(((Number(n) || 0) * 100).toPrecision(12))) / 100;

const EUR = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
export const num = n => EUR.format(r2(n));
export const euro = n => '€ ' + num(n);
export const euroK = n => Math.abs(n) >= 10000 ? '€ ' + new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(n / 1000) + 'k' : '€ ' + new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' }).format(n);

/* "1.350,50" → 1350.5 ; accetta anche "1350.5" */
export function parseNum(s) {
  if (typeof s === 'number') return s;
  s = String(s ?? '').replace(/[€\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // "1.350" = milletrecentocinquanta
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/* Date: sempre stringhe "AAAA-MM-GG" */
const p2 = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const today = () => iso(new Date());
export const toDate = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const dmy = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
export const yearOf = s => Number(String(s).slice(0, 4));
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
export function addMonths(s, n) {
  const d = toDate(s), day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return iso(t);
}
export const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export const MESI_BREVI = MESI.map(m => m.slice(0, 3));

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const clone = o => JSON.parse(JSON.stringify(o));
export const sum = (arr, f = x => x) => r2(arr.reduce((t, x) => t + (Number(f(x)) || 0), 0));
export const by = (k, dir = 1) => (a, b) => { const x = typeof k === 'function' ? k(a) : a[k], y = typeof k === 'function' ? k(b) : b[k]; return (x > y ? 1 : x < y ? -1 : 0) * dir; };
export const fileSize = b => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
