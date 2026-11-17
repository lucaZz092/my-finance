import type { DateKey, MonthKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Data local (não UTC) como YYYY-MM-DD. */
export function toDateKey(d: Date = new Date()): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // meio-dia evita problemas com horário de verão
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Dias de `a` até `b` (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86_400_000);
}

export function monthOf(key: DateKey): MonthKey {
  return key.slice(0, 7);
}

export function currentMonth(now: Date = new Date()): MonthKey {
  return monthOf(toDateKey(now));
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1, 12);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Data no dia `day` do mês, limitada ao último dia (31 em fevereiro vira 28/29). */
export function dateInMonth(month: MonthKey, day: number): DateKey {
  const d = Math.min(Math.max(1, Math.floor(day)), daysInMonth(month));
  return `${month}-${pad(d)}`;
}

/** Mesma data N meses depois, ajustando o dia para o fim do mês quando preciso. */
export function addMonthsToDate(key: DateKey, delta: number): DateKey {
  return dateInMonth(addMonths(monthOf(key), delta), Number(key.slice(8, 10)));
}

/** "04/12" */
export function dayMonth(key: DateKey): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

/** "nov/26" */
export function monthShort(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** "Hoje", "Ontem" ou "terça, 4 de nov". */
export function dayLabel(key: DateKey, now: Date = new Date()): string {
  const today = toDateKey(now);
  if (key === today) return 'Hoje';
  if (key === addDays(today, -1)) return 'Ontem';
  const d = fromDateKey(key);
  const base = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS_SHORT[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} de ${d.getFullYear()}`;
}

export function shortDate(key: DateKey): string {
  const d = fromDateKey(key);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function weekdayInitial(key: DateKey): string {
  return WEEKDAYS_SHORT[fromDateKey(key).getDay()];
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
