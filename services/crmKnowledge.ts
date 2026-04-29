/**
 * crmKnowledge.ts
 * Base de conhecimento configurável do assistente virtual do CRM WhatsApp.
 *
 * Cada escritório preenche seus dados uma única vez.
 * Esses dados geram automaticamente um system prompt rico para o Gemini,
 * fazendo o assistente se comportar como um recepcionista treinado especificamente
 * para aquele escritório.
 */

const KNOWLEDGE_KEY_PREFIX = 'juriscloud_crm_knowledge_';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AdvogadoCRM {
  id: string;
  nome: string;
  oab: string;           // ex: "SP 123456"
  especialidades: string;
  bio?: string;          // apresentação curta para o bot usar
}

export interface AreaAtuacaoCRM {
  id: string;
  area: string;
  casosAceitos: string;   // descrição de que tipos de caso aceitam
  casosRecusados: string; // o que NÃO atendem nessa área
  exemplosCasos: string;  // exemplos concretos para o bot reconhecer
}

export interface FaqItem {
  id: string;
  pergunta: string;
  resposta: string;
}

export interface CRMKnowledgeBase {
  // ── 1. Identidade do Escritório ────────────────────────────────────────────
  nomeCompleto: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  telefoneFixo: string;
  celular: string;
  email: string;
  site: string;
  instagram: string;
  comoChegar: string;          // ex: "Próximo ao fórum, estacionamento no local"

  // ── 2. Equipe ──────────────────────────────────────────────────────────────
  advogados: AdvogadoCRM[];
  totalAdvogados: number;      // para o bot dizer "somos X advogados"
  apresentacaoEquipe: string;  // texto livre sobre a equipe

  // ── 3. Áreas de Atuação ────────────────────────────────────────────────────
  areas: AreaAtuacaoCRM[];

  // ── 4. Atendimento e Horários ─────────────────────────────────────────────
  horarioAtendimento: string;   // ex: "Seg a Sex, 8h às 18h"
  horarioSabado: string;        // ex: "Sábados das 9h ao meio-dia" ou ""
  tempoRespostaWhatsApp: string; // ex: "Respondemos em até 2 horas"
  politicaUrgencia: string;     // como lidam com urgências fora do horário

  // ── 5. Consulta e Honorários ──────────────────────────────────────────────
  primeiraConsultaGratuita: boolean;
  valorConsulta: string;         // ex: "R$ 200,00" ou "a partir de R$ 150,00"
  modelosHonorarios: string;     // ex: "Fixo, por êxito ou misto, dependendo do caso"
  politicaOrcamento: string;     // ex: "Enviamos proposta em 24h após consulta"
  formasPagamento: string;       // ex: "PIX, cartão, boleto, parcelamento"

  // ── 6. Qualificação de Leads ──────────────────────────────────────────────
  dadosMinimosColetar: string;   // quais infos o bot DEVE coletar sempre
  criteriosUrgencia: string;     // o que o escritório considera urgente
  qualificarPorArea: boolean;    // bot pergunta área antes de qualificar?
  perguntasQualificacao: string; // perguntas específicas que o escritório quer fazer

  // ── 7. Perguntas Frequentes ───────────────────────────────────────────────
  faq: FaqItem[];

  // ── 8. Tom e Personalidade ────────────────────────────────────────────────
  nomeAssistente: string;        // ex: "Júlia" ou "Assistente Legere"
  tomComunicacao: 'formal' | 'profissional_amigavel' | 'informal';
  usarNomeProprio: boolean;      // chamar o cliente pelo nome?
  usarEmoji: boolean;

  // ── 9. Mensagens Personalizadas ───────────────────────────────────────────
  mensagemBoasVindas: string;
  mensagemForaHorario: string;
  mensagemTransferenciaHumano: string;
  mensagemEncerramento: string;
  mensagemUrgencia: string;      // quando detectar urgência alta

  // ── 10. Regras Especiais ──────────────────────────────────────────────────
  casosNaoAtender: string;       // ex: "Não atendemos direito tributário complexo"
  regiaoAtendimento: string;     // ex: "Atendemos toda a Bahia e casos federais"
  clientesExistentes: string;    // como o bot deve lidar com quem já é cliente
  instrucoesSigilo: string;      // lembretes de ética e sigilo para o bot
  outrasInstrucoes: string;      // campo livre para regras adicionais
}

// ─── Valores padrão (escritório ainda não configurou) ─────────────────────────

