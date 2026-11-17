import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { addMonths, dateInMonth, monthOf, toDateKey, todayKey } from '../lib/dates';
import { buildInstallments, dueRecurring } from '../lib/planning';
import type { Cents, DateKey, Goal, MonthKey, RecurringItem, Settings, Transaction } from '../lib/types';

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  onboarded: false,
  monthlyLimit: 0,
  reminderEnabled: false,
  reminderHour: 20,
  reminderMinute: 0,
};

interface FinanceState {
  transactions: Transaction[];
  goals: Goal[];
  /** Limite mensal por categoria (centavos). */
  categoryBudgets: Record<string, Cents>;
  /** Dias marcados como "não gastei nada hoje". */
  checkIns: DateKey[];
  /** Contas fixas e rendas recorrentes. */
  recurring: RecurringItem[];
  settings: Settings;

  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => Transaction;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id'>>) => void;
  removeTransaction: (id: string) => void;
  /** Cria todas as parcelas de uma compra. Retorna a primeira. */
  addInstallmentPurchase: (p: { amount: Cents; categoryId: string; note: string; date: DateKey }, n: number) => Transaction;
  removeInstallmentGroup: (groupId: string) => void;

  addRecurring: (r: Omit<RecurringItem, 'id' | 'createdAt'>) => RecurringItem;
  updateRecurring: (id: string, patch: Partial<Omit<RecurringItem, 'id'>>) => void;
  /** Remove a recorrente. Os lançamentos que ela já fez continuam no extrato. */
  removeRecurring: (id: string) => void;
  /** Lança as contas fixas e rendas que já venceram neste mês. Retorna quantas lançou. */
  syncRecurring: (today?: DateKey) => number;

  addGoal: (g: Omit<Goal, 'id' | 'createdAt' | 'saved'> & { saved?: Cents }) => Goal;
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void;
  removeGoal: (id: string) => void;
  contributeToGoal: (id: string, amount: Cents) => void;

  setCategoryBudget: (categoryId: string, limit: Cents) => void;
  checkIn: (date: DateKey) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
}

export const useFinance = create<FinanceState>()(
  persist(
    (set) => ({
      transactions: [],
      goals: [],
      categoryBudgets: {},
      checkIns: [],
      recurring: [],
      settings: DEFAULT_SETTINGS,

      addTransaction: (t) => {
        const tx: Transaction = { ...t, id: uid(), createdAt: Date.now() };
        set((s) => ({ transactions: [tx, ...s.transactions] }));
        return tx;
      },
      updateTransaction: (id, patch) =>
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTransaction: (id) =>
        set((s) => {
          const tx = s.transactions.find((t) => t.id === id);
          const transactions = s.transactions.filter((t) => t.id !== id);
          if (!tx?.recurringId) return { transactions };
          // Lançamento automático excluído: pula este mês, para ele não voltar ao reabrir o app
          const month: MonthKey = tx.recurringMonth ?? monthOf(tx.date);
          return {
            transactions,
            recurring: s.recurring.map((r) =>
              r.id === tx.recurringId && !(r.skipped ?? []).includes(month) ? { ...r, skipped: [...(r.skipped ?? []), month] } : r,
            ),
          };
        }),
      addInstallmentPurchase: (p, n) => {
        const groupId = uid();
        const now = Date.now();
        const txs: Transaction[] = buildInstallments(p, n, groupId).map((t, i) => ({ ...t, id: `${groupId}-${i + 1}`, createdAt: now }));
        set((s) => ({ transactions: [...txs, ...s.transactions] }));
        return txs[0];
      },
      removeInstallmentGroup: (groupId) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.installment?.groupId !== groupId) })),

      addRecurring: (r) => {
        const today = todayKey();
        const month = monthOf(today);
        // Renda cujo dia ainda não chegou neste mês: começa no mês passado, para o último
        // recebimento entrar no extrato e abrir o período atual. Contas começam neste mês.
        const startMonth = r.startMonth ?? (r.type === 'income' && dateInMonth(month, r.dayOfMonth) > today ? addMonths(month, -1) : month);
        const item: RecurringItem = { ...r, startMonth, id: uid(), createdAt: Date.now() };
        set((s) => ({ recurring: [...s.recurring, item] }));
        return item;
      },
      updateRecurring: (id, patch) =>
        set((s) => ({
          recurring: s.recurring.map((r) => {
            if (r.id !== id) return r;
            // Reativada depois de pausada: volta a valer a partir deste mês, sem lançar os meses da pausa
            const resumed = patch.active === true && !r.active;
            return { ...r, ...patch, ...(resumed ? { startMonth: monthOf(todayKey()) } : {}) };
          }),
        })),
      removeRecurring: (id) => set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) })),
      syncRecurring: (today = todayKey()) => {
        let created = 0;
        set((s) => {
          const due = dueRecurring(s.recurring, s.transactions, today);
          created = due.length;
          if (!due.length) return s;
          const now = Date.now();
          const txs: Transaction[] = due.map((t, i) => ({ ...t, id: uid() + i, createdAt: now }));
          return { transactions: [...txs, ...s.transactions] };
        });
        return created;
      },

      addGoal: (g) => {
        const goal: Goal = { saved: 0, ...g, id: uid(), createdAt: Date.now() };
        set((s) => ({ goals: [...s.goals, goal] }));
        return goal;
      },
      updateGoal: (id, patch) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      contributeToGoal: (id, amount) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g)),
        })),

      setCategoryBudget: (categoryId, limit) =>
        set((s) => {
          const next = { ...s.categoryBudgets };
          if (limit > 0) next[categoryId] = limit;
          else delete next[categoryId];
          return { categoryBudgets: next };
        }),
      checkIn: (date) => set((s) => (s.checkIns.includes(date) ? s : { checkIns: [...s.checkIns, date] })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetAll: () =>
        set({ transactions: [], goals: [], categoryBudgets: {}, checkIns: [], recurring: [], settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'my-finance-v1',
      version: 3,
      // v1 -> v2: chegam as contas recorrentes. v2 -> v3: cada recorrente ganha o mês em que começou.
      // Os dados antigos continuam iguais.
      migrate: (persisted) => {
        const p = { recurring: [], ...(persisted as object) } as Partial<FinanceState>;
        p.recurring = (p.recurring ?? []).map((r) => ({
          ...r,
          startMonth: r.startMonth ?? monthOf(toDateKey(new Date(r.createdAt))),
          skipped: r.skipped ?? [],
        }));
        return p;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        transactions: s.transactions,
        goals: s.goals,
        categoryBudgets: s.categoryBudgets,
        checkIns: s.checkIns,
        recurring: s.recurring,
        settings: s.settings,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FinanceState>;
        return { ...current, ...p, recurring: p.recurring ?? [], settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } };
      },
    },
  ),
);

/** true quando os dados salvos já foram carregados do aparelho. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(useFinance.persist.hasHydrated());
  useEffect(() => {
    const unsub = useFinance.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useFinance.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}
