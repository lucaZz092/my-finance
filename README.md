# My Finance 💚

App Android de organização financeira focado em **criar o hábito** de cuidar do dinheiro todos os dias.
MVP feito em React Native + Expo (SDK 58), TypeScript e Expo Router. Os dados ficam salvos no próprio aparelho.

## O que o MVP faz

| Tela | Funcionalidades |
|---|---|
| **Boas-vindas** | Nome, limite mensal de gastos e lembrete diário (4 passos). |
| **Início** | **"Hoje você pode gastar R$ X"**: o número do dia, já descontando contas fixas e parcelas; botão **Posso comprar?**; **registro rápido em texto** (também entende "tênis 600 em 6x"); (“almoço 32,50”, “uber 18 ontem”, “recebi salário 5.000”), botões de Despesa/Receita, **sequência de dias** (🔥) com a semana, botão “Hoje não gastei nada”, limite do mês com **quanto ainda dá para gastar por dia**, gastos por categoria, últimos lançamentos e dica do dia. |
| **Contas fixas e renda** | Salário, aluguel, internet etc. entram sozinhos no extrato no dia certo; resumo da sobra para o dia a dia; compras parceladas em andamento. |
| **Posso comprar?** | Digita o preço, escolhe à vista ou parcelado e vê se cabe no dia, no mês, e quanto o valor diário cai. Dá para registrar a compra ali mesmo. |
| **Parcelas** | Despesa parcelada em até 12x pelo formulário (ou até 48x pelo texto); cria uma parcela por mês; excluir uma ou todas. |
| **Extrato** | Navegação por mês, resumo (receitas/despesas/saldo), busca, filtro, lista agrupada por dia, editar e excluir. |
| **Orçamento** | Limite mensal geral, limites por categoria (aviso em 80% e ao estourar), taxa de poupança com a regra 50-30-20 e sugestão pela sua média dos últimos meses. |
| **Metas** | Metas com valor, ícone e prazo, valor a guardar por mês, guardar/retirar dinheiro. |
| **Ajustes** | Nome, lembrete diário (liga/desliga e horário), exportar CSV, apagar dados. |

## Como rodar no celular (o jeito mais rápido)

1. Instale o [Node.js 20+](https://nodejs.org) no computador.
2. No celular Android, instale o app **Expo Go** (Play Store).
3. Na pasta do projeto:
   ```bash
   npm install
   npx expo start
   ```
4. Abra o Expo Go e escaneie o QR Code que aparece no terminal (celular e computador na mesma rede Wi-Fi).

> No Expo Go os lembretes locais funcionam. Para testar como app instalado de verdade, gere o APK abaixo.

## Gerar o APK para instalar

**Opção A — na nuvem (não precisa de Android Studio):**
```bash
npx eas-cli@latest login        # conta Expo gratuita
npx eas-cli@latest build -p android --profile preview
```
Ao final aparece um link para baixar o `.apk` e instalar no celular.

**Opção B — no seu computador com Android Studio:**
```bash
npx expo run:android --variant release
```

**Para publicar na Play Store:** `npx eas-cli@latest build -p android --profile production` gera o `.aab`.

## Versão 1.1 — o número do dia

- Cálculo em `src/lib/planning.ts`: renda do mês (recebida + recorrentes por vir) − contas fixas − parcelas do mês = sobra para o dia a dia. Valor do dia = (sobra − gastos do dia a dia até ontem) ÷ dias que faltam. Se houver limite mensal, vale o menor.
- Contas recorrentes são lançadas ao abrir o app e quando ele volta para a frente (`syncRecurring`), uma vez por mês cada.
- Dados salvos na versão 2 (migração automática da versão 1, sem perder nada).

## Comandos úteis

```bash
npm test            # testes da lógica (valores, datas, sequência, orçamento, registro rápido)
npm run typecheck   # checagem de tipos
npm run web         # abre no navegador para desenvolver mais rápido
```

## Estrutura

```
src/
  app/                 telas (Expo Router)
    (tabs)/            Início, Extrato, Orçamento, Metas, Ajustes
    onboarding.tsx     boas-vindas
    transaction.tsx    nova/editar transação
    budget.tsx         definir limite
    goal.tsx           nova/editar meta
  components/          componentes visuais reutilizáveis
  lib/
    finance.ts         cálculos (resumo, sequência, orçamento, metas, CSV)
    quickEntry.ts      registro rápido por texto  ← ponto de entrada da IA
    money.ts, dates.ts formatação em R$ e datas locais
    categories.ts      categorias e palavras-chave
    theme.ts           cores verde e branco
  store/useFinance.ts  estado + salvamento no aparelho (Zustand + AsyncStorage)
```

## Preparado para IA

O registro rápido usa a interface `EntryParser` (`src/lib/quickEntry.ts`). Hoje ela é atendida por regras
locais (`ruleBasedParser`). Para colocar IA, basta criar outro parser com a mesma interface e trocar
na tela Início — sem mexer no resto do app. Próximos passos naturais:

1. **Texto livre com IA**: “gastei 80 no mercado e 25 de uber” → vários lançamentos de uma vez.
2. **Voz**: falar o gasto e transcrever para o mesmo parser.
3. **Foto de nota fiscal / comprovante Pix**: extrair valor, data e estabelecimento.
4. **Insights semanais**: resumo do que mudou e onde dá para economizar.

> As chamadas de IA devem passar por um backend seu (nunca coloque a chave da API dentro do app).

## Observações

- Valores são guardados em centavos (inteiros) para evitar erro de arredondamento.
- Datas usam o fuso local do aparelho.
- Para mudar o nome do pacote Android, edite `android.package` em `app.json` (hoje: `com.softsolutions.myfinance`).
