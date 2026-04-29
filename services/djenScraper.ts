/**
 * djenScraper.ts
 * Busca publicações judiciais para os advogados do escritório.
 *
 * Estratégia (ordem de tentativa):
 *   1. fetchDirect — chama comunicaapi.pje.jus.br DIRETO do browser do usuário.
 *      - API retorna Access-Control-Allow-Origin: * → CORS OK de qualquer domínio
 *      - O IP do escritório não é bloqueado (IPs de nuvem/Vercel são bloqueados)
 *      - Busca NACIONAL: omitindo siglaTribunal cobre todos os tribunais de uma vez
 *   2. fetchViaProxy — chama /api/djen (Vercel Serverless). Fallback quando o
 *      fetchDirect falhar por algum motivo inesperado.
 *   3. Gemini AI — último recurso via Google Search.
 *
 * Endpoint oficial (sem siglaTribunal = busca nacional):
 *   GET https://comunicaapi.pje.jus.br/api/v1/comunicacao
 *     ?pagina=1&itensPorPagina=100
 *     &dataDisponibilizacaoInicio=YYYY-MM-DD
 *     &dataDisponibilizacaoFim=YYYY-MM-DD
 *     &numeroOab=XXXXX&ufOab=BA
 *
 * Parâmetros confirmados pelo Swagger:
 *   numeroOab, ufOab, nomeAdvogado, nomeParte, numeroProcesso,
 *   dataDisponibilizacaoInicio, dataDisponibilizacaoFim, siglaTribunal,
 *   numeroComunicacao, pagina, itensPorPagina (apenas 5 ou 100), orgaoId, meio
 */

import { supabase } from './supabase';
import { publicationsDb as _pubDb } from './db';
import { getCurrentTenantId } from './tenantService';
import { searchJudicialPublications } from './gemini';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface DjenPublication {
  id: string;
  djenId: string;
  processNumber: string;
  publicationDate: string; // YYYY-MM-DD
  content: string;
  tribunal: string;
  lawyerOab: string;
  lawyerName: string;
  lawyerId: string | null;
  caseId: string | null;
  status: 'unread' | 'read' | 'archived';
  deadlineCreated: boolean;
  createdAt: string;
}

const DJEN_API_URL  = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const ITENS_POR_PAG = 100; // Swagger aceita apenas 5 ou 100

// ─── Paginação automática ─────────────────────────────────────────────────────

async function paginate(baseParams: Record<string, string>, firstData: any): Promise<any[]> {
  const extract = (d: any): any[] => Array.isArray(d) ? d : (d?.items ?? []);
  const items   = [...extract(firstData)];
  const total   = firstData?.count ?? items.length;
  const pages   = Math.min(Math.ceil(total / ITENS_POR_PAG), 20); // máx 2000 itens

  for (let pagina = 2; pagina <= pages; pagina++) {
    try {
      const url = `${DJEN_API_URL}?${new URLSearchParams({ ...baseParams, pagina: String(pagina) })}`;
      const r   = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) break;
      items.push(...extract(await r.json()));
    } catch { break; }
  }
  return items;
}

// ─── Tentativa 1: chamada direta do browser ───────────────────────────────────
// - API retorna CORS: Access-Control-Allow-Origin: * → funciona de qualquer domínio
// - IP do usuário não é bloqueado (diferente dos IPs Vercel/AWS)
// - Busca nacional: sem siglaTribunal retorna todos os tribunais

