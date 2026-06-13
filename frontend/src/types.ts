// Tipos compartilhados com o backend

export interface Debtor {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  createdAt: string;
  loans?: Loan[];
}

export interface LoanSnapshot {
  elapsedDays: number;
  lateDays: number;
  totalPenaltyCents: number;
  accruedInterestCents: number;
  totalDueCents: number;
  currentPrincipal: number;
}

export interface Loan {
  id: string;
  debtorId: string;
  debtor?: Debtor;
  principalAmount: number;
  currentPrincipal: number;
  startDate: string;
  lastRenewalDate: string;
  status: 'ACTIVE' | 'CLOSED' | 'DELETED';
  createdAt: string;
  payments?: Payment[];
  snapshot?: LoanSnapshot;
}

export interface Payment {
  id: string;
  loanId: string;
  totalAmountPaid: number;
  discountAmount: number;
  amountToPenalty: number;
  amountToInterest: number;
  amountToPrincipal: number;
  paymentDate: string;
  isRollover: boolean;
  notes?: string;
}

export interface Dashboard {
  saida: number;
  entradaTotal: number;
  rendimentoTotal: number;
  totalEmprestimosAtivos: number;
  totalAtrasados: number;
}
