/**
 * Legere — Módulo de CRM WhatsApp (Enterprise)
 *
 * Adaptado do sistema ols-crm sem qualquer dado específico do escritório OLS.
 * A base de conhecimento (nome do escritório, áreas, advogados) é carregada
 * dinamicamente a partir do tenant ativo no Legere.
 */

import { getCurrentTenant } from './tenantService';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Canal = 'whatsapp' | 'instagram';

export enum EtapaConversa {
  SAUDACAO         = 'SAUDACAO',
  COLETA_NOME      = 'COLETA_NOME',
  COLETA_PROBLEMA  = 'COLETA_PROBLEMA',
  QUALIFICACAO     = 'QUALIFICACAO',
  AGENDAMENTO      = 'AGENDAMENTO',
  ENCERRAMENTO     = 'ENCERRAMENTO',
  ATENDIMENTO_HUMANO = 'ATENDIMENTO_HUMANO',
}

export enum StatusConversa {
  ATIVA       = 'ATIVA',
  AGUARDANDO  = 'AGUARDANDO',
  QUALIFICADO = 'QUALIFICADO',
  ENCERRADA   = 'ENCERRADA',
  TRANSFERIDA = 'TRANSFERIDA',
}

export interface MensagemCRM {
  id: string;
  contatoId: string;
  canal: Canal;
  direcao: 'entrada' | 'saida';
  conteudo: string;
  timestamp: Date;
  lida: boolean;
  tenantId: string;
}

export interface ContatoCRM {
  id: string;
  nome: string;
  telefone: string;
  instagramId?: string;
  email?: string;
  etapa: EtapaConversa;
  status: StatusConversa;
  canal: Canal;
  score: number;             // 0–100 de qualificação
  tags: string[];
  observacoes: string;
  ultimaMensagem?: Date;
  criadoEm: Date;
  tenantId: string;
}

export interface LeadCRM {
  id: string;
  contatoId: string;
  nomeContato: string;
  telefone: string;
  problemaRelatado: string;
  areaJuridica: string;
  urgencia: 'baixa' | 'media' | 'alta';
  score: number;
  etapaPipeline: EtapaPipeline;
  advogadoResponsavel?: string;
  dataAgendamento?: Date;
  observacoes: string;
  criadoEm: Date;
  tenantId: string;
}

export enum EtapaPipeline {
  NOVO_LEAD      = 'NOVO_LEAD',
  CONTATO_FEITO  = 'CONTATO_FEITO',
  REUNIAO_MARCADA = 'REUNIAO_MARCADA',
  PROPOSTA_ENVIADA = 'PROPOSTA_ENVIADA',
  CONTRATADO     = 'CONTRATADO',
  PERDIDO        = 'PERDIDO',
}

export interface SessaoCRM {
  contatoId: string;
  etapa: EtapaConversa;
  historico: Array<{ role: 'user' | 'assistant'; content: string }>;
  dadosColetados: {
    nome?: string;
    problema?: string;
    areaJuridica?: string;
    urgencia?: string;
  };
  ultimaAtividade: Date;
  tenantId: string;
}

// ─── Configuração de Tenant ────────────────────────────────────────────────────

export interface ConfiguracaoCRM {
  nomeEscritorio: string;
  areasAtuacao: string[];
  horarioAtendimento: string;
  saudacaoPersonalizada?: string;
  mensagemEncerramento?: string;
  webhookWhatsApp?: string;
  apiKeyWhatsApp?: string;
  phoneNumberId?: string;
  instagramAccessToken?: string;
}

// Retorna configuração padrão usando os dados do tenant ativo
export function getConfiguracaoPadrao(): ConfiguracaoCRM {
  const tenant = getCurrentTenant();
  return {
    nomeEscritorio: tenant?.name ?? 'Escritório de Advocacia',
    areasAtuacao: [
      'Direito Civil',
      'Direito Trabalhista',
      'Direito de Família',
      'Direito Penal',
      'Direito Empresarial',
    ],
    horarioAtendimento: 'Segunda a Sexta, das 8h às 18h',
    saudacaoPersonalizada: undefined,
    mensagemEncerramento: undefined,
  };
}

