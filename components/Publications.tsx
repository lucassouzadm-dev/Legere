import React, { useState, useMemo } from 'react';
import { DjenPublication, publicationsDb } from '../services/djenScraper';

interface PublicationsProps {
  publications: DjenPublication[];
  setPublications: React.Dispatch<React.SetStateAction<DjenPublication[]>>;
  currentUser: any;
  users: any[];
  cases: any[];
  addNotification: (title: string, message: string, recipientId: string) => void;
  onCreateDeadline: (pub: DjenPublication) => void;
  onCreateHearing?: (pub: DjenPublication) => void;
  onRegisterCase?: (pub: DjenPublication) => void;
  onSync: () => void;
  syncing: boolean;
  syncMsg: string | null;
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

const IconNewspaper = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
    <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
  </svg>
);
const IconRefresh = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M8 16H3v5"/>
  </svg>
);
const IconClock = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconCheck = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconArchive = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect width="20" height="5" x="2" y="3" rx="1"/>
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>
    <path d="M10 12h4"/>
  </svg>
);
const IconAlarm = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/>
    <path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>
  </svg>
);
const IconSearch = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);
const IconCheckSquare = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);
const IconX = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);
const IconEyeOff = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
);
const IconTrash = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);

// ─── Formatação ───────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR'); }
  catch { return dateStr; }
}