export function getDefaultKnowledge(nomeEscritorio: string): CRMKnowledgeBase {
  return {
    nomeCompleto: nomeEscritorio,
    endereco: '', bairro: '', cidade: '', estado: '', cep: '',
    telefoneFixo: '', celular: '', email: '', site: '', instagram: '', comoChegar: '',

    advogados: [],
    totalAdvogados: 1,
    apresentacaoEquipe: '',

    areas: [],

    horarioAtendimento: 'Segunda a Sexta, das 8h às 18h',
    horarioSabado: '',
    tempoRespostaWhatsApp: 'Respondemos em até 2 horas durante o horário de atendimento',
    politicaUrgencia: 'Em casos urgentes, oriente o cliente a ligar diretamente para o escritório.',

    primeiraConsultaGratuita: false,
    valorConsulta: '',
    modelosHonorarios: 'Honorários fixos, por êxito ou mistos, definidos em contrato após avaliação do caso.',
    politicaOrcamento: 'Enviamos proposta de honorários em até 24 horas após a consulta inicial.',
    formasPagamento: 'PIX, transferência bancária e cartão de crédito.',

    dadosMinimosColetar: 'Nome completo, telefone, área jurídica do problema e nível de urgência.',
    criteriosUrgencia: 'Prazos processuais vencendo em menos de 5 dias, prisão, liminar urgente.',
    qualificarPorArea: true,
    perguntasQualificacao: '',

    faq: [],

    nomeAssistente: 'Assistente',
    tomComunicacao: 'profissional_amigavel',
    usarNomeProprio: true,
    usarEmoji: true,

    mensagemBoasVindas: '',
    mensagemForaHorario: '',
    mensagemTransferenciaHumano: '',
    mensagemEncerramento: '',
    mensagemUrgencia: '',

    casosNaoAtender: '',
    regiaoAtendimento: '',
    clientesExistentes: 'Oriente clientes existentes a entrar em contato diretamente com o advogado responsável pelo seu processo.',
    instrucoesSigilo: '',
    outrasInstrucoes: '',
  };
}

// ─── Persistência ─────────────────────────────────────────────────────────────

export function saveKnowledge(tenantId: string, kb: CRMKnowledgeBase): void {
  localStorage.setItem(KNOWLEDGE_KEY_PREFIX + tenantId, JSON.stringify(kb));
}

export function loadKnowledge(tenantId: string, nomeEscritorio: string): CRMKnowledgeBase {
  const raw = localStorage.getItem(KNOWLEDGE_KEY_PREFIX + tenantId);
  if (!raw) return getDefaultKnowledge(nomeEscritorio);
  try {
    return { ...getDefaultKnowledge(nomeEscritorio), ...JSON.parse(raw) };
  } catch {
    return getDefaultKnowledge(nomeEscritorio);
  }
}

// ─── Geração do System Prompt Rico ───────────────────────────────────────────

