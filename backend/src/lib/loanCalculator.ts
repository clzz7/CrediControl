/**
 * loanCalculator.ts
 *
 * Motor de cálculo financeiro — núcleo do sistema CrediControl.
 * Todas as funções são PURAS: sem I/O, sem efeitos colaterais.
 * Todos os valores monetários são representados em CENTAVOS (inteiros).
 *
 * Regras de negócio implementadas (conforme PRD seção 3):
 *   - Taxa: 30% ao mês, capitalização diária composta
 *   - Fórmula: M = P × (1.30)^(d/30)
 *   - Multa: R$ 10,00/dia (= 1000 centavos) a partir do D+31
 *   - Amortização: Multa → Juros → Principal
 *   - lastRenewalDate só é atualizada em operações de ROLLOVER
 */

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

/** Taxa mensal: 30% */
export const MONTHLY_RATE = 0.30;

/** Multa diária de atraso em centavos (R$ 10,00 = 1000 centavos) */
export const DAILY_PENALTY_CENTS = 1000;

/** Prazo padrão em dias antes que a multa seja acionada */
export const GRACE_PERIOD_DAYS = 30;

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface LoanSnapshot {
  /** Saldo devedor atual do principal (centavos) */
  currentPrincipal: number;
  /** Data âncora para o cálculo (lastRenewalDate ou startDate) */
  lastRenewalDate: Date;
}

export interface LoanCalculation {
  /** Dias corridos desde lastRenewalDate até referenceDate */
  elapsedDays: number;
  /** Dias de atraso (max(0, elapsedDays - 30)) */
  lateDays: number;
  /** Multa total acumulada (centavos) */
  totalPenaltyCents: number;
  /** Juros acumulados = Montante - Principal (centavos) */
  accruedInterestCents: number;
  /** Montante total da dívida: Principal + Juros + Multa (centavos) */
  totalDueCents: number;
  /** Saldo do principal (centavos) — sem alteração, para clareza */
  currentPrincipal: number;
}

export interface AmortizationResult {
  /** Valor efetivamente aplicado à multa (centavos) */
  appliedToPenalty: number;
  /** Valor efetivamente aplicado aos juros (centavos) */
  appliedToInterest: number;
  /** Valor efetivamente aplicado ao principal (centavos) */
  appliedToPrincipal: number;
  /** Novo saldo do principal após o pagamento (centavos) */
  newPrincipal: number;
  /** Troco/excedente não utilizado (centavos) — só ocorre se pagamento > dívida total */
  change: number;
  /** true se o empréstimo foi encerrado (newPrincipal <= 0) */
  isClosed: boolean;
}

// ─────────────────────────────────────────────
// Funções utilitárias
// ─────────────────────────────────────────────

/**
 * Calcula o número de dias corridos entre duas datas,
 * ignorando a componente de hora (trabalhando com dias cheios).
 */
export function calcElapsedDays(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const fromMidnight = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toMidnight = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((toMidnight - fromMidnight) / msPerDay);
}

/**
 * Calcula os juros compostos acumulados (em centavos, arredondado para baixo).
 * Fórmula: M = P × (1.30)^(d/30)
 * Juros = M - P
 *
 * @param principalCents - Saldo devedor do principal em centavos
 * @param days - Dias corridos desde a data âncora
 */
export function calcAccruedInterest(principalCents: number, days: number): number {
  if (days <= 0) return 0;
  const montante = principalCents * Math.pow(1 + MONTHLY_RATE, days / 30);
  return Math.floor(montante - principalCents);
}

/**
 * Calcula a multa total de atraso acumulada (em centavos).
 * Acionada a partir do D+31 (1 dia após vencimento de 30 dias).
 *
 * @param days - Dias corridos desde a data âncora
 */
export function calcPenalty(days: number): number {
  const lateDays = Math.max(0, days - GRACE_PERIOD_DAYS);
  return lateDays * DAILY_PENALTY_CENTS;
}

// ─────────────────────────────────────────────
// Função principal de snapshot
// ─────────────────────────────────────────────

/**
 * Calcula o estado completo de um empréstimo em uma data de referência.
 * Esta é a função chamada na exibição em tempo real.
 *
 * @param loan - Dados do empréstimo (principal + data âncora)
 * @param referenceDate - Data de referência (normalmente "hoje")
 */
