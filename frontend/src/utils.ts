// Utilitários de formatação monetária e datas

/** Converte centavos para string BRL: 50000 → "R$ 500,00" */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/** Converte string BRL para centavos: "500,00" → 50000 */
export function parseCurrency(value: string): number {
  const clean = value.replace(/[^\d,]/g, '').replace(',', '.');
  return Math.round(parseFloat(clean || '0') * 100);
}

/** Formata número digitado para máscara de moeda BRL ao vivo */
export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const amount = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Formata data ISO para pt-BR: "2025-01-31T..." → "31/01/2025" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Retorna classe CSS de cor baseado nos dias de atraso */
export function lateStatusColor(lateDays: number): string {
  if (lateDays === 0) return 'text-emerald-700';
  if (lateDays <= 5) return 'text-amber-600';
  return 'text-red-600';
}

/** Gera link WhatsApp com mensagens dinâmicas baseadas no atraso */
export function buildWhatsAppLink(
  phone: string,
  debtorName: string,
  totalDueCents: number,
  dueDate: string,
  lateDays: number,
  pixKey: string = '(SUA CHAVE PIX)'
): string {
  const total = formatCurrency(totalDueCents);
  const formattedDate = formatDate(dueDate);
  let text = '';

  if (lateDays <= 0) {
    text = `Oi, ${debtorName}, tudo bem? Passando só pra te lembrar que o nosso acerto de ${total} ficou pra hoje, tá?\nAssim que conseguir fazer, me manda o comprovante aqui pra eu já dar baixa nas minhas coisas.\nMinha chave PIX é essa: ${pixKey}. Fico no aguardo!`;
  } else if (lateDays >= 1 && lateDays <= 3) {
    text = `Oi, ${debtorName}, tudo bom? Fui dar uma olhada aqui e vi que acabou passando a data do nosso acerto do dia ${formattedDate}.\nO valor hoje já atualizou pra ${total} por causa dos dias que correram. Consegue me mandar o Pix hoje pra não acumular mais taxa amanhã?\nA chave é a mesma: ${pixKey}.`;
  } else {
    text = `Oi, ${debtorName}, tudo bem? Tô te mandando mensagem porque o meu sistema aqui atualizou a sua ficha e tá correndo a multa de atraso junto com os juros todos os dias.\nPra não ficar muito pesado pra você pagar depois, é bom a gente acertar isso logo. Hoje o total tá dando ${total} (já com os ${lateDays} dias de atraso incluídos).\nDá uma olhadinha aí e me avisa, por favor. A chave PIX é: ${pixKey}.`;
  }

  const msg = encodeURIComponent(text);
  return `https://wa.me/55${phone}?text=${msg}`;
}
