export const TIPS = [
  'Registrar todo gasto, até o cafezinho, é o primeiro passo: você só controla o que enxerga.',
  'Tente a regra 50-30-20: 50% para necessidades, 30% para desejos e 20% para guardar.',
  'Pague-se primeiro: assim que o salário cair, separe um valor para suas metas.',
  'Uma reserva de emergência ideal cobre de 3 a 6 meses do seu custo de vida.',
  'Antes de uma compra por impulso, espere 24 horas. Se ainda fizer sentido, compre.',
  'Revise suas assinaturas todo mês. Pequenos valores recorrentes somam muito no ano.',
  'Dívida de cartão de crédito costuma ter os juros mais altos: priorize quitá-la.',
  'Defina um limite por categoria nos gastos que mais pesam, como alimentação fora de casa.',
  'Comemore pequenas vitórias: cada semana dentro do orçamento é um avanço real.',
  'Ir ao mercado com lista (e sem fome) reduz bastante as compras não planejadas.',
  'Metas com prazo e valor definidos têm muito mais chance de serem alcançadas.',
  'Olhe o extrato do mês no domingo: 5 minutos por semana evitam sustos no fim do mês.',
  'Dia sem gastos também conta! Marque no app e mantenha sua sequência.',
  'Compare preços e use cashback, mas lembre: o maior desconto é não comprar o que não precisa.',
];

export function tipOfTheDay(date: Date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const day = Math.floor((date.getTime() - start) / 86_400_000);
  return TIPS[day % TIPS.length];
}