export function calcLoanSnapshot(
  loan: LoanSnapshot,
  referenceDate: Date = new Date(),
): LoanCalculation {
  const elapsedDays = calcElapsedDays(loan.lastRenewalDate, referenceDate);
  const lateDays = Math.max(0, elapsedDays - GRACE_PERIOD_DAYS);
  const totalPenaltyCents = calcPenalty(elapsedDays);
  const accruedInterestCents = calcAccruedInterest(loan.currentPrincipal, elapsedDays);
  const totalDueCents = loan.currentPrincipal + accruedInterestCents + totalPenaltyCents;

  return {
    elapsedDays,
    lateDays,
    totalPenaltyCents,
    accruedInterestCents,
    totalDueCents,
    currentPrincipal: loan.currentPrincipal,
  };
}

// ─────────────────────────────────────────────
// Motor de Amortização
// ─────────────────────────────────────────────

/**
 * Processa um pagamento e distribui o valor recebido na ordem:
 *   1º Multa → 2º Juros → 3º Principal
 *
 * IMPORTANTE: Esta função NÃO atualiza lastRenewalDate.
 * Quem orquestra a persistência (service layer) decide isso
 * somente em casos de ROLLOVER.
 *
 * @param paymentCents - Valor bruto recebido (centavos)
 * @param snapshot - Estado atual do empréstimo
 */
export function applyAmortization(
  paymentCents: number,
  snapshot: LoanCalculation,
): AmortizationResult {
  let remaining = paymentCents;

  // 1º — Abater multa
  const appliedToPenalty = Math.min(remaining, snapshot.totalPenaltyCents);
  remaining -= appliedToPenalty;

  // 2º — Abater juros
  const appliedToInterest = Math.min(remaining, snapshot.accruedInterestCents);
  remaining -= appliedToInterest;

  // 3º — Abater principal
  const appliedToPrincipal = Math.min(remaining, snapshot.currentPrincipal);
  remaining -= appliedToPrincipal;

  const newPrincipal = snapshot.currentPrincipal - appliedToPrincipal;
  const isClosed = newPrincipal <= 0;
  const change = remaining; // troco se pagou mais que a dívida total

  return {
    appliedToPenalty,
    appliedToInterest,
    appliedToPrincipal,
    newPrincipal: Math.max(0, newPrincipal),
    change,
    isClosed,
  };
}

// ─────────────────────────────────────────────
// Lógica de Rollover (Renovação)
// ─────────────────────────────────────────────

export interface RolloverValidation {
  isValid: boolean;
  /** Valor exato que deve ser pago para renovar (juros + multas pendentes) */
  requiredPaymentCents: number;
  /** Mensagem de erro se inválido */
  errorMessage?: string;
}

/**
 * Valida e calcula o que deve ser pago para uma operação de Rollover.
 *
 * Um rollover é válido quando o cliente paga EXATAMENTE o valor de juros
 * (+ multas pendentes se houver atraso). O principal é mantido e a
 * lastRenewalDate é resetada para hoje.
 *
 * @param snapshot - Estado atual do empréstimo
 * @param paymentCents - Valor que o cliente deseja pagar
 */
export function validateRollover(
  snapshot: LoanCalculation,
  paymentCents: number,
): RolloverValidation {
  // O valor mínimo para renovar = juros + multas (o que não é principal)
  const requiredPaymentCents = snapshot.accruedInterestCents + snapshot.totalPenaltyCents;

  if (requiredPaymentCents === 0) {
    // Nenhum juro/multa acumulado ainda (empréstimo do mesmo dia)
    return {
      isValid: false,
      requiredPaymentCents: 0,
      errorMessage: 'Nenhum juro acumulado para renovar. O empréstimo foi criado hoje.',
    };
  }

  if (paymentCents < requiredPaymentCents) {
    return {
      isValid: false,
      requiredPaymentCents,
      errorMessage: `Valor insuficiente para renovação. Mínimo necessário: ${requiredPaymentCents} centavos.`,
    };
  }

  return {
    isValid: true,
    requiredPaymentCents,
  };
}
