import { addDays, addMonths, addMonthsToDate, dateInMonth, daysInMonth, diffDays, monthOf, toDateKey } from './dates';
import type { Cents, DateKey, MonthKey, RecurringItem, Transaction } from './types';

/* ------------------------------------------------------------------ */
/* Contas fixas e renda recorrente                                     */
/* ------------------------------------------------------------------ */

/** Mês da ocorrência que um lançamento automático representa. */
const occurrenceMonth = (t: Transaction): MonthKey => t.recurringMonth ?? monthOf(t.date);

/** A recorrente já foi lançada neste mês? */
export function isPosted(item: RecurringItem, txs: Transaction[], month: MonthKey): boolean {
  return txs.some((t) => t.recurringId === item.id && occurrenceMonth(t) === month);
}

/** O usuário pulou este mês (excluiu o lançamento automático)? */
export function isSkipped(item: RecurringItem, month: MonthKey): boolean {
  return (item.skipped ?? []).includes(month);
}

/** Primeiro mês em que a recorrente vale. */
export function firstMonth(item: RecurringItem): MonthKey {
  return item.startMonth ?? monthOf(toDateKey(new Date(item.createdAt)));
}

/** Até quantos meses para trás o app lança o que ficou pendente. */
export const CATCH_UP_MONTHS = 12;

/**
 * Lançamentos de contas fixas e rendas que já venceram e ainda não foram lançados,
 * incluindo meses em que o app não foi aberto. Cada ocorrência (recorrente + mês)
 * é lançada no máximo uma vez, e meses pulados pelo usuário não voltam.
 */
