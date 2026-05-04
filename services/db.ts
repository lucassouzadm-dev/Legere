/**
 * Legere SaaS — Camada de acesso a dados (Supabase)
 * Todas as operações são filtradas por tenant_id para isolamento total dos dados.
 */
import { supabase } from './supabase';
import { getCurrentTenantId } from './tenantService';

function tid() { return getCurrentTenantId(); }
function log(op: string, table: string, err: unknown) {
  console.error(`[DB] ${op} ${table}:`, err);
}

// ─── USERS ────────────────────────────────────────────────────────────────────

export const usersDb = {
  async getAll() {
    const { data, error } = await supabase.from('users').select('*').eq('tenant_id', tid());
    if (error) { log('getAll', 'users', error); return []; }
    return data.map(dbToUser);
  },
  async upsert(user: any) {
    const { error } = await supabase.from('users').upsert(userToDb(user));
    if (error) log('upsert', 'users', error);
  },
  async delete(id: string) {
    const { error } = await supabase.from('users').delete().eq('id', id).eq('tenant_id', tid());
    if (error) log('delete', 'users', error);
  },
};

function userToDb(u: any) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    status: u.status, monthly_goal: u.monthlyGoal ?? 0,
    avatar: u.avatar ?? null,
    oab_number: u.oabNumber ?? null, oab_state: u.oabState ?? null,
    tenant_id: u.tenantId ?? tid(),
  };
}
function dbToUser(r: any) {
  return {
    id: r.id, name: r.name, email: r.email, role: r.role,
    status: r.status, monthlyGoal: r.monthly_goal,
    avatar: r.avatar, password: r.password ?? null,
    oabNumber: r.oab_number ?? null, oabState: r.oab_state ?? null,
    tenantId: r.tenant_id,
  };
}

// ─── CLIENTS ──────────────────────────────────────────────────────────────────

export const clientsDb = {
  async getAll() {
    const { data, error } = await supabase.from('clients').select('*').eq('tenant_id', tid());
    if (error) { log('getAll', 'clients', error); return []; }
    return data.map(dbToClient);
  },
  async upsert(client: any) {
    const { error } = await supabase.from('clients').upsert(clientToDb(client));
    if (error) log('upsert', 'clients', error);
  },
  async delete(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id).eq('tenant_id', tid());
    if (error) log('delete', 'clients', error);
  },
};

function clientToDb(c: any) {
  return {
    id: c.id, name: c.name, type: c.type, document: c.document,
    email: c.email, phone: c.phone, status: c.status, created_at: c.createdAt,
    tags: c.tags ?? [], score: c.score ?? 0, birth_date: c.birthDate ?? null,
    last_contact_date: c.lastContactDate ?? null, area: c.area ?? null,
    total_contract: c.totalContract ?? 0, total_paid: c.totalPaid ?? 0,
    documents: c.documents ?? [], service_logs: c.serviceLogs ?? [],
    notices: c.notices ?? [], tenant_id: c.tenantId ?? tid(),
    password_hash: c.passwordHash ?? null,
  };
}
function dbToClient(r: any) {
  return {
    id: r.id, name: r.name, type: r.type, document: r.document,
    email: r.email, phone: r.phone, status: r.status, createdAt: r.created_at,
    tags: r.tags ?? [], score: r.score ?? 0, birthDate: r.birth_date,
    lastContactDate: r.last_contact_date, area: r.area,
    totalContract: Number(r.total_contract ?? 0), totalPaid: Number(r.total_paid ?? 0),
    documents: r.documents ?? [], serviceLogs: r.service_logs ?? [],
    notices: r.notices ?? [], tenantId: r.tenant_id,
    passwordHash: r.password_hash ?? null,
  };
}

// ─── CASES ────────────────────────────────────────────────────────────────────

export const casesDb = {
  async getAll() {
    const { data, error } = await supabase.from('cases').select('*').eq('tenant_id', tid());
    if (error) { log('getAll', 'cases', error); return []; }
    return data.map(dbToCase);
  },
  async upsert(c: any) {
    const { error } = await supabase.from('cases').upsert(caseToDb(c));
    if (error) log('upsert', 'cases', error);
  },
  async delete(id: string) {
    const { error } = await supabase.from('cases').delete().eq('id', id).eq('tenant_id', tid());
    if (error) log('delete', 'cases', error);
  },
};

