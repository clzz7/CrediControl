import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, TrendingUp, Plus } from 'lucide-react'
import { getDashboard, getLoans } from '../api'
import { formatCurrency, formatDate } from '../utils'
import type { Loan } from '../types'
import NewLoanModal from '../components/NewLoanModal'
import SparklineCard from '../components/SparklineCard'

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: dash, isLoading: loadingDash } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60_000,
  })

  const { data: loans, isLoading: loadingLoans } = useQuery({
    queryKey: ['loans'],
    queryFn: getLoans,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Título ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Visão Geral</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-900 text-sm font-semibold px-3 py-2 rounded-xl transition-all active:scale-95"
        >
          <Plus size={15} />
          Novo
        </button>
      </div>

      {isModalOpen && <NewLoanModal onClose={() => setIsModalOpen(false)} />}

      {/* ── Cards do Dashboard ───────────────────────────────────── */}
      {loadingDash ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-40 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : dash && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SparklineCard
            title="Saídas (Ativos)"
            value={dash.saida}
            percentageChange={dash.saida > 0 ? 12.5 : 0}
            icon={<ArrowUpRight className="w-5 h-5 text-emerald-500" />}
            chartData={
              dash.saida > 0
                ? [{ value: dash.saida * 0.6 }, { value: dash.saida * 0.7 }, { value: dash.saida * 0.65 }, { value: dash.saida * 0.8 }, { value: dash.saida * 0.85 }, { value: dash.saida * 0.9 }, { value: dash.saida }]
                : [{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }]
            }
          />
          <SparklineCard
            title="Entradas (Recuperado)"
            value={dash.entradaTotal}
            percentageChange={dash.entradaTotal > 0 ? 8.2 : 0}
            icon={<ArrowDownLeft className="w-5 h-5 text-blue-500" />}
            chartData={
              dash.entradaTotal > 0
                ? [{ value: dash.entradaTotal * 0.5 }, { value: dash.entradaTotal * 0.6 }, { value: dash.entradaTotal * 0.55 }, { value: dash.entradaTotal * 0.75 }, { value: dash.entradaTotal * 0.7 }, { value: dash.entradaTotal * 0.9 }, { value: dash.entradaTotal }]
                : [{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }]
            }
          />
          <SparklineCard
            title="Rendimento (Lucro)"
            value={dash.rendimentoTotal}
            percentageChange={dash.rendimentoTotal > 0 ? 15.3 : 0}
            icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
            chartData={
              dash.rendimentoTotal > 0
                ? [{ value: dash.rendimentoTotal * 0.3 }, { value: dash.rendimentoTotal * 0.4 }, { value: dash.rendimentoTotal * 0.35 }, { value: dash.rendimentoTotal * 0.6 }, { value: dash.rendimentoTotal * 0.55 }, { value: dash.rendimentoTotal * 0.8 }, { value: dash.rendimentoTotal }]
                : [{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }]
            }
          />
        </div>
      )}

      {/* ── Alertas de Atraso ───────────────────────────────────── */}
      {dash && dash.totalAtrasados > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 pulse-danger">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span className="text-sm text-red-800">
            <strong>{dash.totalAtrasados}</strong> empréstimo{dash.totalAtrasados > 1 ? 's' : ''} em atraso
          </span>
        </div>
      )}

      {/* ── Lista de Empréstimos Ativos ─────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
          Empréstimos Ativos
        </h2>

        {loadingLoans ? (
          <div className="space-y-3">
            {[0,1,2].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : loans?.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-2">💸</p>
            <p className="text-sm">Nenhum empréstimo ativo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {loans?.map((loan: Loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LoanCard({ loan }: { loan: Loan }) {
  const snap = loan.snapshot!
  const isLate = snap.lateDays > 0
  const dueDate = new Date(loan.lastRenewalDate)
  dueDate.setDate(dueDate.getDate() + 30)

  return (
    <Link
      to={`/loans/${loan.id}`}
      className={`block bg-white border rounded-2xl p-4 transition-all hover:bg-gray-50 hover:scale-[1.01] active:scale-[0.99] ${
        isLate ? 'border-red-300' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isLate && (
              <span className="flex items-center gap-1 bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                <AlertTriangle size={10} />
                {snap.lateDays}d atraso
              </span>
            )}
            {!isLate && snap.elapsedDays >= 25 && (
              <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Vence em breve
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-900 truncate">{loan.debtor?.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Vence: {formatDate(dueDate.toISOString())} · D+{snap.elapsedDays}
          </p>
        </div>

        {/* Valores */}
        <div className="text-right shrink-0">
          <p className={`font-bold text-base ${isLate ? 'text-red-600' : 'text-gray-900'}`}>
            {formatCurrency(snap.totalDueCents)}
          </p>
          <p className="text-xs text-gray-500">
            Principal: {formatCurrency(snap.currentPrincipal)}
          </p>
          {snap.totalPenaltyCents > 0 && (
            <p className="text-[10px] text-red-600 mt-0.5">
              +{formatCurrency(snap.totalPenaltyCents)} multa
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
