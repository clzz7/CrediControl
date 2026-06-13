import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, MessageCircle, CreditCard,
  AlertTriangle, ChevronDown, ChevronUp, X, Check, Calculator, Info, RefreshCw, Trash2
} from 'lucide-react'
import { getLoan, registerPayment, deleteLoan } from '../api'
import { formatCurrency, parseCurrency, formatCurrencyInput, formatDate, buildWhatsAppLink } from '../utils'
import type { Payment } from '../types'

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showPayment, setShowPayment] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showMath, setShowMath] = useState(false)

  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', id],
    queryFn: () => getLoan(id!),
    refetchInterval: 30_000,
    enabled: !!id,
  })

  const payMut = useMutation({
    mutationFn: (data: { totalAmountPaid: number; discountAmount?: number; notes?: string }) =>
      registerPayment(id!, data),
    onSuccess: (data) => {
      qc.setQueryData(['loan', id], data.loan)
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setShowPayment(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(-1)
    }
  })

  const handleDelete = () => {
    if (window.confirm("Tem certeza que deseja excluir este registro? Esta ação removerá a dívida do painel.")) {
      deleteMut.mutate(id!)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-32 bg-white rounded-xl" />
        <div className="h-40 bg-white rounded-2xl" />
        <div className="h-32 bg-white rounded-2xl" />
      </div>
    )
  }

  if (!loan) return <p className="text-gray-500 text-center py-16">Empréstimo não encontrado.</p>

  const snap = loan.snapshot!
  const isLate = snap.lateDays > 0
  const isClosed = loan.status === 'CLOSED'
  const dueDate = new Date(loan.lastRenewalDate)
  dueDate.setDate(dueDate.getDate() + 30)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Voltar ────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={15} /> Voltar
      </button>

      {/* ── Header do Empréstimo ──────────────────────────────────── */}
      <div className={`bg-white border rounded-2xl p-5 space-y-4 ${isLate ? 'border-red-300' : 'border-gray-200'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Devedor</p>
            <p className="text-lg font-bold text-gray-900">{loan.debtor?.name}</p>
            <p className="text-xs text-gray-500">{loan.debtor?.phone}</p>
          </div>
          <div className="text-right flex items-center gap-2 justify-end">
            {isClosed ? (
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">QUITADO</span>
            ) : isLate ? (
              <span className="bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle size={11} /> {snap.lateDays}d ATRASO
              </span>
            ) : (
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">ATIVO</span>
            )}
            <button 
              onClick={handleDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Excluir empréstimo"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* ── Grid financeiro ────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Pegou</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(loan.principalAmount)}</p>
            <p className="text-[10px] text-gray-500">{formatDate(loan.startDate)}</p>
          </div>
          <div className="bg-white rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Deve Hoje</p>
            <p className={`text-sm font-bold ${isLate ? 'text-red-600' : 'text-emerald-700'}`}>
              {formatCurrency(snap.totalDueCents)}
            </p>
            <p className="text-[10px] text-gray-500">D+{snap.elapsedDays} · vence {formatDate(dueDate.toISOString())}</p>
          </div>
          <div className="bg-white rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Principal Atual</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(snap.currentPrincipal)}</p>
          </div>
          <div className="bg-white rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Juros Acumulados</p>
            <p className="text-sm font-bold text-amber-600">{formatCurrency(snap.accruedInterestCents)}</p>
            {snap.totalPenaltyCents > 0 && (
              <p className="text-[10px] text-red-600">+{formatCurrency(snap.totalPenaltyCents)} multa</p>
            )}
          </div>
        </div>

        {/* ── Detalhes do Cálculo (Expandível) ───────────────── */}
        {!isClosed && (
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowMath(!showMath)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition-colors"
            >
              <span className="flex items-center gap-1.5"><Calculator size={13} /> Como é calculado?</span>
              {showMath ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showMath && (
              <div className="p-3 bg-white text-[11px] text-gray-600 space-y-2 border-t border-gray-100">
                <p className="font-semibold text-gray-800">Fórmula de Juros Compostos (30% ao mês)</p>
                <div className="bg-gray-50 p-2 rounded text-center font-mono">
                  M = P × (1,30) ^ (d / 30)
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>P (Principal):</strong> {formatCurrency(snap.currentPrincipal)}</li>
                  <li><strong>d (Dias decorridos):</strong> {snap.elapsedDays} dias (desde {formatDate(loan.lastRenewalDate)})</li>
                  <li><strong>M (Montante final):</strong> {formatCurrency(snap.currentPrincipal + snap.accruedInterestCents)}</li>
                </ul>
                <p>Juros Acumulados = M - P = <strong>{formatCurrency(snap.accruedInterestCents)}</strong></p>
                
                {snap.lateDays > 0 ? (
                  <>
                    <hr className="my-1 border-gray-200" />
                    <p className="font-semibold text-gray-800 text-red-600">Fórmula da Multa</p>
                    <p>Dias em atraso: <strong>{snap.lateDays} dias</strong> (ultrapassou D+30).</p>
                    <p>Multa: {snap.lateDays} × R$ 10,00 = <strong>{formatCurrency(snap.totalPenaltyCents)}</strong></p>
                  </>
                ) : (
                  <p className="text-emerald-600 mt-1 flex items-center gap-1"><Info size={11} /> No prazo. Multa começa no D+31.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Breakdown visual ───────────────────────────────── */}
        {!isClosed && snap.totalDueCents > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Composição da Dívida</p>
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
              <div
                className="bg-gray-200 transition-all"
                style={{ width: `${(snap.currentPrincipal / snap.totalDueCents) * 100}%` }}
              />
              <div
                className="bg-amber-500 transition-all"
                style={{ width: `${(snap.accruedInterestCents / snap.totalDueCents) * 100}%` }}
              />
              {snap.totalPenaltyCents > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(snap.totalPenaltyCents / snap.totalDueCents) * 100}%` }}
                />
              )}
            </div>
            <div className="flex gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-200 rounded-full inline-block"/>Principal</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full inline-block"/>Juros</span>
              {snap.totalPenaltyCents > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full inline-block"/>Multa</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── Botões de ação ────────────────────────────────────────── */}
      {!isClosed && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowPayment(!showPayment)}
            className="flex flex-col items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold py-3 rounded-2xl transition-all active:scale-95"
          >
            <CreditCard size={18} />
            Pagar
          </button>
          <a
            href={buildWhatsAppLink(
              loan.debtor!.phone,
              loan.debtor!.name,
              snap.totalDueCents,
              dueDate.toISOString(),
              snap.lateDays
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900 text-xs font-semibold py-3 rounded-2xl transition-all active:scale-95"
          >
            <MessageCircle size={18} />
            WhatsApp
          </a>
        </div>
      )}

      {/* ── Modal: Pagamento ──────────────────────────────────────── */}
      {showPayment && (
        <PaymentForm
          snapshot={snap}
          onSubmit={(amount, discount, notes) => payMut.mutate({ totalAmountPaid: amount, discountAmount: discount, notes })}
          onCancel={() => setShowPayment(false)}
          loading={payMut.isPending}
          error={payMut.error?.message}
        />
      )}

      {/* ── Histórico de Pagamentos ──────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <span>Histórico ({loan.payments?.length ?? 0} pagamentos)</span>
          {showHistory ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </button>
        {showHistory && (
          <div className="divide-y divide-gray-200">
            {loan.payments?.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">Nenhum pagamento registrado.</p>
            ) : (
              loan.payments?.map(p => <PaymentRow key={p.id} payment={p} />)
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function PaymentForm({ snapshot, onSubmit, onCancel, loading, error }: {
  snapshot: { totalPenaltyCents: number; accruedInterestCents: number; currentPrincipal: number; totalDueCents: number }
  onSubmit: (amount: number, discount: number, notes?: string) => void
  onCancel: () => void
  loading: boolean
  error?: string
}) {
  const [value, setValue] = useState('')
  const [discountValue, setDiscountValue] = useState('')
  const [notes, setNotes] = useState('')
  const cents = parseCurrency(value)
  const discountCents = parseCurrency(discountValue)

  // Simulação de amortização em tempo real
  let remainingPenalty = snapshot.totalPenaltyCents
  let remainingInterest = snapshot.accruedInterestCents
  let remainingPrincipal = snapshot.currentPrincipal
  let rem = cents + discountCents

  const toPenalty = Math.min(rem, remainingPenalty); rem -= toPenalty; remainingPenalty -= toPenalty
  const toInterest = Math.min(rem, remainingInterest); rem -= toInterest; remainingInterest -= toInterest
  const toPrincipal = Math.min(rem, remainingPrincipal); rem -= toPrincipal; remainingPrincipal -= toPrincipal
  const change = rem

  return (
    <div className="bg-white border border-emerald-800/50 rounded-2xl p-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Registrar Pagamento</p>
        <button onClick={onCancel}><X size={16} className="text-gray-500" /></button>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">R$</span>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(formatCurrencyInput(e.target.value))}
          placeholder="Valor Pago"
          className="w-full bg-gray-50 border border-[#2e2e48] rounded-xl pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder-[#6b6b99] outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">R$</span>
        <input
          value={discountValue}
          onChange={e => setDiscountValue(formatCurrencyInput(e.target.value))}
          placeholder="Desconto Concedido (opcional)"
          className="w-full bg-gray-50 border border-[#2e2e48] rounded-xl pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder-[#6b6b99] outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {(cents > 0 || discountCents > 0) && (
        <div className="bg-emerald-50 text-emerald-800 text-xs font-semibold px-3 py-2 rounded-lg border border-emerald-200">
          Total a Pagar com Desconto: {formatCurrency(Math.max(0, snapshot.totalDueCents - discountCents))}
        </div>
      )}

      {/* Preview de amortização */}
      {(cents > 0 || discountCents > 0) && (
        <div className="bg-white rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Como será distribuído</p>
          {toPenalty > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Multa de atraso</span>
              <span className="text-red-600 font-medium">- {formatCurrency(toPenalty)}</span>
            </div>
          )}
          {toInterest > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Juros acumulados</span>
              <span className="text-amber-600 font-medium">- {formatCurrency(toInterest)}</span>
            </div>
          )}
          {toPrincipal > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Principal</span>
              <span className="text-emerald-700 font-medium">- {formatCurrency(toPrincipal)}</span>
            </div>
          )}
          {change > 0 && (
            <div className="flex justify-between text-xs border-t border-gray-200 pt-2">
              <span className="text-gray-600">Troco</span>
              <span className="text-gray-900 font-medium">{formatCurrency(change)}</span>
            </div>
          )}
          {toPrincipal >= snapshot.currentPrincipal && toPrincipal > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold mt-1">
              <Check size={12} /> Empréstimo será QUITADO
            </div>
          )}
        </div>
      )}

      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Observação (opcional)"
        className="w-full bg-gray-50 border border-[#2e2e48] rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-[#6b6b99] outline-none focus:border-emerald-500 transition-colors"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={() => onSubmit(cents, discountCents, notes || undefined)}
        disabled={loading || (cents === 0 && discountCents === 0)}
        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-gray-900 text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-95"
      >
        {loading ? 'Registrando...' : `Confirmar ${cents > 0 ? formatCurrency(cents) : (discountCents > 0 ? '(Apenas Desconto)' : '')}`}
      </button>
    </div>
  )
}


function PaymentRow({ payment }: { payment: Payment }) {
  return (
    <div className="px-4 py-3 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {payment.isRollover && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              <RefreshCw size={9} /> RENOVAÇÃO
            </span>
          )}
          <span className="text-xs text-gray-500">{formatDate(payment.paymentDate)}</span>
        </div>
        <span className="text-sm font-bold text-gray-900 flex flex-col items-end">
          {formatCurrency(payment.totalAmountPaid)}
          {payment.discountAmount > 0 && (
            <span className="text-[10px] text-emerald-600 font-normal block">+ {formatCurrency(payment.discountAmount)} desc.</span>
          )}
        </span>
      </div>
      <div className="flex gap-3 text-[10px] text-gray-500">
        {payment.amountToPenalty > 0 && <span>Multa: {formatCurrency(payment.amountToPenalty)}</span>}
        {payment.amountToInterest > 0 && <span>Juros: {formatCurrency(payment.amountToInterest)}</span>}
        {payment.amountToPrincipal > 0 && <span className="text-emerald-500">Principal: {formatCurrency(payment.amountToPrincipal)}</span>}
      </div>
      {payment.notes && <p className="text-[10px] text-gray-500 italic">{payment.notes}</p>}
    </div>
  )
}
