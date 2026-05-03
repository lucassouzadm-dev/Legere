/**
 * api/djen-cron.js — Vercel Serverless Function
 *
 * Roda diariamente às 7h BRT (10h UTC) via Vercel Cron Jobs.
 * Sincroniza publicações do DJEN para todos os tenants ativos
 * que possuam advogados com número OAB cadastrado.
 *
 * Variáveis de ambiente necessárias no Vercel:
 *   SUPABASE_URL             — URL do projeto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — Service Role Key (bypass RLS)
 *   CRON_SECRET              — Token secreto para autorizar chamadas manuais
 *
 * Chamada manual (para teste):
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://seu-dominio.vercel.app/api/djen-cron
 */

const DJEN_API_URL  = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const ITENS_POR_PAG = 100;

// ─── Helpers DJEN ─────────────────────────────────────────────────────────────

function dateRange(daysBack = 30) {
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

async function fetchDjenPage(oab, uf, startDate, endDate, pagina = 1) {
  const params = new URLSearchParams({
    numeroOab: oab, ufOab: uf,
    dataDisponibilizacaoInicio: startDate,
    dataDisponibilizacaoFim: endDate,
    itensPorPagina: String(ITENS_POR_PAG),
    pagina: String(pagina),
  });
  const res = await fetch(`${DJEN_API_URL}?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchAllPublications(oab, uf, startDate, endDate) {
  const first = await fetchDjenPage(oab, uf, startDate, endDate, 1);
  if (!first) return [];
  const extract = (d) => Array.isArray(d) ? d : (d?.items ?? []);
  const items = [...extract(first)];
  const total = first?.count ?? items.length;
  const pages = Math.min(Math.ceil(total / ITENS_POR_PAG), 20);
  for (let p = 2; p <= pages; p++) {
    const data = await fetchDjenPage(oab, uf, startDate, endDate, p);
    if (!data) break;
    items.push(...extract(data));
  }
  return items;
}

function normalizePublication(raw, lawyer, tenantId) {
  const djenId   = String(raw.numeroComunicacao ?? raw.id ?? '');
  const content  = raw.texto ?? raw.conteudo ?? raw.comunicacao ?? '';
  const pubDate  = (raw.dataDisponibilizacao ?? raw.data ?? '').slice(0, 10);
  const tribunal = raw.siglaTribunal ?? raw.tribunal ?? '';
  const processo = raw.numeroProcesso ?? raw.processo ?? '';

  const id = `pub-${djenId}-${tenantId}`.slice(0, 120);

  return {
    id,
    tenant_id:      tenantId,
    djen_id:        djenId,
    process_number: processo,
    publication_date: pubDate || new Date().toISOString().slice(0, 10),
    content,
    tribunal,
    lawyer_oab:     lawyer.oab_number ?? '',
    lawyer_name:    lawyer.name,
    lawyer_id:      lawyer.id,
    case_id:        null,
    status:         'unread',
    deadline_created: false,
    created_at:     new Date().toISOString(),
  };
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // ── Autorização ──────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    // Vercel envia o header "x-vercel-cron": "1" para chamadas automáticas
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    if (!isVercelCron && token !== cronSecret) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
  }

  // ── Supabase com Service Role (bypass RLS) ────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados' });
  }

  // Chamadas manuais ao Supabase REST (sem SDK para manter a function leve)
  const sbFetch = (path, opts = {}) => fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(opts.headers ?? {}),
    },
  });

  const results = [];
  let totalNew  = 0;

  try {
    // ── 1. Buscar todos os tenants ativos ──────────────────────────────────
    const tenantsRes = await sbFetch('/tenants?select=id,name&active=eq.true');
    if (!tenantsRes.ok) throw new Error(`Tenants: ${tenantsRes.status}`);
    const tenants = await tenantsRes.json();

    for (const tenant of tenants) {
      const tenantId = tenant.id;

      // ── 2. Buscar advogados com OAB cadastrado ─────────────────────────
      const lawyersRes = await sbFetch(
        `/users?select=id,name,oab_number,oab_state&tenant_id=eq.${tenantId}&oab_number=not.is.null&role=in.(ADMIN,LAWYER)`
      );
      if (!lawyersRes.ok) continue;
      const lawyers = await lawyersRes.json();

      for (const lawyer of lawyers) {
        if (!lawyer.oab_number?.trim()) continue;
        const oab = lawyer.oab_number.trim();
        const uf  = (lawyer.oab_state ?? 'BA').trim().toUpperCase();

        try {
          // ── 3. Buscar publicações dos últimos 30 dias ──────────────────
          const { startDate, endDate } = dateRange(30);
          const rawItems = await fetchAllPublications(oab, uf, startDate, endDate);

          if (!rawItems.length) continue;

          // ── 4. Buscar IDs já existentes para evitar duplicatas ─────────
          const existingRes = await sbFetch(
            `/publications?select=djen_id&tenant_id=eq.${tenantId}&limit=1000`
          );
          const existing = existingRes.ok ? await existingRes.json() : [];
          const existingIds = new Set(existing.map((p) => String(p.djen_id)));

          const toInsert = rawItems
            .filter((raw) => {
              const djenId = String(raw.numeroComunicacao ?? raw.id ?? '');
              return djenId && !existingIds.has(djenId);
            })
            .map((raw) => normalizePublication(raw, lawyer, tenantId));

          if (!toInsert.length) continue;

          // ── 5. Inserir em lotes de 50 ──────────────────────────────────
          const BATCH = 50;
          for (let i = 0; i < toInsert.length; i += BATCH) {
            const batch = toInsert.slice(i, i + BATCH);
            await sbFetch('/publications', {
              method: 'POST',
              headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
              body: JSON.stringify(batch),
            });
          }

          // ── 6. Criar notificação para o advogado ──────────────────────
          const notif = {
            id:           `notif-djen-${tenantId}-${lawyer.id}-${Date.now()}`,
            title:        '📋 Novas publicações DJEN',
            message:      `${toInsert.length} nova(s) publicação(ões) encontrada(s) para OAB ${oab}/${uf}.`,
            recipient_id: lawyer.id,
            time:         new Date().toISOString(),
            read:         false,
            tenant_id:    tenantId,
          };
          await sbFetch('/notifications', { method: 'POST', body: JSON.stringify(notif) });

          totalNew += toInsert.length;
          results.push({ tenant: tenant.name, lawyer: lawyer.name, oab, uf, new: toInsert.length });

        } catch (lawyerErr) {
          console.error(`[djen-cron] Erro advogado ${oab}/${uf}:`, lawyerErr.message);
          results.push({ tenant: tenant.name, lawyer: lawyer.name, oab, uf, error: lawyerErr.message });
        }
      }
    }

    return res.json({
      ok: true,
      totalNew,
      results,
      runAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[djen-cron] Erro geral:', err);
    return res.status(500).json({ error: err.message });
  }
}
