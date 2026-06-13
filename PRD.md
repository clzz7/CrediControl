# PRD: Sistema de Controle de Empréstimos Pessoais

## 1. Visão Geral do Produto

Um sistema web desenhado para automatizar o controle de empréstimos pessoais. O objetivo principal é substituir anotações manuais, eliminando erros de cálculo de juros compostos, automatizando a cobrança de multas por atraso diário e fornecendo um painel em tempo real da saúde financeira (dinheiro na rua, valor recuperado e lucro).

## 2. Personas e Casos de Uso

- **Administrador (Sua Mãe):** Precisa registrar saídas de dinheiro rapidamente, saber quem está devendo, aplicar pagamentos parciais ou rolagens de dívida, e enviar cobranças pelo WhatsApp com um clique.
- **Devedor:** Não acessa o sistema, mas recebe o link/mensagem de cobrança com os valores atualizados de forma transparente.

## 3. Regras de Negócio (Business Rules)

Esta é a parte mais crítica do sistema. O código deve respeitar estritamente estas diretrizes matemáticas e operacionais:
| Regra | Descrição Técnica |
|---|---|
| **Taxa de Juros** | 30% ao mês. A capitalização é diária (juros compostos) baseada nos dias corridos desde o início ou última renovação. |
| **Cálculo do Montante** | O sistema deve calcular a dívida no momento da consulta usando a fórmula: M = P \times (1 + 0.30)^{\frac{d}{30}} (Onde M = Montante, P = Principal/Saldo Devedor, d = dias corridos). |
| **Multa de Atraso** | Acionada automaticamente no D+31 (1 dia após o vencimento de 30 dias). Taxa fixa de R$ 10,00 por dia de atraso. |
| **Ordem de Amortização** | Quando um pagamento parcial é recebido, o dinheiro é deduzido na seguinte ordem: **1º** Multas de Atraso \rightarrow **2º** Juros Acumulados \rightarrow **3º** Valor Principal. |
| **Renovação (Rolagem)** | Se o cliente pagar o valor exato dos juros do mês para adiar a dívida, o Valor Principal é mantido. O sistema registra o pagamento, zera a contagem de atrasos (multas) e redefine a Data Inicial/Renovação para o dia atual. |
| **Encerramento** | Um empréstimo só muda para o status FINALIZADO quando o Saldo Devedor do Valor Principal chegar a zero ou menos. |

## 4. Requisitos Funcionais (RF)

As funcionalidades que o sistema deve executar:

- **RF01 - Gestão de Clientes:** Criar, editar, listar e inativar perfis de devedores (Nome, Telefone com DDD).
- **RF03 - Registro de Pagamento:** Interface para inserir pagamentos. O sistema deve mostrar o cálculo exato de como o valor inserido será distribuído (Multa, Juros, Principal).
- **RF04 - Ação de Renovação Automática:** Botão de "Renovar Mês" que calcula automaticamente os juros atuais, registra esse valor como pago e atualiza a data de vencimento.
- **RF05 - Dashboard Financeiro:** \* _Saída:_ Total de Valor Principal emprestado (empréstimos ativos).
  - _Entrada:_ Total recebido no mês vigente.
  - _Rendimento:_ Parte das entradas que corresponde exclusivamente a juros e multas.
- **RF06 - Alertas de Atraso:** Indicador visual (ex: vermelho) em empréstimos que ultrapassaram 30 dias da data base.
- **RF07 - Integração WhatsApp:** Geração de link dinâmico embutindo o número do cliente e o Saldo Devedor atualizado em uma mensagem de texto pré-formatada.

## 5. Requisitos Não Funcionais (RNF)

Restrições e tecnologias para garantir a escalabilidade e a experiência:

- **RNF01 - Interface Responsiva:** Deve ser pensado no conceito _Mobile First_ utilizando Tailwind CSS, já que o uso principal provavelmente ocorrerá pelo celular durante a rotina.
- **RNF02 - Stack Tecnológica Sugerida:** Frontend em React/TypeScript para lidar de forma segura com tipagens financeiras, consumindo uma API Node.js.
- **RNF03 - Persistência e Integridade:** Recomenda-se um banco de dados relacional (ex: PostgreSQL) para garantir que um pagamento (transação) não seja registrado sem o vínculo correto com o empréstimo, evitando dados órfãos.
- **RNF04 - Tipagem de Moeda:** Todos os valores financeiros no banco de dados devem ser salvos em **centavos** (Inteiros) para evitar erros de ponto flutuante do JavaScript (ex: R$ 100,50 é salvo como 10050). A conversão para decimal só ocorre na exibição (Frontend).

## 6. Estrutura de Dados (Data Dictionary)

Modelo relacional base para a criação das tabelas no banco de dados:

### Tabela Debtors (Devedores)

| Campo     | Tipo     | Descrição                                 |
| --------- | -------- | ----------------------------------------- |
| id        | UUID     | Identificador único                       |
| name      | String   | Nome do cliente                           |
| phone     | String   | Telefone (Apenas números) para o WhatsApp |
| createdAt | DateTime | Data de cadastro                          |

### Tabela Loans (Empréstimos)

| Campo            | Tipo     | Descrição                                    |
| ---------------- | -------- | -------------------------------------------- |
| id               | UUID     | Identificador único                          |
| debtorId         | UUID     | Chave estrangeira (FK) referenciando Debtors |
| principalAmount  | Integer  | Valor original da dívida (em centavos)       |
| currentPrincipal | Integer  | Saldo devedor atual (em centavos)            |
| startDate        | DateTime | Data em que o dinheiro foi entregue          |
| lastRenewalDate  | DateTime | Data da última rolagem/pagamento de juros    |
| status           | Enum     | ACTIVE ou CLOSED                             |

### Tabela Payments (Histórico de Pagamentos)

| Campo             | Tipo     | Descrição                                               |
| ----------------- | -------- | ------------------------------------------------------- |
| id                | UUID     | Identificador único                                     |
| loanId            | UUID     | Chave estrangeira (FK) referenciando Loans              |
| totalAmountPaid   | Integer  | Valor total entregue pelo cliente (em centavos)         |
| amountToPenalty   | Integer  | Parcela do valor destinada à multa (em centavos)        |
| amountToInterest  | Integer  | Parcela do valor destinada aos juros (em centavos)      |
| amountToPrincipal | Integer  | Parcela do valor que abateu a dívida real (em centavos) |
| paymentDate       | DateTime | Dia em que o pagamento foi realizado                    |
| isRollover        | Boolean  | true se este pagamento foi uma renovação do ciclo       |

## 7. Fluxo de Operação Recomendado (UX)

Para montar as telas (ex: no Lovable ou no código final), siga este fluxo lógico:

1.  **Tela Inicial (Dashboard):** 3 Cards no topo (Entrada, Saída, Rendimento). Abaixo, uma lista dos **Empréstimos Ativos** ordenados pela data de vencimento (os atrasados aparecem primeiro, em vermelho).
2.  **Painel do Empréstimo (Detalhes):** Ao clicar em um empréstimo na lista, abre-se uma tela mostrando:

- O valor que a pessoa pegou inicialmente.
- O valor atualizado hoje (Calculado em tempo real: Principal + Juros + Multa).
- Botão: **"Registrar Pagamento Parcial/Total"**.
- Botão: **"Renovar Empréstimo (Pagar só Juros)"**.
- Botão: **"Cobrar no WhatsApp"**.
- Uma lista (tabela simples) com o histórico de todos os pagamentos que aquela pessoa já fez.
