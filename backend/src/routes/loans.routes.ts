/**
 * loans.routes.ts — RF02, RF03, RF04, RF06
 * Gestão de empréstimos: criar, listar, detalhar, pagar, renovar.
 * O montante é calculado em tempo real no GET.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  calcLoanSnapshot,
  applyAmortization,
  validateRollover,
} from '../lib/loanCalculator.js';

export const loansRouter = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateLoanSchema = z.object({
  debtorId: z.string().uuid('debtorId deve ser um UUID válido'),
  /** Valor do empréstimo em centavos (ex: R$ 500,00 = 50000) */
  principalAmount: z
    .number()
    .int('Valor deve ser inteiro (centavos)')
    .positive('Valor deve ser positivo'),
  startDate: z.coerce.date().optional(),
});

const PaymentSchema = z.object({
  /** Valor bruto recebido em centavos */
  totalAmountPaid: z
    .number()
    .int('Valor deve ser inteiro (centavos)')
    .positive('Valor deve ser positivo'),
  notes: z.string().optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Enriquece um empréstimo com o snapshot financeiro calculado em tempo real */
function enrichLoan(loan: {
  id: string;
  currentPrincipal: number;
  lastRenewalDate: Date;
  [key: string]: unknown;
}) {
  const snapshot = calcLoanSnapshot(
    { currentPrincipal: loan.currentPrincipal, lastRenewalDate: loan.lastRenewalDate },
    new Date(),
  );
  return { ...loan, snapshot };
}

// ── GET /loans ────────────────────────────────────────────────────────────────
// Lista todos os empréstimos ativos, com snapshot financeiro em tempo real.
// Ordenados: atrasados primeiro, depois por data de vencimento mais antiga.

loansRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const loans = await prisma.loan.findMany({
      where: { status: 'ACTIVE' },
      include: {
        debtor: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { lastRenewalDate: 'asc' },
    });

    const enriched = loans.map(enrichLoan);
    // Ordenar: atrasados (lateDays > 0) primeiro
    enriched.sort((a, b) => b.snapshot.lateDays - a.snapshot.lateDays);

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar empréstimos' });
  }
});

// ── GET /loans/:id ────────────────────────────────────────────────────────────
// Detalhe completo: snapshot + histórico de pagamentos

loansRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: req.params['id'] as string },
      include: {
        debtor: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
    if (!loan) return res.status(404).json({ error: 'Empréstimo não encontrado' });

    res.json(enrichLoan(loan));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar empréstimo' });
  }
});

// ── POST /loans ───────────────────────────────────────────────────────────────
// RF02: Registrar novo empréstimo

loansRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { debtorId, principalAmount, startDate } = CreateLoanSchema.parse(req.body);

    // Verificar se devedor existe e está ativo
    const debtor = await prisma.debtor.findUnique({ where: { id: debtorId } });
    if (!debtor) return res.status(404).json({ error: 'Devedor não encontrado' });
    if (!debtor.active) return res.status(400).json({ error: 'Devedor inativo' });

    const anchor = startDate ?? new Date();
    const loan = await prisma.loan.create({
      data: {
        debtorId,
        principalAmount,
        currentPrincipal: principalAmount,
        startDate: anchor,
        lastRenewalDate: anchor,
        status: 'ACTIVE',
      },
      include: { debtor: true },
    });

    res.status(201).json(enrichLoan(loan));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro ao criar empréstimo' });
  }
});

// ── POST /loans/:id/payments ──────────────────────────────────────────────────
// RF03: Registrar pagamento parcial ou total.
// Amortização: Multa → Juros → Principal.
// lastRenewalDate NÃO é alterada em pagamentos parciais comuns.

