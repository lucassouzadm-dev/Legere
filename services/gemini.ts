/**
 * gemini.ts
 * Integração com Google Gemini AI para geração de peças jurídicas
 * e pesquisa de publicações judiciais.
 */
import { getCurrentTenant } from './tenantService';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
  ?? (import.meta.env as any).GEMINI_API_KEY
  ?? '';

// ─── Gerador de petições ──────────────────────────────────────────────────────

export async function generatePetition(
  tipo: string,
  fatos: string,
  pedidos: string,
  clientName: string,
  lawyerName: string,
  lawyerOab: string
): Promise<string> {
  const tenant = getCurrentTenant();
  const firmName = tenant?.name ?? 'Escritório de Advocacia';

  const prompt = `Você é um assistente jurídico do escritório "${firmName}".
Redija uma ${tipo} completa, formal e tecnicamente precisa com base nas informações abaixo.
Use linguagem jurídica adequada ao direito brasileiro. Formate com seções claras.

CLIENTE: ${clientName}
ADVOGADO RESPONSÁVEL: ${lawyerName} — ${lawyerOab}

FATOS E FUNDAMENTOS:
${fatos}

PEDIDOS:
${pedidos}

Inclua: endereçamento ao juízo, qualificação das partes, exposição dos fatos, 
fundamentação jurídica (doutrina e jurisprudência quando cabível), pedidos objetivos 
e fechamento com local/data/assinatura.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Não foi possível gerar o documento.';
  } catch (e: any) {
    return `Erro ao chamar Gemini: ${e.message}`;
  }
}

// ─── Análise de publicação DJEN ───────────────────────────────────────────────

export async function analyzePublication(content: string): Promise<string> {
  const tenant = getCurrentTenant();
  const firmName = tenant?.name ?? 'Escritório de Advocacia';

  const prompt = `Você é um assistente jurídico sênior do escritório "${firmName}".
Analise a publicação judicial abaixo e forneça um resumo executivo em até 3 parágrafos:
1) O que foi decidido/publicado
2) Prazo para manifestação (se houver) e data-limite
3) Ação recomendada ao advogado responsável

PUBLICAÇÃO:
${content.substring(0, 2000)}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Não foi possível analisar.';
  } catch (e: any) {
    return `Erro: ${e.message}`;
  }
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
  const tenant = getCurrentTenant();
  const firmName = tenant?.name ?? 'Escritório de Advocacia';

  const prompt = `Você é um assistente jurídico do escritório "${firmName}".
Redija uma ${req.type} completa, formal e tecnicamente precisa com base nas informações abaixo.
Use linguagem jurídica adequada ao direito brasileiro. Tom: ${req.tone ?? 'formal'}.
Formate com seções claras (endereçamento, fatos, fundamentação, pedidos, fechamento).

CLIENTE: ${req.clientData.name}

FATOS:
${req.facts}

${req.thesis ? `TESE JURÍDICA:\n${req.thesis}` : ''}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    if (!res.ok) return 'Chave Gemini não configurada ou inválida. Configure em Configurações → Integrações.';
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Não foi possível gerar o documento.';
  } catch (e: any) {
    return `Erro ao chamar Gemini: ${e.message}`;
  }
}

// ─── Tradução de jargão jurídico (usado pelo Portal do Cliente) ───────────────

export async function translateLegalJargon(text: string): Promise<string> {
  const prompt = `Você é um assistente que traduz linguagem jurídica complexa para linguagem simples e acessível ao cidadão comum.
Explique o trecho jurídico abaixo em linguagem clara, sem jargões, em no máximo 3 parágrafos curtos.
Indique o que aconteceu, o que significa para o cliente e se há alguma ação necessária.

TRECHO JURÍDICO:
"${text.substring(0, 1500)}"`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    if (!res.ok) return 'IA não configurada. O administrador precisa inserir a chave Gemini em Configurações → Integrações.';
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Não foi possível traduzir o texto.';
  } catch (e: any) {
    return `Erro: ${e.message}`;
  }
}

// ─── Busca de publicações via Gemini (fallback) ───────────────────────────────

export async function searchJudicialPublications(
  oab: string, uf: string, startDate: string, endDate: string
): Promise<any[]> {
  const prompt = `Busque publicações judiciais reais do diário eletrônico (DJEN) para o advogado com OAB ${oab}/${uf} entre ${startDate} e ${endDate}. Retorne um array JSON com campos: processNumber, content, tribunal, publicationDate. Se não houver dados reais disponíveis, retorne [].`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch { return []; }
}