// ─── Geração de Prompt do Sistema ─────────────────────────────────────────────

export function buildSystemPrompt(config: ConfiguracaoCRM): string {
  const areas = config.areasAtuacao.join(', ');
  return `Você é o assistente virtual do escritório ${config.nomeEscritorio}.
Seu papel é recepcionar potenciais clientes via WhatsApp/Instagram de forma profissional, empática e em conformidade com as normas da OAB.

REGRAS ABSOLUTAS:
- Nunca prometa resultados ou garantias de êxito em processos.
- Não forneça consultoria jurídica direta — apenas oriente sobre os próximos passos.
- Seja cordial, direto e humanizado.
- Em caso de emergência ou ameaça à integridade física, indique imediatamente o SAMU (192) ou Polícia (190).
- Respeite o horário de atendimento: ${config.horarioAtendimento}.

ÁREAS DE ATUAÇÃO: ${areas}

FLUXO DE CONVERSA:
1. Saudação e apresentação do escritório
2. Coleta do nome do contato
3. Entendimento do problema jurídico
4. Qualificação (urgência, área, viabilidade de atendimento)
5. Agendamento de consulta ou transferência para advogado

Mantenha respostas concisas (máximo 3 parágrafos). Use linguagem acessível, sem jargões excessivos.`;
}

// ─── Gerenciamento de Sessões (in-memory para demo; produção usa DB) ───────────

const sessoes = new Map<string, SessaoCRM>();

export function obterSessao(contatoId: string): SessaoCRM | undefined {
  return sessoes.get(contatoId);
}

export function criarSessao(contatoId: string, tenantId: string): SessaoCRM {
  const sessao: SessaoCRM = {
    contatoId,
    etapa: EtapaConversa.SAUDACAO,
    historico: [],
    dadosColetados: {},
    ultimaAtividade: new Date(),
    tenantId,
  };
  sessoes.set(contatoId, sessao);
  return sessao;
}

export function atualizarSessao(contatoId: string, updates: Partial<SessaoCRM>): void {
  const atual = sessoes.get(contatoId);
  if (atual) {
    sessoes.set(contatoId, { ...atual, ...updates, ultimaAtividade: new Date() });
  }
}

export function encerrarSessao(contatoId: string): void {
  sessoes.delete(contatoId);
}

// ─── Lógica de Qualificação ────────────────────────────────────────────────────

export function calcularScoreLead(dados: SessaoCRM['dadosColetados']): number {
  let score = 0;
  if (dados.nome)          score += 20;
  if (dados.problema)      score += 30;
  if (dados.areaJuridica)  score += 25;
  if (dados.urgencia === 'alta')   score += 25;
  else if (dados.urgencia === 'media') score += 15;
  else if (dados.urgencia === 'baixa') score += 5;
  return Math.min(score, 100);
}

export function detectarAreaJuridica(texto: string): string | null {
  const mapeamento: Array<[RegExp, string]> = [
    [/divórcio|separação|guarda|pensão|alimentos|família/i,        'Direito de Família'],
    [/trabalhista|demissão|rescisão|horas extras|assédio|fgts/i,   'Direito Trabalhista'],
    [/acidente|indenização|dano|contrato|cobrança|dívida/i,        'Direito Civil'],
    [/crime|criminal|penal|furto|roubo|estelionato|prisão/i,       'Direito Penal'],
    [/empresa|sócio|cnpj|contrato social|falência/i,               'Direito Empresarial'],
    [/previdência|inss|aposentadoria|benefício/i,                  'Direito Previdenciário'],
    [/imóvel|aluguel|despejo|usucapião|propriedade/i,              'Direito Imobiliário'],
  ];
  for (const [regex, area] of mapeamento) {
    if (regex.test(texto)) return area;
  }
  return null;
}

export function detectarUrgencia(texto: string): 'baixa' | 'media' | 'alta' {
  if (/urgente|prazo|amanhã|hoje|imediato|emergência|perigo/i.test(texto)) return 'alta';
  if (/semana|breve|logo|rápido/i.test(texto)) return 'media';
  return 'baixa';
}

