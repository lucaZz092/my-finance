import { addMonths, addMonthsToDate, dateInMonth, daysInMonth, monthOf } from './dates';
import type { Cents, DateKey, MonthKey, RecurringItem, Transaction } from './types';

/* ------------------------------------------------------------------ */
/* Contas fixas e renda recorrente                                     */
/* ------------------------------------------------------------------ */

/** A recorrente já foi lançada neste mês? */
export function isPosted(item: RecurringItem, txs: Transaction[], month: MonthKey): boolean {
  return txs.some((t) => t.recurringId === item.id && monthOf(t.date) === month);
}

/**
 * Lançamentos de contas fixas e rendas que já venceram neste mês e ainda não foram lançados.
 * O app chama isso ao abrir, e as contas "entram sozinhas" no extrato.
 */
export function dueRecurring(
  items: RecurringItem[],
  txs: Transaction[],
  today: DateKey,
): Omit<Transaction, 'id' | 'createdAt'>[] {
  const month = monthOf(today);
  const out: Omit<Transaction, 'id' | 'createdAt'>[] = [];
  for (const item of items) {
    if (!item.active || item.amount <= 0) continue;
    const date = dateInMonth(month, item.dayOfMonth);
    if (date > today) continue;
    if (isPosted(item, txs, month)) continue;
    out.push({
      type: item.type,
      amount: item.amount,
      categoryId: item.categoryId,
      note: item.name,
      date,
      recurringId: item.id,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Compras parceladas                                                  */
/* ------------------------------------------------------------------ */

/** Divide o total em N parcelas; os centavos que sobram vão na primeira. */
export function splitInstallments(total: Cents, n: number): Cents[] {
  const count = Math.max(1, Math.floor(n));
  const base = Math.floor(total / count);
  const rest = total - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + rest : base));
}

/** Lançamentos de uma compra parcelada: uma parcela por mês a partir da data da compra. */
export function buildInstallments(
  purchase: { amount: Cents; categoryId: string; note: string; date: DateKey },
  n: number,
  groupId: string,
): Omit<Transaction, 'id' | 'createdAt'>[] {
  const parts = splitInstallments(purchase.amount, n);
  return parts.map((amount, i) => ({
    type: 'expense' as const,
    amount,
    categoryId: purchase.categoryId,
    note: purchase.note,
    date: addMonthsToDate(purchase.date, i),
    installment: { groupId, index: i + 1, total: parts.length, purchaseTotal: purchase.amount },
  }));
}

/** Soma das parcelas em cada um dos próximos meses (a partir de `fromMonth`, inclusive). */
export function committedByMonth(txs: Transaction[], fromMonth: MonthKey, count: number): { month: MonthKey; total: Cents }[] {
  return Array.from({ length: count }, (_, i) => {
    const month = addMonths(fromMonth, i);
    const total = txs
      .filter((t) => t.installment && t.type === 'expense' && monthOf(t.date) === month)
      .reduce((a, t) => a + t.amount, 0);
    return { month, total };
  });
}

export interface InstallmentGroup {
  groupId: string;
  note: string;
  categoryId: string;
  purchaseTotal: Cents;
  total: number;
  /** Parcelas com data até hoje. */
  paid: number;
  perMonth: Cents;
  lastDate: DateKey;
  nextTxId: string | null;
}

/** Compras parceladas que ainda têm parcelas a vencer. */
export function activeInstallmentGroups(txs: Transaction[], today: DateKey): InstallmentGroup[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (!t.installment) continue;
    const list = groups.get(t.installment.groupId) ?? [];
    list.push(t);
    groups.set(t.installment.groupId, list);
  }
  const out: InstallmentGroup[] = [];
  for (const [groupId, list] of groups) {
    list.sort((a, b) => a.installment!.index - b.installment!.index);
    const last = list[list.length - 1];
    if (last.date < today) continue;
    const next = list.find((t) => t.date >= today) ?? null;
    out.push({
      groupId,
      note: list[0].note,
      categoryId: list[0].categoryId,
      purchaseTotal: list[0].installment!.purchaseTotal,
      total: list[0].installment!.total,
      paid: list.filter((t) => t.date <= today).length,
      perMonth: list[list.length - 1].amount,
      lastDate: last.date,
      nextTxId: next?.id ?? null,
    });
  }
  return out.sort((a, b) => (a.lastDate < b.lastDate ? -1 : 1));
}

/* ------------------------------------------------------------------ */
/* O número do dia                                                      */
/* ------------------------------------------------------------------ */

export interface MonthPlan {
  month: MonthKey;
  /** Renda do mês: o que já entrou + rendas recorrentes ainda por vir. */
  income: Cents;
  /** Contas fixas do mês (lançadas e por vir). */
  recurringExpense: Cents;
  /** Parcelas que caem neste mês. */
  installments: Cents;
  /** Gastos do dia a dia no mês (tudo que não é conta fixa nem parcela). */
  variableSpent: Cents;
  /** Gastos do dia a dia de hoje. */
  spentToday: Cents;
  /** Quanto pode ir para o dia a dia no mês. null = falta informar renda ou limite. */
  budget: Cents | null;
  source: 'income' | 'limit' | 'both' | null;
  /** budget - variableSpent */
  remaining: Cents | null;
  /** Dias que faltam, contando hoje. 0 para meses que já passaram. */
  daysLeft: number;
  /** Valor do dia: o que sobrou até ontem dividido pelos dias que faltam. */
  dailyBase: Cents | null;
  /** Quanto ainda dá para gastar hoje (pode ser negativo). */
  todayLeft: Cents | null;
  /** Contas fixas e rendas que ainda vão cair neste mês. */
  pending: RecurringItem[];
}

const isVariable = (t: Transaction) => t.type === 'expense' && !t.recurringId && !t.installment;

export function monthPlan(
  txs: Transaction[],
  recurring: RecurringItem[],
  monthlyLimit: Cents,
  month: MonthKey,
  today: DateKey,
): MonthPlan {
  const inMonth = txs.filter((t) => monthOf(t.date) === month);
  const active = recurring.filter((r) => r.active && r.amount > 0);
  const isCurrent = monthOf(today) === month;
  const isFuture = month > monthOf(today);

  // Recorrentes que ainda não foram lançadas: só contam no mês atual e nos futuros
  const pending = isCurrent || isFuture ? active.filter((r) => !isPosted(r, txs, month)) : [];

  const income =
    inMonth.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0) +
    pending.filter((r) => r.type === 'income').reduce((a, r) => a + r.amount, 0);
  const recurringExpense =
    inMonth.filter((t) => t.type === 'expense' && t.recurringId).reduce((a, t) => a + t.amount, 0) +
    pending.filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount, 0);
  const installments = inMonth.filter((t) => t.type === 'expense' && t.installment).reduce((a, t) => a + t.amount, 0);
  const variable = inMonth.filter(isVariable);
  const variableSpent = variable.reduce((a, t) => a + t.amount, 0);
  const spentToday = isCurrent ? variable.filter((t) => t.date === today).reduce((a, t) => a + t.amount, 0) : 0;

  const fixed = recurringExpense + installments;
  const byIncome = income > 0 ? income - fixed : null;
  const byLimit = monthlyLimit > 0 ? monthlyLimit - fixed : null;
  let budget: Cents | null = null;
  let source: MonthPlan['source'] = null;
  if (byIncome !== null && byLimit !== null) {
    budget = Math.min(byIncome, byLimit);
    source = 'both';
  } else if (byIncome !== null) {
    budget = byIncome;
    source = 'income';
  } else if (byLimit !== null) {
    budget = byLimit;
    source = 'limit';
  }

  const total = daysInMonth(month);
  const daysLeft = isCurrent ? total - Number(today.slice(8, 10)) + 1 : isFuture ? total : 0;

  let dailyBase: Cents | null = null;
  let todayLeft: Cents | null = null;
  if (budget !== null && daysLeft > 0) {
    const beforeToday = variableSpent - spentToday;
    dailyBase = Math.max(0, Math.floor((budget - beforeToday) / daysLeft));
    todayLeft = dailyBase - spentToday;
  }

  return {
    month,
    income,
    recurringExpense,
    installments,
    variableSpent,
    spentToday,
    budget,
    source,
    remaining: budget === null ? null : budget - variableSpent,
    daysLeft,
    dailyBase,
    todayLeft,
    pending,
  };
}

