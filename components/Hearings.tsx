
import React, { useState, useMemo } from 'react';
import { Hearing, HearingModality, HearingStatus, User, Case } from '../types';
import Modal from './Modal';
import { getCurrentTenantId, getCurrentTenant } from '../services/tenantService';
import { exportHearingsPDF } from '../services/exportService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface HearingsProps {
  hearings: Hearing[];
  setHearings: React.Dispatch<React.SetStateAction<Hearing[]>>;
  users: User[];
  cases: Case[];
  currentUser: any;
  addNotification: (title: string, message: string, recipientId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
};

const fmtDateTime = (date: string, time: string) => {
  const d = fmtDate(date);
  return time ? `${d} às ${time}` : d;
};

const daysUntil = (date: string, time?: string): number => {
  const target = new Date(`${date}T${time || '23:59'}:00`);
  const now = new Date();
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
};

const urgencyClass = (days: number) => {
  if (days < 0) return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
  if (days <= 1) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if (days <= 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
  if (days <= 7) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
  return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
};

const statusLabel: Record<HearingStatus, { label: string; cls: string }> = {
  SCHEDULED:  { label: 'Agendada',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  COMPLETED:  { label: 'Realizada',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  CANCELLED:  { label: 'Cancelada',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  POSTPONED:  { label: 'Adiada',     cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
};

// ─── Ícones inline ────────────────────────────────────────────────────────────

const IconGavel = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m14 13-7.5 7.5a1.93 1.93 0 0 1-2.7-2.7L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/>
    <path d="m9 7 8 8"/><path d="m21 11-8-8"/>
  </svg>
);
const IconVideo = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m22 8-6 4 6 4V8z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
  </svg>
);
const IconMapPin = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconClock = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconUser = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconPlus = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 5v14M5 12h14"/>
  </svg>
);
const IconEdit = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconTrash = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/>
    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
  </svg>
);
const IconLink = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);
const IconNewspaper = (p: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
    <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>
  </svg>
);

// ─── Formulário em branco ─────────────────────────────────────────────────────

const blankForm = (): Partial<Hearing> => ({
  date: '',
  time: '',
  processNumber: '',
  parties: '',
  modality: HearingModality.PRESENCIAL,
  link: '',
  location: '',
  responsibleName: '',
  responsibleId: undefined,
  status: HearingStatus.SCHEDULED,
  notes: '',
  caseId: undefined,
  clientName: '',
});

// ─── Componente principal ─────────────────────────────────────────────────────

