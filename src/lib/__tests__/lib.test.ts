import { describe, expect, test } from '@jest/globals';
import { addDays, addMonths, daysInMonth, dayLabel, toDateKey } from '../dates';
import {
  activeDays,
  bestStreak,
  budgetStatus,
  currentStreak,
  dailyAllowance,
  expenseByCategory,
  groupByDay,
  monthlyToReachGoal,
  summarize,
  toCSV,
  txOfMonth,
} from '../finance';
import { digitsToCents, formatBRL, formatCompact, nextAmountFromEdit, parseAmount } from '../money';
import { parseQuickEntry } from '../quickEntry';
import type { Transaction } from '../types';

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  type: 'expense',
  amount: 1000,
  categoryId: 'food',
  note: '',
  date: '2026-11-10',
  createdAt: new Date(2026, 10, 10, 10).getTime(),
  ...p,
});

describe('money', () => {
  test('formatBRL', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(100000000)).toBe('R$ 1.000.000,00');
    expect(formatBRL(-2550)).toBe('-R$ 25,50');
    expect(formatBRL(2550, { sign: true })).toBe('+R$ 25,50');
    expect(formatCompact(2500000)).toBe('R$ 25 mil');
  });
  test('parseAmount', () => {
    expect(parseAmount('45')).toBe(4500);
    expect(parseAmount('45,9')).toBe(4590);
    expect(parseAmount('45,90')).toBe(4590);
    expect(parseAmount('1.234,56')).toBe(123456);
    expect(parseAmount('1,234.56')).toBe(123456);
    expect(parseAmount('12.5')).toBe(1250);
    expect(parseAmount('1.500')).toBe(150000);
    expect(parseAmount('R$ 12')).toBe(1200);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
  test('digitsToCents', () => {
    expect(digitsToCents('')).toBe(0);
    expect(digitsToCents('1')).toBe(1);
    expect(digitsToCents('4590')).toBe(4590);
    expect(digitsToCents('00012')).toBe(12);
    expect(digitsToCents('123456789012345')).toBe(12345678901);
  });
});

describe('amount field', () => {
  const type = (start: number, keys: string, pos?: number) => {
    let v = start;
    for (const k of keys) {
      const text = formatBRL(v, { hideSymbol: true });
      const at = pos ?? text.length;
      const next = k === '<' ? text.slice(0, at - 1) + text.slice(at) : text.slice(0, at) + k + text.slice(at);
      v = nextAmountFromEdit(v, text, next);
    }
    return v;
  };
  test('digits append at the end wherever the cursor is', () => {
    expect(type(0, '300000')).toBe(300000);
    expect(type(0, '300000', 0)).toBe(300000);
    expect(type(0, '300000', 2)).toBe(300000);
    expect(type(4590, '<')).toBe(459);
    expect(type(4590, '<', 1)).toBe(459);
    expect(type(123456, '<<<')).toBe(123);
    expect(type(1, '<')).toBe(0);
  });
});

describe('dates', () => {
  test('helpers', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(daysInMonth('2028-02')).toBe(29);
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    const now = new Date(2026, 10, 10, 9);
    expect(dayLabel('2026-11-10', now)).toBe('Hoje');
    expect(dayLabel('2026-11-09', now)).toBe('Ontem');
    expect(dayLabel('2026-11-04', now)).toBe('quarta, 4 de nov');
  });
});