loansRouter.post('/:id/payments', async (req: Request, res: Response) => {
  try {
    const { totalAmountPaid, notes } = PaymentSchema.parse(req.body);

    const loan = await prisma.loan.findUnique({ where: { id: req.params['id'] as string } });
    if (!loan) return res.status(404).json({ error: 'Empréstimo não encontrado' });
    if (loan.status === 'CLOSED') {
      return res.status(400).json({ error: 'Empréstimo já encerrado' });
    }

    const snapshot = calcLoanSnapshot(
      { currentPrincipal: loan.currentPrincipal, lastRenewalDate: loan.lastRenewalDate },
      new Date(),
    );

    const amortization = applyAmortization(totalAmountPaid, snapshot);

    // Transação atômica: salvar payment + atualizar loan
    const [payment, updatedLoan] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          loanId: loan.id,
          totalAmountPaid,
          amountToPenalty: amortization.appliedToPenalty,
          amountToInterest: amortization.appliedToInterest,
          amountToPrincipal: amortization.appliedToPrincipal,
          isRollover: false,
          notes,
        },
      }),
      prisma.loan.update({
        where: { id: loan.id },
        data: {
          currentPrincipal: amortization.newPrincipal,
          status: amortization.isClosed ? 'CLOSED' : 'ACTIVE',
          // REGRA DE NEGÓCIO DA RENOVAÇÃO AUTOMÁTICA:
          // Se o pagamento cobriu 100% da multa e 100% dos juros pendentes, a dívida é automaticamente "renovada"
          // ou seja, o tempo volta a ser Dia 0 (jogando o vencimento +30 dias pra frente).
          ...(amortization.appliedToPenalty === snapshot.totalPenaltyCents && 
              amortization.appliedToInterest === snapshot.accruedInterestCents && 
              !amortization.isClosed
            ? { 
                lastRenewalDate: (() => { 
                  const d = new Date(); d.setHours(0,0,0,0); return d; 
                })() 
              }
            : {})
        },
        include: {
          debtor: true,
          payments: { orderBy: { paymentDate: 'desc' } },
        },
      }),
    ]);

    res.status(201).json({
      payment,
      amortization,
      loan: enrichLoan(updatedLoan),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro ao registrar pagamento' });
  }
});

// ── POST /loans/:id/rollover ──────────────────────────────────────────────────
// RF04: Renovação — pagar só juros + multas, resetar lastRenewalDate.
// Principal mantido. Data base resetada para hoje.

loansRouter.post('/:id/rollover', async (req: Request, res: Response) => {
  try {
    const { totalAmountPaid, notes } = PaymentSchema.parse(req.body);

    const loan = await prisma.loan.findUnique({ where: { id: req.params['id'] as string } });
    if (!loan) return res.status(404).json({ error: 'Empréstimo não encontrado' });
    if (loan.status === 'CLOSED') {
      return res.status(400).json({ error: 'Empréstimo já encerrado' });
    }

    const snapshot = calcLoanSnapshot(
      { currentPrincipal: loan.currentPrincipal, lastRenewalDate: loan.lastRenewalDate },
      new Date(),
    );

    const validation = validateRollover(snapshot, totalAmountPaid);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errorMessage,
        requiredPaymentCents: validation.requiredPaymentCents,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [payment, updatedLoan] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          loanId: loan.id,
          totalAmountPaid,
          amountToPenalty: snapshot.totalPenaltyCents,
          amountToInterest: snapshot.accruedInterestCents,
          amountToPrincipal: 0, // rollover nunca abate principal no pagamento
          isRollover: true,
          notes: notes ?? 'Renovação de mês',
        },
      }),
      prisma.loan.update({
        where: { id: loan.id },
        data: {
          // REGRA: O Saldo Devedor Total (incluindo juros/multas não pagos) vira o Novo Principal
          currentPrincipal: snapshot.totalDueCents,
          // E o tempo corrido volta a ser Dia 0 (vencimento +30 dias a partir de hoje)
          lastRenewalDate: today,
        },
        include: {
          debtor: true,
          payments: { orderBy: { paymentDate: 'desc' } },
        },
      }),
    ]);

    res.status(201).json({
      payment,
      loan: enrichLoan(updatedLoan),
      message: 'Empréstimo renovado com sucesso. Novo prazo: 30 dias a partir de hoje.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro ao renovar empréstimo' });
  }
});