const Hearings: React.FC<HearingsProps> = ({
  hearings,
  setHearings,
  users,
  cases,
  currentUser,
  addNotification,
}) => {
  const [isFormOpen,    setIsFormOpen]    = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [viewItem,      setViewItem]      = useState<Hearing | null>(null);
  const [form,          setForm]          = useState<Partial<Hearing>>(blankForm());
  const [filterStatus,  setFilterStatus]  = useState<string>('all');
  const [filterModal,   setFilterModal]   = useState<string>('all');
  const [search,        setSearch]        = useState('');
  const [caseSearch,    setCaseSearch]    = useState('');
  const [showCaseSug,   setShowCaseSug]   = useState(false);
  const [exporting,     setExporting]     = useState(false);

  // ── Filtered / sorted list ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return hearings
      .filter(h => {
        if (filterStatus !== 'all' && h.status !== filterStatus) return false;
        if (filterModal  !== 'all' && h.modality !== filterModal) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !h.processNumber?.toLowerCase().includes(q) &&
            !h.parties?.toLowerCase().includes(q) &&
            !h.responsibleName?.toLowerCase().includes(q) &&
            !h.clientName?.toLowerCase().includes(q)
          ) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = new Date(`${a.date}T${a.time || '00:00'}:00`).getTime();
        const db = new Date(`${b.date}T${b.time || '00:00'}:00`).getTime();
        return da - db;
      });
  }, [hearings, filterStatus, filterModal, search]);

  const upcoming = filtered.filter(h => h.status === HearingStatus.SCHEDULED && daysUntil(h.date, h.time) >= 0);
  const past     = filtered.filter(h => h.status !== HearingStatus.SCHEDULED || daysUntil(h.date, h.time) < 0);

  // ── Abrir formulário ────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(blankForm());
    setCaseSearch('');
    setIsFormOpen(true);
  };

  const openEdit = (h: Hearing) => {
    setEditingId(h.id);
    setForm({ ...h });
    setCaseSearch(h.processNumber || '');
    setViewItem(null);
    setIsFormOpen(true);
  };

  // ── Salvar ──────────────────────────────────────────────────────────────────
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();

    if (editingId) {
      // Notifica novo responsável se foi alterado
      const prev = hearings.find(h => h.id === editingId);
      if (prev && form.responsibleId && form.responsibleId !== prev.responsibleId && form.responsibleId !== currentUser.id) {
        addNotification(
          `⚖️ Audiência atribuída: ${form.processNumber || 'Processo não informado'}`,
          `Você foi designado(a) responsável pela audiência do dia ${fmtDateTime(form.date ?? '', form.time ?? '')}.`,
          form.responsibleId
        );
      }
      setHearings(prev => prev.map(h => h.id === editingId ? { ...h, ...form } as Hearing : h));
    } else {
      const newHearing: Hearing = {
        id: `hr-${Date.now()}`,
        date: form.date ?? '',
        time: form.time ?? '',
        processNumber: form.processNumber ?? '',
        parties: form.parties ?? '',
        modality: form.modality ?? HearingModality.PRESENCIAL,
        link: form.link ?? '',
        location: form.location ?? '',
        responsibleId: form.responsibleId,
        responsibleName: form.responsibleName ?? '',
        status: HearingStatus.SCHEDULED,
        notes: form.notes ?? '',
        caseId: form.caseId,
        clientName: form.clientName ?? '',
        notified5d: false,
        notified1d: false,
        notified3h: false,
        createdAt: now,
        tenantId: getCurrentTenantId(),
      };
      setHearings(prev => [...prev, newHearing]);

      // Notifica o responsável ao criar
      if (newHearing.responsibleId && newHearing.responsibleId !== currentUser.id) {
        addNotification(
          `⚖️ Nova Audiência: ${newHearing.processNumber || 'Processo não informado'}`,
          `Você foi designado(a) responsável pela audiência do dia ${fmtDateTime(newHearing.date, newHearing.time)}.`,
          newHearing.responsibleId
        );
      }
    }

    setIsFormOpen(false);
  };

  // ── Excluir ─────────────────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    if (confirm('Deseja excluir esta audiência?')) {
      setHearings(prev => prev.filter(h => h.id !== id));
      if (viewItem?.id === id) setViewItem(null);
    }
  };

  // ── Alterar status ──────────────────────────────────────────────────────────
  const changeStatus = (id: string, status: HearingStatus) => {
    setHearings(prev => prev.map(h => h.id === id ? { ...h, status } : h));
    if (viewItem?.id === id) setViewItem(prev => prev ? { ...prev, status } : prev);
  };

  // ── Filtro de processo com autocomplete ─────────────────────────────────────
  const filteredCases = useMemo(() => {
    if (caseSearch.length < 3) return [];
    return cases.filter(c =>
      c.cnj?.includes(caseSearch) ||
      c.clientName?.toLowerCase().includes(caseSearch.toLowerCase())
    );
  }, [caseSearch, cases]);

  const selectCase = (c: Case) => {
    setForm(prev => ({
      ...prev,
      processNumber: c.cnj,
      clientName: c.clientName,
      caseId: c.id,
    }));
    setCaseSearch(c.cnj);
    setShowCaseSug(false);
  };

  // ── Responsável onChange ────────────────────────────────────────────────────
  const setResponsible = (name: string) => {
    const u = users.find(u => u.name === name);
    setForm(prev => ({ ...prev, responsibleName: name, responsibleId: u?.id }));
  };

  // ── Renderização de card ────────────────────────────────────────────────────
  const HearingCard = ({ h }: { h: Hearing }) => {
    const days = daysUntil(h.date, h.time);
    const isPast = h.status !== HearingStatus.SCHEDULED || days < 0;
    const sl = statusLabel[h.status] ?? statusLabel.SCHEDULED;

    return (
      <div
        onClick={() => setViewItem(h)}
        className={`bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border cursor-pointer hover:shadow-md transition-all group
          ${isPast ? 'border-gray-100 dark:border-slate-700 opacity-70' : 'border-gray-100 dark:border-slate-700 hover:border-gold-300 dark:hover:border-gold-700'}`}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${sl.cls}`}>{sl.label}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
              ${h.modality === HearingModality.VIDEOCONFERENCIA
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'}`}>
              {h.modality === HearingModality.VIDEOCONFERENCIA ? 'Videoconferência' : 'Presencial'}
            </span>
            {h.publicationId && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center gap-1">
                <IconNewspaper className="w-3 h-3" /> DJEN
              </span>
            )}
          </div>
          {!isPast && h.status === HearingStatus.SCHEDULED && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${urgencyClass(days)}`}>
              {days < 1 ? `${Math.round(days * 24)}h` : `${Math.floor(days)}d`}
            </span>
          )}
        </div>

        {/* Data e hora */}
        <div className="flex items-center gap-2 mb-2">
          <IconClock className="w-4 h-4 text-gold-800 shrink-0" />
          <span className="text-sm font-bold text-gray-800 dark:text-white">
            {fmtDateTime(h.date, h.time)}
          </span>
        </div>

        {/* Processo */}
        {h.processNumber && (
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-1 truncate">
            {h.processNumber}
          </p>
        )}

        {/* Partes */}
        {h.parties && (
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{h.parties}</p>
        )}

        {/* Rodapé */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-slate-700/50">
          <div className="flex items-center gap-1.5">
            {h.modality === HearingModality.VIDEOCONFERENCIA
              ? <IconVideo className="w-3.5 h-3.5 text-purple-500" />
              : <IconMapPin className="w-3.5 h-3.5 text-teal-500" />}
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
              {h.modality === HearingModality.VIDEOCONFERENCIA
                ? (h.link ? 'Link disponível' : 'Sem link')
                : (h.location || '—')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <IconUser className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[100px]">{h.responsibleName || '—'}</span>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col space-y-6 animate-in slide-in-from-right duration-500">

      {/* Cabeçalho */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif dark:text-white flex items-center gap-3">
            <IconGavel className="w-7 h-7 text-gold-800" />
            Audiências
          </h2>
          <p className="text-sm text-gray-500">Gerencie e acompanhe todas as audiências do escritório.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-navy-800 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-gold-800 transition-all"
        >
          <IconPlus className="w-4 h-4" />
          Nova Audiência
        </button>
        <button
          onClick={async () => {
            setExporting(true);
            try { await exportHearingsPDF(hearings, users, getCurrentTenant()?.name ?? 'Legere'); }
            finally { setExporting(false); }
          }}
          disabled={exporting || hearings.length === 0}
          className="bg-white dark:bg-slate-800 border dark:border-slate-700 text-navy-800 dark:text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          {exporting ? 'Gerando...' : 'Exportar PDF'}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar processo, partes, advogado..."
          className="flex-1 min-w-[200px] bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-800 dark:text-white"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:text-white outline-none"
        >
          <option value="all">Todos os status</option>
          <option value="SCHEDULED">Agendadas</option>
          <option value="COMPLETED">Realizadas</option>
          <option value="POSTPONED">Adiadas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
        <select
          value={filterModal}
          onChange={e => setFilterModal(e.target.value)}
          className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:text-white outline-none"
        >
          <option value="all">Todas as modalidades</option>
          <option value="PRESENCIAL">Presencial</option>
          <option value="VIDEOCONFERENCIA">Videoconferência</option>
        </select>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Esta semana',   value: hearings.filter(h => h.status === 'SCHEDULED' && daysUntil(h.date, h.time) >= 0 && daysUntil(h.date, h.time) <= 7).length, color: 'text-blue-600' },
          { label: 'Agendadas',     value: hearings.filter(h => h.status === 'SCHEDULED').length, color: 'text-gold-800' },
          { label: 'Realizadas',    value: hearings.filter(h => h.status === 'COMPLETED').length, color: 'text-green-600' },
          { label: 'Videoconf.',    value: hearings.filter(h => h.modality === 'VIDEOCONFERENCIA' && h.status === 'SCHEDULED').length, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border dark:border-slate-700 shadow-sm">
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista principal */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-4">
        {/* Próximas */}
        {upcoming.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-navy-800 dark:text-gold-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Próximas Audiências ({upcoming.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {upcoming.map(h => <React.Fragment key={h.id}><HearingCard h={h} /></React.Fragment>)}
            </div>
          </div>
        )}

        {/* Passadas / outros status */}
        {past.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">
              Histórico ({past.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {past.map(h => <React.Fragment key={h.id}><HearingCard h={h} /></React.Fragment>)}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-300 dark:text-gray-600">
            <IconGavel className="w-16 h-16 mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhuma audiência encontrada</p>
            <p className="text-xs mt-1">Crie uma audiência ou ajuste os filtros.</p>
          </div>
        )}
      </div>

      {/* ── Modal de detalhes ─────────────────────────────────────────────────── */}
      <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="Detalhes da Audiência">
        {viewItem && (
          <div className="space-y-6">
            {/* Status + badges */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${statusLabel[viewItem.status]?.cls}`}>
                {statusLabel[viewItem.status]?.label}
              </span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase
                ${viewItem.modality === HearingModality.VIDEOCONFERENCIA
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-teal-100 text-teal-700'}`}>
                {viewItem.modality === HearingModality.VIDEOCONFERENCIA ? 'Videoconferência' : 'Presencial'}
              </span>
              {viewItem.publicationId && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                  <IconNewspaper className="w-3 h-3" /> Origem DJEN
                </span>
              )}
            </div>

            {/* Informações principais */}
            <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl p-5 space-y-4 border dark:border-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Data e Horário</p>
                  <p className="text-sm font-bold dark:text-white">{fmtDateTime(viewItem.date, viewItem.time)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Processo</p>
                  <p className="text-sm font-mono dark:text-white">{viewItem.processNumber || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Partes</p>
                  <p className="text-sm dark:text-white">{viewItem.parties || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Responsável</p>
                  <p className="text-sm dark:text-white">{viewItem.responsibleName || '—'}</p>
                </div>
                {viewItem.clientName && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Cliente</p>
                    <p className="text-sm dark:text-white">{viewItem.clientName}</p>
                  </div>
                )}
              </div>

              {/* Local / Link */}
              {viewItem.modality === HearingModality.VIDEOCONFERENCIA && viewItem.link && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Link</p>
                  <a href={viewItem.link} target="_blank" rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1.5 break-all">
                    <IconLink className="w-4 h-4 shrink-0" />
                    {viewItem.link}
                  </a>
                </div>
              )}
              {viewItem.modality === HearingModality.PRESENCIAL && viewItem.location && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Local</p>
                  <p className="text-sm dark:text-white flex items-center gap-1.5">
                    <IconMapPin className="w-4 h-4 text-teal-500 shrink-0" />
                    {viewItem.location}
                  </p>
                </div>
              )}

              {/* Observações */}
              {viewItem.notes && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Observações</p>
                  <p className="text-sm dark:text-white whitespace-pre-wrap leading-relaxed">{viewItem.notes}</p>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => openEdit(viewItem)}
                className="flex items-center gap-2 px-4 py-2 bg-navy-800 text-white rounded-xl text-sm font-bold hover:bg-gold-800 transition-all">
                <IconEdit className="w-4 h-4" /> Editar
              </button>
              {viewItem.status === HearingStatus.SCHEDULED && (<>
                <button onClick={() => changeStatus(viewItem.id, HearingStatus.COMPLETED)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all">
                  ✓ Marcar como Realizada
                </button>
                <button onClick={() => changeStatus(viewItem.id, HearingStatus.POSTPONED)}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl text-sm font-bold hover:bg-yellow-600 transition-all">
                  Adiada
                </button>
                <button onClick={() => changeStatus(viewItem.id, HearingStatus.CANCELLED)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all">
                  Cancelar
                </button>
              </>)}
              <button onClick={() => handleDelete(viewItem.id)}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-red-500 rounded-xl text-sm font-bold hover:bg-red-50 transition-all">
                <IconTrash className="w-4 h-4" /> Excluir
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal de criação / edição ─────────────────────────────────────────── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? 'Editar Audiência' : 'Nova Audiência'}
      >
        <form onSubmit={handleSave} className="space-y-5">
          {/* Processo */}
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Processo (CNJ)</label>
            <input
              value={caseSearch}
              onChange={e => { setCaseSearch(e.target.value); setForm(p => ({ ...p, processNumber: e.target.value })); setShowCaseSug(true); }}
              onBlur={() => setTimeout(() => setShowCaseSug(false), 200)}
              placeholder="0000000-00.0000.0.00.0000 ou nome do cliente"
              className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm font-mono dark:text-white focus:ring-2 focus:ring-gold-800 outline-none"
            />
            {showCaseSug && filteredCases.length > 0 && (
              <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-800 border rounded-xl shadow-2xl z-50 mt-1 overflow-hidden">
                {filteredCases.map(c => (
                  <button key={c.id} type="button" onMouseDown={() => selectCase(c)}
                    className="w-full flex flex-col p-3 text-left hover:bg-navy-50 dark:hover:bg-slate-700 border-b last:border-0 transition-colors">
                    <span className="text-xs font-bold font-mono dark:text-white">{c.cnj}</span>
                    <span className="text-[10px] text-gray-500">{c.clientName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Partes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Partes</label>
            <input
              value={form.parties ?? ''}
              onChange={e => setForm(p => ({ ...p, parties: e.target.value }))}
              placeholder="Ex.: João da Silva x Empresa XYZ"
              className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none"
            />
          </div>

          {/* Data e hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Data *</label>
              <input required type="date"
                value={form.date ?? ''}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Horário</label>
              <input type="time"
                value={form.time ?? ''}
                onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white"
              />
            </div>
          </div>

          {/* Modalidade */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Modalidade</label>
            <div className="flex gap-3">
              {[
                { val: HearingModality.PRESENCIAL,       label: 'Presencial',       color: 'teal' },
                { val: HearingModality.VIDEOCONFERENCIA, label: 'Videoconferência', color: 'purple' },
              ].map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => setForm(p => ({ ...p, modality: opt.val }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all
                    ${form.modality === opt.val
                      ? opt.color === 'teal'
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Link / Local */}
          {form.modality === HearingModality.VIDEOCONFERENCIA ? (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Link da Videoconferência</label>
              <input
                value={form.link ?? ''}
                onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
                placeholder="https://meet.google.com/..."
                type="url"
                className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Local / Sala / Vara</label>
              <input
                value={form.location ?? ''}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="Ex.: 3ª Vara Cível — Sala 204"
                className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none"
              />
            </div>
          )}

          {/* Responsável */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Profissional Responsável</label>
            <select
              value={form.responsibleName ?? ''}
              onChange={e => setResponsible(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white"
            >
              <option value="">— Selecione —</option>
              {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Observações</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3}
              placeholder="Notas adicionais sobre a audiência..."
              className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white resize-none focus:ring-2 focus:ring-gold-800 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsFormOpen(false)}
              className="px-6 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all">
              Cancelar
            </button>
            <button type="submit"
              className="px-8 py-2 bg-navy-800 text-white rounded-lg text-sm font-bold hover:bg-gold-800 shadow-lg transition-all">
              {editingId ? 'Salvar Alterações' : 'Criar Audiência'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Hearings;