export function dueRecurring(
  items: RecurringItem[],
  txs: Transaction[],
  today: DateKey,
): Omit<Transaction, 'id' | 'createdAt'>[] {
  const current = monthOf(today);
  const oldest = addMonths(current, -(CATCH_UP_MONTHS - 1));
  const out: Omit<Transaction, 'id' | 'createdAt'>[] = [];
  for (const item of items) {
    if (!item.active || item.amount <= 0) continue;
    const first = firstMonth(item);
    for (let month = first > oldest ? first : oldest; month <= current; month = addMonths(month, 1)) {
      const date = dateInMonth(month, item.dayOfMonth);
      if (date > today) continue;
      if (isSkipped(item, month) || isPosted(item, txs, month)) continue;
      out.push({
        type: item.type,
        amount: item.amount,
        categoryId: item.categoryId,
        note: item.name,
        date,
        recurringId: item.id,
        recurringMonth: month,
      });
    }
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
  const pending = isCurrent || isFuture ? active.filter((r) => !isPosted(r, txs, month) && !isSkipped(r, month) && firstMonth(r) <= month) : [];

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

export function canIBuy(plan: Pick<MonthPlan, 'budget' | 'dailyBase' | 'todayLeft' | 'remaining' | 'variableSpent' | 'spentToday' | 'daysLeft'>, price: Cents, n: number, purchaseDate: DateKey): BuyAnalysis {
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

/* ------------------------------------------------------------------ */
/* Período até o próximo recebimento                                    */
/* ------------------------------------------------------------------ */

export interface PlanLine {
  label: string;
  amount: Cents;
  date: DateKey;
  /** true = ainda vai acontecer (previsto); false = já está no extrato. */
  pending: boolean;
}

export interface CyclePlan {
  /** 'payday' = do último recebimento até a véspera do próximo; 'month' = mês do calendário. */
  mode: 'payday' | 'month';
  start: DateKey;
  end: DateKey;
  /** Data do próximo recebimento recorrente, se houver. */
  nextPay: DateKey | null;
  income: Cents;
  recurringExpense: Cents;
  installments: Cents;
  variableSpent: Cents;
  spentToday: Cents;
  /** Limite mensal ajustado ao tamanho do período (0 = sem limite). */
  limit: Cents;
  budget: Cents | null;
  source: 'income' | 'limit' | 'both' | null;
  remaining: Cents | null;
  /** Dias que faltam, contando hoje. */
  daysLeft: number;
  dailyBase: Cents | null;
  todayLeft: Cents | null;
  /** Tudo que entrou na conta, para a tela "Como calculamos". */
  incomeLines: PlanLine[];
  fixedLines: PlanLine[];
  installmentLines: PlanLine[];
}

interface Occurrence {
  item: RecurringItem;
  month: MonthKey;
  date: DateKey;
}

/** Ocorrências válidas (não puladas, a partir do primeiro mês) das recorrentes ativas entre dois meses. */
function occurrences(items: RecurringItem[], from: MonthKey, to: MonthKey): Occurrence[] {
  const out: Occurrence[] = [];
  for (const item of items) {
    if (!item.active || item.amount <= 0) continue;
    for (let month = from; month <= to; month = addMonths(month, 1)) {
      if (month < firstMonth(item) || isSkipped(item, month)) continue;
      out.push({ item, month, date: dateInMonth(month, item.dayOfMonth) });
    }
  }
  return out;
}

/**
 * O número do dia, contando até o próximo recebimento.
 *
 * Com renda recorrente cadastrada, o período vai do último recebimento até a véspera do próximo:
 * só conta dinheiro que já entrou, e reserva as contas fixas e parcelas que vencem antes do
 * próximo recebimento (inclusive as do começo do mês seguinte). Sem renda recorrente, usa o mês do calendário.
 */
export function cyclePlan(txs: Transaction[], recurring: RecurringItem[], monthlyLimit: Cents, today: DateKey): CyclePlan {
  const month = monthOf(today);
  const occ = occurrences(recurring, addMonths(month, -3), addMonths(month, 3));
  const pays = occ.filter((o) => o.item.type === 'income').map((o) => o.date).sort();
  const lastPay = [...pays].reverse().find((d) => d <= today) ?? null;
  const nextPay = pays.find((d) => d > today) ?? null;

  let mode: CyclePlan['mode'];
  let start: DateKey;
  let end: DateKey;
  if (lastPay) {
    mode = 'payday';
    start = lastPay;
    end = nextPay ? addDays(nextPay, -1) : addDays(addMonthsToDate(lastPay, 1), -1);
  } else {
    mode = 'month';
    start = `${month}-01`;
    const monthEnd = dateInMonth(month, 31);
    end = nextPay && nextPay <= monthEnd ? addDays(nextPay, -1) : monthEnd;
  }

  const inRange = (d: DateKey) => d >= start && d <= end;
  const inCycle = txs.filter((t) => inRange(t.date));
  const pending = occ.filter((o) => inRange(o.date) && !isPosted(o.item, txs, o.month));
  const byDate = (a: PlanLine, b: PlanLine) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  const incomeLines: PlanLine[] = [
    ...inCycle.filter((t) => t.type === 'income').map((t) => ({ label: t.note || 'Receita', amount: t.amount, date: t.date, pending: false })),
    ...pending.filter((o) => o.item.type === 'income').map((o) => ({ label: o.item.name, amount: o.item.amount, date: o.date, pending: true })),
  ].sort(byDate);
  const fixedLines: PlanLine[] = [
    ...inCycle
      .filter((t) => t.type === 'expense' && t.recurringId)
      .map((t) => ({ label: t.note || 'Conta fixa', amount: t.amount, date: t.date, pending: false })),
    ...pending.filter((o) => o.item.type === 'expense').map((o) => ({ label: o.item.name, amount: o.item.amount, date: o.date, pending: true })),
  ].sort(byDate);
  const installmentLines: PlanLine[] = inCycle
    .filter((t) => t.type === 'expense' && t.installment)
    .map((t) => ({
      label: `${t.note || 'Parcela'} (${t.installment!.index}/${t.installment!.total})`,
      amount: t.amount,
      date: t.date,
      pending: t.date > today,
    }))
    .sort(byDate);

  const sum = (lines: PlanLine[]) => lines.reduce((a, l) => a + l.amount, 0);
  const income = sum(incomeLines);
  const recurringExpense = sum(fixedLines);
  const installments = sum(installmentLines);
  const variable = inCycle.filter(isVariable);
  const variableSpent = variable.reduce((a, t) => a + t.amount, 0);
  const spentToday = variable.filter((t) => t.date === today).reduce((a, t) => a + t.amount, 0);

  // O limite é mensal: em períodos mais curtos ou mais longos que um mês, vale proporcionalmente
  const cycleDays = diffDays(start, end) + 1;
  const limit = monthlyLimit <= 0 ? 0 : cycleDays >= 28 && cycleDays <= 31 ? monthlyLimit : Math.round((monthlyLimit * cycleDays) / 30);

  const fixed = recurringExpense + installments;
  const byIncome = income > 0 ? income - fixed : null;
  const byLimit = limit > 0 ? limit - fixed : null;
  let budget: Cents | null = null;
  let source: CyclePlan['source'] = null;
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

  const daysLeft = diffDays(today, end) + 1;
  let dailyBase: Cents | null = null;
  let todayLeft: Cents | null = null;
  if (budget !== null && daysLeft > 0) {
    dailyBase = Math.max(0, Math.floor((budget - (variableSpent - spentToday)) / daysLeft));
    todayLeft = dailyBase - spentToday;
  }

  return {
    mode,
    start,
    end,
    nextPay,
    income,
    recurringExpense,
    installments,
    variableSpent,
    spentToday,
    limit,
    budget,
    source,
    remaining: budget === null ? null : budget - variableSpent,
    daysLeft,
    dailyBase,
    todayLeft,
    incomeLines,
    fixedLines,
    installmentLines,
  };
}