/* ------------------------------------------------------------------ */
/* Posso comprar?                                                       */
/* ------------------------------------------------------------------ */

export type BuyVerdict = 'today' | 'month' | 'no' | 'unknown';

export interface BuyAnalysis {
  verdict: BuyVerdict;
  /** Quanto a compra pesa neste mês (à vista = tudo; parcelado = 1ª parcela). */
  thisMonth: Cents;
  /** Valor do dia antes e depois da compra (a partir de hoje). */
  dailyBefore: Cents | null;
  dailyAfter: Cents | null;
  /** Quanto passa do mês, quando não cabe. */
  over: Cents;
  /** Parcelas que ficam para os próximos meses. */
  future: { month: MonthKey; amount: Cents }[];
}

export function canIBuy(plan: MonthPlan, price: Cents, n: number, purchaseDate: DateKey): BuyAnalysis {
  const parts = splitInstallments(price, n);
  const thisMonth = parts[0];
  const future = parts.slice(1).map((amount, i) => ({ month: monthOf(addMonthsToDate(purchaseDate, i + 1)), amount }));

  if (plan.budget === null || plan.dailyBase === null || plan.todayLeft === null || plan.remaining === null || price <= 0) {
    return { verdict: 'unknown', thisMonth, dailyBefore: null, dailyAfter: null, over: 0, future };
  }

  const beforeToday = plan.variableSpent - plan.spentToday;
  const dailyAfter = Math.max(0, Math.floor((plan.budget - beforeToday - thisMonth) / plan.daysLeft));
  let verdict: BuyVerdict;
  let over = 0;
  if (thisMonth <= Math.max(0, plan.todayLeft)) verdict = 'today';
  else if (thisMonth <= plan.remaining) verdict = 'month';
  else {
    verdict = 'no';
    over = thisMonth - Math.max(0, plan.remaining);
  }
  return { verdict, thisMonth, dailyBefore: plan.dailyBase, dailyAfter, over, future };
}
