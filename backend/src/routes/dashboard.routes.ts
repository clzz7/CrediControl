/**
 * dashboard.routes.ts — RF05: Dashboard Financeiro
 *
 * GET /dashboard retorna:
 *   - saida: Total de Principal ativo (dinheiro na rua)
 *   - entradaTotal: Total global recebido
 *   - rendimentoTotal: Parte das entradas globais que é juros + multa (lucro)
 *   - totalEmprestimosAtivos: Contagem de empréstimos ativos
 *   - totalAtrasados: Empréstimos em atraso (D+31+)
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const now = new Date();

    // ── Empréstimos ativos ────────────────────────────────────────────────
    const emprestimosAtivos = await prisma.loan.findMany({
      where: { status: 'ACTIVE' },
      select: { currentPrincipal: true, lastRenewalDate: true },
    });

    // Saída = soma de todos os saldos de principal ativos
    const saida = emprestimosAtivos.reduce((acc: number, l: any) => acc + l.currentPrincipal, 0);

    // Atrasados = D+31 ou mais
    const msPerDay = 1000 * 60 * 60 * 24;
    const totalAtrasados = emprestimosAtivos.filter((l: any) => {
      const dias = Math.floor((now.getTime() - l.lastRenewalDate.getTime()) / msPerDay);
      return dias > 30;
    }).length;

    // ── Pagamentos totais ─────────────────────────────────────────────────
    const pagamentos = await prisma.payment.findMany({
      select: {
        totalAmountPaid: true,
        amountToPenalty: true,
        amountToInterest: true,
      },
    });

    const entradaTotal = pagamentos.reduce((acc: number, p: any) => acc + p.totalAmountPaid, 0);
    const rendimentoTotal = pagamentos.reduce(
      (acc: number, p: any) => acc + p.amountToPenalty + p.amountToInterest,
      0,
    );

    res.json({
      saida,
      entradaTotal,
      rendimentoTotal,
      totalEmprestimosAtivos: emprestimosAtivos.length,
      totalAtrasados,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao calcular dashboard' });
  }
});
