import type { Category } from './types';

export const CATEGORIES: Category[] = [
  // Despesas
  {
    id: 'food',
    name: 'Alimentação',
    icon: 'restaurant',
    color: '#F2994A',
    type: 'expense',
    keywords: ['almoço', 'almoco', 'jantar', 'lanche', 'restaurante', 'ifood', 'pizza', 'café', 'cafe', 'padaria', 'comida', 'hamburguer', 'açaí', 'acai', 'delivery', 'sorvete'],
  },
  {
    id: 'market',
    name: 'Mercado',
    icon: 'cart',
    color: '#27AE60',
    type: 'expense',
    keywords: ['mercado', 'supermercado', 'feira', 'hortifruti', 'atacadão', 'atacadao', 'compras', 'açougue', 'acougue'],
  },
  {
    id: 'transport',
    name: 'Transporte',
    icon: 'car',
    color: '#2D9CDB',
    type: 'expense',
    keywords: ['uber', '99', 'taxi', 'táxi', 'gasolina', 'combustível', 'combustivel', 'ônibus', 'onibus', 'metrô', 'metro', 'estacionamento', 'pedágio', 'pedagio', 'passagem', 'posto'],
  },
  {
    id: 'home',
    name: 'Moradia',
    icon: 'home',
    color: '#9B51E0',
    type: 'expense',
    keywords: ['aluguel', 'condomínio', 'condominio', 'luz', 'energia', 'água', 'agua', 'gás', 'gas', 'internet', 'iptu', 'reforma'],
  },
  {
    id: 'health',
    name: 'Saúde',
    icon: 'medkit',
    color: '#EB5757',
    type: 'expense',
    keywords: ['farmácia', 'farmacia', 'remédio', 'remedio', 'médico', 'medico', 'consulta', 'exame', 'dentista', 'plano de saúde', 'academia', 'drogaria'],
  },
  {
    id: 'education',
    name: 'Educação',
    icon: 'school',
    color: '#56CCF2',
    type: 'expense',
    keywords: ['curso', 'faculdade', 'escola', 'livro', 'mensalidade', 'material'],
  },
  {
    id: 'leisure',
    name: 'Lazer',
    icon: 'game-controller',
    color: '#F2C94C',
    type: 'expense',
    keywords: ['cinema', 'bar', 'show', 'viagem', 'festa', 'cerveja', 'jogo', 'passeio', 'balada', 'ingresso'],
  },
  {
    id: 'subscriptions',
    name: 'Assinaturas',
    icon: 'tv',
    color: '#BB6BD9',
    type: 'expense',
    keywords: ['netflix', 'spotify', 'assinatura', 'prime', 'disney', 'youtube', 'hbo', 'icloud', 'celular', 'plano'],
  },
  {
    id: 'shopping',
    name: 'Compras',
    icon: 'bag-handle',
    color: '#E06C9F',
    type: 'expense',
    keywords: ['roupa', 'sapato', 'tênis', 'tenis', 'shopping', 'presente', 'loja', 'amazon', 'shopee', 'mercado livre'],
  },
  {
    id: 'debts',
    name: 'Dívidas',
    icon: 'card',
    color: '#828282',
    type: 'expense',
    keywords: ['fatura', 'cartão', 'cartao', 'empréstimo', 'emprestimo', 'parcela', 'financiamento', 'juros', 'boleto'],
  },
  {
    id: 'other-expense',
    name: 'Outros',
    icon: 'ellipsis-horizontal-circle',
    color: '#95A5A6',
    type: 'expense',
    keywords: [],
  },
  // Receitas
  {
    id: 'salary',
    name: 'Salário',
    icon: 'briefcase',
    color: '#1B9E5A',
    type: 'income',
    keywords: ['salário', 'salario', 'pagamento', 'holerite', 'adiantamento', 'vale'],
  },
  {
    id: 'freelance',
    name: 'Renda extra',
    icon: 'flash',
    color: '#2BB673',
    type: 'income',
    keywords: ['freela', 'freelance', 'extra', 'bico', 'venda', 'vendi', 'comissão', 'comissao'],
  },
  {
    id: 'investments',
    name: 'Rendimentos',
    icon: 'trending-up',
    color: '#0F6B3C',
    type: 'income',
    keywords: ['rendimento', 'dividendo', 'juros recebidos', 'cdb', 'tesouro', 'investimento'],
  },
  {
    id: 'other-income',
    name: 'Outras receitas',
    icon: 'add-circle',
    color: '#6FCF97',
    type: 'income',
    keywords: ['pix recebido', 'reembolso', 'presente recebido', 'recebi'],
  },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): Category {
  return byId.get(id) ?? byId.get('other-expense')!;
}

export function categoriesOf(type: 'expense' | 'income'): Category[] {
  return CATEGORIES.filter((c) => c.type === type);
}

export const DEFAULT_CATEGORY = { expense: 'other-expense', income: 'other-income' } as const;