function statusLabel(status: string) {
  if (status === 'unread') return { label: 'Não lida',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
  if (status === 'read')   return { label: 'Lida',      cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' };
  return                          { label: 'Arquivada', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' };
}

// ─── Componente Principal ─────────────────────────────────────────────────────

// Detecta se a publicação é sobre uma audiência
function isHearingPublication(pub: DjenPublication): boolean {
  const text = (pub.content ?? '').toLowerCase();
  return /audiência|audiencia|pauta\s+de\s+audiência|designou\s+audiência|audi[eê]ncia\s+de/i.test(text);
}

const Publications: React.FC<PublicationsProps> = ({
  publications,
  setPublications,
  currentUser,
  users,
  cases,
  addNotification,
  onCreateDeadline,
  onCreateHearing,
  onRegisterCase,
  onSync,
  syncing,
  syncMsg,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read' | 'archived'>('all');
  const [filterLawyer, setFilterLawyer] = useState<string>('all');
  const [search, setSearch]             = useState('');
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  // ── Seleção em lote ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading]   = useState(false);

  const lawyers = useMemo(() => users.filter(u => u.oabNumber), [users]);

  const filtered = useMemo(() => {
    return publications.filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterLawyer !== 'all' && p.lawyerOab !== filterLawyer) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.processNumber?.toLowerCase().includes(q) &&
          !p.content?.toLowerCase().includes(q) &&
          !p.tribunal?.toLowerCase().includes(q) &&
          !p.lawyerName?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [publications, filterStatus, filterLawyer, search]);

  const unreadCount  = publications.filter(p => p.status === 'unread').length;
  const myUnread     = publications.filter(p => p.status === 'unread' && p.lawyerId === currentUser?.id).length;
  const allSelected  = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  // ── Toggle seleção ──────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // ── Ações individuais ───────────────────────────────────────────────────────
  async function handleMarkRead(pub: DjenPublication) {
    await publicationsDb.markRead(pub.id);
    setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, status: 'read' } : p));
  }

  async function handleMarkUnread(pub: DjenPublication) {
    await publicationsDb.markUnread(pub.id);
    setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, status: 'unread' } : p));
  }

  async function handleArchive(pub: DjenPublication) {
    await publicationsDb.archive(pub.id);
    setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, status: 'archived' } : p));
  }

  async function handleMarkAllRead() {
    await publicationsDb.markAllRead(currentUser.id);
    setPublications(prev => prev.map(p =>
      p.lawyerId === currentUser.id && p.status === 'unread' ? { ...p, status: 'read' } : p
    ));
  }

  async function handleCreateDeadline(pub: DjenPublication) {
    onCreateDeadline(pub);
    await publicationsDb.markDeadlineCreated(pub.id);
    setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, deadlineCreated: true } : p));
  }

  function handleCreateHearing(pub: DjenPublication) {
    if (onCreateHearing) onCreateHearing(pub);
  }

  // ── Ações em lote ───────────────────────────────────────────────────────────
  async function bulkAction(action: 'read' | 'unread' | 'archive' | 'delete') {
    if (!selectedIds.size || bulkLoading) return;
    setBulkLoading(true);
    const ids = [...selectedIds];
    try {
      if (action === 'read') {
        await publicationsDb.bulkMarkRead(ids);
        setPublications(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status: 'read' } : p));
      } else if (action === 'unread') {
        await publicationsDb.bulkMarkUnread(ids);
        setPublications(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status: 'unread' } : p));
      } else if (action === 'archive') {
        await publicationsDb.bulkArchive(ids);
        setPublications(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status: 'archived' } : p));
      } else if (action === 'delete') {
        if (!window.confirm(`Excluir ${ids.length} publicação(ões) permanentemente?`)) {
          setBulkLoading(false);
          return;
        }
        await publicationsDb.bulkDelete(ids);
        setPublications(prev => prev.filter(p => !selectedIds.has(p.id)));
      }
      clearSelection();
    } finally {
      setBulkLoading(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy-800 dark:text-white flex items-center gap-3">
            <IconNewspaper className="text-gold-800" />
            Publicações DJEN
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Diário de Justiça Eletrônico Nacional — monitoramento automático por OAB
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {unreadCount > 0 && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs font-bold px-3 py-1 rounded-full">
              {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
            </span>
          )}
          {myUnread > 0 && (
            <button onClick={handleMarkAllRead} className="text-xs text-navy-800 dark:text-gold-800 underline font-semibold">
              Marcar minhas como lidas
            </button>
          )}
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-navy-800 hover:bg-navy-700 disabled:bg-navy-400 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
          >
            <IconRefresh className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Consultando DJEN...' : 'Consultar DJEN agora'}
          </button>
        </div>
      </div>

      {/* Resultado da sincronização */}
      {syncMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium border ${
          syncMsg.startsWith('✅')
            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300'
            : syncMsg.startsWith('⚠️')
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300'
        }`}>
          {syncMsg}
        </div>
      )}

      {/* Filtros + Seleção */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Checkbox selecionar todos */}
          <button
            onClick={toggleSelectAll}
            title={allSelected ? 'Desselecionar todos' : 'Selecionar todos visíveis'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${
              someSelected
                ? 'bg-navy-800 text-white border-navy-800'
                : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-gray-400 hover:border-navy-800 hover:text-navy-800 dark:hover:text-gold-800'
            }`}
          >
            <IconCheckSquare />
            {someSelected ? `${selectedIds.size} selecionada${selectedIds.size > 1 ? 's' : ''}` : 'Selecionar'}
          </button>

          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por processo, conteúdo, tribunal..."
              className="w-full pl-9 pr-4 py-2 text-sm border dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-800"
            />
          </div>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="text-sm border dark:border-slate-600 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-800"
          >
            <option value="all">Todos os status</option>
            <option value="unread">Não lidas</option>
            <option value="read">Lidas</option>
            <option value="archived">Arquivadas</option>
          </select>

          {/* Advogado */}
          <select
            value={filterLawyer}
            onChange={e => setFilterLawyer(e.target.value)}
            className="text-sm border dark:border-slate-600 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-800"
          >
            <option value="all">Todos os advogados</option>
            {lawyers.map(l => (
              <option key={l.id} value={l.oabNumber}>
                {l.name} (OAB/{l.oabState} {l.oabNumber})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Barra de ações em lote — aparece quando há seleção */}
      {someSelected && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center gap-2 bg-navy-800 text-white px-4 py-3 rounded-2xl shadow-xl shadow-navy-800/30 border border-navy-700">
          <span className="text-sm font-bold mr-1">
            {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <button
              onClick={() => bulkAction('read')}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors"
            >
              <IconCheck /> Marcar como lida
            </button>
            <button
              onClick={() => bulkAction('unread')}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors"
            >
              <IconEyeOff /> Marcar como não lida
            </button>
            <button
              onClick={() => bulkAction('archive')}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors"
            >
              <IconArchive /> Arquivar
            </button>
            <button
              onClick={() => bulkAction('delete')}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900 hover:bg-red-800 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors"
            >
              <IconTrash /> Excluir
            </button>
          </div>
          <button
            onClick={clearSelection}
            className="ml-auto p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Cancelar seleção"
          >
            <IconX />
          </button>
          {bulkLoading && (
            <div className="absolute inset-0 bg-navy-800/80 rounded-2xl flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-16 text-center">
            <IconNewspaper className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {publications.length === 0
                ? 'Nenhuma publicação encontrada. Clique em "Consultar DJEN agora" para buscar.'
                : 'Nenhuma publicação corresponde aos filtros selecionados.'}
            </p>
          </div>
        ) : (
          filtered.map(pub => {
            const st              = statusLabel(pub.status);
            const isExpanded      = expandedId === pub.id;
            const isSelected      = selectedIds.has(pub.id);
            const linkedCase      = cases.find(c => c.id === pub.caseId);
            // Verifica se já existe processo com este CNJ cadastrado
            const caseRegistered  = !!pub.processNumber && cases.some(
              c => c.cnj && c.cnj.replace(/\D/g, '') === pub.processNumber.replace(/\D/g, '')
            );

            return (
              <div
                key={pub.id}
                className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border transition-all duration-200 overflow-hidden ${
                  isSelected
                    ? 'border-navy-800 dark:border-gold-800 shadow-navy-800/10'
                    : pub.status === 'unread'
                      ? 'border-red-200 dark:border-red-800/50'
                      : 'border-gray-100 dark:border-slate-700'
                }`}
              >
                {/* Cabeçalho da publicação */}
                <div className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-3">

                    {/* Checkbox de seleção */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleSelect(pub.id)}
                        className={`flex-shrink-0 mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-navy-800 border-navy-800 dark:bg-gold-800 dark:border-gold-800'
                            : 'border-gray-300 dark:border-slate-500 hover:border-navy-800 dark:hover:border-gold-800'
                        }`}
                        title={isSelected ? 'Desselecionar' : 'Selecionar'}
                      >
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>

                      {/* Conteúdo clicável para expandir */}
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => {
                          setExpandedId(isExpanded ? null : pub.id);
                          if (pub.status === 'unread') handleMarkRead(pub);
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {pub.status === 'unread' && (
                            <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 animate-pulse" />
                          )}
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${st.cls}`}>
                            {st.label}
                          </span>
                          {pub.tribunal && (
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full">
                              {pub.tribunal}
                            </span>
                          )}
                          {pub.deadlineCreated && (
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 rounded-full">
                              Prazo criado
                            </span>
                          )}
                          {linkedCase && (
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 px-2 py-0.5 rounded-full">
                              Vinculado ao processo
                            </span>
                          )}
                          {caseRegistered && (
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Processo cadastrado
                            </span>
                          )}
                        </div>

                        <p className="font-bold text-navy-800 dark:text-white text-sm truncate">
                          {pub.processNumber
                            ? `Processo: ${pub.processNumber}`
                            : 'Número de processo não identificado'}
                        </p>

                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <IconClock />
                            {formatDate(pub.publicationDate)}
                          </span>
                          <span className="font-medium text-navy-800 dark:text-gray-300">
                            {pub.lawyerName} — OAB/BA {pub.lawyerOab}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ações rápidas individuais */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {pub.status !== 'unread' ? (
                        <button
                          onClick={() => handleMarkUnread(pub)}
                          title="Marcar como não lida"
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                        >
                          <IconEyeOff />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkRead(pub)}
                          title="Marcar como lida"
                          className="p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 transition-colors"
                        >
                          <IconCheck />
                        </button>
                      )}
                      {!pub.deadlineCreated && (
                        <button
                          onClick={() => handleCreateDeadline(pub)}
                          title="Criar prazo"
                          className="p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 transition-colors"
                        >
                          <IconAlarm />
                        </button>
                      )}
                      {/* Botão audiência — aparece quando a publicação menciona audiência */}
                      {onCreateHearing && isHearingPublication(pub) && (
                        <button
                          onClick={() => handleCreateHearing(pub)}
                          title="Criar audiência a partir desta publicação"
                          className="p-2 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m14 13-7.5 7.5a1.93 1.93 0 0 1-2.7-2.7L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/>
                            <path d="m9 7 8 8"/><path d="m21 11-8-8"/>
                          </svg>
                        </button>
                      )}
                      {/* Botão cadastrar processo — desabilitado se CNJ já existe */}
                      {onRegisterCase && pub.processNumber && (
                        <button
                          onClick={() => !caseRegistered && onRegisterCase(pub)}
                          disabled={caseRegistered}
                          title={caseRegistered ? 'Processo já cadastrado no sistema' : 'Cadastrar processo a partir desta publicação'}
                          className={`p-2 rounded-lg transition-colors
                            ${caseRegistered
                              ? 'text-emerald-500 cursor-default opacity-60'
                              : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600'}`}
                        >
                          {caseRegistered ? (
                            /* ícone check-circle quando já existe */
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                          ) : (
                            /* ícone pasta/briefcase para cadastrar */
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
                              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                            </svg>
                          )}
                        </button>
                      )}
                      {pub.status !== 'archived' && (
                        <button
                          onClick={() => handleArchive(pub)}
                          title="Arquivar"
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-500 transition-colors"
                        >
                          <IconArchive />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Conteúdo expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700">
                    <div className="mt-3 p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                        Conteúdo da Publicação
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {pub.content || 'Conteúdo não disponível.'}
                      </p>
                    </div>

                    {linkedCase && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-200 dark:border-yellow-800/30">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-700 dark:text-yellow-400 mb-1">
                          Processo vinculado no sistema
                        </p>
                        <p className="text-sm font-semibold text-navy-800 dark:text-white">
                          {linkedCase.title || linkedCase.cnj}
                        </p>
                        <p className="text-xs text-gray-500">{linkedCase.cnj}</p>
                      </div>
                    )}

                    {/* Painel de cadastro de processo */}
                    {onRegisterCase && pub.processNumber && (
                      <div className={`mt-3 p-4 rounded-xl border ${
                        caseRegistered
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30'
                          : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${
                            caseRegistered ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400'
                          }`}>
                            {caseRegistered ? '✓ Processo já cadastrado no sistema' : 'Cadastro automático de processo'}
                          </p>
                          {!caseRegistered && (
                            <button
                              onClick={() => onRegisterCase(pub)}
                              className="text-[11px] font-bold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1.5"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                              Cadastrar Processo
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div>
                            <span className="text-gray-400 font-medium">CNJ: </span>
                            <span className="font-mono dark:text-white">{pub.processNumber}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium">Tribunal: </span>
                            <span className="dark:text-white">{pub.tribunal || '—'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium">Advogado: </span>
                            <span className="dark:text-white">{pub.lawyerName || '—'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium">Publicado em: </span>
                            <span className="dark:text-white">{pub.publicationDate ? new Date(pub.publicationDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                          </div>
                        </div>
                        {!caseRegistered && (
                          <p className="text-[10px] text-gray-400 mt-2 italic">
                            Partes, área e data de distribuição serão extraídas automaticamente do texto da publicação.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé */}
      {publications.length > 0 && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pb-4">
          {filtered.length} publicação(ões) exibida(s)
          {someSelected && ` · ${selectedIds.size} selecionada(s)`}
          {' · '} Fonte: DJEN/CNJ via OAB cadastrada
        </p>
      )}
    </div>
  );
};

export default Publications;