describe('finance', () => {
  const txs = [
    tx({ type: 'income', amount: 500000, categoryId: 'salary', date: '2026-11-05' }),
    tx({ amount: 3000, categoryId: 'food', date: '2026-11-10' }),
    tx({ amount: 12000, categoryId: 'market', date: '2026-11-09' }),
    tx({ amount: 2000, categoryId: 'food', date: '2026-11-09' }),
    tx({ amount: 9999, categoryId: 'food', date: '2026-10-30' }),
  ];
  test('summary and grouping', () => {
    const nov = txOfMonth(txs, '2026-11');
    expect(nov).toHaveLength(4);
    expect(summarize(nov)).toEqual({ income: 500000, expense: 17000, balance: 483000, count: 4 });
    expect(expenseByCategory(nov)).toEqual([
      { categoryId: 'market', total: 12000 },
      { categoryId: 'food', total: 5000 },
    ]);
    const groups = groupByDay(nov);
    expect(groups.map((g) => g.date)).toEqual(['2026-11-10', '2026-11-09', '2026-11-05']);
    expect(groups[1].net).toBe(-14000);
  });
  test('streaks', () => {
    const days = new Set(['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-01', '2026-11-02']);
    expect(currentStreak(days, '2026-11-09')).toBe(3);
    expect(currentStreak(days, '2026-11-10')).toBe(3); // hoje ainda em aberto
    expect(currentStreak(days, '2026-11-11')).toBe(0);
    expect(bestStreak(days)).toBe(3);
    expect(bestStreak(new Set())).toBe(0);
    const a = activeDays([tx({ date: '2026-11-01', createdAt: new Date(2026, 10, 3, 8).getTime() })], ['2026-11-05']);
    expect([...a].sort()).toEqual(['2026-11-01', '2026-11-03', '2026-11-05']);
  });
  test('budget', () => {
    expect(budgetStatus(500, 1000)).toBe('ok');
    expect(budgetStatus(800, 1000)).toBe('warning');
    expect(budgetStatus(1001, 1000)).toBe('over');
    expect(budgetStatus(1001, 0)).toBe('ok');
    // novembro tem 30 dias; dia 21 => 10 dias restantes
    expect(dailyAllowance(200000, 100000, '2026-11', '2026-11-21')).toBe(10000);
    expect(dailyAllowance(200000, 300000, '2026-11', '2026-11-21')).toBe(0);
    expect(dailyAllowance(0, 0, '2026-11', '2026-11-21')).toBeNull();
    expect(dailyAllowance(100, 0, '2026-10', '2026-11-21')).toBeNull();
  });
  test('goals', () => {
    expect(monthlyToReachGoal(0, 120000, '2027-11-10', '2026-11-10')).toBe(10000);
    expect(monthlyToReachGoal(0, 120000, '2026-11-20', '2026-11-10')).toBe(120000);
    expect(monthlyToReachGoal(130000, 120000, '2027-11-10', '2026-11-10')).toBeNull();
    expect(monthlyToReachGoal(0, 120000, undefined, '2026-11-10')).toBeNull();
  });
  test('csv', () => {
    const csv = toCSV([tx({ amount: 4590, note: 'Almoço "bom"' })], () => 'Alimentação');
    expect(csv.split('\n')[1]).toBe('2026-11-10;despesa;Alimentação;"Almoço ""bom""";-45,90');
  });
});

describe('quick entry', () => {
  const today = '2026-11-10';
  test.each([
    ['almoço 32,50', { amount: 3250, type: 'expense', categoryId: 'food', note: 'Almoço', date: today }],
    ['Uber 18 ontem', { amount: 1800, type: 'expense', categoryId: 'transport', note: 'Uber', date: '2026-11-09' }],
    ['recebi salário 3.500', { amount: 350000, type: 'income', categoryId: 'salary', note: 'Salário', date: today }],
    ['+200 freela logo', { amount: 20000, type: 'income', categoryId: 'freelance', note: 'Freela logo', date: today }],
    ['gastei 120 no mercado', { amount: 12000, type: 'expense', categoryId: 'market', note: 'Mercado', date: today }],
    ['netflix 55,90', { amount: 5590, type: 'expense', categoryId: 'subscriptions', note: 'Netflix', date: today }],
    ['farmacia R$ 23,40 anteontem', { amount: 2340, type: 'expense', categoryId: 'health', note: 'Farmacia', date: '2026-11-08' }],
    ['coisa aleatória 10', { amount: 1000, type: 'expense', categoryId: 'other-expense', note: 'Coisa aleatória', date: today }],
    ['gasolina', { amount: null, type: 'expense', categoryId: 'transport', note: 'Gasolina', date: today }],
  ])('%s', (input: string, expected: Record<string, unknown>) => {
    expect(parseQuickEntry(input, today)).toMatchObject(expected);
  });
});
