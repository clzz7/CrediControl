/**
 * loanCalculator.test.ts
 *
 * Testes unitários para o motor de cálculo financeiro.
 * Cobertura dos cenários críticos de negócio.
 */

import { describe, it, expect } from 'vitest';
import {
  calcElapsedDays,
  calcAccruedInterest,
  calcPenalty,
  calcLoanSnapshot,
  applyAmortization,
  validateRollover,
  DAILY_PENALTY_CENTS,
} from '../lib/loanCalculator.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Cria uma data relativa a hoje com N dias no passado */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Cria uma data exata para comparações determinísticas */
function makeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// ─── calcElapsedDays ────────────────────────────────────────────────────────

describe('calcElapsedDays', () => {
  it('deve retornar 0 quando as datas são iguais', () => {
    const d = makeDate(2025, 1, 15);
    expect(calcElapsedDays(d, d)).toBe(0);
  });

  it('deve retornar 30 para 30 dias corridos', () => {
    const from = makeDate(2025, 1, 1);
    const to = makeDate(2025, 1, 31);
    expect(calcElapsedDays(from, to)).toBe(30);
  });

  it('deve retornar 31 cruzando meses', () => {
    const from = makeDate(2025, 1, 31);
    const to = makeDate(2025, 3, 3);
    expect(calcElapsedDays(from, to)).toBe(31);
  });
});

// ─── calcAccruedInterest ────────────────────────────────────────────────────

describe('calcAccruedInterest', () => {
  it('deve retornar 0 para 0 dias', () => {
    expect(calcAccruedInterest(100_000, 0)).toBe(0);
  });

  it('deve retornar exatos 30% em 30 dias para R$ 1000,00', () => {
    // Principal: R$ 1000,00 = 100.000 centavos
    // Juros = 100000 × 0.30 × (30/30) = 30.000
    // Juros = 30.000 centavos = R$ 300,00
    const interest = calcAccruedInterest(100_000, 30);
    expect(interest).toBe(30_000);
  });

  it('deve retornar juros integrais de 30% mesmo antes de 30 dias', () => {
    // Juros = 100000 × 0.30 = 30.000 centavos
    const interest = calcAccruedInterest(100_000, 15);
    expect(interest).toBe(30_000);
  });

  it('deve funcionar para principal de 1 centavo', () => {
    const interest = calcAccruedInterest(1, 30);
    expect(interest).toBeGreaterThanOrEqual(0);
  });
});

// ─── calcPenalty ─────────────────────────────────────────────────────────────

describe('calcPenalty', () => {
  it('deve retornar 0 com 0 dias', () => {
    expect(calcPenalty(0)).toBe(0);
  });

  it('deve retornar 0 no dia 30 (prazo de carência)', () => {
    expect(calcPenalty(30)).toBe(0);
  });

  it('deve retornar R$ 10,00 no D+31 (primeiro dia de atraso)', () => {
    expect(calcPenalty(31)).toBe(DAILY_PENALTY_CENTS);
  });

  it('deve acumular R$ 50,00 em 5 dias de atraso (D+35)', () => {
    expect(calcPenalty(35)).toBe(5 * DAILY_PENALTY_CENTS);
  });

  it('deve calcular 10 dias de atraso corretamente', () => {
    expect(calcPenalty(40)).toBe(10 * DAILY_PENALTY_CENTS);
  });
});

// ─── calcLoanSnapshot ────────────────────────────────────────────────────────

describe('calcLoanSnapshot', () => {
  it('deve calcular snapshot correto no dia 0 (empréstimo recém-criado)', () => {
    const loan = { currentPrincipal: 100_000, lastRenewalDate: new Date() };
    const snap = calcLoanSnapshot(loan, 0, 0, new Date());
    expect(snap.elapsedDays).toBe(0);
    expect(snap.accruedInterestCents).toBe(0);
    expect(snap.totalPenaltyCents).toBe(0);
    expect(snap.totalDueCents).toBe(100_000);
  });

  it('deve calcular snapshot no dia 30 (vencimento, sem multa)', () => {
    const anchor = makeDate(2025, 1, 1);
    const today = makeDate(2025, 1, 31);
    const loan = { currentPrincipal: 100_000, lastRenewalDate: anchor };
    const snap = calcLoanSnapshot(loan, 0, 0, today);

    expect(snap.elapsedDays).toBe(30);
    expect(snap.lateDays).toBe(0);
    expect(snap.totalPenaltyCents).toBe(0);
    expect(snap.accruedInterestCents).toBe(30_000); // exato 30%
    expect(snap.totalDueCents).toBe(130_000);
  });

  it('deve ativar multa no D+31', () => {
    const anchor = makeDate(2025, 1, 1);
    const today = makeDate(2025, 2, 1); // 31 dias depois
    const loan = { currentPrincipal: 100_000, lastRenewalDate: anchor };
    const snap = calcLoanSnapshot(loan, 0, 0, today);

    expect(snap.elapsedDays).toBe(31);
    expect(snap.lateDays).toBe(1);
    expect(snap.totalPenaltyCents).toBe(1_000); // R$ 10,00
    // Juros: 100000 × 0.30
    const expectedInterest = Math.floor(100_000 * 0.30);
    expect(snap.accruedInterestCents).toBe(expectedInterest);
    expect(snap.totalDueCents).toBe(100_000 + expectedInterest + 1_000);
  });
});

// ─── applyAmortization ───────────────────────────────────────────────────────

