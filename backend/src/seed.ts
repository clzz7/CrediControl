/**
 * seed.ts — Popula o banco com dados fictícios para desenvolvimento.
 * Execute com: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpar dados anteriores
  await prisma.payment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.debtor.deleteMany();

  // ── Devedores ────────────────────────────────────────────────────────────
  const maria = await prisma.debtor.create({
    data: { name: 'Maria Silva', phone: '11987654321' },
  });

  const joao = await prisma.debtor.create({
    data: { name: 'João Pereira', phone: '21912345678' },
  });

  const ana = await prisma.debtor.create({
    data: { name: 'Ana Souza', phone: '31998765432' },
  });

  // ── Empréstimos ──────────────────────────────────────────────────────────

  // Maria: empréstimo de R$ 500,00 há 30 dias (vencendo hoje, sem multa ainda)
  const loanMaria = await prisma.loan.create({
    data: {
      debtorId: maria.id,
      principalAmount: 50_000,       // R$ 500,00
      currentPrincipal: 50_000,
      startDate: daysAgo(30),
      lastRenewalDate: daysAgo(30),
      status: 'ACTIVE',
    },
  });

  // João: empréstimo de R$ 1.000,00 há 45 dias (ATRASADO — 15 dias de multa = R$ 150,00)
  const loanJoao = await prisma.loan.create({
    data: {
      debtorId: joao.id,
      principalAmount: 100_000,      // R$ 1.000,00
      currentPrincipal: 100_000,
      startDate: daysAgo(45),
      lastRenewalDate: daysAgo(45),
      status: 'ACTIVE',
    },
  });

  // Ana: empréstimo de R$ 300,00 há 10 dias (dentro do prazo, sem atraso)
  const loanAna = await prisma.loan.create({
    data: {
      debtorId: ana.id,
      principalAmount: 30_000,       // R$ 300,00
      currentPrincipal: 30_000,
      startDate: daysAgo(10),
      lastRenewalDate: daysAgo(10),
      status: 'ACTIVE',
    },
  });

  // ── Histórico de Pagamentos (João fez um pagamento parcial) ───────────────
  await prisma.payment.create({
    data: {
      loanId: loanJoao.id,
      totalAmountPaid: 5_000,        // R$ 50,00
      amountToPenalty: 5_000,        // Abateu só parte da multa
      amountToInterest: 0,
      amountToPrincipal: 0,
      paymentDate: daysAgo(3),
      isRollover: false,
      notes: 'Pagamento parcial — abateu parte da multa',
    },
  });

  console.log(`✅ Seed concluído!`);
  console.log(`   📋 Devedores: Maria, João, Ana`);
  console.log(`   💰 Empréstimos:`);
  console.log(`      - ${loanMaria.id.slice(0, 8)}... (Maria) R$ 500,00 — D+30`);
  console.log(`      - ${loanJoao.id.slice(0, 8)}... (João)  R$ 1.000,00 — D+45 ATRASADO`);
  console.log(`      - ${loanAna.id.slice(0, 8)}... (Ana)   R$ 300,00 — D+10`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
