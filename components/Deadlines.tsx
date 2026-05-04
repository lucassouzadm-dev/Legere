
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { sendNotificationEmail } from '../services/notificationService';
import { getCurrentTenant } from '../services/tenantService';
import { exportDeadlinesPDF } from '../services/exportService';
import Modal from './Modal';

interface DeadlinesProps {
  users: any[];
  clients: any[];
  cases: any[];
  deadlines: any[];
  setDeadlines: React.Dispatch<React.SetStateAction<any[]>>;
  currentUser: any;
  addNotification: (title: string, message: string, recipientId: string) => void;
  onNavigateToPublications?: () => void;
  publications?: any[];
}

// ── Ícones inline ─────────────────────────────────────────────────────────────
const IconEdit   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const IconNews   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>;
const IconTrash  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const IconNote   = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>;
const IconUser   = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>;
const IconCheck  = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>;
const IconSearch = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
const IconX      = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>;
const IconClose  = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>;

// ── Badge de urgência ─────────────────────────────────────────────────────────
const UrgencyBadge = ({ urgency }: { urgency: string }) => {
  const map: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    HIGH:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    LOW:    'bg-navy-100 text-navy-700 dark:bg-navy-900/40 dark:text-navy-300',
  };
  const labels: Record<string, string> = { URGENT: 'Fatal', HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' };
  return (
    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${map[urgency] ?? map.MEDIUM}`}>
      {labels[urgency] ?? urgency}
    </span>
  );
};

// ── Avatar de iniciais ────────────────────────────────────────────────────────
const Avatar = ({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) => {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const sz = size === 'xs' ? 'w-5 h-5 text-[8px]' : 'w-7 h-7 text-[10px]';
  return (
    <div className={`${sz} rounded-full bg-navy-800 dark:bg-navy-600 text-white flex items-center justify-center font-bold shrink-0`}
         title={name}>
      {initials}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const Deadlines: React.FC<DeadlinesProps> = ({
  users, clients, cases, deadlines, setDeadlines,
  currentUser, addNotification, onNavigateToPublications,
  publications = [],
}) => {
  // ── Estado principal ──────────────────────────────────────────────────────
  const [isCreateOpen,      setIsCreateOpen]      = useState(false);
  const [isEditOpen,        setIsEditOpen]         = useState(false);
  const [isPublicationOpen, setIsPublicationOpen]  = useState(false);
  const [editingDeadline,   setEditingDeadline]    = useState<any | null>(null);
  const [viewingPub,        setViewingPub]         = useState<any | null>(null);
  const [responsibleSearch, setResponsibleSearch]  = useState('');
  const [exporting,         setExporting]          = useState(false);

  // Autocomplete de Processo (formulário de criação)
  const [caseSearch,      setCaseSearch]      = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCases,   setFilteredCases]   = useState<any[]>([]);

  // Campos do formulário de edição
  const [editType,        setEditType]        = useState('');
  const [editDate,        setEditDate]        = useState('');
  const [editUrgency,     setEditUrgency]     = useState('');
  const [editResponsible, setEditResponsible] = useState('');
  const [editNotes,       setEditNotes]       = useState('');
  const [editMentions,    setEditMentions]    = useState<string[]>([]);

  // ── Autocomplete processo ─────────────────────────────────────────────────
  useEffect(() => {
    if (caseSearch.length > 2) {
      const matches = cases.filter(c =>
        c.cnj?.includes(caseSearch) ||
        c.clientName?.toLowerCase().includes(caseSearch.toLowerCase())
      );
      setFilteredCases(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [caseSearch, cases]);

  // ── Filtro de responsável ─────────────────────────────────────────────────
  const filteredList = useMemo(() => {
    if (!responsibleSearch.trim()) return deadlines;
    const q = responsibleSearch.toLowerCase();
    return deadlines.filter(d => d.responsible?.toLowerCase().includes(q));
  }, [deadlines, responsibleSearch]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getMentionedUsers = (mentions: string[]) =>
    (mentions ?? []).map(id => users.find(u => u.id === id)).filter(Boolean);

  const getLinkedPublication = (deadline: any) => {
    if (!deadline?.publicationId) return null;
    return publications.find(p => p.id === deadline.publicationId) ?? null;
  };

  // ── Toggle status ─────────────────────────────────────────────────────────
  const toggleStatus = (id: string) => {
    setDeadlines(prev =>
      prev.map(d => d.id === id ? { ...d, status: d.status === 'DONE' ? 'PENDING' : 'DONE' } : d)
    );
  };

  // ── Excluir ───────────────────────────────────────────────────────────────
  const deleteDeadline = (id: string) => {
    if (confirm('Deseja excluir este prazo permanentemente?')) {
      setDeadlines(prev => prev.filter(d => d.id !== id));
    }
  };

  // ── Abrir edição ──────────────────────────────────────────────────────────
  const openEdit = (deadline: any) => {
    setEditingDeadline(deadline);
    setEditType(deadline.type ?? '');
    setEditDate(deadline.date ?? '');
    setEditUrgency(deadline.urgency ?? 'MEDIUM');
    setEditResponsible(deadline.responsible ?? '');
    setEditNotes(deadline.notes ?? '');
    setEditMentions(deadline.mentions ?? []);
    setIsEditOpen(true);
  };

  // ── Salvar edição ─────────────────────────────────────────────────────────
  const saveEdit = useCallback(() => {
    if (!editingDeadline) return;
    const updated = {
      ...editingDeadline,
      type:            editType,
      title:           editType,
      date:            editDate,
      urgency:         editUrgency,
      priority:        editUrgency,
      responsible:     editResponsible,
      responsibleName: editResponsible,
      notes:           editNotes,
      mentions:        editMentions,
    };
    setDeadlines(prev => prev.map(d => d.id === updated.id ? updated : d));

    // Notificar apenas usuários recém-mencionados (não estavam antes)
    const prevMentions: string[] = editingDeadline.mentions ?? [];
    editMentions.forEach(uid => {
      if (!prevMentions.includes(uid) && uid !== currentUser?.id) {
        const u = users.find((x: any) => x.id === uid);
        if (u) {
          addNotification(
            `📌 Mencionado em prazo`,
            `Você foi mencionado no prazo "${editType}" — Processo: ${updated.case ?? 'N/A'}.`,
            uid
          );
          sendNotificationEmail({
            to: u.email,
            subject: `Mencionado em prazo: ${editType}`,
            body: `Você foi mencionado no prazo "${editType}" (Processo: ${updated.case ?? 'N/A'}).`,
            type: 'MENTION',
          });
        }
      }
    });

    setIsEditOpen(false);
    setEditingDeadline(null);
  }, [editingDeadline, editType, editDate, editUrgency, editResponsible,
      editNotes, editMentions, users, currentUser, addNotification, setDeadlines]);

  // ── Abrir publicação vinculada ────────────────────────────────────────────
  const openPublication = (deadline: any) => {
    const pub = getLinkedPublication(deadline);
    setViewingPub(pub ?? {
      content: deadline.description ?? deadline.summary ?? 'Conteúdo não disponível.',
      tribunal: '',
      publicationDate: '',
      processNumber: deadline.case ?? '',
      _noLink: true,
    });
    setIsPublicationOpen(true);
  };

  // ── Criar prazo manual ────────────────────────────────────────────────────
  const handleSubmitCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newDeadline = {
      id:          String(Date.now()),
      case:        caseSearch,
      type:        fd.get('type') as string,
      date:        fd.get('date') as string,
      status:      'PENDING',
      urgency:     fd.get('urgency') as string,
      responsible: fd.get('responsible') as string,
      notes:       fd.get('notes') as string ?? '',
      mentions:    [],
      publicationId: null,
    };
    setDeadlines(prev => [newDeadline, ...prev]);

    const responsibleUser = users.find((u: any) => u.name === newDeadline.responsible);
    if (responsibleUser && responsibleUser.id !== currentUser?.id) {
      const dateFmt = newDeadline.date
        ? new Date(newDeadline.date + 'T00:00:00').toLocaleDateString('pt-BR')
        : 'data não definida';
      addNotification(
        `Novo Prazo: ${newDeadline.type}`,
        `Você foi designado(a) como responsável pelo prazo "${newDeadline.type}" (Processo: ${newDeadline.case || 'N/A'}) com vencimento em ${dateFmt}.`,
        responsibleUser.id
      );
      sendNotificationEmail({
        to: responsibleUser.email,
        subject: `Novo Prazo: ${newDeadline.type}`,
        body: `Você foi designado(a) como responsável pelo prazo "${newDeadline.type}" (Processo: ${newDeadline.case || 'N/A'}) com vencimento em ${dateFmt}.`,
        type: 'MENTION',
      });
    }

    setIsCreateOpen(false);
    setCaseSearch('');
  };

  // ── Exportar prazos para PDF ───────────────────────────────────────────────
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const tenant = getCurrentTenant();
      const tenantName = tenant?.name ?? 'Escritório';
      await exportDeadlinesPDF(deadlines, tenantName);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Erro ao exportar PDF. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in zoom-in-95 duration-500">

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold font-serif dark:text-white">Publicações & Prazos</h2>
          <p className="text-sm text-gray-500">Gestão centralizada de intimações e prazos fatais.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigateToPublications?.()}
            className="bg-gold-800 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-navy-800 transition-all"
            title="Ir para o módulo de Publicações DJEN"
          >
            <IconNews /> Ver Publicações DJEN →
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting || deadlines.length === 0}
            className="bg-gold-800 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-navy-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2m0 0v-8m0 8H3m9-8h0m0 0h6"/></svg>
            {exporting ? 'Gerando...' : '📄 Exportar Prazos'}
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="bg-navy-800 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-navy-700 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            Cadastrar Prazo
          </button>
        </div>
      </div>

      {/* Filtro por responsável */}
      <div className="relative group max-w-md">
        <input
          type="text"
          placeholder="Filtrar por usuário responsável..."
          value={responsibleSearch}
          onChange={e => setResponsibleSearch(e.target.value)}
          className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-10 py-3 text-sm focus:ring-2 focus:ring-gold-800 outline-none dark:text-white shadow-sm transition-all"
        />
        <div className="absolute left-3 top-3.5 text-gray-400"><IconSearch /></div>
        {responsibleSearch && (
          <button onClick={() => setResponsibleSearch('')} className="absolute right-3 top-3.5 text-gray-400 hover:text-red-500 transition-colors">
            <IconX />
          </button>
        )}
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Lista de prazos ─────────────────────────────────────────────── */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50/50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-sm uppercase tracking-wider text-gray-500">Prazos em Aberto</h3>
            <span className="text-[10px] font-bold text-gray-400">
              {filteredList.filter(d => d.status === 'PENDING').length} Pendentes
            </span>
          </div>

          <div className="divide-y dark:divide-slate-700">
            {filteredList.length === 0 ? (
              <div className="p-12 text-center text-gray-400 italic text-sm">
                {responsibleSearch ? `Nenhum prazo encontrado para "${responsibleSearch}".` : 'Nenhum prazo cadastrado.'}
              </div>
            ) : filteredList.map(item => {
              const linkedPub    = getLinkedPublication(item);
              const hasPub       = !!linkedPub || (item.publicationId && item.description);
              const mentionedUsr = getMentionedUsers(item.mentions);

              return (
                <div
                  key={item.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-all ${item.status === 'DONE' ? 'opacity-50' : ''}`}
                >
                  {/* Linha principal */}
                  <div className="flex items-center justify-between gap-3">
                    {/* Toggle status */}
                    <button
                      onClick={() => toggleStatus(item.id)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all shrink-0 ${
                        item.status === 'DONE'
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-200 dark:border-slate-600 text-transparent hover:border-navy-800'
                      }`}
                    >
                      <IconCheck />
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-bold text-sm dark:text-white truncate ${item.status === 'DONE' ? 'line-through text-gray-400' : ''}`}>
                        {item.type}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-mono tracking-tighter truncate">
                        {item.case} • Vencimento: <span className="font-bold">{formatDateBR(item.date)}</span>
                      </p>

                      {/* Observações — preview */}
                      {item.notes && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                          <IconNote />
                          {item.notes.length > 80 ? item.notes.substring(0, 80) + '…' : item.notes}
                        </p>
                      )}

                      {/* Menções */}
                      {mentionedUsr.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <IconUser />
                          <div className="flex -space-x-1">
                            {mentionedUsr.map((u: any) => (
                              <span key={u.id}><Avatar name={u.name} size="xs" /></span>
                            ))}
                          </div>
                          <span className="text-[9px] text-gray-400 ml-1">
                            {mentionedUsr.map((u: any) => u.name.split(' ')[0]).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Responsável + urgência + ações */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Responsável</p>
                        <p className={`text-xs dark:text-gray-300 font-bold ${item.status === 'DONE' ? 'line-through' : ''}`}>
                          {item.responsible}
                        </p>
                      </div>

                      <UrgencyBadge urgency={item.urgency} />

                      {/* Botão: ver publicação */}
                      {(hasPub || item.description) && (
                        <button
                          onClick={() => openPublication(item)}
                          className="p-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 transition-colors"
                          title="Ver termos da publicação vinculada"
                        >
                          <IconNews />
                        </button>
                      )}

                      {/* Botão: editar */}
                      <button
                        onClick={() => openEdit(item)}
                        className="p-2 text-gray-400 hover:text-navy-800 dark:hover:text-white transition-colors"
                        title="Editar prazo"
                      >
                        <IconEdit />
                      </button>

                      {/* Botão: excluir */}
                      <button
                        onClick={() => deleteDeadline(item.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Excluir Prazo"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sidebar: Visão Crítica ───────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="bg-navy-800 p-6 rounded-2xl text-white shadow-xl">
            <h4 className="font-bold text-lg mb-2">Visão Crítica</h4>
            <p className="text-xs text-navy-300 mb-6">Prazos urgentes em aberto.</p>
            <div className="space-y-4">
              {deadlines.filter(d => d.status === 'PENDING').slice(0, 4).map(d => (
                <div key={`side-${d.id}`} className="p-3 bg-navy-700 rounded-xl border border-navy-600">
                  <p className="text-[10px] font-bold text-gold-800 uppercase mb-1">Vence {formatDateBR(d.date)}</p>
                  <p className="text-sm font-bold truncate">{d.type}</p>
                  {d.notes && (
                    <p className="text-[9px] text-navy-300 mt-1 truncate">{d.notes}</p>
                  )}
                </div>
              ))}
              {deadlines.filter(d => d.status === 'PENDING').length === 0 && (
                <p className="text-xs text-navy-400 italic text-center">Tudo em dia!</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Criar prazo
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setCaseSearch(''); }}
        title="Cadastrar Novo Prazo Processual"
      >
        <form onSubmit={handleSubmitCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            {/* Processo */}
            <div className="col-span-2 relative">
              <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-widest">
                Processo (CNJ) — Autocomplete
              </label>
              <input
                value={caseSearch}
                onChange={e => setCaseSearch(e.target.value)}
                onFocus={() => caseSearch.length > 2 && setShowSuggestions(true)}
                required
                className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm font-mono dark:text-white"
                placeholder="0000000-00.0000.0.00.0000 ou nome do cliente"
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden mt-1 animate-in fade-in duration-200">
                  <div className="max-h-48 overflow-y-auto">
                    {filteredCases.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setCaseSearch(c.cnj); setShowSuggestions(false); }}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-navy-50 dark:hover:bg-slate-700 border-b last:border-0 dark:border-slate-700 transition-colors"
                      >
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold font-mono dark:text-white truncate">{c.cnj}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold truncate">{c.clientName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tipo */}
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Tipo de Prazo / Providência</label>
              <input name="type" required className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white" placeholder="Ex: Contestação, Recurso, Manifestação..." />
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Data Limite para Cumprimento</label>
              <input name="date" type="date" required className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white" />
            </div>

            {/* Urgência */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Urgência</label>
              <select name="urgency" className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white">
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Crítica / Fatal</option>
              </select>
            </div>

            {/* Responsável */}
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Responsável</label>
              <select name="responsible" className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white">
                {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>

            {/* Observações */}
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Observações / Complementos</label>
              <textarea
                name="notes"
                rows={3}
                className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white resize-none"
                placeholder="Anotações, estratégias, pendências, links de documentos..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={() => { setIsCreateOpen(false); setCaseSearch(''); }} className="px-6 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" className="px-6 py-2 bg-navy-800 text-white rounded-lg text-sm font-bold hover:bg-gold-800 transition-all">Salvar Prazo</button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Editar prazo
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setEditingDeadline(null); }}
        title="Editar Prazo"
      >
        {editingDeadline && (
          <div className="space-y-5">

            {/* Dados do prazo */}
            <section>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 border-b dark:border-slate-700 pb-2">
                Detalhes do Prazo
              </h4>
              <div className="grid grid-cols-2 gap-4">

                {/* Tipo/Providência */}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Tipo / Providência</label>
                  <input
                    value={editType}
                    onChange={e => setEditType(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white"
                    placeholder="Ex: Contestação, Recurso, Manifestação..."
                  />
                </div>

                {/* Data Limite */}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Data Limite para Cumprimento
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white"
                  />
                  {editingDeadline?.date && editDate !== editingDeadline.date && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ O sistema havia calculado {formatDateBR(editingDeadline.date)} — você está definindo uma data diferente.
                    </p>
                  )}
                </div>

                {/* Urgência */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Urgência</label>
                  <select
                    value={editUrgency}
                    onChange={e => setEditUrgency(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white"
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">Crítica / Fatal</option>
                  </select>
                </div>

                {/* Responsável */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Responsável</label>
                  <select
                    value={editResponsible}
                    onChange={e => setEditResponsible(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white"
                  >
                    {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                </div>

                {/* Processo — somente leitura */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Processo</label>
                  <p className="text-sm font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-900/50 rounded-lg px-3 py-2 border dark:border-slate-700">
                    {editingDeadline.case ?? '—'}
                  </p>
                </div>
              </div>
            </section>

            {/* Observações */}
            <section>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 border-b dark:border-slate-700 pb-2">
                Observações &amp; Complementos
              </h4>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={5}
                className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-3 text-sm dark:text-white resize-none"
                placeholder="Anotações estratégicas, pendências, links, histórico de tratativas, orientações ao responsável..."
              />
            </section>

            {/* Menções / Marcar pessoas */}
            <section>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 border-b dark:border-slate-700 pb-2">
                Marcar Pessoas
              </h4>
              <p className="text-[10px] text-gray-500 mb-3">Pessoas marcadas recebem notificação sobre este prazo.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {users.map(u => {
                  const checked = editMentions.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        checked
                          ? 'border-navy-800 bg-navy-50 dark:bg-navy-900/40 dark:border-navy-600'
                          : 'border-gray-200 dark:border-slate-700 hover:border-navy-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setEditMentions(prev =>
                            checked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                          );
                        }}
                        className="sr-only"
                      />
                      <Avatar name={u.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold dark:text-white truncate">{u.name}</p>
                        <p className="text-[9px] text-gray-400 uppercase font-bold">{u.role}</p>
                      </div>
                      {checked && (
                        <div className="ml-auto">
                          <div className="w-4 h-4 bg-navy-800 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          </div>
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsEditOpen(false); setEditingDeadline(null); }}
                className="px-6 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="px-6 py-2 bg-navy-800 text-white rounded-lg text-sm font-bold hover:bg-gold-800 transition-all"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Termos da publicação vinculada
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isPublicationOpen}
        onClose={() => { setIsPublicationOpen(false); setViewingPub(null); }}
        title="Publicação Vinculada ao Prazo"
      >
        {viewingPub && (
          <div className="space-y-4">
            {/* Metadados */}
            <div className="flex flex-wrap gap-2">
              {viewingPub.tribunal && (
                <span className="px-3 py-1 bg-navy-100 dark:bg-navy-900/40 text-navy-800 dark:text-navy-300 rounded-full text-xs font-bold">
                  {viewingPub.tribunal}
                </span>
              )}
              {viewingPub.publicationDate && (
                <span className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-bold">
                  📅 {new Date(viewingPub.publicationDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
              {viewingPub.processNumber && (
                <span className="px-3 py-1 bg-gold-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-mono font-bold">
                  {viewingPub.processNumber}
                </span>
              )}
            </div>

            {/* Advogado */}
            {viewingPub.lawyerName && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <IconUser />
                <span className="font-bold">{viewingPub.lawyerName}</span>
                {viewingPub.lawyerOab && <span className="text-xs text-gray-400">OAB {viewingPub.lawyerOab}</span>}
              </div>
            )}

            {/* Conteúdo integral da publicação */}
            <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-700 p-4 max-h-96 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Íntegra da Publicação</p>
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                {viewingPub.content ?? viewingPub.description ?? viewingPub.summary ?? 'Conteúdo não disponível.'}
              </pre>
            </div>

            {/* Aviso quando a publicação não está mais disponível localmente */}
            {viewingPub._noLink && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                ℹ️ Esta publicação foi criada antes do vínculo automático. O conteúdo exibido é o resumo salvo no momento da criação do prazo.
              </p>
            )}

            {/* Ação: ir para publicações */}
            <div className="flex justify-end gap-3">
              {!viewingPub._noLink && onNavigateToPublications && (
                <button
                  type="button"
                  onClick={() => { setIsPublicationOpen(false); onNavigateToPublications(); }}
                  className="px-5 py-2 bg-gold-800 text-white rounded-lg text-sm font-bold hover:bg-navy-800 transition-all flex items-center gap-2"
                >
                  <IconNews /> Ver no módulo de Publicações →
                </button>
              )}
              <button
                type="button"
                onClick={() => { setIsPublicationOpen(false); setViewingPub(null); }}
                className="px-5 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default Deadlines;
