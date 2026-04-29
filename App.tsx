import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CRM from './components/CRM';
import Cases from './components/Cases';
import Tasks from './components/Tasks';
import Deadlines from './components/Deadlines';
import Finance from './components/Finance';
import PetitionGenerator from './components/PetitionGenerator';
import Chat from './components/Chat';
import Settings from './components/Settings';
import ClientPortal from './components/ClientPortal';
import Calendar from './components/Calendar';
import Publications from './components/Publications';
import Hearings from './components/Hearings';
import WhatsAppCRM from './components/WhatsAppCRM';
import StaffLogin from './components/Auth/StaffLogin';
import TenantOnboarding from './components/Auth/TenantOnboarding';
import {
  UserRole, UserStatus, CaseStatus, TransactionStatus,
  Transaction, Task, Hearing, HearingModality, HearingStatus,
  PlanType, PLAN_FEATURES, Tenant,
} from './types';
import { supabase } from './services/supabase';
import {
  usersDb, clientsDb, casesDb, transactionsDb, tasksDb,
  deadlinesDb, eventsDb, channelsDb, chatMessagesDb, notificationsDb,
  publicationsDb,
} from './services/db';
import { hearingsDb } from './services/db';
import { tenantsDb, setCurrentTenant, getCurrentTenant, getCurrentTenantId, clearCurrentTenant } from './services/tenantService';
import { authService } from './services/authService';
import { loadPermissions, canViewFinancials, allowedModules } from './services/permissionsService';
import { TenantRolePermissions } from './types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const getTodayStr = (offset = 0) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

