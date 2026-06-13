import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Calendar } from 'lucide-react'
import { getDebtors, createDebtor, createLoan } from '../api'
import { parseCurrency, formatCurrencyInput } from '../utils'
import type { Debtor } from '../types'

export default function NewLoanModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()

  // Queries
  const { data: debtors } = useQuery({
    queryKey: ['debtors'],
    queryFn: getDebtors,
  })

  // Mutations
  const createDebtorMut = useMutation({ mutationFn: createDebtor })
  const createLoanMut = useMutation({ mutationFn: createLoan })

  // Form State
  const [searchName, setSearchName] = useState('')
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null)
  
  // Se o usuário digitou e não selecionou ninguém da lista (e a busca não é exata)
  const isNewDebtor = searchName.trim().length > 0 && !selectedDebtor

  const [phone, setPhone] = useState('')
  const [amountStr, setAmountStr] = useState('')
  
  // Date default is today (YYYY-MM-DD for date input)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])

  const amountCents = parseCurrency(amountStr)

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!debtors || searchName.length < 2 || selectedDebtor) return []
    return debtors.filter(d => 
      d.name.toLowerCase().includes(searchName.toLowerCase())
    )
  }, [debtors, searchName, selectedDebtor])

  const handleSelectDebtor = (debtor: Debtor) => {
    setSelectedDebtor(debtor)
    setSearchName(debtor.name)
    setPhone(debtor.phone) // Pre-fill although we might hide it
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchName(e.target.value)
    if (selectedDebtor && e.target.value !== selectedDebtor.name) {
      setSelectedDebtor(null) // Unselect if they edit
    }
  }

  const handleSubmit = async () => {
    if (amountCents <= 0) return

    let finalDebtorId = selectedDebtor?.id

    try {
      // Create debtor if new
      if (isNewDebtor) {
        if (phone.length < 10) {
          alert('Telefone inválido.')
          return
        }
        const newDebtor = await createDebtorMut.mutateAsync({ name: searchName.trim(), phone })
        finalDebtorId = newDebtor.id
      }

      if (!finalDebtorId) return

      // Create loan
      // Converter a string YYYY-MM-DD para ISO-8601 (start of the day UTC or local is fine, backend uses coerce.date())
      const dateObj = new Date(startDate)
      // Ajuste de fuso: queremos a data local escolhida
      dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset())

      await createLoanMut.mutateAsync({
        debtorId: finalDebtorId,
        principalAmount: amountCents,
        startDate: dateObj.toISOString(),
      })

      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['debtors'] })
      
      onClose()
    } catch (e) {
      alert('Erro ao registrar empréstimo. Verifique os dados.')
      console.error(e)
    }
  }

  const isSaving = createDebtorMut.isPending || createLoanMut.isPending
  const canSave = searchName.trim() && amountCents > 0 && (!isNewDebtor || phone.length >= 10) && startDate

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-fade-in px-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Novo Empréstimo</h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          
          {/* Nome / Autocomplete */}
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cliente</label>
            <input
              autoFocus
              value={searchName}
              onChange={handleSearchChange}
              placeholder="Nome do cliente"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-emerald-500 transition-colors"
            />
            {/* Dropdown Suggestions */}
            {suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-auto z-10">
                {suggestions.map(s => (
                  <li 
                    key={s.id} 
                    onClick={() => handleSelectDebtor(s)}
                    className="px-4 py-2.5 hover:bg-emerald-50 cursor-pointer text-sm text-gray-800 border-b border-gray-50 last:border-0"
                  >
                    {s.name} <span className="text-xs text-gray-400 ml-1">({s.phone})</span>
                  </li>
                ))}
              </ul>
            )}
            
            {/* Feedback Status */}
            {selectedDebtor && (
              <p className="text-xs text-emerald-600 mt-1.5 ml-1">✓ Cliente existente selecionado.</p>
            )}
            {isNewDebtor && (
              <p className="text-xs text-amber-600 mt-1.5 ml-1">✧ Novo cliente será cadastrado.</p>
            )}
          </div>

          {/* Telefone (Aparece só se for cliente novo) */}
          {isNewDebtor && (
            <div className="animate-fade-in">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">WhatsApp (Telefone)</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Somente números (ex: 11999999999)"
                maxLength={11}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Valor */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Valor (R$)</label>
              <input
                value={amountStr}
                onChange={e => setAmountStr(formatCurrencyInput(e.target.value))}
                placeholder="0,00"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data de Início</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Dica de regras */}
          {amountCents > 0 && (
            <div className="bg-emerald-50 text-emerald-800 text-xs rounded-xl p-3 leading-relaxed">
              <strong>Regras:</strong> Juros de 30% ao mês (capitalização diária). Multa de R$ 10/dia após o vencimento (30 dias).
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={handleSubmit}
            disabled={!canSave || isSaving}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-200 disabled:text-gray-400 text-gray-900 text-sm font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
          >
            {isSaving ? 'Salvando...' : 'Salvar Empréstimo'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