export function buildRichSystemPrompt(kb: CRMKnowledgeBase): string {
  const tom = {
    formal: 'Utilize linguagem extremamente formal e respeitosa.',
    profissional_amigavel: 'Utilize linguagem profissional, cordial e empática — formal sem ser frio.',
    informal: 'Utilize linguagem descontraída e próxima, mas sempre respeitosa.',
  }[kb.tomComunicacao];

  const emoji = kb.usarEmoji
    ? 'Pode usar emojis com moderação para tornar a conversa mais leve.'
    : 'Não utilize emojis.';

  const nome = kb.usarNomeProprio
    ? 'Sempre que souber o nome do cliente, use-o na conversa.'
    : 'Não chame o cliente pelo nome.';

  // Bloco de advogados
  const advBlock = kb.advogados.length > 0
    ? `EQUIPE DE ADVOGADOS:\n${kb.advogados.map(a =>
        `  • ${a.nome} (OAB ${a.oab}) — ${a.especialidades}${a.bio ? ` — ${a.bio}` : ''}`
      ).join('\n')}`
    : `O escritório conta com ${kb.totalAdvogados} advogado(s). ${kb.apresentacaoEquipe}`;

  // Bloco de áreas
  const areasBlock = kb.areas.length > 0
    ? `ÁREAS DE ATUAÇÃO DETALHADAS:\n${kb.areas.map(a =>
        `  • ${a.area}:\n    - Atendemos: ${a.casosAceitos}\n    - NÃO atendemos: ${a.casosRecusados}\n    - Exemplos: ${a.exemplosCasos}`
      ).join('\n')}`
    : '';

  // Bloco de honorários
  const honorariosBlock = [
    kb.primeiraConsultaGratuita
      ? '✓ A PRIMEIRA CONSULTA É GRATUITA — informe isso ao cliente quando perguntar sobre custos.'
      : kb.valorConsulta ? `Valor da consulta: ${kb.valorConsulta}` : '',
    kb.modelosHonorarios ? `Modelos de honorários: ${kb.modelosHonorarios}` : '',
    kb.politicaOrcamento ? `Orçamentos: ${kb.politicaOrcamento}` : '',
    kb.formasPagamento ? `Formas de pagamento: ${kb.formasPagamento}` : '',
  ].filter(Boolean).join('\n');

  // Bloco de FAQ
  const faqBlock = kb.faq.length > 0
    ? `PERGUNTAS FREQUENTES (use estas respostas quando aplicável):\n${kb.faq.map((f, i) =>
        `  ${i + 1}. P: ${f.pergunta}\n     R: ${f.resposta}`
      ).join('\n')}`
    : '';

  // Bloco de localização
  const localBlock = [
    kb.endereco && `Endereço: ${kb.endereco}${kb.bairro ? ', ' + kb.bairro : ''}${kb.cidade ? ' — ' + kb.cidade + '/' + kb.estado : ''}`,
    kb.comoChegar && `Como chegar: ${kb.comoChegar}`,
    kb.regiaoAtendimento && `Região de atendimento: ${kb.regiaoAtendimento}`,
  ].filter(Boolean).join('\n');

  // Dados de contato
  const contatoBlock = [
    kb.telefoneFixo && `Telefone: ${kb.telefoneFixo}`,
    kb.celular && `Celular/WhatsApp: ${kb.celular}`,
    kb.email && `E-mail: ${kb.email}`,
    kb.site && `Site: ${kb.site}`,
    kb.instagram && `Instagram: ${kb.instagram}`,
  ].filter(Boolean).join(' | ');

  // Qualificação
  const qualBlock = [
    `Dados mínimos a coletar de todo lead: ${kb.dadosMinimosColetar}`,
    kb.criteriosUrgencia && `Critérios de urgência do escritório: ${kb.criteriosUrgencia}`,
    kb.perguntasQualificacao && `Perguntas específicas a fazer: ${kb.perguntasQualificacao}`,
  ].filter(Boolean).join('\n');

  const prompt = `Você é ${kb.nomeAssistente}, assistente virtual do escritório ${kb.nomeCompleto}.
Seu papel é recepcionar potenciais clientes via WhatsApp/Instagram, qualificar leads e agendar consultas, sempre em conformidade com as normas éticas da OAB.

════════════════════════════════════════
TOM E COMUNICAÇÃO
════════════════════════════════════════
${tom} ${emoji} ${nome}
Respostas concisas (máximo 3 parágrafos). Nunca prometa resultados ou dê pareceres jurídicos. Apenas oriente sobre os próximos passos.

════════════════════════════════════════
INFORMAÇÕES DO ESCRITÓRIO
════════════════════════════════════════
${localBlock}
${contatoBlock ? 'Contato: ' + contatoBlock : ''}

════════════════════════════════════════
HORÁRIOS E ATENDIMENTO
════════════════════════════════════════
Horário: ${kb.horarioAtendimento}${kb.horarioSabado ? '\nSábados: ' + kb.horarioSabado : ''}
Tempo de resposta: ${kb.tempoRespostaWhatsApp}
Fora do horário: ${kb.politicaUrgencia}

════════════════════════════════════════
EQUIPE
════════════════════════════════════════
${advBlock}
${kb.apresentacaoEquipe && kb.advogados.length === 0 ? kb.apresentacaoEquipe : ''}

════════════════════════════════════════
${areasBlock}

════════════════════════════════════════
HONORÁRIOS E CONSULTA
════════════════════════════════════════
${honorariosBlock}

════════════════════════════════════════
QUALIFICAÇÃO DE LEADS
════════════════════════════════════════
${qualBlock}

════════════════════════════════════════
${faqBlock}

════════════════════════════════════════
REGRAS ABSOLUTAS
════════════════════════════════════════
${kb.casosNaoAtender ? '• NÃO ATENDEMOS: ' + kb.casosNaoAtender : ''}
${kb.clientesExistentes ? '• Clientes existentes: ' + kb.clientesExistentes : ''}
${kb.instrucoesSigilo ? '• Sigilo: ' + kb.instrucoesSigilo : ''}
• Nunca prometa êxito, resultados ou prazos de decisão judicial.
• Em emergência de saúde ou segurança: SAMU 192 / Polícia 190.
• Nunca forneça orientação jurídica direta — apenas encaminhe para consulta.
• Não revele informações de outros clientes do escritório.
${kb.outrasInstrucoes ? '• ' + kb.outrasInstrucoes.replace(/\n/g, '\n• ') : ''}

════════════════════════════════════════
MENSAGENS PADRÃO (use quando aplicável)
════════════════════════════════════════
${kb.mensagemBoasVindas ? 'Boas-vindas: ' + kb.mensagemBoasVindas : ''}
${kb.mensagemForaHorario ? 'Fora do horário: ' + kb.mensagemForaHorario : ''}
${kb.mensagemUrgencia ? 'Urgência detectada: ' + kb.mensagemUrgencia : ''}
${kb.mensagemTransferenciaHumano ? 'Ao transferir: ' + kb.mensagemTransferenciaHumano : ''}
${kb.mensagemEncerramento ? 'Encerramento: ' + kb.mensagemEncerramento : ''}`;

  return prompt.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Score de completude da base de conhecimento ──────────────────────────────

export interface KnowledgeScore {
  total: number;        // 0–100
  secoes: { nome: string; score: number; max: number; faltando: string[] }[];
}

export function calcularScore(kb: CRMKnowledgeBase): KnowledgeScore {
  const secoes = [
    {
      nome: 'Identidade',
      items: [
        { label: 'Nome completo',    ok: !!kb.nomeCompleto },
        { label: 'Cidade/Estado',    ok: !!kb.cidade && !!kb.estado },
        { label: 'Endereço',         ok: !!kb.endereco },
        { label: 'Telefone/Celular', ok: !!kb.telefoneFixo || !!kb.celular },
        { label: 'E-mail',           ok: !!kb.email },
      ],
    },
    {
      nome: 'Equipe',
      items: [
        { label: 'Ao menos 1 advogado cadastrado', ok: kb.advogados.length > 0 },
        { label: 'Especialidades informadas',      ok: kb.advogados.some(a => !!a.especialidades) },
      ],
    },
    {
      nome: 'Áreas de Atuação',
      items: [
        { label: 'Ao menos 1 área cadastrada',  ok: kb.areas.length > 0 },
        { label: 'Casos aceitos definidos',     ok: kb.areas.some(a => !!a.casosAceitos) },
        { label: 'Casos recusados definidos',   ok: kb.areas.some(a => !!a.casosRecusados) },
        { label: 'Exemplos de casos',           ok: kb.areas.some(a => !!a.exemplosCasos) },
      ],
    },
    {
      nome: 'Honorários',
      items: [
        { label: 'Política de honorários',  ok: !!kb.modelosHonorarios },
        { label: 'Política de orçamento',   ok: !!kb.politicaOrcamento },
        { label: 'Formas de pagamento',     ok: !!kb.formasPagamento },
      ],
    },
    {
      nome: 'Qualificação',
      items: [
        { label: 'Dados mínimos definidos',  ok: !!kb.dadosMinimosColetar },
        { label: 'Critérios de urgência',    ok: !!kb.criteriosUrgencia },
      ],
    },
    {
      nome: 'FAQ',
      items: [
        { label: 'Ao menos 3 perguntas cadastradas', ok: kb.faq.length >= 3 },
      ],
    },
    {
      nome: 'Mensagens',
      items: [
        { label: 'Mensagem de boas-vindas',        ok: !!kb.mensagemBoasVindas },
        { label: 'Mensagem fora do horário',       ok: !!kb.mensagemForaHorario },
        { label: 'Mensagem de transferência',      ok: !!kb.mensagemTransferenciaHumano },
      ],
    },
  ];

  const resultado = secoes.map(s => {
    const ok = s.items.filter(i => i.ok).length;
    return {
      nome: s.nome,
      score: ok,
      max: s.items.length,
      faltando: s.items.filter(i => !i.ok).map(i => i.label),
    };
  });

  const totalOk = resultado.reduce((acc, s) => acc + s.score, 0);
  const totalMax = resultado.reduce((acc, s) => acc + s.max, 0);

  return {
    total: Math.round((totalOk / totalMax) * 100),
    secoes: resultado,
  };
}
