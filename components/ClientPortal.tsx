
import React, { useState } from 'react';
import { Logo } from '../constants';
import { translateLegalJargon } from '../services/gemini';
import Modal from './Modal';
import { ClientNotice, ClientDocument, Transaction, TransactionStatus } from '../types';

interface ClientPortalProps {
  client: any;
  clientCases: any[];
  onLogout: () => void;
  onUpdateClient: (updatedClient: any) => void;
  onReportPayment: (amount: number, attachmentData?: string, attachmentName?: string) => void;
  allTransactions: Transaction[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// ── Componente de upload de comprovante ───────────────────────────────────────
const UploadComprovante: React.FC<{
  onReportPayment: (amount: number, data?: string, name?: string) => void;
}> = ({ onReportPayment }) => {
  const [amount,      setAmount]      = useState('');
  const [file,        setFile]        = useState<{ data: string; name: string } | null>(null);
  const [dragging,    setDragging]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [sent,        setSent]        = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const readFile = (f: File) => {
    if (f.size > 5 * 1024 * 1024) { alert('Arquivo muito grande. Máximo: 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => setFile({ data: e.target?.result as string, name: f.name });
    reader.readAsDataURL(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) readFile(f);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { alert('Selecione o comprovante antes de enviar.'); return; }
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) { alert('Informe um valor válido.'); return; }
    setSubmitting(true);
    setTimeout(() => {
      onReportPayment(val, file.data, file.name);
      setSent(true);
      setSubmitting(false);
      setAmount('');
      setFile(null);
      setTimeout(() => setSent(false), 4000);
    }, 800);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Cabeçalho */}
      <div className="p-6 border-b dark:border-slate-700 bg-navy-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gold-800/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-white">Enviar Comprovante de Pagamento</p>
          <p className="text-[10px] text-navy-300">O escritório receberá e confirmará o pagamento em até 1 dia útil</p>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">

        {/* Confirmação de envio */}
        {sent && (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 animate-in fade-in zoom-in-95">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
            </svg>
            <p className="text-sm font-bold text-green-700 dark:text-green-300">
              Comprovante enviado! Aguarde a confirmação do escritório.
            </p>
          </div>
        )}

        {/* Valor */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Valor pago (R$)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
            <input
              type="number" step="0.01" min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-2xl text-lg font-bold outline-none focus:ring-2 focus:ring-gold-800 dark:text-white"
            />
          </div>
        </div>

        {/* Área de upload */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Comprovante (imagem ou PDF — máx. 5 MB)
          </label>

          {file ? (
            /* Arquivo selecionado */
            <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-700">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-800/40 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-green-800 dark:text-green-300 truncate">{file.name}</p>
                <p className="text-[10px] text-green-600 dark:text-green-400">Arquivo pronto para envio</p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-800/40 text-green-600 transition-colors"
                title="Remover arquivo"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ) : (
            /* Zona de drop */
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all
                ${dragging
                  ? 'border-gold-800 bg-gold-50 dark:bg-gold-900/10 scale-[1.01]'
                  : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 hover:border-gold-800 hover:bg-gold-50/30 dark:hover:bg-gold-900/5'
                }`}
            >
              <svg className={`w-10 h-10 transition-colors ${dragging ? 'text-gold-800' : 'text-gray-300'}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                  {dragging ? 'Solte o arquivo aqui' : 'Arraste o comprovante ou clique para selecionar'}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">PNG, JPG, PDF — até 5 MB</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }}
              />
            </div>
          )}
        </div>

        {/* Botão enviar */}
        <button
          type="submit"
          disabled={submitting || !file}
          className="w-full py-4 bg-navy-800 text-white rounded-2xl font-bold text-[11px] uppercase tracking-widest
            hover:bg-gold-800 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Enviando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
              Enviar Comprovante
            </>
          )}
        </button>

        <p className="text-[10px] text-gray-400 text-center">
          Após o envio, o comprovante ficará <span className="font-bold text-amber-600">pendente de confirmação</span> pelo escritório.
          Você será notificado assim que for processado.
        </p>
      </form>
    </div>
  );
};

const ClientPortal: React.FC<ClientPortalProps & { allTransactions: Transaction[] }> = ({ 
  client, 
  clientCases, 
  onLogout, 
  onUpdateClient, 
  onReportPayment,
  allTransactions
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'processes' | 'finance' | 'docs'>('home');
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translation, setTranslation] = useState<{ [key: string]: string }>({});
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentFile, setPaymentFile] = useState<{ data: string, name: string } | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const WHATSAPP_NUMBER = "557591774695";
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=Olá, sou o cliente ${client.name} e gostaria de falar sobre o meu processo.`;
  
  const handleTranslate = async (processId: string, movementText: string) => {
    if (translatingId) return;
    setTranslatingId(processId);
    try {
      const result = await translateLegalJargon(movementText);
      setTranslation(prev => ({ ...prev, [processId]: result }));
    } catch (err) {
      alert("Ocorreu um erro ao processar a análise por IA.");
    } finally {
      setTranslatingId(null);
    }
  };

  const handlePaymentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPaymentFile({
        data: event.target?.result as string,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount)) return alert("Valor inválido");
    if (!paymentFile) return alert("Por favor, anexe o comprovante de pagamento.");

    setIsSubmittingPayment(true);
    setTimeout(() => {
      onReportPayment(amount, paymentFile.data, paymentFile.name);
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentFile(null);
      setIsSubmittingPayment(false);
      alert("Comprovante enviado com sucesso! Aguarde a conferência pelo nosso departamento financeiro.");
    }, 1000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação de segurança para localStorage (limite de 2MB por arquivo para evitar estouro)
    if (file.size > 2 * 1024 * 1024) {
      return alert("O arquivo é muito grande. Para garantir o desempenho, anexe arquivos de até 2MB.");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target?.result as string;
      const newDoc: ClientDocument = {
        id: Date.now().toString(),
        name: file.name,
        date: new Date().toLocaleDateString('pt-BR'),
        type: file.type.split('/')[1]?.toUpperCase() || 'FILE',
        status: 'RECEBIDO',
        content: fileData,
        sentBy: 'CLIENT'
      };

      const updatedClient = {
        ...client,
        documents: [...(client.documents || []), newDoc]
      };
      onUpdateClient(updatedClient);
      setIsDocModalOpen(false);
      alert("Documento enviado com sucesso e já disponível na sua pasta!");
    };
    reader.onerror = () => alert("Erro ao ler o arquivo. Tente novamente.");
    reader.readAsDataURL(file);
  };

  const handleDownload = (doc: any) => {
    if (!doc.content) return alert("Documento sem conteúdo disponível.");
    try {
      const link = document.createElement('a');
      link.href = doc.content;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Erro ao baixar o arquivo.");
    }
  };

  const handleDeleteDoc = (docId: string) => {
    if (confirm("Deseja remover este documento?")) {
      onUpdateClient({ ...client, documents: (client.documents || []).filter((d: any) => d.id !== docId) });
    }
  };

  const progressPercent = Math.min(100, ((client.totalPaid || 0) / (client.totalContract || 1)) * 100);
  const myTransactions = allTransactions.filter(t => t.clientId === client.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const notices = client.notices || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-500 pb-20 relative">
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="fixed bottom-8 right-8 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center group">
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
      </a>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-navy-800 rounded-xl flex items-center justify-center shadow-lg"><Logo className="w-8 h-8" /></div>
          <div>
            <h2 className="text-2xl font-serif font-bold dark:text-white">Olá, {client.name.split(' ')[0]}</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Acompanhamento de Autos • Legere</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onLogout} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest shadow-sm">Sair do Portal</button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['home', 'processes', 'finance', 'docs'].map(t => (
          <button key={t} onClick={() => setActiveTab(t as any)} className={`px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border whitespace-nowrap ${activeTab === t ? 'bg-navy-800 text-white shadow-lg border-navy-800' : 'bg-white dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700'}`}>
            {t === 'home' ? '🏠 Início' : t === 'processes' ? '⚖️ Processos' : t === 'finance' ? '💰 Financeiro' : '📁 Documentos'}
          </button>
        ))}
      </div>

      {activeTab === 'home' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 shadow-sm">
              <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                <svg className="w-4 h-4 text-gold-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                Quadro de Avisos
              </h3>
              <div className="space-y-4">
                {notices.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Nenhum aviso no momento.</p>
                ) : notices.map((n: ClientNotice) => (
                  <div key={n.id} className="p-4 bg-navy-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase">{new Date(n.createdAt).toLocaleDateString('pt-BR')}</p>
                      {n.date && <span className="text-[8px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase">Agendado para {new Date(n.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                    <p className="text-sm dark:text-white leading-relaxed">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 shadow-sm">
              <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-6">Última Movimentação dos Processos</h3>
              <div className="space-y-4">
                {clientCases.length > 0 ? clientCases.map(c => (
                  <div key={c.id} className="p-6 bg-gray-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-700">
                    <div className="flex justify-between items-start mb-3">
                       <p className="text-[10px] text-gold-800 font-bold uppercase">Processo: {c.cnj}</p>
                       <span className="text-[9px] bg-navy-800 text-white px-2 py-0.5 rounded font-bold">{c.status}</span>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border-l-4 border-navy-800">
                      <p className="text-xs text-gray-600 dark:text-gray-300 italic mb-2">"{c.lastMovement}"</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-gray-400">Nenhum processo vinculado.</p>}
                
                {clientCases.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-4 italic font-medium">
                    * A movimentação pode ser explicada na sua aba de Processos.
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-gold-800 text-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col justify-between relative overflow-hidden group min-h-[300px]">
              <div className="relative z-10">
                <h3 className="text-lg font-bold font-serif mb-6">Investimento Judicial</h3>
                <p className="text-[10px] uppercase font-bold opacity-70 tracking-widest">Pago até agora</p>
                <p className="text-3xl font-bold">{formatCurrency(client.totalPaid || 0)}</p>
                <div className="h-3 w-full bg-white/20 rounded-full overflow-hidden border border-white/10 mt-4">
                  <div className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <p className="text-[10px] mt-2 opacity-70 font-bold uppercase">Total Contratado: {formatCurrency(client.totalContract)}</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(true)} className="mt-8 relative z-10 bg-white text-gold-900 font-bold py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-navy-800 hover:text-white transition-all shadow-xl">
                Informar Novo Pagamento
              </button>
            </div>

            <div className="bg-navy-800 text-white p-6 rounded-3xl shadow-xl">
               <h4 className="font-bold text-sm uppercase tracking-widest mb-4">Suporte Direto</h4>
               <p className="text-xs text-navy-200 mb-4 leading-relaxed">Dúvidas sobre o andamento? Fale agora com nossa equipe via WhatsApp.</p>
               <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform">
                  Atendimento WhatsApp
               </a>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'processes' && (
        <div className="space-y-6">
          {clientCases.length === 0 ? (
            <p className="text-center py-20 text-gray-400 italic">Nenhum processo localizado para este documento.</p>
          ) : clientCases.map(c => (
            <div key={c.id} className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 shadow-sm animate-in slide-in-from-bottom-4">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
                <div>
                  <h4 className="text-lg font-bold dark:text-white">{c.cnj}</h4>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{c.area} • {c.court}</p>
                </div>
                <span className="px-4 py-1.5 bg-navy-50 dark:bg-slate-900 text-navy-800 dark:text-gold-800 text-[10px] font-bold rounded-full uppercase tracking-widest border dark:border-slate-700">
                  Status: {c.status}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] border-b dark:border-slate-700 pb-2">Última Movimentação Técnica</h5>
                  <div className="p-6 bg-gray-50 dark:bg-slate-900 rounded-3xl border-l-4 border-navy-800 italic">
                    <p className="text-sm dark:text-white leading-relaxed">"{c.lastMovement}"</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-bold text-gold-800 uppercase tracking-[0.2em] border-b dark:border-slate-700 pb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    Análise por Inteligência Artificial
                  </h5>
                  
                  {translation[c.id] ? (
                    <div className="p-6 bg-gold-50/50 dark:bg-gold-800/5 rounded-3xl border border-gold-800/20 animate-in fade-in zoom-in-95">
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{translation[c.id]}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-slate-900/50 rounded-3xl border border-dashed dark:border-slate-700">
                      <p className="text-xs text-gray-500 mb-6 text-center leading-relaxed">A linguagem jurídica pode ser complexa. Clique abaixo para que nossa IA explique o que essa movimentação significa para você.</p>
                      <button 
                        onClick={() => handleTranslate(c.id, c.lastMovement)}
                        disabled={translatingId === c.id}
                        className="px-8 py-3 bg-navy-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold-800 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                      >
                        {translatingId === c.id ? (
                          <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : null}
                        {translatingId === c.id ? 'Analisando...' : 'Traduzir Jargão Jurídico'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 shadow-sm">
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total do Contrato</p>
               <p className="text-2xl font-bold dark:text-white">{formatCurrency(client.totalContract)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 shadow-sm">
               <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Total Pago</p>
               <p className="text-2xl font-bold text-green-600">{formatCurrency(client.totalPaid)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 shadow-sm">
               <p className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-widest mb-1">Saldo Remanescente</p>
               <p className="text-2xl font-bold dark:text-white">{formatCurrency(client.totalContract - client.totalPaid)}</p>
            </div>
          </div>

          {/* ── Upload de comprovante ──────────────────────────────────────── */}
          <UploadComprovante onReportPayment={onReportPayment} />

          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50">
              <h3 className="text-sm font-bold uppercase tracking-widest dark:text-white">Extrato de Pagamentos</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase text-gray-400 border-b dark:border-slate-700">
                  <th className="p-4">Data</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4 text-right">Valor</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700">
                {myTransactions.length === 0 ? (
                  <tr><td colSpan={4} className="p-10 text-center text-xs text-gray-400 italic">Nenhum pagamento registrado.</td></tr>
                ) : myTransactions.map(tx => (
                  <tr key={tx.id} className="text-sm dark:text-gray-300">
                    <td className="p-4">{new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="p-4 font-medium">{tx.description}</td>
                    <td className="p-4 text-right font-bold">{formatCurrency(tx.amount)}</td>
                    <td className="p-4 text-right">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        tx.status === TransactionStatus.APPROVED ? 'bg-green-100 text-green-700' : 
                        tx.status === TransactionStatus.PENDING ? 'bg-gold-100 text-gold-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold uppercase tracking-widest dark:text-white">Repositório de Documentos</h3>
             <button onClick={() => setIsDocModalOpen(true)} className="bg-navy-800 text-white px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold-800 transition-all shadow-lg">
                Enviar Documento
             </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(client.documents || []).length === 0 && <p className="col-span-full text-center py-20 text-gray-400 italic">Nenhum documento disponível.</p>}
            {(client.documents || []).map((doc: any) => (
              <div key={doc.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 shadow-sm hover:border-gold-800 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${doc.sentBy === 'OFFICE' ? 'bg-gold-50 text-gold-800' : 'bg-navy-50 dark:bg-slate-900 text-navy-800'}`}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold dark:text-white truncate">{doc.name}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase border ${doc.sentBy === 'OFFICE' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                      {doc.sentBy === 'OFFICE' ? 'Enviado pelo Escritório' : 'Enviado por Você'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t dark:border-slate-700">
                  <button onClick={() => handleDownload(doc)} className="flex-1 text-[9px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-widest bg-navy-50 dark:bg-slate-900 py-2 rounded-lg hover:bg-navy-100 transition-colors">Baixar</button>
                  {doc.sentBy === 'CLIENT' && <button onClick={() => handleDeleteDoc(doc.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Payment */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Informar Novo Pagamento">
        <form onSubmit={handleUpdatePayment} className="space-y-8">
          <div className="p-4 bg-navy-50 dark:bg-slate-900 rounded-2xl border border-navy-100 dark:border-slate-700">
            <p className="text-xs text-navy-800 dark:text-navy-100 font-medium leading-relaxed">
              Utilize esta opção para enviar comprovantes de transferências, PIX ou boletos liquidados. Sua ficha financeira será atualizada após a conferência.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Valor Total Pago (R$)</label>
              <input type="number" step="0.01" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-2xl p-4 text-xl font-bold outline-none focus:ring-2 focus:ring-gold-800 dark:text-white" placeholder="0,00" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Comprovante de Pagamento (Imagem ou PDF)</label>
              <div className="relative">
                <input type="file" required accept="image/*,.pdf" onChange={handlePaymentFileSelect} className="hidden" id="payment-attachment" />
                <label htmlFor="payment-attachment" className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-[2rem] bg-gray-50 dark:bg-slate-900 cursor-pointer hover:border-gold-800 transition-all group">
                   <svg className="w-10 h-10 text-gray-300 group-hover:text-gold-800 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                   <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-navy-800 dark:group-hover:text-white">
                      {paymentFile ? `Selecionado: ${paymentFile.name}` : "Clique para selecionar arquivo"}
                   </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
            <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-6 py-3 text-sm font-bold text-gray-400">Cancelar</button>
            <button type="submit" disabled={isSubmittingPayment} className="px-10 py-3 bg-navy-800 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-gold-800 shadow-xl transition-all disabled:opacity-50">
              {isSubmittingPayment ? "Enviando..." : "Confirmar e Enviar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Upload Doc */}
      <Modal isOpen={isDocModalOpen} onClose={() => setIsDocModalOpen(false)} title="Enviar Documento">
        <div className="space-y-6">
           <p className="text-xs text-gray-500">Envie documentos, petições ou arquivos necessários para o seu processo. (Limite de 2MB)</p>
           <label className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-[2rem] bg-gray-50 dark:bg-slate-900 cursor-pointer hover:border-gold-800 transition-all group">
              <svg className="w-10 h-10 text-gray-300 group-hover:text-gold-800 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-navy-800 dark:group-hover:text-white">Selecionar Arquivo</span>
              <input type="file" className="hidden" onChange={handleFileUpload} />
           </label>
        </div>
      </Modal>
    </div>
  );
};

export default ClientPortal;
