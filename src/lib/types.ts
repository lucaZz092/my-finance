export type TxType = 'expense' | 'income';

/** Valores monetários são sempre guardados em centavos (inteiros) para evitar erros de arredondamento. */
export type Cents = number;

/** Data local no formato YYYY-MM-DD. */
export type DateKey = string;

/** Mês no formato YYYY-MM. */
export type MonthKey = string;

export interface Transaction {
  id: string;
  type: TxType;
  amount: Cents;
  categoryId: string;
  note: string;
  date: DateKey;
  createdAt: number;
  /** Preenchido quando o lançamento veio de uma conta fixa ou renda recorrente. */
  recurringId?: string;
  /** Preenchido quando é uma parcela de uma compra parcelada. */
  installment?: InstallmentInfo;
}

export interface InstallmentInfo {
  groupId: string;
  /** Número da parcela, começando em 1. */
  index: number;
  total: number;
  /** Valor total da compra. */
  purchaseTotal: Cents;
}

/** Conta fixa (aluguel, internet) ou renda recorrente (salário), lançada sozinha todo mês. */
export interface RecurringItem {
  id: string;
  type: TxType;
  name: string;
  amount: Cents;
  categoryId: string;
  /** Dia do mês (1 a 31). Em meses mais curtos, cai no último dia. */
  dayOfMonth: number;
  active: boolean;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TxType;
  /** Palavras usadas pelo lançamento rápido para adivinhar a categoria. */
  keywords: string[];
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target: Cents;
  saved: Cents;
  deadline?: DateKey;
  createdAt: number;
}

export interface Settings {
  name: string;
  onboarded: boolean;
  /** Limite de gastos do mês (0 = não definido). */
  monthlyLimit: Cents;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
}
