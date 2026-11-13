import { describe, expect, test } from '@jest/globals';
import { addMonthsToDate, dateInMonth } from '../dates';
import {
  activeInstallmentGroups,
  buildInstallments,
  canIBuy,
  committedByMonth,
  dueRecurring,
  monthPlan,
  splitInstallments,
} from '../planning';
import { parseQuickEntry } from '../quickEntry';
import type { RecurringItem, Transaction } from '../types';

let seq = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`,
  type: 'expense',
  amount: 1000,
  categoryId: 'food',
  note: '',
  date: '2026-11-10',
  createdAt: 0,
  ...p,
});
const rec = (p: Partial<RecurringItem>): RecurringItem => ({
  id: `r${++seq}`,
  type: 'expense',
  name: 'Aluguel',
  amount: 120000,
  categoryId: 'home',
  dayOfMonth: 5,
  active: true,
  createdAt: 0,
  ...p,
});

describe('datas', () => {
  test('dia limitado ao fim do mês', () => {
    expect(dateInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(dateInMonth('2028-02', 30)).toBe('2028-02-29');
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDate('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('contas recorrentes', () => {
  const aluguel = rec({ id: 'aluguel', dayOfMonth: 5 });
  const internet = rec({ id: 'internet', name: 'Internet', amount: 10000, dayOfMonth: 20 });
  const salario = rec({ id: 'salario', type: 'income', name: 'Salário', amount: 500000, categoryId: 'salary', dayOfMonth: 5 });
  const pausada = rec({ id: 'pausada', active: false, dayOfMonth: 1 });

  test('lança só o que já venceu e ainda não foi lançado', () => {
    const due = dueRecurring([aluguel, internet, salario, pausada], [], '2026-11-13');
    expect(due.map((d) => d.recurringId)).toEqual(['aluguel', 'salario']);
    expect(due[0]).toMatchObject({ date: '2026-11-05', amount: 120000, note: 'Aluguel', type: 'expense' });
    const posted = due.map((d, i) => tx({ ...d, id: `p${i}` }));
    expect(dueRecurring([aluguel, internet, salario], posted, '2026-11-13')).toEqual([]);
    expect(dueRecurring([aluguel, internet, salario], posted, '2026-11-20').map((d) => d.recurringId)).toEqual(['internet']);
  });

  test('dia 31 cai no último dia em fevereiro', () => {
    const due = dueRecurring([rec({ dayOfMonth: 31 })], [], '2026-02-28');
    expect(due[0].date).toBe('2026-02-28');
  });
});

describe('parcelas', () => {
  test('divide sem perder centavos', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitInstallments(60000, 6)).toEqual([10000, 10000, 10000, 10000, 10000, 10000]);
    expect(splitInstallments(500, 1)).toEqual([500]);
  });

  test('uma parcela por mês a partir da compra', () => {
    const list = buildInstallments({ amount: 60000, categoryId: 'shopping', note: 'Tênis', date: '2026-11-30' }, 3, 'g1');
    expect(list.map((t) => t.date)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30']);
    expect(list[1].installment).toEqual({ groupId: 'g1', index: 2, total: 3, purchaseTotal: 60000 });
  });

  test('compromissos dos próximos meses e grupos ativos', () => {
    const txs = buildInstallments({ amount: 60000, categoryId: 'shopping', note: 'Tênis', date: '2026-11-10' }, 6, 'g1').map((t, i) =>
      tx({ ...t, id: `i${i}` }),
    );
    expect(committedByMonth(txs, '2026-12', 3)).toEqual([
      { month: '2026-12', total: 10000 },
      { month: '2027-01', total: 10000 },
      { month: '2027-02', total: 10000 },
    ]);
    const groups = activeInstallmentGroups(txs, '2026-12-15');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ note: 'Tênis', paid: 2, total: 6, perMonth: 10000, lastDate: '2027-04-10', nextTxId: 'i2' });
    expect(activeInstallmentGroups(txs, '2027-05-01')).toEqual([]);
  });
});

describe('número do dia', () => {
  // Novembro tem 30 dias; hoje é dia 13 => faltam 18 dias contando hoje
  const today = '2026-11-13';
  const salario = rec({ id: 'sal', type: 'income', name: 'Salário', amount: 350000, categoryId: 'salary', dayOfMonth: 5 });
  const aluguel = rec({ id: 'alu', amount: 120000, dayOfMonth: 5 });
  const luz = rec({ id: 'luz', name: 'Luz', amount: 20000, dayOfMonth: 25 });

  test('sem renda nem limite: sem número', () => {
    const p = monthPlan([tx({})], [], 0, '2026-11', today);
    expect(p.budget).toBeNull();
    expect(p.dailyBase).toBeNull();
  });

  test('renda menos contas fixas e parcelas, dividido pelos dias', () => {
    const txs = [
      tx({ type: 'income', amount: 350000, categoryId: 'salary', recurringId: 'sal', date: '2026-11-05' }),
      tx({ amount: 120000, recurringId: 'alu', date: '2026-11-05' }),
      tx({ amount: 10000, date: '2026-11-08', installment: { groupId: 'g', index: 1, total: 6, purchaseTotal: 60000 } }),
      tx({ amount: 30000, date: '2026-11-07' }),
      tx({ amount: 4000, date: '2026-11-13' }),
    ];
    const p = monthPlan(txs, [salario, aluguel, luz], 0, '2026-11', today);
    expect(p.income).toBe(350000);
    expect(p.recurringExpense).toBe(140000); // aluguel lançado + luz por vir
    expect(p.installments).toBe(10000);
    expect(p.variableSpent).toBe(34000);
    expect(p.spentToday).toBe(4000);
    expect(p.budget).toBe(200000);
    expect(p.remaining).toBe(166000);
    expect(p.daysLeft).toBe(18);
    // (200000 - 30000) / 18 = 9444
    expect(p.dailyBase).toBe(9444);
    expect(p.todayLeft).toBe(5444);
    expect(p.pending.map((r) => r.id)).toEqual(['luz']);
  });

  test('renda recorrente ainda não lançada conta como renda do mês', () => {
    const p = monthPlan([], [rec({ id: 's', type: 'income', amount: 300000, dayOfMonth: 25 })], 0, '2026-11', today);
    expect(p.income).toBe(300000);
    expect(p.dailyBase).toBe(Math.floor(300000 / 18));
  });

  test('com limite e renda, vale o menor', () => {
    const p = monthPlan([], [salario], 180000, '2026-11', today);
    expect(p.source).toBe('both');
    expect(p.budget).toBe(180000);
  });

  test('gastou além do valor do dia', () => {
    const p = monthPlan([tx({ amount: 20000, date: today })], [], 180000, '2026-11', today);
    expect(p.dailyBase).toBe(10000);
    expect(p.todayLeft).toBe(-10000);
  });

  test('mês passado não tem número do dia', () => {
    const p = monthPlan([], [], 180000, '2026-10', today);
    expect(p.daysLeft).toBe(0);
    expect(p.dailyBase).toBeNull();
  });
});

describe('posso comprar?', () => {
  const today = '2026-11-13';
  const plan = monthPlan([tx({ amount: 30000, date: '2026-11-07' })], [], 210000, '2026-11', today);
  // budget 210000, gasto 30000 => (180000)/18 = 10000 por dia; restante no mês 180000

  test('cabe hoje', () => {
    const a = canIBuy(plan, 8000, 1, today);
    expect(a.verdict).toBe('today');
    expect(a.dailyBefore).toBe(10000);
    expect(a.dailyAfter).toBe(Math.floor((180000 - 8000) / 18));
  });

  test('cabe no mês, mas reduz o valor do dia', () => {
    const a = canIBuy(plan, 90000, 1, today);
    expect(a.verdict).toBe('month');
    expect(a.dailyAfter).toBe(5000);
  });

  test('não cabe', () => {
    const a = canIBuy(plan, 200000, 1, today);
    expect(a.verdict).toBe('no');
    expect(a.over).toBe(20000);
  });

  test('parcelado: só a 1ª parcela pesa agora', () => {
    const a = canIBuy(plan, 200000, 10, today);
    expect(a.thisMonth).toBe(20000);
    expect(a.verdict).toBe('month');
    expect(a.future).toHaveLength(9);
    expect(a.future[0]).toEqual({ month: '2026-12', amount: 20000 });
    expect(a.future[8].month).toBe('2027-08');
  });

  test('sem renda nem limite', () => {
    const empty = monthPlan([], [], 0, '2026-11', today);
    expect(canIBuy(empty, 5000, 1, today).verdict).toBe('unknown');
  });
});

describe('registro rápido com parcelas', () => {
  const today = '2026-11-13';
  test.each([
    ['tênis 600 em 6x', { amount: 60000, installments: 6, categoryId: 'shopping', note: 'Tênis' }],
    ['celular 6x de 250', { amount: 150000, installments: 6, categoryId: 'subscriptions', note: 'Celular' }],
    ['geladeira 3.000 em 10 vezes', { amount: 300000, installments: 10, note: 'Geladeira' }],
    ['curso 900 3 parcelas', { amount: 90000, installments: 3, categoryId: 'education', note: 'Curso' }],
    ['uber 18', { amount: 1800, installments: 1, categoryId: 'transport' }],
    ['recebi 600 em 2x', { amount: 60000, installments: 1, type: 'income' }],
  ])('%s', (input: string, expected: Record<string, unknown>) => {
    expect(parseQuickEntry(input, today)).toMatchObject(expected);
  });
});
