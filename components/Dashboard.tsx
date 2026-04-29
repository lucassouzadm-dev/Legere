
import React, { useState, useMemo } from 'react';
import { 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { UserRole, CaseStatus, TransactionStatus, ClientStatus } from '../types';

interface DashboardProps {
  currentUser: any;
  transactions: any[];
  cases: any[];
  tasks: any[];
  users: any[];
  deadlines: any[];
  events: any[];
  isDarkMode: boolean;
  clients: any[];
  totalUnreadChat?: number;
  hideAmounts?: boolean;
  tenantSlogan?: string;
}

const COLORS = ['#1E3A8A', '#D4AF37', '#22C55E', '#EF4444', '#8B5CF6'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  transactions,
  cases,
  tasks,
  users,
  deadlines,
  events,
  isDarkMode,
  clients,
  totalUnreadChat = 0,
  hideAmounts = false,
  tenantSlogan,
}) => {
  const fmtCur = (v: number) => hideAmounts ? '••••' : formatCurrency(v);
  const isAuthorizedFinance = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FINANCE;
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const now = new Date();
  const currentMonth = now.getMonth(); 
  const currentYear = now.getFullYear();
  const todayFormatted = now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  // CÁLCULOS DAS ESTATÍSTICAS
  const activeClientsCount = clients.filter(c => c.status === ClientStatus.ACTIVE).length;
  const prospectsCount = clients.filter(c => c.status === ClientStatus.LEAD || c.status === ClientStatus.PROSPECT).length;
  const ongoingCasesCount = cases.filter(c => c.status === CaseStatus.ONGOING).length;
  
  // Honorários a faturar: Transações de entrada PENDENTES para o mês corrente
  const pendingRevenueMonth = transactions
    .filter(t => t.type === 'IN' && 
                t.status === TransactionStatus.PENDING && 
                new Date(t.date).getMonth() === currentMonth && 
                new Date(t.date).getFullYear() === currentYear)
    .reduce((acc, t) => acc + Number(t.amount), 0);

  // Novos processos nos últimos 30 dias
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newCasesCount = cases.filter(c => {
    const dDate = new Date(c.distributionDate || c.createdAt);
    return dDate >= thirtyDaysAgo;
  }).length;

  // META DO PERFIL
  const upToDateUser = users.find(u => u.id === currentUser.id) || currentUser;
  const userGoal = upToDateUser.monthlyGoal || 1;

  const professionalRevenue = transactions
    .filter(t => t.type === 'IN' && 
                t.status === TransactionStatus.APPROVED && 
                t.professionalId === currentUser.id && 
                new Date(t.date).getMonth() === currentMonth && 
                new Date(t.date).getFullYear() === currentYear)
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const progressPercent = Math.min(100, (professionalRevenue / userGoal) * 100);

  // CÁLCULOS GLOBAIS
  const currentMonthTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthRevenue = currentMonthTransactions
    .filter(t => t.type === 'IN' && t.status === TransactionStatus.APPROVED)
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const monthExpenses = currentMonthTransactions
    .filter(t => t.type === 'OUT' && t.status === TransactionStatus.APPROVED)
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const monthResult = monthRevenue - monthExpenses;

  // Widget de Prazos
  const iminentDeadlines = deadlines.filter(d => {
    if (d.status === 'DONE') return false;
    const dDate = new Date(d.date + 'T00:00:00');
    const diffTime = dDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 5;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Agenda
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const upcomingEvents = events.filter(e => {
    const isToday = e.day === today.getDate() && e.month === today.getMonth() && e.year === today.getFullYear();
    const isTomorrow = e.day === tomorrow.getDate() && e.month === tomorrow.getMonth() && e.year === tomorrow.getFullYear();
    return isToday || isTomorrow;
  }).sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.time.localeCompare(b.time);
  });

  const barData = [
    { name: 'Receitas', value: monthRevenue, color: '#22C55E' },
    { name: 'Despesas', value: monthExpenses, color: '#EF4444' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          {tenantSlogan && (
            <p className="font-serif italic text-gold-800 text-sm mb-1 opacity-90 tracking-wide animate-in fade-in slide-in-from-bottom-2 duration-1000">
              "{tenantSlogan}"
            </p>
          )}
          <h2 className="text-3xl font-serif font-bold text-navy-800 dark:text-white">Painel Executivo</h2>
          <p className="text-gray-500 dark:text-gray-400">Olá, {currentUser.name}. Hoje é {todayFormatted}.</p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-xl border border-gold-800/10 w-full md:w-80 group">
           <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Minha Meta (Perfil)</p>
              <span className={`text-xs font-bold ${progressPercent >= 100 ? 'text-green-500' : 'text-gold-800'}`}>
                {progressPercent.toFixed(1)}%
              </span>
           </div>
           <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
              <div 
                className={`h-full transition-all duration-1000 ${progressPercent >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-navy-800 to-gold-800'}`} 
                style={{ width: `${progressPercent}%` }}
              ></div>
           </div>
           <div className="flex justify-between items-baseline">
              <p className="text-xl font-bold dark:text-white">
                {fmtCur(professionalRevenue)}
              </p>
              <p className="text-[9px] text-gray-400 font-bold uppercase">Objetivo: {fmtCur(userGoal)}</p>
           </div>
        </div>
      </div>

      {/* ALERTA DE COMUNICAÇÃO (Novidade solicitada) */}
      {totalUnreadChat > 0 && (
        <div className="animate-bounce bg-gold-800 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border-2 border-white dark:border-slate-800 cursor-pointer hover:scale-[1.02] transition-transform">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                 <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
              </div>
              <div>
                 <p className="text-xs font-black uppercase tracking-widest">Central de Comunicação</p>
                 <p className="text-sm">Você possui <b>{totalUnreadChat} {totalUnreadChat === 1 ? 'mensagem não lida' : 'mensagens não lidas'}</b> aguardando resposta.</p>
              </div>
           </div>
           <svg className="w-6 h-6 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5-5 5M6 7l5 5-5 5"/></svg>
        </div>
      )}

      {/* SEÇÃO DE ESTATÍSTICAS INTEGRADAS - VISÍVEL APENAS PARA ADMINS */}
      {isAdmin && (
        <section className="animate-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* NOVO WIDGET AGRUPADO EM FORMA DE LISTA */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-8 border-b dark:border-slate-700 pb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-navy-800 dark:text-gold-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                Sumário Operacional da Banca
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                 {/* Clientes Ativos */}
                 <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-2xl bg-navy-50 dark:bg-navy-900/50 flex items-center justify-center text-navy-800 dark:text-gold-800 group-hover:bg-navy-800 group-hover:text-white transition-all">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                       </div>
                       <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clientes Ativos</p>
                    </div>
                    <span className="text-xl font-bold dark:text-white">{activeClientsCount}</span>
                 </div>

                 {/* Prospectos */}
                 <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-2xl bg-gold-50 dark:bg-gold-900/30 flex items-center justify-center text-gold-800 group-hover:bg-gold-800 group-hover:text-white transition-all">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                       </div>
                       <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Prospectos</p>
                    </div>
                    <span className="text-xl font-bold dark:text-white">{prospectsCount}</span>
                 </div>

                 {/* Novos Processos (30D) */}
                 <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                    </div>
                       <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Novos Processos (30D)</p>
                    </div>
                    <span className="text-xl font-bold dark:text-white">{newCasesCount}</span>
                 </div>

                 {/* Processos Ativos */}
                 <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z"/></svg>
                       </div>
                       <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Processos Ativos</p>
                    </div>
                    <span className="text-xl font-bold dark:text-white">{ongoingCasesCount}</span>
                 </div>
              </div>
            </div>

            {/* FINANCEIRO - CARD SEPARADO PARA EQUILÍBRIO VISUAL */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-green-100 dark:border-green-900/20 shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                     <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] leading-none">Previsão de Honorários</p>
               </div>
               <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-1">A Faturar (Mês Corrente)</p>
               <p className="text-4xl font-bold text-green-600">{fmtCur(pendingRevenueMonth)}</p>
               <div className="mt-6 p-3 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
                  <p className="text-[10px] font-bold text-green-700 dark:text-green-400 text-center uppercase tracking-widest">Base de Projeção: Lançamentos Pendentes</p>
               </div>
            </div>
          </div>
        </section>
      )}

      {/* RESULTADO LÍQUIDO E KPIs OPERACIONAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isAuthorizedFinance && (
          <div className="bg-navy-800 p-6 rounded-3xl shadow-xl text-white">
             <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Resultado Líquido (Mês)</p>
             <h4 className={`text-2xl font-bold ${monthResult >= 0 ? 'text-green-400' : 'text-red-400'}`}>
               {fmtCur(monthResult)}
             </h4>
          </div>
        )}
        <KPICard title="Total de Clientes" value={clients.length} change="Total Base" type="neutral" />
        <KPICard title="Minhas Tarefas" value={tasks.filter(t => t.responsible === currentUser.name && t.status !== 'DONE').length} change="Pendentes" type="negative" />
        <KPICard title="Prazos (5 dias)" value={iminentDeadlines.length} change="Críticos" type="negative" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
           <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
             <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
             Prazos Críticos (5 dias)
           </h3>
           <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {iminentDeadlines.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-10">Nenhum prazo fatal identificado.</p>
              ) : iminentDeadlines.map(d => (
                <div key={d.id} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl">
                   <div className="flex justify-between items-start mb-1">
                      <p className="text-[10px] font-bold text-red-600 uppercase">{new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                      <span className="text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">Urgente</span>
                   </div>
                   <p className="text-xs font-bold dark:text-white truncate">{d.type}</p>
                   <p className="text-[9px] text-gray-500 font-mono mt-1">{d.case}</p>
                </div>
              ))}
           </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
           <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
             <svg className="w-4 h-4 text-gold-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z"/></svg>
             Agenda Hoje & Amanhã
           </h3>
           <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-10">Agenda livre para as próximas 48h.</p>
              ) : upcomingEvents.map(e => (
                <div key={e.id} className="flex gap-3 items-center border-b dark:border-slate-700 pb-3 last:border-0 hover:bg-gray-50 p-1 rounded-lg">
                   <div className="text-center min-w-[40px]">
                      <p className="text-[10px] font-bold text-gold-800 uppercase leading-none">{e.day === today.getDate() ? 'Hoje' : 'Amanhã'}</p>
                      <p className="text-xs font-bold dark:text-white mt-1">{e.time}</p>
                   </div>
                   <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-bold dark:text-white truncate">{e.title}</p>
                      <span className={`text-[8px] font-bold px-1 rounded uppercase tracking-tighter ${
                        e.type === 'HEARING' ? 'bg-navy-800 text-white' : 'bg-green-100 text-green-700'
                      }`}>{e.type === 'HEARING' ? 'Audiência' : e.type}</span>
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Performance Financeira</h3>
          <div className="h-64">
             {isAuthorizedFinance ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={barData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={50}>
                       {barData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Bar>
                 </BarChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-center">Faturamento Restrito ao Financeiro</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

const KPICard = ({ title, value, change, type }: any) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">{title}</p>
    <div className="flex items-baseline gap-2">
      <h4 className="text-xl font-bold dark:text-white truncate">{value}</h4>
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
        type === 'positive' ? 'bg-green-100 text-green-700' : 
        type === 'negative' ? 'bg-red-100 text-red-700' : 
        'bg-gray-100 text-gray-700'
      }`}>
        {change}
      </span>
    </div>
  </div>
);

export default Dashboard;
