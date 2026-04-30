/**
 * gemini.ts
 * Integração com Google Gemini AI para geração de peças jurídicas
 * e pesquisa de publicações judiciais.
 *
 * Estratégia de chave (ordem de prioridade):
 *   1. Chave própria do tenant (geminiApiKey em TenantIntegrations) — override manual
 *   2. Chave da plataforma (VITE_GEMINI_API_KEY no Vercel) — planos Pro/Enterprise
 *   3. Nenhuma chave → mensagem de upgrade
 *
 * Limite de uso: checkAiLimit / incrementAiUsage em tenantService.
 */
import { getCurrentTenant, getCurrentTenantId, loadIntegrations, checkAiLimit, incrementAiUsage } from './tenantService';
import { PLAN_FEATURES } from '../types';

// Chave da plataforma — configurada como variável de ambiente no Vercel
const PLATFORM_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
  ?? (import.meta.env as any).GEMINI_API_KEY
  ?? '';

// Evolution API hospedada pela plataforma
export const PLATFORM_EVOLUTION_URL = (import.meta.env.VITE_EVOLUTION_API_URL as string) ?? '';
export const PLATFORM_EVOLUTION_KEY = (import.meta.env.VITE_EVOLUTION_API_KEY as string) ?? '';

/** Resolve qual chave Gemini usar para o tenant atual. */
function resolveGeminiKey(): { key: string; source: 'tenant' | 'platform' | 'none' } {
  const tenantId     = getCurrentTenantId();
  const integrations = loadIntegrations(tenantId);
  if (integrations.geminiApiKey?.trim())
    return { key: integrations.geminiApiKey.trim(), source: 'tenant' };
  const tenant   = getCurrentTenant();
  const features = tenant ? PLAN_FEATURES[tenant.plan] : null;
  if (features?.geminiIncluded && PLATFORM_GEMINI_KEY)
    return { key: PLATFORM_GEMINI_KEY, source: 'platform' };
  return { key: '', source: 'none' };
}

/** Verifica limite mensal de uso de IA. Retorna mensagem de erro ou null se ok. */
function checkLimit(): string | null {
  const tenantId = getCurrentTenantId();
  const tenant   = getCurrentTenant();
  if (!tenant) return null;
  const features = PLAN_FEATURES[tenant.plan];
  if (features.aiMonthlyLimit === 0)
    return 'As funcionalidades de IA estão disponíveis a partir do plano Pro. Acesse Configurações → Meu Plano para fazer upgrade.';
  if (features.aiMonthlyLimit === -1) return null;
  const { allowed, used, limit } = checkAiLimit(tenantId, features.aiMonthlyLimit);
  if (!allowed)
    return `Limite de IA atingido: ${used}/${limit} requisições usadas este mês. O limite renova em 1º do próximo mês.`;
  return null;
}

/** Chamada centralizada ao Gemini com rastreamento de uso e tratamento de erros. */
async function callGemini(prompt: string): Promise<string> {
  const limitErr = checkLimit();
  if (limitErr) return limitErr;

  const { key, source } = resolveGeminiKey();
  if (!key)
    return 'Chave Gemini não configurada. Acesse Configurações → Integrações ou faça upgrade para o plano Pro.';

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    if (!res.ok) {
      if (res.status === 429) return 'Muitas requisições simultâneas. Aguarde alguns segundos e tente novamente.';
      if (res.status === 403) return source === 'platform'
        ? 'Erro interno de configuração da IA. Contate o suporte.'
        : 'Chave Gemini inválida. Verifique em Configurações → Integrações.';
      const err = await res.json().catch(() => ({}));
      return `Erro na IA (${res.status}): ${err?.error?.message ?? 'Tente novamente.'}`;
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return 'A IA não retornou conteúdo. Tente reformular a solicitação.';
    incrementAiUsage(getCurrentTenantId());
    return text;
  } catch (e: any) {
    return `Erro de conexão com a IA: ${e.message}`;
  }
}

