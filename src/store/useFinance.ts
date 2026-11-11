import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Cents, DateKey, Goal, Settings, Transaction } from '../lib/types';

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
  settings: Settings;

  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => Transaction;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id'>>) => void;
  removeTransaction: (id: string) => void;

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
      settings: DEFAULT_SETTINGS,

      addTransaction: (t) => {
        const tx: Transaction = { ...t, id: uid(), createdAt: Date.now() };
        set((s) => ({ transactions: [tx, ...s.transactions] }));
        return tx;
      },
      updateTransaction: (id, patch) =>
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

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
        set({ transactions: [], goals: [], categoryBudgets: {}, checkIns: [], settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'my-finance-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        transactions: s.transactions,
        goals: s.goals,
        categoryBudgets: s.categoryBudgets,
        checkIns: s.checkIns,
        settings: s.settings,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FinanceState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } };
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
