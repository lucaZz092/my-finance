import type { Cents } from './types';

/** Formata centavos como moeda brasileira: 123456 -> "R$ 1.234,56". */
export function formatBRL(cents: Cents, opts: { sign?: boolean; hideSymbol?: boolean } = {}): string {
  const negative = cents < 0;
  const abs = Math.round(Math.abs(cents));
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  const reaisStr = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const body = `${opts.hideSymbol ? '' : 'R$ '}${reaisStr},${String(centavos).padStart(2, '0')}`;
  if (negative) return `-${body}`;
  if (opts.sign && cents > 0) return `+${body}`;
  return body;
}

/** Formato compacto para espaços pequenos: 1500000 -> "R$ 15 mil". */
export function formatCompact(cents: Cents): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1_000_000) return `R$ ${(reais / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (Math.abs(reais) >= 10_000) return `R$ ${Math.round(reais / 1000)} mil`;
  return formatBRL(cents);
}

/**
 * Converte texto digitado para centavos.
 * Aceita "45", "45,9", "45,90", "1.234,56", "1234.56", "R$ 12".
 * Retorna null se não houver número válido.
 */
export function parseAmount(input: string): Cents | null {
  let s = input.replace(/[R$\s]/gi, '');
  if (!s) return null;
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // O último separador é o decimal
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals <= 2 ? s.replace(/,/g, (m, i) => (i === lastComma ? '.' : '')) : s.replace(/,/g, '');
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    const dots = (s.match(/\./g) || []).length;
    // "1.234" (milhar) vs "12.5" (decimal)
    if (dots > 1 || decimals === 3) s = s.replace(/\./g, '');
  }
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/**
 * Entrada estilo "app de banco": cada dígito empurra da direita.
 * Mantém apenas dígitos e limita a 11 dígitos (R$ 999.999.999,99).
 */
/**
 * Calcula o novo valor do campo "app de banco" a partir do texto editado,
 * independente de onde o cursor estava: dígitos novos entram sempre no fim,
 * e apagar remove sempre o último dígito.
 */
export function nextAmountFromEdit(prev: Cents, prevText: string, nextText: string): Cents {
  const a = prevText.replace(/\D/g, '');
  const b = nextText.replace(/\D/g, '');
  if (b.length > a.length) {
    let p = 0;
    while (p < a.length && a[p] === b[p]) p++;
    let q = 0;
    while (q < a.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
    const inserted = b.slice(p, b.length - q);
    return digitsToCents(String(prev) + inserted);
  }
  if (b.length < a.length) {
    const removed = a.length - b.length;
    return Math.floor(prev / 10 ** removed);
  }
  return prev;
}

export function digitsToCents(digits: string): Cents {
  const clean = digits.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11);
  return clean ? parseInt(clean, 10) : 0;
}