function caseToDb(c: any) {
  return {
    id: c.id, cnj: c.cnj,
    title: c.lastMovement ?? c.title ?? null,
    client_id: c.clientId, client_name: c.clientName,
    opposing_party: c.opposingParty ?? null,
    area: c.area, court: c.court ?? null, status: c.status,
    lawyer_id: c.lawyerId, value: c.value ?? 0,
    probability: c.probability ?? 50, risk: c.risk ?? 'MEDIUM',
    next_deadline: c.nextDeadline ?? null, created_at: c.createdAt,
    distribution_date: c.distributionDate, tenant_id: c.tenantId ?? tid(),
  };
}
function dbToCase(r: any) {
  return {
    id: r.id, cnj: r.cnj, lastMovement: r.title, title: r.title,
    clientId: r.client_id, clientName: r.client_name,
    opposingParty: r.opposing_party ?? '',
    area: r.area, court: r.court, status: r.status, lawyerId: r.lawyer_id,
    value: Number(r.value ?? 0), probability: r.probability ?? 50,
    risk: r.risk, nextDeadline: r.next_deadline,
    createdAt: r.created_at, distributionDate: r.distribution_date,
    tenantId: r.tenant_id,
  };
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

export const transactionsDb = {
  async getAll() {
    const { data, error } = await supabase.from('transactions').select('*')
      .eq('tenant_id', tid()).order('created_at', { ascending: false });
    if (error) { log('getAll', 'transactions', error); return []; }
    return data.map(dbToTransaction);
  },
  async upsert(t: any) {
    const { error } = await supabase.from('transactions').upsert(transactionToDb(t));
    if (error) log('upsert', 'transactions', error);
  },
  async delete(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('tenant_id', tid());
    if (error) log('delete', 'transactions', error);
  },
};

function transactionToDb(t: any) {
  return {
    id: t.id, description: t.description, amount: t.amount, type: t.type,
    category: t.category, date: t.date, status: t.status,
    has_attachment: t.hasAttachment ?? false,
    attachment_data: t.attachmentData ?? null,
    attachment_name: t.attachmentName ?? null,
    professional_id: t.professionalId ?? null,
    client_id: t.clientId ?? null, client_name: t.clientName ?? null,
    tenant_id: t.tenantId ?? tid(),
  };
}
function dbToTransaction(r: any) {
  return {
    id: r.id, description: r.description, amount: Number(r.amount),
    type: r.type, category: r.category, date: r.date, status: r.status,
    hasAttachment: r.has_attachment, attachmentData: r.attachment_data,
    attachmentName: r.attachment_name, professionalId: r.professional_id,
    clientId: r.client_id, clientName: r.client_name, tenantId: r.tenant_id,
  };
}

// ─── TASKS ────────────────────────────────────────────────────────────────────

export const tasksDb = {
  async getAll() {
    const { data, error } = await supabase.from('tasks').select('*').eq('tenant_id', tid());
    if (error) { log('getAll', 'tasks', error); return []; }
    return data.map(dbToTask);
  },
  async upsert(t: any) {
    const { error } = await supabase.from('tasks').upsert(taskToDb(t));
    if (error) log('upsert', 'tasks', error);
  },
  async delete(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('tenant_id', tid());
    if (error) log('delete', 'tasks', error);
  },
};

function taskToDb(t: any) {
  return {
    id: t.id, title: t.title, client: t.client, priority: t.priority,
    deadline: t.deadline, status: t.status, responsible: t.responsible,
    created_by: t.createdBy ?? null, comments: t.comments ?? [],
    tenant_id: t.tenantId ?? tid(),
  };
}
function dbToTask(r: any) {
  return {
    id: r.id, title: r.title, client: r.client, priority: r.priority,
    deadline: r.deadline, status: r.status, responsible: r.responsible,
    createdBy: r.created_by ?? null, comments: r.comments ?? [],
    tenantId: r.tenant_id,
  };
}

// ─── DEADLINES ────────────────────────────────────────────────────────────────

export const deadlinesDb = {
  async getAll() {
    const { data, error } = await supabase.from('deadlines').select('*').eq('tenant_id', tid());
    if (error) { log('getAll', 'deadlines', error); return []; }
    return data.map(dbToDeadline);
  },
  async upsert(d: any) {
    const { error } = await supabase.from('deadlines').upsert(deadlineToDb(d));
    if (error) log('upsert', 'deadlines', error);
  },
  async delete(id: string) {
    const { error } = await supabase.from('deadlines').delete().eq('id', id).eq('tenant_id', tid());
    if (error) log('delete', 'deadlines', error);
  },
};

function deadlineToDb(d: any) {
  const legacyDesc = d._legacyDescription ?? d.summary ?? d.description ?? null;
  const extraData = JSON.stringify({
    _v: 2, notes: d.notes ?? '', mentions: d.mentions ?? [],
    publicationId: d.publicationId ?? null, originalDescription: legacyDesc,
    notified5d:    d.notified5d    ?? false,
    notified1d:    d.notified1d    ?? false,
    notifiedFatal: d.notifiedFatal ?? false,
  });
  return {
    id: d.id, title: d.type ?? d.title ?? null, date: d.date,
    case_id: d.caseId ?? null, case_name: d.case ?? d.caseName ?? null,
    client_id: d.clientId ?? null, client_name: d.clientName ?? null,
    responsible_id: d.responsibleId ?? null,
    responsible_name: d.responsible ?? d.responsibleName ?? null,
    priority: d.urgency ?? d.priority ?? 'MEDIUM',
    status: d.status ?? 'PENDING', description: extraData,
    tenant_id: d.tenantId ?? tid(),
  };
}
function dbToDeadline(r: any) {
  let notes = '', mentions: string[] = [], publicationId: string | null = null;
  let notified5d = false, notified1d = false, notifiedFatal = false;
  let description: string | null = r.description;
  if (r.description) {
    try {
      const parsed = JSON.parse(r.description);
      if (parsed && parsed._v === 2) {
        notes = parsed.notes ?? ''; mentions = parsed.mentions ?? [];
        publicationId = parsed.publicationId ?? null;
        description = parsed.originalDescription ?? null;
        notified5d    = parsed.notified5d    ?? false;
        notified1d    = parsed.notified1d    ?? false;
        notifiedFatal = parsed.notifiedFatal ?? false;
      }
    } catch { description = r.description; }
  }
  return {
    id: r.id, type: r.title, case: r.case_name, urgency: r.priority,
    responsible: r.responsible_name, title: r.title, date: r.date,
    caseId: r.case_id, caseName: r.case_name, clientId: r.client_id,
    clientName: r.client_name, responsibleId: r.responsible_id,
    responsibleName: r.responsible_name, priority: r.priority,
    status: r.status, description, summary: description,
    notes, mentions, publicationId, tenantId: r.tenant_id,
    notified5d, notified1d, notifiedFatal,
  };
}

// ─── HEARINGS ─────────────────────────────────────────────────────────────────

export const hearingsDb = {
  async getAll() {
    const { data, error } = await supabase.from('hearings').select('*')
      .eq('tenant_id', tid()).order('date', { ascending: true });
    if (error) { log('getAll', 'hearings', error); return []; }
    return data.map(dbToHearing);
  },
  async upsert(h: any) {
    const { error } = await supabase.from('hearings').upsert(hearingToDb(h));
    if (error) log('upsert', 'hearings', error);
  },
  async delete(id: string) {
    const { error } = await supabase.from('hearings').delete().eq('id', id).eq('tenant_id', tid());
    if (error) log('delete', 'hearings', error);
  },
};

function hearingToDb(h: any) {
  return {
    id: h.id, date: h.date, time: h.time ?? null,
    process_number: h.processNumber ?? null, parties: h.parties ?? null,
    modality: h.modality ?? 'PRESENCIAL', link: h.link ?? null,
    location: h.location ?? null, responsible_id: h.responsibleId ?? null,
    responsible_name: h.responsibleName ?? null,
    status: h.status ?? 'SCHEDULED', notes: h.notes ?? null,
    publication_id: h.publicationId ?? null, case_id: h.caseId ?? null,
    client_name: h.clientName ?? null, notified_5d: h.notified5d ?? false,
    notified_1d: h.notified1d ?? false, notified_3h: h.notified3h ?? false,
    created_at: h.createdAt ?? new Date().toISOString(),
    tenant_id: h.tenantId ?? tid(),
  };
}
function dbToHearing(r: any) {
  return {
    id: r.id, date: r.date, time: r.time ?? '',
    processNumber: r.process_number ?? '', parties: r.parties ?? '',
    modality: r.modality ?? 'PRESENCIAL', link: r.link ?? '',
    location: r.location ?? '', responsibleId: r.responsible_id,
    responsibleName: r.responsible_name ?? '', status: r.status ?? 'SCHEDULED',
    notes: r.notes ?? '', publicationId: r.publication_id ?? null,
    caseId: r.case_id ?? null, clientName: r.client_name ?? '',
    notified5d: r.notified_5d ?? false, notified1d: r.notified_1d ?? false,
    notified3h: r.notified_3h ?? false, createdAt: r.created_at ?? '',
    tenantId: r.tenant_id,
  };
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

export const eventsDb = {
  async getAll() {
    const { data, error } = await supabase.from('events').select('*').eq('tenant_id', tid());
    if (error) { log('getAll', 'events', error); return []; }
    return data.map(dbToEvent);
  },
  async upsert(e: any) {
    const { error } = await supabase.from('events').upsert(eventToDb(e));
    if (error) log('upsert', 'events', error);
  },
  async delete(id: string) {
    const { error } = await supabase.from('events').delete().eq('id', id).eq('tenant_id', tid());
    if (error) log('delete', 'events', error);
  },
};

function eventToDb(e: any) {
  let dateStr: string | null = e.date ?? null;
  if (!dateStr && e.year !== undefined && e.month !== undefined && e.day !== undefined) {
    dateStr = `${e.year}-${String(e.month + 1).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`;
  }
  return {
    id: String(e.id), title: e.title, date: dateStr, time: e.time ?? null,
    type: e.type ?? 'MEETING', description: e.notes ?? e.description ?? null,
    participants: e.participants ?? [], client_id: e.clientId ?? null,
    case_id: e.caseId ?? null, created_by: e.responsible ?? e.createdBy ?? null,
    tenant_id: e.tenantId ?? tid(),
  };
}
function dbToEvent(r: any) {
  const dateObj = r.date ? new Date(r.date + 'T00:00:00') : null;
  return {
    id: r.id, title: r.title, date: r.date,
    day: dateObj ? dateObj.getDate() : undefined,
    month: dateObj ? dateObj.getMonth() : undefined,
    year: dateObj ? dateObj.getFullYear() : undefined,
    time: r.time, type: r.type, notes: r.description, description: r.description,
    participants: r.participants ?? [], clientId: r.client_id, caseId: r.case_id,
    responsible: r.created_by, createdBy: r.created_by, tenantId: r.tenant_id,
  };
}

// ─── CHANNELS ─────────────────────────────────────────────────────────────────

export const channelsDb = {
  async getAll() {
    const { data, error } = await supabase.from('channels').select('*').eq('tenant_id', tid());
    if (error) { log('getAll', 'channels', error); return []; }
    return data.map(dbToChannel);
  },
  async upsert(c: any) {
    const { error } = await supabase.from('channels').upsert(channelToDb(c));
    if (error) log('upsert', 'channels', error);
  },
  async delete(id: string) {
    const { error } = await supabase.from('channels').delete().eq('id', id).eq('tenant_id', tid());
    if (error) log('delete', 'channels', error);
  },
};

function channelToDb(c: any) {
  return { id: c.id, name: c.name, members: c.members ?? [], type: c.type ?? 'CHANNEL', tenant_id: c.tenantId ?? tid() };
}
function dbToChannel(r: any) {
  return { id: r.id, name: r.name, members: r.members ?? [], type: r.type, tenantId: r.tenant_id };
}

// ─── CHAT MESSAGES ────────────────────────────────────────────────────────────

export const chatMessagesDb = {
  async getAll() {
    const { data, error } = await supabase.from('chat_messages').select('*')
      .eq('tenant_id', tid()).order('created_at', { ascending: true });
    if (error) { log('getAll', 'chat_messages', error); return []; }
    return data.map(dbToMsg);
  },
  async insert(msg: any) {
    const { error } = await supabase.from('chat_messages').insert(msgToDb(msg));
    if (error) log('insert', 'chat_messages', error);
  },
};

function msgToDb(m: any) {
  return {
    id: String(m.id), sender_id: m.senderId, sender_name: m.senderName,
    content: m.content, time: m.time, chat_id: m.chatId, tenant_id: m.tenantId ?? tid(),
  };
}
function dbToMsg(r: any) {
  return {
    id: r.id, senderId: r.sender_id, senderName: r.sender_name,
    content: r.content, time: r.time, chatId: r.chat_id, tenantId: r.tenant_id,
  };
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const notificationsDb = {
  async getAll() {
    const { data, error } = await supabase.from('notifications').select('*')
      .eq('tenant_id', tid()).order('created_at', { ascending: false });
    if (error) { log('getAll', 'notifications', error); return []; }
    return data.map(dbToNotification);
  },
  async insert(n: any) {
    const { error } = await supabase.from('notifications').insert(notificationToDb(n));
    if (error) log('insert', 'notifications', error);
  },
  async markRead(id: string) {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) log('markRead', 'notifications', error);
  },
  async markAllRead(recipientId: string) {
    const { error } = await supabase.from('notifications').update({ read: true })
      .eq('recipient_id', recipientId).eq('tenant_id', tid());
    if (error) log('markAllRead', 'notifications', error);
  },
};

function notificationToDb(n: any) {
  return {
    id: n.id, title: n.title, message: n.message,
    recipient_id: n.recipientId, time: n.time, read: n.read ?? false,
    tenant_id: n.tenantId ?? tid(),
  };
}
function dbToNotification(r: any) {
  return {
    id: r.id, title: r.title, message: r.message,
    recipientId: r.recipient_id, time: r.time, read: r.read, tenantId: r.tenant_id,
  };
}

// ─── PUBLICATIONS (DJEN) ──────────────────────────────────────────────────────

export const publicationsDb = {
  async getAll() {
    const { data, error } = await supabase.from('publications').select('*')
      .eq('tenant_id', tid()).order('publication_date', { ascending: false });
    if (error) { log('getAll', 'publications', error); return []; }
    return data.map(dbToPub);
  },
  async upsert(p: any) {
    const { error } = await supabase.from('publications').upsert(pubToDb(p));
    if (error) log('upsert', 'publications', error);
  },
};

function pubToDb(p: any) {
  return {
    id: p.id, djen_id: p.djenId ?? p.id,
    process_number: p.processNumber ?? null,
    publication_date: p.publicationDate ?? null,
    content: p.content ?? '', tribunal: p.tribunal ?? null,
    lawyer_oab: p.lawyerOab ?? null, lawyer_name: p.lawyerName ?? null,
    lawyer_id: p.lawyerId ?? null, case_id: p.caseId ?? null,
    status: p.status ?? 'unread', deadline_created: p.deadlineCreated ?? false,
    created_at: p.createdAt ?? new Date().toISOString(),
    tenant_id: p.tenantId ?? tid(),
  };
}
function dbToPub(r: any) {
  return {
    id: r.id, djenId: r.djen_id, processNumber: r.process_number,
    publicationDate: r.publication_date, content: r.content,
    tribunal: r.tribunal, lawyerOab: r.lawyer_oab,
    lawyerName: r.lawyer_name, lawyerId: r.lawyer_id,
    caseId: r.case_id, status: r.status,
    deadlineCreated: r.deadline_created, createdAt: r.created_at,
    tenantId: r.tenant_id,
  };
}