// ─── Processamento de Mensagem Recebida ───────────────────────────────────────

export interface ResultadoProcessamento {
  resposta: string;
  novaEtapa: EtapaConversa;
  scoreAtualizado: number;
  areaDetectada: string | null;
  transferirParaHumano: boolean;
}

export async function processarMensagem(
  contatoId: string,
  mensagemUsuario: string,
  tenantId: string,
  config: ConfiguracaoCRM,
  geminiApiKey?: string,
  systemPromptOverride?: string
): Promise<ResultadoProcessamento> {
  let sessao = obterSessao(contatoId) ?? criarSessao(contatoId, tenantId);

  // Detectar dados automaticamente
  const areaDetectada = detectarAreaJuridica(mensagemUsuario);
  const urgencia = detectarUrgencia(mensagemUsuario);

  if (areaDetectada) {
    sessao.dadosColetados.areaJuridica = areaDetectada;
  }
  if (mensagemUsuario.length > 20 && !sessao.dadosColetados.problema) {
    sessao.dadosColetados.problema = mensagemUsuario.slice(0, 200);
  }
  if (urgencia !== 'baixa') {
    sessao.dadosColetados.urgencia = urgencia;
  }

  sessao.historico.push({ role: 'user', content: mensagemUsuario });

  // Decidir próxima etapa
  let novaEtapa = sessao.etapa;
  let resposta = '';
  let transferirParaHumano = false;

  const nome = sessao.dadosColetados.nome;

  switch (sessao.etapa) {
    case EtapaConversa.SAUDACAO: {
      const saudacao = config.saudacaoPersonalizada
        ?? `Olá! Bem-vindo ao ${config.nomeEscritorio}. 😊\nPara que eu possa ajudá-lo melhor, poderia me informar seu nome?`;
      resposta = saudacao;
      novaEtapa = EtapaConversa.COLETA_NOME;
      break;
    }

    case EtapaConversa.COLETA_NOME: {
      // Tentar extrair nome da mensagem
      const nomeExtraido = mensagemUsuario.trim().split(/\s+/).slice(0, 3).join(' ');
      sessao.dadosColetados.nome = nomeExtraido;
      resposta = `Prazer em conhecê-lo, ${nomeExtraido}! 🙏\n\nPor favor, me conte brevemente a situação jurídica com que posso ajudar. Não precisa entrar em detalhes agora — só uma descrição geral.`;
      novaEtapa = EtapaConversa.COLETA_PROBLEMA;
      break;
    }

    case EtapaConversa.COLETA_PROBLEMA: {
      sessao.dadosColetados.problema = mensagemUsuario;
      const area = areaDetectada ?? 'área jurídica';
      resposta = `Entendi, ${nome ?? 'prezado(a)'}. Sua situação parece envolver ${area}.\n\nNossa equipe está pronta para auxiliá-lo. Para agilizar o atendimento:\n• Como você avalia a urgência do seu caso?\n  1️⃣ Urgente (há prazo ou risco imediato)\n  2️⃣ Moderada (em breve)\n  3️⃣ Sem urgência imediata`;
      novaEtapa = EtapaConversa.QUALIFICACAO;
      break;
    }

    case EtapaConversa.QUALIFICACAO: {
      if (/1|urgente|prazo|risco/i.test(mensagemUsuario)) {
        sessao.dadosColetados.urgencia = 'alta';
      } else if (/2|moderada|breve/i.test(mensagemUsuario)) {
        sessao.dadosColetados.urgencia = 'media';
      } else {
        sessao.dadosColetados.urgencia = 'baixa';
      }

      resposta = `Certo! Gostaria de agendar uma consulta inicial ${sessao.dadosColetados.urgencia === 'alta' ? 'o mais breve possível' : 'em breve'} com um dos nossos advogados?\n\nAtendemos ${config.horarioAtendimento}.\n\nPara confirmar, precisamos de um e-mail ou prefere que entremos em contato apenas por aqui?`;
      novaEtapa = EtapaConversa.AGENDAMENTO;
      break;
    }

    case EtapaConversa.AGENDAMENTO: {
      resposta = `Perfeito, ${nome ?? 'prezado(a)'}! Registramos seu interesse.\n\nEm breve um dos nossos advogados entrará em contato para confirmar o horário. 📅\n\nCaso tenha alguma outra dúvida, estou à disposição!`;
      novaEtapa = EtapaConversa.ENCERRAMENTO;
      transferirParaHumano = true;
      break;
    }

    case EtapaConversa.ENCERRAMENTO: {
      const enc = config.mensagemEncerramento
        ?? `Obrigado pelo contato! Nosso escritório responderá em breve. 😊`;
      resposta = enc;
      break;
    }

    default: {
      resposta = `Olá! Para dar continuidade, um advogado assumirá este atendimento em breve.`;
      transferirParaHumano = true;
    }
  }

  // Se tiver chave Gemini, usar IA para enriquecer/substituir a resposta
  // Quando há systemPromptOverride (base de conhecimento rica), usa em TODAS as etapas.
  // Sem override, usa apenas na etapa de coleta de problema (comportamento original).
  const deveUsarGemini = geminiApiKey && (
    systemPromptOverride
      ? sessao.etapa !== EtapaConversa.ENCERRAMENTO && sessao.etapa !== EtapaConversa.ATENDIMENTO_HUMANO
      : sessao.etapa === EtapaConversa.COLETA_PROBLEMA
  );

  if (deveUsarGemini) {
    try {
      const systemPrompt = systemPromptOverride ?? buildSystemPrompt(config);

      // Montar histórico de conversa para Gemini (formato multi-turn)
      const historicoParcial = sessao.historico.slice(-8); // últimas 8 trocas
      const contents = [
        // instrução de sistema como primeira mensagem do usuário
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Entendido. Estou pronto para atender os potenciais clientes conforme as instruções.' }] },
        // histórico real da conversa
        ...historicoParcial.map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        })),
      ];

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) resposta = text;
      }
    } catch {
      // fallback para resposta padrão já gerada pela máquina de estados
    }
  }

  sessao.historico.push({ role: 'assistant', content: resposta });
  atualizarSessao(contatoId, { etapa: novaEtapa, historico: sessao.historico, dadosColetados: sessao.dadosColetados });

  const scoreAtualizado = calcularScoreLead(sessao.dadosColetados);

  return {
    resposta,
    novaEtapa,
    scoreAtualizado,
    areaDetectada,
    transferirParaHumano,
  };
}