async function fetchDirect(
  oab: string,
  uf: string,
  startDate: string,
  endDate: string
): Promise<any[] | null> {
  try {
    // Busca nacional com filtro de OAB
    const params: Record<string, string> = {
      dataDisponibilizacaoInicio: startDate,
      dataDisponibilizacaoFim:    endDate,
      itensPorPagina:             String(ITENS_POR_PAG),
      numeroOab:                  oab,
      ufOab:                      uf,
    };

    const url = `${DJEN_API_URL}?${new URLSearchParams({ ...params, pagina: '1' })}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (res.ok) {
      const data = await res.json();
      const items = await paginate(params, data);
      console.log(`[DJEN direct] OAB ${oab}/${uf}: ${items.length} publicações (nacionais)`);
      return items;
    }

    console.warn(`[DJEN direct] HTTP ${res.status} para OAB ${oab}`);
    return null;
  } catch (e) {
    console.warn('[DJEN direct] erro de rede:', e);
    return null;
  }
}

// ─── Tentativa 2: via Vercel Serverless Function /api/djen ────────────────────
// Falha quando a Vercel usa IP de nuvem bloqueado pela API governamental.
// Mantido como fallback para casos inesperados.

async function fetchViaProxy(
  oab: string,
  uf: string,
  startDate: string,
  endDate: string
): Promise<any[] | null> {
  try {
    // Sem siglaTribunal → busca nacional no proxy também
    const params = new URLSearchParams({ oab, uf, startDate, endDate });
    const res = await fetch(`/api/djen?${params}`);
    if (!res.ok) return null;

    const json = await res.json();
    if (!json.success) {
      console.warn('[DJEN proxy] falhou:', json.error);
      return null;
    }

    const raw = json.data;
    if (Array.isArray(raw))        return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    return null;
  } catch (e) {
    console.warn('[DJEN proxy] erro de rede:', e);
    return null;
  }
}

// ─── Filtro OAB client-side ───────────────────────────────────────────────────
// Usado quando a API retorna todos os itens sem filtrar por OAB.
// Estrutura real: destinatarioadvogados[].advogado.{ numero_oab, uf_oab }

function filterByOab(items: any[], oab: string, uf: string): any[] {
  const oabNum = String(oab).replace(/\D/g, '');
  return items.filter(item => {
    const destAdvs: any[] = item.destinatarioadvogados ?? [];
    return destAdvs.some((da: any) => {
      const adv  = da?.advogado ?? {};
      const pOab = String(adv.numero_oab ?? '').replace(/\D/g, '');
      const pUf  = String(adv.uf_oab ?? '').toUpperCase();
      return pOab === oabNum && (!uf || pUf === String(uf).toUpperCase());
    });
  });
}

// ─── Normaliza item da API para formato interno ───────────────────────────────
// Campos confirmados pela API real: numero_processo, data_disponibilizacao, texto

function normalizeDjenItem(raw: any, lawyer: any): {
  djen_id: string; process_number: string | null; publication_date: string;
  content: string; tribunal: string | null; lawyer_oab: string | null;
  lawyer_name: string | null; lawyer_id: string | null; case_id: null;
} {
  const cnj     = raw.numero_processo ?? raw.numeroProcesso ?? raw.cnj ?? null;
  const rawDate = raw.data_disponibilizacao ?? raw.dataDisponibilizacao ?? raw.data ?? '';
  const pubDate = toIsoDate(rawDate);
  const tribunal = raw.siglaTribunal ?? raw.tribunal ?? 'DJEN';

  const content =
    raw.texto ?? raw.conteudo ?? raw.teor ?? raw.comunicacao ?? raw.descricao ?? '';

  const apiId  = raw.id ?? raw.hash ?? null;
  const djenId = apiId
    ? `djen-${apiId}`
    : `djen-${tribunal}-${cnj ?? ''}-${pubDate}`.replace(/\s/g, '');

  return {
    djen_id:          djenId,
    process_number:   cnj,
    publication_date: pubDate,
    content:          String(content).substring(0, 5000),
    tribunal,
    lawyer_oab:       lawyer?.oab_number ?? null,
    lawyer_name:      lawyer?.name ?? null,
    lawyer_id:        lawyer?.id ?? null,
    case_id:          null,
  };
}

function toIsoDate(s: string): string {
  if (!s) return new Date().toISOString().split('T')[0];
  const parts = s.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return s.split('T')[0];
}

// ─── Sincronização principal ──────────────────────────────────────────────────

export async function syncDjenPublications(caseCnjs: string[] = []): Promise<{
  total: number;
  novas: number;
  errors: string[];
  message: string;
  source?: 'api' | 'gemini';
}> {
  try {
    // 1. Advogados com OAB cadastrado
    const { data: lawyers, error: lawyersErr } = await supabase
      .from('users')
      .select('id, name, oab_number, oab_state')
      .not('oab_number', 'is', null);

    if (lawyersErr || !lawyers?.length) {
      return {
        total: 0, novas: 0, errors: ['Nenhum advogado com OAB cadastrado.'],
        message: 'Configure os números OAB em Configurações.',
      };
    }

    // 2. Janela de busca: últimos 7 dias
    const today    = new Date().toISOString().split('T')[0];
    const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 3. Uma chamada nacional por advogado (sem loop de tribunais)
    type RawWithLawyer = { raw: any; lawyer: any };
    const rawEntries: RawWithLawyer[] = [];
    let usedSource: 'api' | 'gemini' = 'api';
    let apiWorked = false;

    for (const lawyer of lawyers) {
      if (!lawyer.oab_number) continue;

      const oab = lawyer.oab_number;
      const uf  = lawyer.oab_state ?? 'BA';

      // Tenta direto do browser (funciona — IP do escritório + CORS: *)
      let items = await fetchDirect(oab, uf, sevenAgo, today);

      // Fallback para o proxy Vercel se o direct falhar
      if (items === null) {
        items = await fetchViaProxy(oab, uf, sevenAgo, today);
      }

      if (items !== null) {
        apiWorked = true;
        items.forEach(raw => rawEntries.push({ raw, lawyer }));
      }
    }

    // 4. Fallback Gemini se ambos falharam
    if (!apiWorked) {
      usedSource = 'gemini';
      const result = await searchJudicialPublications({ caseCnjs });

      if (!result.publications?.length) {
        return {
          total: 0, novas: 0, errors: [],
          message: result.message || 'Nenhuma publicação nova encontrada nos últimos 7 dias.',
          source: 'gemini',
        };
      }

      result.publications.forEach((p: any) => {
        const lawyer = lawyers.find((l: any) =>
          (p.lawyerName ?? '').toLowerCase().includes((l.name ?? '').split(' ')[0].toLowerCase())
        ) ?? lawyers[0];
        rawEntries.push({
          raw: {
            id:                    `gemini-${p.cnj}-${p.publishedAt}`,
            numero_processo:       p.cnj,
            data_disponibilizacao: p.publishedAt,
            texto:                 p.summary ?? '',
            siglaTribunal:         p.source,
            destinatarioadvogados: [{
              advogado: {
                nome:       p.lawyerName,
                numero_oab: lawyer?.oab_number,
                uf_oab:     lawyer?.oab_state ?? 'BA',
              }
            }],
          },
          lawyer,
        });
      });
    }

    if (!rawEntries.length) {
      return {
        total: 0, novas: 0, errors: [],
        message: 'Nenhuma publicação encontrada nos últimos 7 dias.',
        source: usedSource,
      };
    }

    // 5. Deduplicação
    const { data: existingPubs } = await supabase.from('publications').select('djen_id');
    const existingIds = new Set((existingPubs ?? []).map((p: any) => p.djen_id));

    // 6. Vincular ao processo pelo número CNJ
    const { data: cases } = await supabase.from('cases').select('id, cnj');
    const casesByCnj = new Map((cases ?? []).map((c: any) => [c.cnj?.trim(), c.id]));

    // 7. Montar registros para inserção (deduplicação dentro do batch também)
    const toInsert: any[] = [];
    const batchIds = new Set<string>(); // evita duplicatas no mesmo batch

    for (const { raw, lawyer } of rawEntries) {
      const normalized = normalizeDjenItem(raw, lawyer);
      if (existingIds.has(normalized.djen_id)) continue;
      if (batchIds.has(normalized.djen_id)) continue;
      batchIds.add(normalized.djen_id);

      const caseId = casesByCnj.get((normalized.process_number ?? '').trim()) ?? null;

      toInsert.push({
        ...normalized,
        case_id:          caseId,
        status:           'unread',
        deadline_created: false,
      });
    }

    if (!toInsert.length) {
      return {
        total: rawEntries.length, novas: 0, errors: [],
        message: 'Todas as publicações encontradas já estavam cadastradas.',
        source: usedSource,
      };
    }

    // 8. Inserir no Supabase
    const { error: insErr } = await supabase.from('publications').insert(toInsert);
    if (insErr) {
      return {
        total: rawEntries.length, novas: 0,
        errors: [insErr.message], message: 'Erro ao salvar publicações.',
      };
    }

    // 9. Criar notificações
    const notifications = toInsert
      .filter(p => p.lawyer_id)
      .map(p => ({
        id:           `pub-notif-${p.djen_id}-${Date.now()}`,
        title:        '📰 Nova Publicação no DJEN',
        message:      `${p.tribunal ?? 'Tribunal'} — Proc. ${p.process_number ?? 'sem número'} — ${p.publication_date}`,
        recipient_id: p.lawyer_id,
        time:         new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        read:         false,
      }));

    if (notifications.length) {
      await supabase.from('notifications').insert(notifications);
    }

    return {
      total:   rawEntries.length,
      novas:   toInsert.length,
      errors:  [],
      message: `${toInsert.length} nova(s) publicação(ões) encontrada(s) e salva(s). [${usedSource}]`,
      source:  usedSource,
    };

  } catch (err: any) {
    const msg = err?.message ?? String(err);
    return { total: 0, novas: 0, errors: [msg], message: `Erro na consulta: ${msg}` };
  }
}

// ─── publicationsDb: CRUD para o frontend ─────────────────────────────────────

export const publicationsDb = {
  async getAll(): Promise<DjenPublication[]> {
    const { data, error } = await supabase
      .from('publications')
      .select('*')
      .order('publication_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) { console.error('[DB] getAll publications:', error); return []; }
    return (data ?? []).map(dbToPub);
  },

  async markRead(id: string) {
    await supabase.from('publications').update({ status: 'read' }).eq('id', id);
  },

  async markUnread(id: string) {
    await supabase.from('publications').update({ status: 'unread' }).eq('id', id);
  },

  async markAllRead(lawyerId: string) {
    await supabase.from('publications').update({ status: 'read' })
      .eq('lawyer_id', lawyerId).eq('status', 'unread');
  },

  async archive(id: string) {
    await supabase.from('publications').update({ status: 'archived' }).eq('id', id);
  },

  async markDeadlineCreated(id: string) {
    await supabase.from('publications').update({ deadline_created: true }).eq('id', id);
  },

  // ── Operações em lote ──────────────────────────────────────────────────────
  async bulkMarkRead(ids: string[]) {
    if (!ids.length) return;
    await supabase.from('publications').update({ status: 'read' }).in('id', ids);
  },

  async bulkMarkUnread(ids: string[]) {
    if (!ids.length) return;
    await supabase.from('publications').update({ status: 'unread' }).in('id', ids);
  },

  async bulkArchive(ids: string[]) {
    if (!ids.length) return;
    await supabase.from('publications').update({ status: 'archived' }).in('id', ids);
  },

  async bulkDelete(ids: string[]) {
    if (!ids.length) return;
    await supabase.from('publications').delete().in('id', ids);
  },
};

function dbToPub(r: any): DjenPublication {
  return {
    id:              r.id,
    djenId:          r.djen_id,
    processNumber:   r.process_number ?? '',
    publicationDate: r.publication_date ?? '',
    content:         r.content ?? '',
    tribunal:        r.tribunal ?? '',
    lawyerOab:       r.lawyer_oab ?? '',
    lawyerName:      r.lawyer_name ?? '',
    lawyerId:        r.lawyer_id ?? null,
    caseId:          r.case_id ?? null,
    status:          r.status ?? 'unread',
    deadlineCreated: r.deadline_created ?? false,
    createdAt:       r.created_at ?? '',
  };
}