// ─── App ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [isLoaded, setIsLoaded]         = useState(false);
  const [authState, setAuthState]       = useState<'NONE' | 'ONBOARDING' | 'STAFF' | 'CLIENT'>('NONE');
  const [currentUser, setCurrentUser]   = useState<any>(null);
  const [tenant, setTenant]             = useState<Tenant | null>(null);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isDarkMode, setIsDarkMode]     = useState(false);
  const [rolePerms, setRolePerms]       = useState<TenantRolePermissions | null>(null);

  const [users, setUsersState]           = useState<any[]>([]);
  const [clients, setClientsState]       = useState<any[]>([]);
  const [cases, setCasesState]           = useState<any[]>([]);
  const [transactions, setTransactions]  = useState<Transaction[]>([]);
  const [events, setEvents]              = useState<any[]>([]);
  const [tasks, setTasks]                = useState<Task[]>([]);
  const [deadlines, setDeadlines]        = useState<any[]>([]);
  const [channels, setChannels]          = useState<any[]>([]);
  const [chatMessages, setChatMessages]  = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [publications, setPublications]  = useState<any[]>([]);
  const [hearings, setHearings]          = useState<Hearing[]>([]);
  const [djenSyncing, setDjenSyncing]    = useState(false);
  const [djenSyncMsg, setDjenSyncMsg]    = useState<string | null>(null);
  const [unreadChatCounts, setUnreadChatCounts] = useState<Record<string, number>>({});
  const [activeChatId, setActiveChatId]  = useState<string>('');

  // ── Plano atual e features ────────────────────────────────────────────────

  const currentPlan: PlanType = (tenant?.plan ?? PlanType.ESSENCIAL) as PlanType;
  const features = PLAN_FEATURES[currentPlan];

  // ── Carregar tenant e sessão ao iniciar ──────────────────────────────────

  useEffect(() => {
    const savedTheme = localStorage.getItem('legere_theme');
    if (savedTheme === 'dark') setIsDarkMode(true);

    const init = async () => {
      // 1. Tenta restaurar sessão ativa do Supabase Auth (JWT armazenado)
      const sessionCtx = await authService.getSessionContext();
      if (sessionCtx?.success && sessionCtx.tenantId) {
        const t = await tenantsDb.getById(sessionCtx.tenantId);
        if (t) {
          setCurrentTenant(t);
          setTenant(t);
          setRolePerms(loadPermissions(t.id));
          await loadAllData();
          const dbUsers = await usersDb.getAll();
          const user = dbUsers.find((u: any) =>
            u.authId === sessionCtx.authUserId ||
            u.auth_id === sessionCtx.authUserId ||
            u.email?.toLowerCase() === (sessionCtx as any).email?.toLowerCase()
          ) ?? dbUsers.find((u: any) => u.role === UserRole.ADMIN);
          if (user) { setCurrentUser(user); setUsersState(dbUsers); setAuthState('STAFF'); }
          return;
        }
      }

      // 2. Fallback: restaurar tenant salvo no localStorage
      const savedTenant = getCurrentTenant();
      if (savedTenant) {
        setTenant(savedTenant);
        setRolePerms(loadPermissions(savedTenant.id));
        await loadAllData();
      } else {
        setIsLoaded(true);
      }
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Carregar dados do Supabase ───────────────────────────────────────────

  const loadAllData = useCallback(async () => {
    try {
      const [
        dbUsers, dbClients, dbCases, dbTransactions, dbEvents,
        dbTasks, dbDeadlines, dbChannels, dbMessages,
        dbNotifications, dbPublications, dbHearings,
      ] = await Promise.all([
        usersDb.getAll(), clientsDb.getAll(), casesDb.getAll(),
        transactionsDb.getAll(), eventsDb.getAll(), tasksDb.getAll(),
        deadlinesDb.getAll(), channelsDb.getAll(), chatMessagesDb.getAll(),
        notificationsDb.getAll(), publicationsDb.getAll(), hearingsDb.getAll(),
      ]);
      setUsersState(dbUsers);
      setClientsState(dbClients);
      setCasesState(dbCases);
      setTransactions(dbTransactions as Transaction[]);
      setEvents(dbEvents);
      setTasks(dbTasks as Task[]);
      setDeadlines(dbDeadlines);
      setChannels(dbChannels);
      setChatMessages(dbMessages);
      setNotifications(dbNotifications);
      setPublications(dbPublications);
      setHearings(dbHearings as Hearing[]);
    } catch (e) {
      console.error('[App] Falha ao carregar dados:', e);
    }
    setIsLoaded(true);
  }, []);

  // ── Notificações ─────────────────────────────────────────────────────────

  const addNotification = useCallback(async (title: string, message: string, recipientId: string) => {
    const tenantId = getCurrentTenantId();
    const n = {
      id: `n-${Date.now()}-${Math.random()}`, title, message, recipientId, tenantId,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setNotifications(prev => [n, ...prev]);
    await notificationsDb.insert(n);
  }, []);

  // ── Sync helper ──────────────────────────────────────────────────────────

  const syncUpsert = useCallback((
    prev: any[], next: any[],
    upsertFn: (item: any) => void, deleteFn: (id: string) => void
  ) => {
    const prevMap = new Map(prev.map((x: any) => [x.id, x]));
    next.forEach((x: any) => {
      const old = prevMap.get(x.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(x)) upsertFn(x);
    });
    const nextIds = new Set(next.map((x: any) => x.id));
    prev.forEach((x: any) => { if (!nextIds.has(x.id)) deleteFn(x.id); });
  }, []);

  // ── Setters com sync Supabase ─────────────────────────────────────────────

  const handleSetUsers = useCallback((updater: any) => {
    setUsersState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const prevIds = new Set(prev.map((u: any) => u.id));
      const nextIds = new Set(next.map((u: any) => u.id));
      next.forEach((u: any) => {
        if (!prevIds.has(u.id) || JSON.stringify(prev.find((p: any) => p.id === u.id)) !== JSON.stringify(u)) usersDb.upsert(u);
      });
      prev.forEach((u: any) => { if (!nextIds.has(u.id)) usersDb.delete(u.id); });
      return next;
    });
  }, []);

  const handleSetClients = useCallback((updater: any) => {
    setClientsState(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; syncUpsert(prev, next, clientsDb.upsert, clientsDb.delete); return next; });
  }, [syncUpsert]);

  const handleSetCases = useCallback((updater: any) => {
    setCasesState(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; syncUpsert(prev, next, casesDb.upsert, casesDb.delete); return next; });
  }, [syncUpsert]);

  const handleSetTransactions = useCallback((updater: any) => {
    setTransactions(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; syncUpsert(prev, next, transactionsDb.upsert, transactionsDb.delete); return next; });
  }, [syncUpsert]);

  const handleSetTasks = useCallback((updater: any) => {
    setTasks(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; syncUpsert(prev, next, tasksDb.upsert, tasksDb.delete); return next; });
  }, [syncUpsert]);

  const handleSetDeadlines = useCallback((updater: any) => {
    setDeadlines(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; syncUpsert(prev, next, deadlinesDb.upsert, deadlinesDb.delete); return next; });
  }, [syncUpsert]);

  const handleSetEvents = useCallback((updater: any) => {
    setEvents(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; syncUpsert(prev, next, eventsDb.upsert, eventsDb.delete); return next; });
  }, [syncUpsert]);

  const handleSetHearings = useCallback((updater: any) => {
    setHearings(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; syncUpsert(prev, next, hearingsDb.upsert, hearingsDb.delete); return next; });
  }, [syncUpsert]);

  const handleSetChannels = useCallback((updater: any) => {
    setChannels(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; syncUpsert(prev, next, channelsDb.upsert, channelsDb.delete); return next; });
  }, [syncUpsert]);

  const handleSetNotifications = useCallback((updater: any) => {
    setNotifications(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const prevMap = new Map(prev.map((n: any) => [n.id, n]));
      next.forEach((n: any) => { const old = prevMap.get(n.id) as any; if (old && old.read !== n.read && n.read) notificationsDb.markRead(n.id); });
      return next;
    });
  }, []);

  // ── Audiências: alertas ───────────────────────────────────────────────────

  useEffect(() => {
    if (!hearings.length || !currentUser?.id) return;
    const now = new Date();
    const updates: string[] = [];
    hearings.forEach(h => {
      if (h.status !== HearingStatus.SCHEDULED || !h.responsibleId) return;
      const hTime  = new Date(`${h.date}T${h.time || '23:59'}:00`);
      const diffMs = hTime.getTime() - now.getTime();
      if (diffMs < 0) return;
      const diffH = diffMs / (1000 * 60 * 60);
      const diffD = diffH / 24;
      const label = `Processo ${h.processNumber || 'sem número'}`;
      if (!h.notified5d && diffD <= 5) { addNotification(`⚖️ Audiência em ${Math.ceil(diffD)}d: ${h.processNumber || '—'}`, `Lembrete: audiência (${label}) em ${new Date(h.date + 'T12:00').toLocaleDateString('pt-BR')} às ${h.time || '—'}.`, h.responsibleId!); updates.push(h.id + ':5d'); }
      if (!h.notified1d && diffD <= 1)  { addNotification(`⚖️ Audiência AMANHÃ: ${h.processNumber || '—'}`, `Atenção! Audiência (${label}) é amanhã às ${h.time || '—'}.`, h.responsibleId!); updates.push(h.id + ':1d'); }
      if (!h.notified3h && diffH <= 3)  { addNotification(`⚖️ Audiência em 3h: ${h.processNumber || '—'}`, `Urgente! A audiência começa às ${h.time || '—'}.`, h.responsibleId!); updates.push(h.id + ':3h'); }
    });
    if (updates.length) {
      handleSetHearings((prev: Hearing[]) => prev.map(h => ({
        ...h,
        notified5d: h.notified5d || updates.includes(h.id + ':5d'),
        notified1d: h.notified1d || updates.includes(h.id + ':1d'),
        notified3h: h.notified3h || updates.includes(h.id + ':3h'),
      })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearings.length, currentUser?.id]);

  // ── Publicações → Processo ────────────────────────────────────────────────

  const handleRegisterCaseFromPublication = useCallback((pub: any) => {
    const text = pub.content ?? '';
    const inferArea = (t: string): string => {
      if (/trabalhist|clt|rescis/i.test(t)) return 'Trabalhista';
      if (/criminal|penal|crime/i.test(t)) return 'Criminal';
      if (/alimentos|divórcio|guarda/i.test(t)) return 'Família';
      if (/tribut|fiscal|fazenda/i.test(t)) return 'Tributário';
      if (/previdenci|inss|aposentadoria/i.test(t)) return 'Previdenciário';
      return 'Cível';
    };
    const extract = (label: RegExp) => { const m = text.match(new RegExp(label.source + '[:\\s-–]+([^\\n\\r/]{3,60})', label.flags + 'i')); return m ? m[1].trim().replace(/[.,;:]+$/, '') : ''; };
    const activePart  = extract(/autor[ae]?|exequente|requerente|impetrante|apelante/);
    const passivePart = extract(/r[eé][u|s]|executad[ao]|requerid[ao]|impetrad[ao]/);
    const title = activePart && passivePart ? `${activePart} x ${passivePart}` : activePart || passivePart || pub.processNumber || 'Processo sem título';
    const tenantId = getCurrentTenantId();
    const newCase = {
      id: `case-pub-${Date.now()}`, cnj: pub.processNumber ?? '', title,
      clientId: '', clientName: passivePart || activePart || '', area: inferArea(text),
      court: pub.tribunal ?? '', status: CaseStatus.ONGOING, lawyerId: pub.lawyerId ?? '',
      value: 0, probability: 50, risk: 'MEDIUM' as const,
      createdAt: getTodayStr(), distributionDate: pub.publicationDate ?? getTodayStr(), tenantId,
    };
    handleSetCases((prev: any[]) => [...prev, newCase]);
    if (pub.lawyerId) addNotification('📁 Processo cadastrado via DJEN', `Processo ${pub.processNumber || ''} adicionado.`, pub.lawyerId);
    setActiveModule('cases');
  }, [clients, handleSetCases, addNotification]);

  // ── Publicações → Audiência ───────────────────────────────────────────────

  const handleCreateHearingFromPublication = useCallback((pub: any) => {
    const raw = pub.content ?? '';
    let date = '', time = '';
    const m = raw.match(/para\s+o\s+dia\s+(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+[aà]s\s+(\d{1,2})[h:.](\d{2})/i);
    if (m) { date = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; time = `${m[4].padStart(2,'0')}:${m[5]}`; }
    const tenantId = getCurrentTenantId();
    const h: Hearing = {
      id: `hr-pub-${Date.now()}`, date, time, processNumber: pub.processNumber ?? '',
      parties: '', modality: HearingModality.PRESENCIAL, link: '', location: '',
      responsibleId: pub.lawyerId, responsibleName: pub.lawyerName ?? '',
      status: HearingStatus.SCHEDULED, notes: `Originada de publicação DJEN em ${pub.publicationDate ?? '—'}`,
      publicationId: pub.id, clientName: '', createdAt: new Date().toISOString(),
      notified5d: false, notified1d: false, notified3h: false, tenantId,
    };
    handleSetHearings((prev: Hearing[]) => [...prev, h]);
    if (pub.lawyerId) addNotification('⚖️ Nova Audiência via DJEN', `Audiência para ${date || 'data não identificada'}.`, pub.lawyerId);
    setActiveModule('hearings');
  }, [handleSetHearings, addNotification]);

  // ── Publicações → Prazo ───────────────────────────────────────────────────

  const handleCreateDeadlineFromPublication = useCallback((pub: any) => {
    const d = pub.publicationDate ? new Date(pub.publicationDate + 'T12:00:00') : new Date();
    d.setDate(d.getDate() + 15);
    const tenantId = getCurrentTenantId();
    const dl = {
      id: `dl-pub-${Date.now()}`, publicationId: pub.id, type: 'Prazo — Publicação DJEN',
      title: 'Prazo — Publicação DJEN', date: d.toISOString().split('T')[0],
      case: pub.processNumber || '', caseName: pub.processNumber || '', caseId: null,
      clientName: '', responsible: pub.lawyerName, responsibleId: pub.lawyerId,
      urgency: 'HIGH', priority: 'HIGH', status: 'PENDING',
      description: `Originado de publicação DJEN em ${pub.publicationDate ?? '—'}.\nTribunal: ${pub.tribunal ?? '—'}\n\n${pub.content?.substring(0, 300) ?? ''}...`,
      tenantId,
    };
    handleSetDeadlines((prev: any[]) => [...prev, dl]);
    if (pub.lawyerId) addNotification('⚖️ Prazo criado via DJEN', `Prazo 15 dias para ${pub.processNumber || 'processo sem número'}.`, pub.lawyerId);
    setActiveModule('deadlines');
  }, [handleSetDeadlines, addNotification]);

  // ── Financeiro ────────────────────────────────────────────────────────────

  const handleApproveTransaction = useCallback((txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    handleSetTransactions((prev: any[]) => prev.map(t => t.id === txId ? { ...t, status: TransactionStatus.APPROVED } : t));
    if (tx.clientId && tx.type === 'IN') {
      handleSetClients((prev: any[]) => prev.map(c => c.id === tx.clientId ? { ...c, totalPaid: (c.totalPaid || 0) + tx.amount } : c));
      addNotification('Pagamento Aprovado', `Pagamento de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)} conciliado.`, tx.clientId);
    }
  }, [transactions, handleSetTransactions, handleSetClients, addNotification]);

  const handleRejectTransaction = useCallback((txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    handleSetTransactions((prev: any[]) => prev.map(t => t.id === txId ? { ...t, status: TransactionStatus.REJECTED } : t));
    if (tx?.clientId) addNotification('Pagamento Recusado', 'Um comprovante não pôde ser validado.', tx.clientId);
  }, [transactions, handleSetTransactions, addNotification]);

  // ── Chat ──────────────────────────────────────────────────────────────────

  const processIncomingRef = useRef<(msg: any) => void>(() => {});
  const processIncoming = useCallback((msg: any) => {
    const isFromOthers    = msg.senderId !== currentUser?.id;
    const isChatNotFocused = activeModule !== 'chat' || activeChatId !== msg.chatId;
    if (isFromOthers && isChatNotFocused) setUnreadChatCounts(prev => ({ ...prev, [msg.chatId]: (prev[msg.chatId] || 0) + 1 }));
    if (isFromOthers && currentUser?.id) {
      if (msg.chatId.startsWith('dm-')) {
        const parts = msg.chatId.split('-');
        const recipId = parts[1] === msg.senderId ? parts[2] : parts[1];
        if (recipId === currentUser.id) addNotification(`Chat de ${msg.senderName}`, msg.content.substring(0, 60), currentUser.id);
      } else {
        const ch = channels.find((c: any) => c.id === msg.chatId);
        if (ch?.members.includes(currentUser.id)) addNotification(`#${ch.name}: ${msg.senderName}`, msg.content.substring(0, 60), currentUser.id);
      }
    }
  }, [currentUser, activeChatId, activeModule, channels, addNotification]);
  useEffect(() => { processIncomingRef.current = processIncoming; });

  const handleNewChatMessage = useCallback(async (msg: any) => {
    setChatMessages(prev => [...prev, msg]);
    processIncomingRef.current(msg);
    await chatMessagesDb.insert({ ...msg, tenantId: getCurrentTenantId() });
  }, []);

  // ── Real-time Supabase ────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser?.id) return;
    const ch = supabase.channel(`chat-rt-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        const r = payload.new;
        if (r.sender_id === currentUser.id || r.tenant_id !== getCurrentTenantId()) return;
        const incoming = { id: r.id, senderId: r.sender_id, senderName: r.sender_name, content: r.content, time: r.time, chatId: r.chat_id };
        setChatMessages(prev => prev.some(m => String(m.id) === String(incoming.id)) ? prev : [...prev, incoming]);
        processIncomingRef.current(incoming);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUser?.id]);

  // ── Chat unread ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeModule === 'chat' && activeChatId && unreadChatCounts[activeChatId]) {
      setUnreadChatCounts(prev => { const n = { ...prev }; delete n[activeChatId]; return n; });
    }
  }, [activeChatId, activeModule, unreadChatCounts]);

  const totalUnreadChat = useMemo(() => Object.values(unreadChatCounts).reduce((a, b) => a + (b as number), 0), [unreadChatCounts]);
  const unreadPubs = useMemo(() => publications.filter((p: any) => p.status === 'unread' && p.lawyerId === currentUser?.id).length, [publications, currentUser]);

  // ── DJEN sync ─────────────────────────────────────────────────────────────

  const handleDjenSync = useCallback(async () => {
    if (!features.djenAutoSync) { alert('A sincronização automática DJEN está disponível a partir do Plano Profissional.'); return; }
    if (djenSyncing) return;
    setDjenSyncing(true); setDjenSyncMsg(null);
    try {
      const { syncDjenPublications } = await import('./services/djenScraper');
      const cnjs = cases.map((c: any) => c.cnj).filter(Boolean);
      const result = await syncDjenPublications(cnjs);
      setDjenSyncMsg(result.novas > 0 ? `✅ ${result.novas} nova(s) publicação(ões)!` : `✅ ${result.message}`);
      const fresh = await publicationsDb.getAll();
      setPublications(fresh);
    } catch (e: any) { setDjenSyncMsg(`❌ Erro: ${e?.message ?? e}`); }
    setDjenSyncing(false);
  }, [djenSyncing, cases, features.djenAutoSync]);

  // ── Onboarding: registrar novo escritório ─────────────────────────────────

  const handleOnboardingComplete = useCallback(async (data: any) => {
    const adminEmail = data.adminEmail || data.email;

    // Cria tenant
    const newTenant = await tenantsDb.create({
      name: data.firmName,
      slogan: data.slogan || undefined,
      cnpj: data.cnpj, phone: data.phone,
      email: data.email, plan: data.plan, active: true,
    });
    if (!newTenant) { alert('Erro ao criar escritório. Tente novamente.'); return; }

    setCurrentTenant(newTenant);
    setTenant(newTenant);
    setRolePerms(loadPermissions(newTenant.id));

    // Tenta criar o admin via Supabase Auth (seguro: bcrypt + JWT)
    const authResult = await authService.signUpAdmin({
      email: adminEmail,
      password: data.adminPassword,
      tenantId: newTenant.id,
      name: data.adminName,
      oabNumber: data.oabNumber,
      oabState: data.oabState,
    });

    let adminUser: any;

    if (!authResult.fallback && authResult.success) {
      // Supabase criou o auth user; o trigger handle_new_auth_user() criará
      // automaticamente a linha em public.users — aguarda propagação
      await new Promise(r => setTimeout(r, 800));
      const dbUsers = await usersDb.getAll();
      adminUser = dbUsers.find((u: any) => u.email?.toLowerCase() === adminEmail.toLowerCase());
    }

    if (!adminUser) {
      // Fallback local (sem Supabase configurado ou erro no trigger)
      adminUser = {
        id: `u-${Date.now()}`, name: data.adminName, email: adminEmail,
        role: UserRole.ADMIN, status: UserStatus.APPROVED,
        password: data.adminPassword, monthlyGoal: 0,
        oabNumber: data.oabNumber || null, oabState: data.oabState || null,
        tenantId: newTenant.id,
      };
      await usersDb.upsert(adminUser);
    }

    // Cria canal "Geral" padrão
    const geral = { id: `ch-${newTenant.id}-geral`, name: 'Geral', members: [adminUser.id], type: 'CHANNEL', tenantId: newTenant.id };
    await channelsDb.upsert(geral);

    setUsersState([adminUser]);
    setChannels([geral]);
    setCurrentUser(adminUser);
    setAuthState('STAFF');
    await loadAllData();
  }, [loadAllData]);

  // ── Login ─────────────────────────────────────────────────────────────────

  const handleLogin = useCallback(async (email: string, pass: string) => {
    // 1. Autentica via Supabase Auth (bcrypt + JWT)
    const authResult = await authService.signIn(email, pass);

    if (!authResult.fallback && !authResult.success) {
      alert(authResult.error || 'Credenciais inválidas. Verifique e-mail e senha.');
      return;
    }

    // 2. Resolve tenant
    let activeTenant = tenant;
    if (!activeTenant) {
      const tenantId = authResult.tenantId;
      if (tenantId) {
        const t = await tenantsDb.getById(tenantId);
        if (t) { setCurrentTenant(t); activeTenant = t; setTenant(t); setRolePerms(loadPermissions(t.id)); }
      }
      if (!activeTenant) {
        // Fallback: busca pelo e-mail (modo localStorage)
        const t = await tenantsDb.getByEmail(email);
        if (t) { setCurrentTenant(t); activeTenant = t; setTenant(t); setRolePerms(loadPermissions(t.id)); }
      }
    }

    // 3. Carrega usuários e encontra o perfil correto
    const dbUsers = await usersDb.getAll();
    let user: any;

    if (authResult.success && authResult.authUserId) {
      // Modo Supabase: localiza pelo auth_id
      user = dbUsers.find((u: any) =>
        u.authId === authResult.authUserId || u.auth_id === authResult.authUserId
      );
      // Fallback por e-mail (trigger pode ter leve atraso)
      if (!user) user = dbUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    } else {
      // Modo localStorage: valida senha manualmente
      const candidate = dbUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (candidate && candidate.password === pass) user = candidate;
    }

    if (user && user.status === UserStatus.APPROVED) {
      setCurrentUser(user);
      setAuthState('STAFF');
      setUsersState(dbUsers);
      await loadAllData();
    } else if (user?.status === UserStatus.PENDING) {
      alert('Sua conta ainda está aguardando aprovação pelo administrador.');
    } else {
      alert('Credenciais inválidas. Verifique e-mail e senha.');
    }
  }, [tenant, loadAllData]);

  const handleSignUp = useCallback(async (name: string, email: string, role: UserRole, pass: string, oabNumber?: string, oabState?: string) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) { alert('Escritório não identificado. Use o link de convite do seu escritório.'); return; }

    // Tenta criar via Supabase Auth (o trigger criará public.users com status PENDING)
    const authResult = await authService.signUpStaff({
      email, password: pass, tenantId, name, role, oabNumber, oabState,
    });

    if (!authResult.fallback && !authResult.success) {
      alert(authResult.error || 'Erro ao criar conta. Tente novamente.');
      return;
    }

    if (authResult.fallback) {
      // Sem Supabase: cria localmente com senha
      const newUser = {
        id: `u-${Date.now()}`, name, email, role,
        status: UserStatus.PENDING, password: pass, monthlyGoal: 0,
        oabNumber: oabNumber || null, oabState: oabState || null, tenantId,
      };
      await usersDb.upsert(newUser);
    }

    alert('Solicitação enviada! Aguarde aprovação do administrador.');
  }, []);

  const handleClientLogin = useCallback((doc: string) => {
    const client = clients.find((c: any) => c.document.replace(/\D/g, '') === doc.replace(/\D/g, ''));
    if (client) { setCurrentUser(client); setAuthState('CLIENT'); }
    else alert('Documento não localizado. Verifique com o escritório.');
  }, [clients]);

  const handleLogout = useCallback(async () => {
    await authService.signOut();
    setAuthState('NONE');
    setCurrentUser(null);
  }, []);

  // ── Permissões derivadas do perfil do usuário logado ──────────────────────

  const activePerms = rolePerms && currentUser?.role
    ? rolePerms
    : null;

  const hideAmounts: boolean = activePerms && currentUser?.role
    ? !canViewFinancials(activePerms, currentUser.role as UserRole)
    : false;

  const allowedMods: string[] = activePerms && currentUser?.role
    ? allowedModules(activePerms, currentUser.role as UserRole)
    : [];

  // ── Loading ───────────────────────────────────────────────────────────────

  if (!isLoaded) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Carregando Legere...</p>
      </div>
    </div>
  );

  // ── Onboarding ────────────────────────────────────────────────────────────

  if (authState === 'ONBOARDING') return (
    <TenantOnboarding onComplete={handleOnboardingComplete} onBack={() => setAuthState('NONE')} />
  );

  // ── Login ─────────────────────────────────────────────────────────────────

  if (authState === 'NONE') return (
    <div className={`min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-slate-900 ${isDarkMode ? 'dark' : ''}`}>
      <StaffLogin
        onLogin={handleLogin}
        onSignUp={handleSignUp}
        onClientLogin={handleClientLogin}
        onRegisterFirm={() => setAuthState('ONBOARDING')}
      />
    </div>
  );

  // ── App principal ─────────────────────────────────────────────────────────

  return (
    <Layout
      activeModule={activeModule} setActiveModule={setActiveModule}
      isDarkMode={isDarkMode}
      toggleDarkMode={() => setIsDarkMode(d => { localStorage.setItem('legere_theme', !d ? 'dark' : 'light'); return !d; })}
      userRole={currentUser.role} userName={currentUser.name} userId={currentUser.id}
      onLogout={handleLogout}
      notifications={notifications} setNotifications={handleSetNotifications}
      unreadPublications={unreadPubs} djenSyncing={djenSyncing}
      tenant={tenant}
      totalUnreadChat={totalUnreadChat}
      allData={{ clients, cases, tasks, deadlines, transactions, events }}
      showWhatsAppCRM={features.whatsappIntegration}
      allowedModules={allowedMods.length > 0 ? allowedMods : undefined}
    >
      {authState === 'CLIENT' ? (
        <ClientPortal
          client={currentUser}
          clientCases={cases.filter((c: any) => c.clientId === currentUser.id)}
          onLogout={handleLogout}
          onUpdateClient={(upd: any) => handleSetClients((prev: any[]) => prev.map(c => c.id === upd.id ? upd : c))}
          onReportPayment={(amt: number, dat: string, nam: string) => {
            const tenantId = getCurrentTenantId();
            const tx = { id: `tx-${Date.now()}`, description: 'Pgto Portal', amount: amt, type: 'IN', category: 'Honorários', date: getTodayStr(), status: TransactionStatus.PENDING, hasAttachment: !!dat, attachmentData: dat, attachmentName: nam, clientId: currentUser.id, clientName: currentUser.name, tenantId };
            handleSetTransactions((prev: any[]) => [...prev, tx]);
          }}
          allTransactions={transactions}
        />
      ) : (
        <>
          {activeModule === 'dashboard'    && <Dashboard currentUser={currentUser} transactions={transactions} cases={cases} tasks={tasks} users={users} deadlines={deadlines} events={events} isDarkMode={isDarkMode} clients={clients} totalUnreadChat={totalUnreadChat} hideAmounts={hideAmounts} tenantSlogan={tenant?.slogan} />}
          {activeModule === 'crm'          && <CRM clients={clients} setClients={handleSetClients} currentUser={currentUser} />}
          {activeModule === 'cases'        && <Cases cases={cases} setCases={handleSetCases} clients={clients} users={users} />}
          {activeModule === 'tasks'        && <Tasks users={users} clients={clients} cases={cases} tasks={tasks} setTasks={handleSetTasks} currentUser={currentUser} addNotification={addNotification} onNewComment={() => {}} />}
          {activeModule === 'deadlines'    && <Deadlines users={users} clients={clients} cases={cases} deadlines={deadlines} setDeadlines={handleSetDeadlines} currentUser={currentUser} addNotification={addNotification} onNavigateToPublications={() => setActiveModule('publications')} publications={publications} />}
          {activeModule === 'finance'      && <Finance transactions={transactions} setTransactions={handleSetTransactions} users={users} cases={cases} onApprove={handleApproveTransaction} onReject={handleRejectTransaction} hideAmounts={hideAmounts} />}
          {activeModule === 'ia'           && (features.aiPetitionGenerator
            ? <PetitionGenerator clients={clients} cases={cases} />
            : <div className="flex items-center justify-center h-64"><div className="text-center p-8 bg-white dark:bg-slate-800 rounded-[2rem] border dark:border-slate-700 shadow-sm max-w-md"><p className="text-4xl mb-4">🔒</p><h3 className="text-xl font-bold dark:text-white mb-2">IA Jurídica</h3><p className="text-gray-500 mb-4">Disponível a partir do <strong>Plano Profissional</strong>.</p><button onClick={() => setActiveModule('settings')} className="bg-gold-800 text-white px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-navy-800 transition-all">Ver Planos</button></div></div>
          )}
          {activeModule === 'chat'         && <Chat users={users} currentUser={currentUser} channels={channels} setChannels={handleSetChannels} chatMessages={chatMessages} setChatMessages={setChatMessages} onNewMessage={handleNewChatMessage} addNotification={addNotification} unreadChatCounts={unreadChatCounts} activeChatId={activeChatId} setActiveChatId={setActiveChatId} />}
          {activeModule === 'calendar'     && <Calendar users={users} currentUser={currentUser} clients={clients} cases={cases} events={events} setEvents={handleSetEvents} setUsers={handleSetUsers} addNotification={addNotification} />}
          {activeModule === 'publications' && (features.djenAutoSync
            ? <Publications publications={publications} setPublications={setPublications} currentUser={currentUser} users={users} cases={cases} addNotification={addNotification} onCreateDeadline={handleCreateDeadlineFromPublication} onCreateHearing={handleCreateHearingFromPublication} onRegisterCase={handleRegisterCaseFromPublication} onSync={handleDjenSync} syncing={djenSyncing} syncMsg={djenSyncMsg} />
            : <Publications publications={publications} setPublications={setPublications} currentUser={currentUser} users={users} cases={cases} addNotification={addNotification} onCreateDeadline={handleCreateDeadlineFromPublication} onCreateHearing={handleCreateHearingFromPublication} onRegisterCase={handleRegisterCaseFromPublication} onSync={handleDjenSync} syncing={djenSyncing} syncMsg={"🔒 Sincronização automática disponível no Plano Profissional. Cadastros manuais ainda são possíveis."} />
          )}
          {activeModule === 'hearings'     && <Hearings hearings={hearings} setHearings={handleSetHearings} users={users} cases={cases} currentUser={currentUser} addNotification={addNotification} />}
          {activeModule === 'whatsapp_crm' && (features.whatsappIntegration
            ? <WhatsAppCRM />
            : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:16, color:'#6b7280' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <p style={{ fontSize:18, fontWeight:700, color:'#374151', margin:0 }}>CRM WhatsApp — exclusivo Enterprise</p>
                <p style={{ fontSize:14, color:'#9ca3af', margin:0 }}>Faça upgrade para o plano Enterprise para acessar o CRM integrado de WhatsApp e Instagram.</p>
                <button onClick={() => setActiveModule('settings')} style={{ padding:'10px 24px', background:'#3b82f6', color:'white', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:14 }}>
                  Ver Planos → Configurações
                </button>
              </div>
          )}
          {activeModule === 'settings'     && <Settings users={users} setUsers={handleSetUsers} clients={clients} currentUser={currentUser} tenant={tenant} onTenantUpdate={(updated) => { setTenant(updated); setCurrentTenant(updated); }} resetDatabase={() => { localStorage.clear(); window.location.reload(); }} />}
        </>
      )}
    </Layout>
  );
};

export default App;
