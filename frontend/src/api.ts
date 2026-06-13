import axios from 'axios';
import type { Dashboard, Debtor, Loan, Payment } from './types';

// Em dev: proxy Vite redireciona /api → localhost:3001
// Em prod: mesma origem (Express serve o frontend)
const api = axios.create({ baseURL: '/api' });

// ── Dashboard ─────────────────────────────────────────────────────────────
export const getDashboard = () =>
  api.get<Dashboard>('/dashboard').then(r => r.data);

// ── Devedores ─────────────────────────────────────────────────────────────
export const getDebtors = () =>
  api.get<Debtor[]>('/debtors').then(r => r.data);

export const createDebtor = (data: { name: string; phone: string }) =>
  api.post<Debtor>('/debtors', data).then(r => r.data);

export const updateDebtor = (id: string, data: Partial<Debtor>) =>
  api.patch<Debtor>(`/debtors/${id}`, data).then(r => r.data);

// ── Empréstimos ──────────────────────────────────────────────────────────
export const getLoans = () =>
  api.get<Loan[]>('/loans').then(r => r.data);

export const getLoan = (id: string) =>
  api.get<Loan>(`/loans/${id}`).then(r => r.data);

export const createLoan = (data: { debtorId: string; principalAmount: number; startDate?: string }) =>
  api.post<Loan>('/loans', data).then(r => r.data);

export const registerPayment = (loanId: string, data: { totalAmountPaid: number; notes?: string }) =>
  api.post<{ payment: Payment; amortization: object; loan: Loan }>(`/loans/${loanId}/payments`, data).then(r => r.data);

export const rolloverLoan = (loanId: string, data: { totalAmountPaid: number; notes?: string }) =>
  api.post<{ payment: Payment; loan: Loan; message: string }>(`/loans/${loanId}/rollover`, data).then(r => r.data);
