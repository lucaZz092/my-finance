import { describe, expect, test } from '@jest/globals';
import { addMonthsToDate, dateInMonth } from '../dates';
import {
  activeInstallmentGroups,
  buildInstallments,
  canIBuy,
  cyclePlan,
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
  startMonth: '2026-11',
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
    const due = dueRecurring([rec({ dayOfMonth: 31, startMonth: '2026-02' })], [], '2026-02-28');
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

describe('v1.2: contas fixas sem duplicar nem sumir', () => {
  const aluguel = rec({ id: 'alu', amount: 100000, dayOfMonth: 5, startMonth: '2026-10' });

  test('mês sem abrir o app é lançado, uma única vez', () => {
    const due = dueRecurring([aluguel], [], '2026-12-02');
    expect(due.map((d) => [d.recurringMonth, d.date])).toEqual([
      ['2026-10', '2026-10-05'],
      ['2026-11', '2026-11-05'],
    ]);
    const posted = due.map((d, i) => tx({ ...d, id: `c${i}` }));
    expect(dueRecurring([aluguel], posted, '2026-12-02')).toEqual([]);
    expect(dueRecurring([aluguel], posted, '2026-12-05').map((d) => d.recurringMonth)).toEqual(['2026-12']);
  });

  test('mês pulado não volta', () => {
    const pulada = { ...aluguel, skipped: ['2026-11'] };
    expect(dueRecurring([pulada], [], '2026-11-16').map((d) => d.recurringMonth)).toEqual(['2026-10']);
  });

  test('editar a data do lançamento para outro mês não duplica', () => {
    const movido = tx({ recurringId: 'alu', recurringMonth: '2026-11', date: '2026-12-01', amount: 100000 });
    const due = dueRecurring([{ ...aluguel, startMonth: '2026-11' }], [movido], '2026-12-02');
    expect(due).toEqual([]);
  });

  test('nunca lança antes do primeiro mês, e no máximo 12 meses para trás', () => {
    expect(dueRecurring([rec({ startMonth: '2026-11', dayOfMonth: 5 })], [], '2026-11-16')).toHaveLength(1);
    expect(dueRecurring([rec({ startMonth: '2020-01', dayOfMonth: 5 })], [], '2026-11-16')).toHaveLength(12);
  });
});

describe('v1.2: número do dia até o próximo recebimento', () => {
  const sal = rec({ id: 'sal', type: 'income', name: 'Salário', amount: 300000, categoryId: 'salary', dayOfMonth: 5, startMonth: '2026-10' });
  const alu = rec({ id: 'alu', amount: 100000, dayOfMonth: 5, startMonth: '2026-10' });
  const nov = [
    tx({ type: 'income', amount: 300000, categoryId: 'salary', note: 'Salário', date: '2026-11-05', recurringId: 'sal', recurringMonth: '2026-11' }),
    tx({ amount: 100000, note: 'Aluguel', date: '2026-11-05', recurringId: 'alu', recurringMonth: '2026-11' }),
    tx({ amount: 170000, date: '2026-11-20' }),
  ];

  test('salário dia 5, R$ 300 livres em 28/11: conta os 7 dias até 04/12', () => {
    const p = cyclePlan(nov, [sal, alu], 0, '2026-11-28');
    expect(p.mode).toBe('payday');
    expect([p.start, p.end, p.nextPay]).toEqual(['2026-11-05', '2026-12-04', '2026-12-05']);
    expect(p.remaining).toBe(30000);
    expect(p.daysLeft).toBe(7);
    expect(p.dailyBase).toBe(4285);
  });

  test('em 02/12, antes do salário cair, a renda de dezembro não conta', () => {
    const p = cyclePlan(nov, [sal, alu], 0, '2026-12-02');
    expect(p.income).toBe(300000);
    expect(p.end).toBe('2026-12-04');
    expect(p.daysLeft).toBe(3);
    expect(p.dailyBase).toBe(10000);
    expect(p.incomeLines.every((l) => !l.pending)).toBe(true);
  });

  test('no dia do recebimento começa um período novo', () => {
    const dez = [
      ...nov,
      tx({ type: 'income', amount: 300000, categoryId: 'salary', date: '2026-12-05', recurringId: 'sal', recurringMonth: '2026-12' }),
      tx({ amount: 100000, date: '2026-12-05', recurringId: 'alu', recurringMonth: '2026-12' }),
    ];
    const p = cyclePlan(dez, [sal, alu], 0, '2026-12-05');
    expect([p.start, p.end]).toEqual(['2026-12-05', '2027-01-04']);
    expect(p.budget).toBe(200000);
    expect(p.daysLeft).toBe(31);
    expect(p.variableSpent).toBe(0);
  });

  test('conta fixa do começo do mês seguinte é reservada antes do próximo salário', () => {
    const internet = rec({ id: 'net', name: 'Internet', amount: 12000, dayOfMonth: 1, startMonth: '2026-10' });
    const p = cyclePlan(nov, [sal, alu, internet], 0, '2026-11-28');
    expect(p.fixedLines.map((l) => [l.label, l.date, l.pending])).toEqual([
      ['Aluguel', '2026-11-05', false],
      ['Internet', '2026-12-01', true],
    ]);
    expect(p.remaining).toBe(18000);
  });

  test('parcela que vence antes do próximo recebimento entra, a seguinte não', () => {
    const parcelas = [
      tx({ amount: 5000, note: 'Fone', date: '2026-12-03', installment: { groupId: 'g', index: 2, total: 3, purchaseTotal: 15000 } }),
      tx({ amount: 5000, note: 'Fone', date: '2027-01-03', installment: { groupId: 'g', index: 3, total: 3, purchaseTotal: 15000 } }),
    ];
    const p = cyclePlan([...nov, ...parcelas], [sal, alu], 0, '2026-11-28');
    expect(p.installments).toBe(5000);
    expect(p.installmentLines[0]).toMatchObject({ label: 'Fone (2/3)', pending: true });
  });

  test('dois recebimentos no mês: cada um abre um período', () => {
    const vale = rec({ id: 'vale', type: 'income', name: 'Adiantamento', amount: 120000, categoryId: 'salary', dayOfMonth: 20, startMonth: '2026-10' });
    const txs = [tx({ type: 'income', amount: 120000, date: '2026-11-20', recurringId: 'vale', recurringMonth: '2026-11' })];
    const p = cyclePlan(txs, [sal, vale], 0, '2026-11-25');
    expect([p.start, p.end]).toEqual(['2026-11-20', '2026-12-04']);
    expect(p.income).toBe(120000);
    expect(p.daysLeft).toBe(10);
    expect(p.dailyBase).toBe(12000);
  });

  test('recebimento pulado não abre período', () => {
    const p = cyclePlan(nov.slice(1), [{ ...sal, skipped: ['2026-11'] }, alu], 0, '2026-11-28');
    expect(p.start).toBe('2026-10-05');
  });

  test('sem renda recorrente: mês do calendário, como antes', () => {
    const p = cyclePlan([tx({ amount: 30000, date: '2026-11-07' })], [], 210000, '2026-11-13');
    expect(p.mode).toBe('month');
    expect([p.start, p.end]).toEqual(['2026-11-01', '2026-11-30']);
    expect(p.daysLeft).toBe(18);
    expect(p.dailyBase).toBe(10000);
  });

  test('limite mensal vale proporcionalmente em período curto', () => {
    const vale = rec({ id: 'vale', type: 'income', name: 'Adiantamento', amount: 120000, categoryId: 'salary', dayOfMonth: 20, startMonth: '2026-10' });
    const txs = [tx({ type: 'income', amount: 120000, date: '2026-11-20', recurringId: 'vale', recurringMonth: '2026-11' })];
    const p = cyclePlan(txs, [sal, vale], 90000, '2026-11-25'); // 15 dias => metade do limite
    expect(p.limit).toBe(45000);
    expect(p.budget).toBe(45000);
    expect(p.source).toBe('both');
  });

  test('fevereiro e virada de ano', () => {
    const s31 = rec({ id: 's31', type: 'income', amount: 300000, categoryId: 'salary', dayOfMonth: 31, startMonth: '2026-12' });
    const p = cyclePlan([], [s31], 0, '2027-02-10');
    expect([p.start, p.end, p.nextPay]).toEqual(['2027-01-31', '2027-02-27', '2027-02-28']);
    const q = cyclePlan([], [s31], 0, '2027-01-02');
    expect([q.start, q.end]).toEqual(['2026-12-31', '2027-01-30']);
  });
});