// ─── Dados de Demonstração (para UI sem backend real) ─────────────────────────

export function gerarContatosDemo(tenantId: string): ContatoCRM[] {
  return [
    {
      id: 'demo-1',
      nome: 'Maria Aparecida Santos',
      telefone: '+55 11 91234-5678',
      canal: 'whatsapp',
      etapa: EtapaConversa.QUALIFICACAO,
      status: StatusConversa.ATIVA,
      score: 75,
      tags: ['Direito de Família', 'Urgente'],
      observacoes: 'Interesse em processo de guarda.',
      ultimaMensagem: new Date(Date.now() - 5 * 60 * 1000),
      criadoEm: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      tenantId,
    },
    {
      id: 'demo-2',
      nome: 'João Carlos Pereira',
      telefone: '+55 21 98765-4321',
      canal: 'whatsapp',
      etapa: EtapaConversa.AGENDAMENTO,
      status: StatusConversa.QUALIFICADO,
      score: 90,
      tags: ['Direito Trabalhista'],
      observacoes: 'Demissão sem justa causa, quer calcular verbas.',
      ultimaMensagem: new Date(Date.now() - 30 * 60 * 1000),
      criadoEm: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      tenantId,
    },
    {
      id: 'demo-3',
      nome: 'Ana Luíza Ferreira',
      telefone: '+55 31 97654-3210',
      canal: 'instagram',
      etapa: EtapaConversa.COLETA_PROBLEMA,
      status: StatusConversa.AGUARDANDO,
      score: 40,
      tags: ['Direito Civil'],
      observacoes: 'Perguntou sobre cobrança indevida.',
      ultimaMensagem: new Date(Date.now() - 3 * 60 * 60 * 1000),
      criadoEm: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      tenantId,
    },
    {
      id: 'demo-4',
      nome: 'Roberto Alves Lima',
      telefone: '+55 85 96543-2109',
      canal: 'whatsapp',
      etapa: EtapaConversa.ENCERRAMENTO,
      status: StatusConversa.TRANSFERIDA,
      score: 85,
      tags: ['Direito Empresarial'],
      observacoes: 'Consultoria para abertura de empresa.',
      ultimaMensagem: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      criadoEm: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      tenantId,
    },
  ];
}

