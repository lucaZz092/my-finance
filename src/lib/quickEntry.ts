import { CATEGORIES, DEFAULT_CATEGORY } from './categories';
import { addDays } from './dates';
import { parseAmount } from './money';
import type { Cents, DateKey, TxType } from './types';

export interface ParsedEntry {
  amount: Cents | null;
  type: TxType;
  categoryId: string;
  note: string;
  date: DateKey;
  /** 0 a 1: quão confiante o parser está na categoria. */
  confidence: number;
}

/**
 * Ponto de extensão para IA: hoje usamos regras locais (`ruleBasedParser`).
 * No futuro, um parser com IA (texto livre, voz ou foto de nota fiscal) pode
 * implementar esta mesma interface sem mudar as telas.
 */
export interface EntryParser {
  parse(text: string, today: DateKey): Promise<ParsedEntry> | ParsedEntry;
}

const INCOME_HINTS = ['recebi', 'ganhei', 'entrou', 'salário', 'salario', 'pix recebido', 'receita', 'vendi', 'rendimento'];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function parseQuickEntry(text: string, today: DateKey): ParsedEntry {
  let rest = ` ${text.trim()} `;
  const lower = normalize(rest);

  // Data
  let date = today;
  if (/\banteontem\b/.test(lower)) {
    date = addDays(today, -2);
    rest = rest.replace(/\banteontem\b/i, ' ');
  } else if (/\bontem\b/.test(lower)) {
    date = addDays(today, -1);
    rest = rest.replace(/\bontem\b/i, ' ');
  } else if (/\bhoje\b/.test(lower)) {
    rest = rest.replace(/\bhoje\b/i, ' ');
  }

  // Sinal explícito: "+200 freela" = receita
  let type: TxType | null = null;
  const signMatch = rest.match(/(^|\s)([+-])\s*(?=R?\$?\s*\d)/);
  if (signMatch) {
    type = signMatch[2] === '+' ? 'income' : 'expense';
    rest = rest.replace(signMatch[0], ' ');
  }

  // Valor: primeiro número do texto
  let amount: Cents | null = null;
  const numMatch = rest.match(/(R\$\s*)?\d[\d.,]*/i);
  if (numMatch) {
    amount = parseAmount(numMatch[0]);
    rest = rest.replace(numMatch[0], ' ');
  }
  rest = rest.replace(/\b(reais|real|conto|pila)\b/gi, ' ');

  const noteRaw = rest.replace(/\s+/g, ' ').trim();
  const noteNorm = normalize(noteRaw);

  if (!type) type = INCOME_HINTS.some((h) => noteNorm.includes(normalize(h))) ? 'income' : 'expense';

  // Categoria por palavras-chave (prefere a palavra mais longa encontrada)
  let best: { id: string; len: number } | null = null;
  for (const c of CATEGORIES) {
    if (c.type !== type) continue;
    for (const k of c.keywords) {
      const kn = normalize(k);
      const re = new RegExp(`(^|[^a-z0-9])${kn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`);
      if (re.test(noteNorm) && (!best || kn.length > best.len)) best = { id: c.id, len: kn.length };
    }
  }

  const note = noteRaw
    .replace(/^(gastei|paguei|comprei|recebi|ganhei)\s+(com|no|na|em|de)?\s*/i, '')
    .replace(/^(com|no|na|em|de)\s+/i, '');

  return {
    amount,
    type,
    categoryId: best?.id ?? DEFAULT_CATEGORY[type],
    note: note ? note.charAt(0).toUpperCase() + note.slice(1) : '',
    date,
    confidence: best ? 0.8 : 0.3,
  };
}

export const ruleBasedParser: EntryParser = { parse: parseQuickEntry };
