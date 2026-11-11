import { addDays, daysInMonth, monthOf, toDateKey } from './dates';
import type { Cents, DateKey, MonthKey, Transaction } from './types';

export interface MonthSummary {
  income: Cents;
  expense: Cents;
  balance: Cents;
  count: number;
}

export function txOfMonth(txs: Transaction[], month: MonthKey): Transaction[] {
  return txs.filter((t) => monthOf(t.date) === month);
}

export function summarize(txs: Transaction[]): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense, count: txs.length };
}

export function expenseByCategory(txs: Transaction[]): { categoryId: string; total: Cents }[] {
  const map = new Map<string, Cents>();
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total);
}

/** Ordena do mais recente para o mais antigo e agrupa por dia. */
export function groupByDay(txs: Transaction[]): { date: DateKey; items: Transaction[]; net: Cents }[] {
  const sorted = [...txs].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  const groups: { date: DateKey; items: Transaction[]; net: Cents }[] = [];
  for (const t of sorted) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== t.date) {
      g = { date: t.date, items: [], net: 0 };
      groups.push(g);
    }
    g.items.push(t);
    g.net += t.type === 'income' ? t.amount : -t.amount;
  }
  return groups;
}

/** Dias em que o usuário cuidou das finanças: registrou algo ou confirmou "dia sem gastos". */
export function activeDays(txs: Transaction[], checkIns: DateKey[]): Set<DateKey> {
  const set = new Set<DateKey>(checkIns);
  for (const t of txs) {
    set.add(t.date);
    set.add(toDateKey(new Date(t.createdAt)));
  }
  return set;
}

/**
 * Sequência atual de dias seguidos.
 * Se hoje ainda não teve registro, a sequência continua viva contando a partir de ontem.
 */
export function currentStreak(days: Set<DateKey>, today: DateKey): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function bestStreak(days: Set<DateKey>): number {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: DateKey | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function lastNDays(today: DateKey, n: number): DateKey[] {
  const out: DateKey[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

export type BudgetStatus = 'ok' | 'warning' | 'over';

export function budgetStatus(spent: Cents, limit: Cents): BudgetStatus {
  if (limit <= 0) return 'ok';
  if (spent > limit) return 'over';
  if (spent >= limit * 0.8) return 'warning';
  return 'ok';
}

/** Quanto ainda dá para gastar por dia até o fim do mês (incluindo hoje). */
export function dailyAllowance(limit: Cents, spent: Cents, month: MonthKey, today: DateKey): Cents | null {
  if (limit <= 0) return null;
  const total = daysInMonth(month);
  let daysLeft: number;
  if (monthOf(today) === month) daysLeft = total - Number(today.slice(8, 10)) + 1;
  else if (monthOf(today) < month) daysLeft = total;
  else return null; // mês passado
  const remaining = limit - spent;
  if (remaining <= 0) return 0;
  return Math.floor(remaining / daysLeft);
}

export function goalProgress(saved: Cents, target: Cents): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, saved / target));
}

/** Quanto guardar por mês para atingir a meta até o prazo. */
export function monthlyToReachGoal(saved: Cents, target: Cents, deadline: DateKey | undefined, today: DateKey): Cents | null {
  if (!deadline || saved >= target) return null;
  const [ty, tm] = today.split('-').map(Number);
  const [dy, dm] = deadline.split('-').map(Number);
  const months = Math.max(1, (dy - ty) * 12 + (dm - tm));
  return Math.ceil((target - saved) / months);
}

/** Taxa de poupança do mês: quanto da renda sobrou. */
export function savingsRate(s: MonthSummary): number | null {
  if (s.income <= 0) return null;
  return s.balance / s.income;
}

export function toCSV(txs: Transaction[], categoryName: (id: string) => string): string {
  const header = 'data;tipo;categoria;descricao;valor';
  const rows = [...txs]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => {
      const value = ((t.type === 'expense' ? -t.amount : t.amount) / 100).toFixed(2).replace('.', ',');
      const note = `"${t.note.replace(/"/g, '""')}"`;
      return [t.date, t.type === 'expense' ? 'despesa' : 'receita', categoryName(t.categoryId), note, value].join(';');
    });
  return [header, ...rows].join('\n');
}
