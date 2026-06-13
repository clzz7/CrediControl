import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Phone, Edit2, X, Check, UserX, UserCheck } from 'lucide-react'
import { getDebtors, createDebtor, updateDebtor, createLoan } from '../api'
import { formatCurrency, parseCurrency, formatCurrencyInput, formatDate } from '../utils'
import type { Debtor } from '../types'

export default function DebtorsPage() {
  const qc = useQueryClient()
  const [showNewDebtor, setShowNewDebtor] = useState(false)
  const [showNewLoan, setShowNewLoan] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const { data: debtors, isLoading } = useQuery({
    queryKey: ['debtors'],
    queryFn: getDebtors,
  })

  const createMut = useMutation({
    mutationFn: createDebtor,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debtors'] }); setShowNewDebtor(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Debtor> }) => updateDebtor(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debtors'] }); setEditId(null) },
  })

  const loanMut = useMutation({
    mutationFn: createLoan,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans', 'debtors', 'dashboard'] }); setShowNewLoan(null) },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Devedores</h1>
          <p className="text-sm text-gray-500">{debtors?.length ?? 0} cadastrado{debtors?.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowNewDebtor(true)}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-900 text-sm font-semibold px-3 py-2 rounded-xl transition-all active:scale-95"
        >
          <Plus size={15} /> Cadastrar
        </button>
      </div>

      {/* Modal: Novo Devedor */}
      {showNewDebtor && (
        <NewDebtorForm
          onSubmit={(name, phone) => createMut.mutate({ name, phone })}
          onCancel={() => setShowNewDebtor(false)}
          loading={createMut.isPending}
        />
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}
        </div>
      ) : debtors?.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-2">👤</p>
          <p className="text-sm">Nenhum devedor cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {debtors?.map(debtor => (
            <div key={debtor.id}>
              {editId === debtor.id ? (
                <EditDebtorForm
                  debtor={debtor}
                  onSubmit={(data) => updateMut.mutate({ id: debtor.id, data })}
                  onCancel={() => setEditId(null)}
                  loading={updateMut.isPending}
                />
              ) : (
                <DebtorCard
                  debtor={debtor}
                  onEdit={() => setEditId(debtor.id)}
                  onToggleActive={() => updateMut.mutate({ id: debtor.id, data: { active: !debtor.active } })}
                  onNewLoan={() => setShowNewLoan(debtor.id)}
                />
              )}
              {showNewLoan === debtor.id && (
                <NewLoanForm
                  debtorName={debtor.name}
                  onSubmit={(amount) => loanMut.mutate({ debtorId: debtor.id, principalAmount: amount })}
                  onCancel={() => setShowNewLoan(null)}
                  loading={loanMut.isPending}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function DebtorCard({ debtor, onEdit, onToggleActive, onNewLoan }: {
  debtor: Debtor
  onEdit: () => void
  onToggleActive: () => void
  onNewLoan: () => void
}) {
  const activeLoans = debtor.loans?.filter(l => l.status === 'ACTIVE') ?? []
  const totalPrincipal = activeLoans.reduce((s, l) => s + l.currentPrincipal, 0)

  return (
    <div className={`bg-white border rounded-2xl p-4 transition-all ${debtor.active ? 'border-gray-200' : 'border-gray-200 opacity-50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-gray-900 truncate">{debtor.name}</p>
            {!debtor.active && (
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">INATIVO</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Phone size={11} />
            <span>{debtor.phone}</span>
          </div>
          {activeLoans.length > 0 && (
            <p className="text-xs text-emerald-700 mt-1">
              {activeLoans.length} empréstimo{activeLoans.length > 1 ? 's' : ''} · {formatCurrency(totalPrincipal)}
            </p>
          )}
          <p className="text-[10px] text-gray-500 mt-1">Desde {formatDate(debtor.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1">
          {debtor.active && (
            <button
              onClick={onNewLoan}
              title="Novo empréstimo"
              className="p-2 rounded-xl text-emerald-700 hover:bg-emerald-950/40 transition-all"
            >
              <Plus size={15} />
            </button>
          )}
          <button
            onClick={onEdit}
            title="Editar"
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={onToggleActive}
            title={debtor.active ? 'Inativar' : 'Reativar'}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
          >
            {debtor.active ? <UserX size={14} /> : <UserCheck size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function NewDebtorForm({ onSubmit, onCancel, loading }: {
  onSubmit: (name: string, phone: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  return (
    <div className="bg-white border border-emerald-800/50 rounded-2xl p-4 space-y-3 animate-fade-in">
      <p className="text-sm font-semibold text-gray-900">Novo Devedor</p>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nome completo"
        className="w-full bg-gray-50 border border-[#2e2e48] rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-[#6b6b99] outline-none focus:border-emerald-500 transition-colors"
      />
      <input
        value={phone}
        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
        placeholder="Telefone (somente números)"
        maxLength={11}
        className="w-full bg-gray-50 border border-[#2e2e48] rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-[#6b6b99] outline-none focus:border-emerald-500 transition-colors"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(name, phone)}
          disabled={loading || !name || phone.length < 10}
          className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-gray-900 text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-95"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onCancel} className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-all">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

function EditDebtorForm({ debtor, onSubmit, onCancel, loading }: {
  debtor: Debtor
  onSubmit: (data: Partial<Debtor>) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState(debtor.name)
  const [phone, setPhone] = useState(debtor.phone)

  return (
    <div className="bg-white border border-gray-300 rounded-2xl p-4 space-y-3 animate-fade-in">
      <p className="text-sm font-semibold text-gray-900">Editar Devedor</p>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full bg-gray-50 border border-[#2e2e48] rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-500 transition-colors"
      />
      <input
        value={phone}
        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
        maxLength={11}
        className="w-full bg-gray-50 border border-[#2e2e48] rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-500 transition-colors"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit({ name, phone })}
          disabled={loading}
          className="flex-1 bg-gray-200 hover:bg-[#6b6b99] disabled:opacity-40 text-gray-900 text-sm font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <Check size={15} /> {loading ? 'Salvando...' : 'Atualizar'}
        </button>
        <button onClick={onCancel} className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-all">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

function NewLoanForm({ debtorName, onSubmit, onCancel, loading }: {
  debtorName: string
  onSubmit: (amountCents: number) => void
  onCancel: () => void
  loading: boolean
}) {
  const [value, setValue] = useState('')
  const cents = parseCurrency(value)

  return (
    <div className="bg-white border border-emerald-800/50 rounded-2xl p-4 space-y-3 mt-2 animate-fade-in ml-4">
      <p className="text-sm font-semibold text-gray-900">Novo empréstimo para <span className="text-emerald-700">{debtorName}</span></p>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">R$</span>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(formatCurrencyInput(e.target.value))}
          placeholder="0,00"
          className="w-full bg-gray-50 border border-[#2e2e48] rounded-xl pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder-[#6b6b99] outline-none focus:border-emerald-500 transition-colors"
        />
      </div>
      {cents > 0 && (
        <p className="text-xs text-emerald-700">
          Taxa de 30%/mês · Vencimento em 30 dias · Multa de R$ 10/dia após vencimento
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(cents)}
          disabled={loading || cents <= 0}
          className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-gray-900 text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-95"
        >
          {loading ? 'Registrando...' : `Emprestar ${cents > 0 ? formatCurrency(cents) : ''}`}
        </button>
        <button onClick={onCancel} className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-all">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
