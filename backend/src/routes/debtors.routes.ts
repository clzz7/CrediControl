/**
 * debtors.routes.ts — RF01: Gestão de Clientes
 * CRUD completo: criar, listar, editar, inativar devedores.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const debtorsRouter = Router();

// ── Schemas de validação ─────────────────────────────────────────────────────

const CreateDebtorSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').trim(),
  phone: z
    .string()
    .regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos (apenas números)'),
});

const UpdateDebtorSchema = z.object({
  name: z.string().min(2).trim().optional(),
  phone: z.string().regex(/^\d{10,11}$/).optional(),
  active: z.boolean().optional(),
});

// ── GET /debtors ─────────────────────────────────────────────────────────────
// Lista todos os devedores (ativos por padrão; ?all=true inclui inativos)

debtorsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.all === 'true';
    const debtors = await prisma.debtor.findMany({
      where: includeInactive ? {} : { active: true },
      include: {
        loans: {
          where: { status: 'ACTIVE' },
          select: { id: true, currentPrincipal: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(debtors);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar devedores' });
  }
});

// ── GET /debtors/:id ─────────────────────────────────────────────────────────

debtorsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const debtor = await prisma.debtor.findUnique({
      where: { id: req.params['id'] as string },
      include: { loans: { include: { payments: { orderBy: { paymentDate: 'desc' } } } } },
    });
    if (!debtor) return res.status(404).json({ error: 'Devedor não encontrado' });
    res.json(debtor);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar devedor' });
  }
});

// ── POST /debtors ─────────────────────────────────────────────────────────────

debtorsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreateDebtorSchema.parse(req.body);
    const debtor = await prisma.debtor.create({ data });
    res.status(201).json(debtor);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro ao criar devedor' });
  }
});

// ── PATCH /debtors/:id ────────────────────────────────────────────────────────

debtorsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const data = UpdateDebtorSchema.parse(req.body);
    const debtor = await prisma.debtor.update({
      where: { id: req.params['id'] as string },
      data,
    });
    res.json(debtor);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro ao atualizar devedor' });
  }
});