describe('applyAmortization — ordem: Multa → Juros → Principal', () => {
  it('pagamento total em dia 30 (sem multa) deve zerar juros e encerrar se >= montante', () => {
    const anchor = makeDate(2025, 1, 1);
    const today = makeDate(2025, 1, 31);
    const loan = { currentPrincipal: 100_000, lastRenewalDate: anchor };
    const snap = calcLoanSnapshot(loan, 0, 0, today);
    // Paga o montante exato: 130.000 centavos
    const result = applyAmortization(130_000, snap);

    expect(result.appliedToPenalty).toBe(0);
    expect(result.appliedToInterest).toBe(30_000);
    expect(result.appliedToPrincipal).toBe(100_000);
    expect(result.newPrincipal).toBe(0);
    expect(result.isClosed).toBe(true);
    expect(result.change).toBe(0);
  });

  it('pagamento parcial deve abater multa primeiro, depois juros', () => {
    // Simula D+35: 5 dias de atraso = R$ 50,00 de multa
    const anchor = makeDate(2025, 1, 1);
    const today = makeDate(2025, 2, 5);
    const loan = { currentPrincipal: 50_000, lastRenewalDate: anchor };
    const snap = calcLoanSnapshot(loan, 0, 0, today);

    // Paga R$ 100,00 (10.000 centavos)
    const result = applyAmortization(10_000, snap);

    // Primeiro abate a multa (R$ 50,00 = 5.000 centavos)
    expect(result.appliedToPenalty).toBe(5_000);
    // O restante vai para juros (5.000 centavos)
    expect(result.appliedToInterest).toBe(5_000);
    // Não sobra para o principal
    expect(result.appliedToPrincipal).toBe(0);
    expect(result.newPrincipal).toBe(50_000); // principal inalterado
    expect(result.isClosed).toBe(false);
  });

  it('pagamento com troco quando excede a dívida total', () => {
    const anchor = makeDate(2025, 1, 1);
    const today = makeDate(2025, 1, 31);
    const loan = { currentPrincipal: 100_000, lastRenewalDate: anchor };
    const snap = calcLoanSnapshot(loan, 0, 0, today);

    // Paga 200.000 (dívida é 130.000)
    const result = applyAmortization(200_000, snap);

    expect(result.isClosed).toBe(true);
    expect(result.change).toBe(70_000); // troco de R$ 700,00
  });

  it('pagamento zero não deve alterar nada', () => {
    const anchor = makeDate(2025, 1, 1);
    const today = makeDate(2025, 1, 31);
    const loan = { currentPrincipal: 100_000, lastRenewalDate: anchor };
    const snap = calcLoanSnapshot(loan, 0, 0, today);
    const result = applyAmortization(0, snap);

    expect(result.appliedToPenalty).toBe(0);
    expect(result.appliedToInterest).toBe(0);
    expect(result.appliedToPrincipal).toBe(0);
    expect(result.newPrincipal).toBe(100_000);
    expect(result.isClosed).toBe(false);
  });

  it('deve encerrar o empréstimo se o pagamento reduzir o principal a zero exato', () => {
    const loan = { currentPrincipal: 50_000, lastRenewalDate: new Date() };
    const snap = calcLoanSnapshot(loan, 0, 0, new Date());
    // Pagamento igual ao principal (dia 0, sem juros)
    const result = applyAmortization(50_000, snap);
    expect(result.isClosed).toBe(true);
    expect(result.newPrincipal).toBe(0);
  });
});

// ─── validateRollover ────────────────────────────────────────────────────────

describe('validateRollover', () => {
  it('deve aprovar rollover quando o valor cobre juros + multas', () => {
    const anchor = makeDate(2025, 1, 1);
    const today = makeDate(2025, 1, 31);
    const loan = { currentPrincipal: 100_000, lastRenewalDate: anchor };
    const snap = calcLoanSnapshot(loan, 0, 0, today);
    // Juros = 30.000, multa = 0, requerido = 30.000
    const result = validateRollover(snap, 30_000);

    expect(result.isValid).toBe(true);
    expect(result.requiredPaymentCents).toBe(30_000);
  });

  it('deve rejeitar rollover com valor abaixo do mínimo', () => {
    const anchor = makeDate(2025, 1, 1);
    const today = makeDate(2025, 1, 31);
    const loan = { currentPrincipal: 100_000, lastRenewalDate: anchor };
    const snap = calcLoanSnapshot(loan, 0, 0, today);
    const result = validateRollover(snap, 20_000); // insuficiente

    expect(result.isValid).toBe(false);
    expect(result.requiredPaymentCents).toBe(30_000);
  });

  it('deve rejeitar rollover no dia 0 (sem juros acumulados)', () => {
    const loan = { currentPrincipal: 100_000, lastRenewalDate: new Date() };
    const snap = calcLoanSnapshot(loan, 0, 0, new Date());
    const result = validateRollover(snap, 0);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeDefined();
  });

  it('deve exigir juros + multas para rollover com atraso', () => {
    // D+35: juros simples + 5 dias de multa
    const anchor = makeDate(2025, 1, 1);
    const today = makeDate(2025, 2, 5);
    const loan = { currentPrincipal: 100_000, lastRenewalDate: anchor };
    const snap = calcLoanSnapshot(loan, 0, 0, today);

    const required = snap.accruedInterestCents + snap.totalPenaltyCents;
    expect(required).toBeGreaterThan(30_000); // mais que os juros puros

    const result = validateRollover(snap, required);
    expect(result.isValid).toBe(true);
    expect(result.requiredPaymentCents).toBe(required);
  });
});