export function gerarLeadsDemo(tenantId: string): LeadCRM[] {
  return [
    {
      id: 'lead-1',
      contatoId: 'demo-2',
      nomeContato: 'João Carlos Pereira',
      telefone: '+55 21 98765-4321',
      problemaRelatado: 'Demissão sem justa causa — quer calcular verbas rescisórias e horas extras.',
      areaJuridica: 'Direito Trabalhista',
      urgencia: 'alta',
      score: 90,
      etapaPipeline: EtapaPipeline.REUNIAO_MARCADA,
      advogadoResponsavel: 'Dr(a). Responsável',
      dataAgendamento: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      observacoes: 'Disponível manhãs.',
      criadoEm: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      tenantId,
    },
    {
      id: 'lead-2',
      contatoId: 'demo-4',
      nomeContato: 'Roberto Alves Lima',
      telefone: '+55 85 96543-2109',
      problemaRelatado: 'Abertura de empresa — necessita de contrato social e orientação societária.',
      areaJuridica: 'Direito Empresarial',
      urgencia: 'media',
      score: 85,
      etapaPipeline: EtapaPipeline.PROPOSTA_ENVIADA,
      observacoes: 'Aguardando retorno sobre honorários.',
      criadoEm: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      tenantId,
    },
    {
      id: 'lead-3',
      contatoId: 'demo-1',
      nomeContato: 'Maria Aparecida Santos',
      telefone: '+55 11 91234-5678',
      problemaRelatado: 'Disputa de guarda dos filhos após separação.',
      areaJuridica: 'Direito de Família',
      urgencia: 'alta',
      score: 75,
      etapaPipeline: EtapaPipeline.CONTATO_FEITO,
      observacoes: 'Caso urgente — audiência marcada.',
      criadoEm: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      tenantId,
    },
  ];
}

export function gerarMensagensDemo(contatoId: string, tenantId: string): MensagemCRM[] {
  const base: Array<Omit<MensagemCRM, 'id' | 'tenantId'>> = [
    { contatoId, canal: 'whatsapp', direcao: 'entrada', conteudo: 'Olá, boa tarde!', timestamp: new Date(Date.now() - 35 * 60 * 1000), lida: true },
    { contatoId, canal: 'whatsapp', direcao: 'saida', conteudo: 'Olá! Bem-vindo ao nosso escritório. Para ajudá-lo melhor, pode me informar seu nome?', timestamp: new Date(Date.now() - 34 * 60 * 1000), lida: true },
    { contatoId, canal: 'whatsapp', direcao: 'entrada', conteudo: 'João Carlos Pereira', timestamp: new Date(Date.now() - 33 * 60 * 1000), lida: true },
    { contatoId, canal: 'whatsapp', direcao: 'saida', conteudo: 'Prazer, João! Em que posso ajudá-lo hoje?', timestamp: new Date(Date.now() - 32 * 60 * 1000), lida: true },
    { contatoId, canal: 'whatsapp', direcao: 'entrada', conteudo: 'Fui demitido sem justa causa e quero saber meus direitos, tenho horas extras não pagas também', timestamp: new Date(Date.now() - 30 * 60 * 1000), lida: true },
  ];
  return base.map((m, i) => ({ ...m, id: `msg-${i}`, tenantId }));
}
