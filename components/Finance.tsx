
import React, { useState, useRef } from 'react';
import Modal from './Modal';
import { TransactionStatus, UserRole, Transaction } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { getCurrentTenantId } from '../services/tenantService';

interface FinanceProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  users: any[];
  cases: any[];
  onApprove: (txId: string) => void;
  onReject: (txId: string) => void;
  hideAmounts?: boolean;
}

const CATEGORIES_IN = [
  'Honorários Contratuais',
  'Honorários de Sucumbência',
  'Consultoria',
  'Outras Receitas'
];

const CATEGORIES_OUT = [
  'Aluguel / Sede',
  'Despesas de Consumo',
  'Despesa com Serviços',
  'Impostos',
  'Outras Despesas'
];

const COLORS = ['#1E3A8A', '#D4AF37', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#3B82F6'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const Finance: React.FC<FinanceProps> = ({ transactions, setTransactions, users, cases, onApprove, onReject, hideAmounts = false }) => {
  // Mascara valores monetários quando o perfil não tem permissão
  const fmtVal = (v: number) => hideAmounts ? '••••' : formatCurrency(v);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [reviewTx, setReviewTx] = useState<any>(null);
  const [txType, setTxType] = useState<'IN' | 'OUT'>('IN');
  const [isFuture, setIsFuture] = useState(false);
  const [attachment, setAttachment] = useState<{ data: string, name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'lancamentos' | 'futuro'>('lancamentos');

  // Estados para Filtro de Período
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  // Filtra as transações baseadas no mês selecionado
  const filteredTransactions = transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  // Separa lançamentos futuros dos regulares
  const regularTransactions = filteredTransactions.filter(t => t.status !== TransactionStatus.FUTURE);
  const futureTransactions = filteredTransactions.filter(t => t.status === TransactionStatus.FUTURE);

  const financialSummary = regularTransactions.reduce((acc, t) => {
    const amount = Number(t.amount);
    if (t.status === TransactionStatus.APPROVED) {
      if (t.type === 'IN') acc.totalIn += amount;
      else acc.totalOut += amount;
    } else if (t.status === TransactionStatus.PENDING) {
      acc.totalPending += amount;
      acc.pendingCount += 1;
    }
    return acc;
  }, { totalIn: 0, totalOut: 0, totalPending: 0, pendingCount: 0 });

  const futureSummary = futureTransactions.reduce((acc, t) => {
    const amount = Number(t.amount);
    if (t.type === 'IN') acc.totalIn += amount;
    else acc.totalOut += amount;
    acc.count += 1;
    return acc;
  }, { totalIn: 0, totalOut: 0, count: 0 });

  const categoryData = regularTransactions
    .filter(t => t.status === TransactionStatus.APPROVED)
    .reduce((acc: any[], t) => {
      const existing = acc.find(item => item.name === t.category);
      if (existing) existing.value += Number(t.amount);
      else acc.push({ name: t.category || 'Não Categorizado', value: Number(t.amount) });
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value);

  const responsibleData = regularTransactions
    .filter(t => t.status === TransactionStatus.APPROVED)
    .reduce((acc: any[], t) => {
      const user = users.find(u => u.id === t.professionalId);
      const name = user ? user.name : (t.clientName || 'Escritório');
      const existing = acc.find(item => item.name === name);
      if (existing) existing.value += Number(t.amount);
      else acc.push({ name, value: Number(t.amount) });
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value);

  const handleExportExcel = () => {
    const revenues = filteredTransactions
      .filter(t => t.type === 'IN')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const expenses = filteredTransactions
      .filter(t => t.type === 'OUT')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalIn = revenues.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalOut = expenses.reduce((acc, t) => acc + Number(t.amount), 0);

    const headers = ['Data', 'Descrição', 'Categoria', 'Responsável', 'Valor', 'Status'];
    
    const formatRow = (tx: Transaction) => [
      new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR'),
      tx.description.replace(/;/g, ','),
      tx.category,
      users.find(u => u.id === tx.professionalId)?.name || tx.clientName || 'Escritório',
      tx.amount.toFixed(2).replace('.', ','),
      tx.status
    ].join(';');

    const csvContent = [
      `RELATÓRIO FINANCEIRO Legere - ${months[filterMonth].toUpperCase()} / ${filterYear}`,
      '',
      '--- SEÇÃO DE RECEITAS ---',
      headers.join(';'),
      ...revenues.map(formatRow),
      '',
      '--- SEÇÃO DE DESPESAS ---',
      headers.join(';'),
      ...expenses.map(formatRow),
      '',
      '--- RESUMO FINANCEIRO CONSOLIDADO ---',
      `RECEITA FINANCEIRA BRUTA; ; ; ;${totalIn.toFixed(2).replace('.', ',')}`,
      `TOTAL DE DESPESAS; ; ; ;${totalOut.toFixed(2).replace('.', ',')}`,
      `RESULTADO LÍQUIDO; ; ; ;${(totalIn - totalOut).toFixed(2).replace('.', ',')}`,
      '',
      `Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `Legere_Financeiro_${filterMonth + 1}_${filterYear}.csv`;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachment({
        data: event.target?.result as string,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as 'IN' | 'OUT';

    const newTx: Transaction = {
      id: editingTx?.id || Date.now().toString(),
      description: formData.get('description') as string,
      amount: Number(formData.get('amount')),
      type,
      category: formData.get('category') as string,
      professionalId: formData.get('professionalId') as string,
      date: formData.get('date') as string,
      status: isFuture ? TransactionStatus.FUTURE : TransactionStatus.APPROVED,
      hasAttachment: !!attachment || !!editingTx?.hasAttachment,
      attachmentData: attachment?.data || editingTx?.attachmentData,
      attachmentName: attachment?.name || editingTx?.attachmentName,
      tenantId: editingTx?.tenantId || getCurrentTenantId(),
    };

    if (editingTx) setTransactions(transactions.map(t => t.id === editingTx.id ? newTx : t));
    else setTransactions([newTx, ...transactions]);

    setIsModalOpen(false);
    setEditingTx(null);
    setAttachment(null);
    setIsFuture(false);
  };

  const handleConfirmFuture = (txId: string) => {
    setTransactions(transactions.map(t =>
      t.id === txId ? { ...t, status: TransactionStatus.APPROVED } : t
    ));
  };

  const handleDownloadAttachment = (tx: Transaction) => {
    if (!tx.attachmentData) return;
    const link = document.createElement('a');
    link.href = tx.attachmentData;
    link.download = tx.attachmentName || 'comprovante.pdf';
    link.click();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold font-serif dark:text-white">Financeiro</h2>
          <p className="text-sm text-gray-500">Inteligência financeira e controle de fluxo.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border dark:border-slate-700">
            <select 
              value={filterMonth} 
              onChange={(e) => setFilterMonth(parseInt(e.target.value))}
              className="bg-transparent text-xs font-bold px-3 py-2 outline-none dark:text-white border-r dark:border-slate-700"
            >
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select 
              value={filterYear} 
              onChange={(e) => setFilterYear(parseInt(e.target.value))}
              className="bg-transparent text-xs font-bold px-3 py-2 outline-none dark:text-white"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button 
            onClick={handleExportExcel}
            className="flex-1 md:flex-none px-5 py-2.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-white border dark:border-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Exportar Planilha (XLS)
          </button>

          <button 
            onClick={() => { setEditingTx(null); setAttachment(null); setIsModalOpen(true); }} 
            className="flex-1 md:flex-none bg-navy-800 text-white px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg hover:bg-gold-800 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            Novo Lançamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receitas (Mês)" value={financialSummary.totalIn} color="green" hideAmounts={hideAmounts} />
        <StatCard title="Despesas (Mês)" value={financialSummary.totalOut} color="red" hideAmounts={hideAmounts} />
        <StatCard title="Saldo Período" value={financialSummary.totalIn - financialSummary.totalOut} color="navy" hideAmounts={hideAmounts} />
        <StatCard title="Pendente Conferência" value={financialSummary.totalPending} color="gold" count={financialSummary.pendingCount} hideAmounts={hideAmounts} />
      </div>

      {/* Resumo A Lançar */}
      {futureSummary.count > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-300">A Lançar ({futureSummary.count} entr.)</p>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-100">
                Receitas: {hideAmounts ? '••••' : formatCurrency(futureSummary.totalIn)} &nbsp;|&nbsp; Despesas: {hideAmounts ? '••••' : formatCurrency(futureSummary.totalOut)}
              </p>
            </div>
          </div>
          <button onClick={() => setActiveTab('futuro')} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-amber-700 transition-all">
            Ver A Lançar
          </button>
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-2 border-b dark:border-slate-700">
        <button
          onClick={() => setActiveTab('lancamentos')}
          className={`pb-3 px-1 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'lancamentos' ? 'border-navy-800 text-navy-800 dark:text-white dark:border-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Lançamentos
        </button>
        <button
          onClick={() => setActiveTab('futuro')}
          className={`pb-3 px-1 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'futuro' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          A Lançar
          {futureSummary.count > 0 && <span className="bg-amber-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{futureSummary.count}</span>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 shadow-sm">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Distribuição por Categoria ({months[filterMonth]})</h3>
           <div className="h-[250px]">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                         {categoryData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                   </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">Sem dados aprovados no período</div>
              )}
           </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 shadow-sm">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Fluxo por Profissional / Origem</h3>
           <div className="h-[250px]">
              {responsibleData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie data={responsibleData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                         {responsibleData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                   </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">Sem dados aprovados no período</div>
              )}
           </div>
        </div>
      </div>

      {activeTab === 'lancamentos' ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 text-[10px] font-bold uppercase text-gray-400">
                <th className="p-4">Data / Categoria</th>
                <th className="p-4">Descrição / Responsável</th>
                <th className="p-4 text-right">Valor</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              {regularTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-gray-400 italic text-sm">
                    Nenhum lançamento localizado em {months[filterMonth]} de {filterYear}.
                  </td>
                </tr>
              ) : regularTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                <tr key={tx.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${tx.status === TransactionStatus.PENDING ? 'bg-gold-50/10' : ''}`}>
                  <td className="p-4">
                     <p className="text-[10px] font-bold text-gray-400">{new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                     <span className="text-[8px] bg-navy-50 dark:bg-slate-700 text-navy-800 dark:text-gold-800 font-bold px-1.5 py-0.5 rounded uppercase">{tx.category}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold dark:text-white">{tx.description}</p>
                      {tx.hasAttachment && (
                        <button
                          onClick={() => handleDownloadAttachment(tx)}
                          className="p-1 bg-gold-50 dark:bg-slate-700 rounded hover:bg-gold-800 hover:text-white transition-all group"
                          title={`Ver Comprovante: ${tx.attachmentName || 'Download'}`}
                        >
                          <svg className="w-3.5 h-3.5 text-gold-800 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase">Resp: {users.find(u => u.id === tx.professionalId)?.name || tx.clientName || 'Geral'}</p>
                  </td>
                  <td className={`p-4 text-right font-bold ${tx.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                    {hideAmounts ? <span className="tracking-widest text-gray-400">••••</span> : <>{tx.type === 'OUT' ? '-' : ''} {formatCurrency(tx.amount)}</>}
                  </td>
                  <td className="p-4 text-right">
                    {tx.status === TransactionStatus.PENDING ? (
                      <button onClick={() => { setReviewTx(tx); setIsReviewModalOpen(true); }} className="bg-gold-800 text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase hover:bg-navy-800 transition-all shadow-md">Conferir</button>
                    ) : (
                      <div className="flex justify-end gap-2">
                         <button onClick={() => { setEditingTx(tx); setTxType(tx.type); setIsFuture(false); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-navy-800 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                         <button onClick={() => setTransactions(transactions.filter(t => t.id !== tx.id))} className="p-2 text-gray-400 hover:text-red-600 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ABA: A LANÇAR */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-amber-200 dark:border-amber-700 overflow-hidden shadow-sm">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Lançamentos Futuros — Não computados no saldo até confirmação</p>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 text-[10px] font-bold uppercase text-gray-400">
                <th className="p-4">Data Prevista / Categoria</th>
                <th className="p-4">Descrição / Responsável</th>
                <th className="p-4 text-right">Valor Previsto</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              {futureTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-gray-400 italic text-sm">
                    Nenhum lançamento futuro em {months[filterMonth]} de {filterYear}.
                  </td>
                </tr>
              ) : futureTransactions.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(tx => (
                <tr key={tx.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                  <td className="p-4">
                     <p className="text-[10px] font-bold text-gray-400">{new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                     <span className="text-[8px] bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 font-bold px-1.5 py-0.5 rounded uppercase">{tx.category}</span>
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-bold dark:text-white">{tx.description}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase">Resp: {users.find(u => u.id === tx.professionalId)?.name || tx.clientName || 'Geral'}</p>
                  </td>
                  <td className={`p-4 text-right font-bold opacity-70 ${tx.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                    {hideAmounts ? <span className="tracking-widest text-gray-400">••••</span> : <>{tx.type === 'OUT' ? '-' : ''} {formatCurrency(tx.amount)}</>}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleConfirmFuture(tx.id)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[9px] font-bold uppercase hover:bg-green-700 transition-all shadow-sm"
                        title="Confirmar e mover para lançamentos"
                      >
                        Confirmar
                      </button>
                      <button onClick={() => { setEditingTx(tx); setTxType(tx.type); setIsFuture(true); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-navy-800 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                      <button onClick={() => setTransactions(transactions.filter(t => t.id !== tx.id))} className="p-2 text-gray-400 hover:text-red-600 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Lançamento Completo com Upload */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTx(null); setAttachment(null); setIsFuture(false); }} title={editingTx ? "Editar Registro" : "Novo Lançamento Estruturado"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-2">
             <button type="button" onClick={() => setTxType('IN')} className={`flex-1 py-3 rounded-xl font-bold uppercase text-[10px] border transition-all ${txType === 'IN' ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>Receita</button>
             <button type="button" onClick={() => setTxType('OUT')} className={`flex-1 py-3 rounded-xl font-bold uppercase text-[10px] border transition-all ${txType === 'OUT' ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>Despesa</button>
             <input type="hidden" name="type" value={txType} />
          </div>

          {/* Toggle: A Lançar (futuro) */}
          <div
            onClick={() => setIsFuture(!isFuture)}
            className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${isFuture ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900'}`}
          >
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 ${isFuture ? 'text-amber-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isFuture ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400'}`}>Lançamento Futuro (A Lançar)</span>
            </div>
            <div className={`w-10 h-5 rounded-full transition-all flex items-center px-0.5 ${isFuture ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${isFuture ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </div>
          {isFuture && <p className="text-[9px] text-amber-600 dark:text-amber-400 -mt-3 px-1">Este lançamento não será computado nos totais até ser confirmado manualmente.</p>}

          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Descrição</label>
                <input name="description" defaultValue={editingTx?.description} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Valor (R$)</label>
                <input name="amount" type="number" step="0.01" defaultValue={editingTx?.amount} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm font-bold dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Data</label>
                <input name="date" type="date" required defaultValue={editingTx?.date || new Date().toISOString().split('T')[0]} className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Profissional Responsável</label>
                <select name="professionalId" defaultValue={editingTx?.professionalId} className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none">
                   <option value="">Geral / Escritório</option>
                   {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
             </div>
             <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Categoria do Lançamento</label>
                <select name="category" defaultValue={editingTx?.category} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none">
                   {txType === 'IN' 
                     ? CATEGORIES_IN.map(c => <option key={c} value={c}>{c}</option>)
                     : CATEGORIES_OUT.map(c => <option key={c} value={c}>{c}</option>)
                   }
                </select>
             </div>

             <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Comprovante (Nota Fiscal / Recibo)</label>
                <div className="relative">
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden" 
                    accept="image/*,.pdf"
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-900 cursor-pointer hover:border-gold-800 transition-all group"
                  >
                    <svg className="w-8 h-8 text-gray-300 group-hover:text-gold-800 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-navy-800 dark:group-hover:text-white transition-colors">
                      {attachment ? `Arquivo: ${attachment.name}` : (editingTx?.hasAttachment ? "Substituir Comprovante Atual" : "Anexar Nota ou Recibo")}
                    </span>
                  </div>
                </div>
             </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
             <button type="button" onClick={() => { setIsModalOpen(false); setEditingTx(null); setAttachment(null); }} className="px-6 py-2 text-sm font-bold text-gray-400">Cancelar</button>
             <button type="submit" className="px-10 py-3 bg-navy-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold-800 shadow-xl transition-all">
                {editingTx ? "Atualizar Lançamento" : "Salvar Lançamento"}
             </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Revisão do Portal do Cliente */}
      <Modal isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} title="Conferência de Comprovante">
        {reviewTx && (
          <div className="space-y-6 text-center">
             <div className="p-4 bg-navy-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-700">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Cliente Solicitante</p>
                <p className="text-lg font-bold dark:text-white">{reviewTx.clientName}</p>
             </div>
             <p className="text-3xl font-bold text-green-600">{hideAmounts ? '••••' : formatCurrency(reviewTx.amount)}</p>
             
             {reviewTx.hasAttachment && (
                <div className="flex flex-col items-center gap-2 p-4 border dark:border-slate-700 rounded-2xl">
                   <svg className="w-10 h-10 text-gold-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                   <p className="text-[10px] font-bold text-gray-500 uppercase">{reviewTx.attachmentName || 'Comprovante_Anexado.pdf'}</p>
                   <button onClick={() => handleDownloadAttachment(reviewTx)} className="text-xs font-bold text-navy-800 dark:text-gold-800 underline">Visualizar Documento</button>
                </div>
             )}

             <div className="flex gap-2 pt-4">
                <button onClick={() => { onReject(reviewTx.id); setIsReviewModalOpen(false); }} className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all">Recusar</button>
                <button onClick={() => { onApprove(reviewTx.id); setIsReviewModalOpen(false); }} className="flex-[2] py-3 bg-navy-800 text-white rounded-xl font-bold uppercase text-[10px] hover:bg-gold-800 transition-all shadow-lg">Aprovar e Conciliar</button>
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const StatCard = ({ title, value, color, count, hideAmounts }: any) => (
  <div className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 shadow-sm border-l-4 ${
    color === 'green' ? 'border-l-green-500' :
    color === 'red' ? 'border-l-red-500' :
    color === 'gold' ? 'border-l-gold-800' : 'border-l-navy-800'
  }`}>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
    <h4 className={`text-xl font-bold mt-1 ${color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : 'dark:text-white'}`}>
      {hideAmounts ? <span className="tracking-widest text-gray-400">••••</span> : formatCurrency(value)}
    </h4>
    {count !== undefined && <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">{count} itens</p>}
  </div>
);

export default Finance;