// ─── Gerador de petições ──────────────────────────────────────────────────────

export async function generatePetition(
  tipo: string, fatos: string, pedidos: string,
  clientName: string, lawyerName: string, lawyerOab: string
): Promise<string> {
  const firmName = getCurrentTenant()?.name ?? 'Escritório de Advocacia';
  return callGemini(`Você é um assistente jurídico do escritório "${firmName}".
Redija uma ${tipo} completa, formal e tecnicamente precisa. Use linguagem jurídica adequada ao direito brasileiro.

CLIENTE: ${clientName}
ADVOGADO RESPONSÁVEL: ${lawyerName} — ${lawyerOab}

FATOS E FUNDAMENTOS:
${fatos}

PEDIDOS:
${pedidos}

Inclua: endereçamento ao juízo, qualificação das partes, exposição dos fatos, fundamentação jurídica (doutrina e jurisprudência quando cabível), pedidos objetivos e fechamento com local/data/assinatura.`);
}

// ─── Análise de publicação DJEN ───────────────────────────────────────────────

export async function analyzePublication(content: string): Promise<string> {
  const firmName = getCurrentTenant()?.name ?? 'Escritório de Advocacia';
  return callGemini(`Você é um assistente jurídico sênior do escritório "${firmName}".
Analise a publicação judicial abaixo e forneça um resumo executivo em até 3 parágrafos:
1) O que foi decidido/publicado
2) Prazo para manifestação (se houver) e data-limite
3) Ação recomendada ao advogado responsável

PUBLICAÇÃO:
${content.substring(0, 2000)}`);
}

// ─── Gerador de documento jurídico (alias usado pelo PetitionGenerator) ───────

interface LegalDocumentRequest {
  type: string;
  clientData: { name: string };
  facts: string;
  thesis?: string;
  tone?: string;
  attachments?: { data: string; mimeType: string }[];
}

export async function generateLegalDocument(req: LegalDocumentRequest): Promise<string> {
  const firmName = getCurrentTenant()?.name ?? 'Escritório de Advocacia';
  return callGemini(`Você é um assistente jurídico do escritório "${firmName}".
Redija uma ${req.type} completa, formal e tecnicamente precisa.
Use linguagem jurídica adequada ao direito brasileiro. Tom: ${req.tone ?? 'formal'}.

CLIENTE: ${req.clientData.name}

FATOS:
${req.facts}

${req.thesis ? `TESE JURÍDICA:\n${req.thesis}` : ''}`);
}

// ─── Tradução de jargão jurídico (Portal do Cliente) ─────────────────────────

export async function translateLegalJargon(text: string): Promise<string> {
  return callGemini(`Você é um assistente que traduz linguagem jurídica complexa para linguagem simples e acessível ao cidadão comum.
Explique o trecho jurídico abaixo em linguagem clara, sem jargões, em no máximo 3 parágrafos curtos.
Indique o que aconteceu, o que significa para o cliente e se há alguma ação necessária.

TRECHO JURÍDICO:
"${text.substring(0, 1500)}"`);
}

// ─── Busca de publicações via Gemini (fallback) ───────────────────────────────

export interface GeminiPublicationsResult {
  publications: any[];
  message: string;
}

export async function searchJudicialPublications(
  params: { caseCnjs: string[] }
): Promise<GeminiPublicationsResult> {
  const today   = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const text = await callGemini(
    `Busque publicações judiciais no DJEN para os processos: ${params.caseCnjs.slice(0, 10).join(', ')} entre ${weekAgo} e ${today}. Retorne um JSON com campo "publications": array com campos cnj, content, tribunal, publicationDate. Se não houver dados reais disponíveis, retorne {"publications":[]}.`
  );
  try {
    const match  = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    return { publications: parsed.publications ?? [], message: parsed.message ?? 'Nenhuma publicação nova encontrada nos últimos 7 dias.' };
  } catch {
    return { publications: [], message: 'Erro ao processar resposta do Gemini.' };
  }
}
