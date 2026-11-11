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
