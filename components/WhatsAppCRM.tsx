import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle, Instagram, Users, TrendingUp, Settings,
  Send, Search, Phone, Mail, Tag, Clock, CheckCheck,
  ChevronRight, Circle, AlertCircle, Star, MoreVertical,
  RefreshCw, Wifi, WifiOff, Filter, Plus, Bot, UserCheck, XCircle, PhoneOff,
} from 'lucide-react';
import {
  ContatoCRM, LeadCRM, MensagemCRM, EtapaConversa, StatusConversa, EtapaPipeline,
  Canal,
  ConfiguracaoCRM, getConfiguracaoPadrao, processarMensagem,
} from '../services/whatsappCrm';
import { getCurrentTenantId, loadIntegrations } from '../services/tenantService';
import { CRMKnowledgeBase, loadKnowledge, saveKnowledge, buildRichSystemPrompt, calcularScore } from '../services/crmKnowledge';
import CRMAssistantConfig from './CRMAssistantConfig';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)   return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function etapaLabel(e: EtapaConversa): string {
  const map: Record<EtapaConversa, string> = {
    [EtapaConversa.SAUDACAO]:          'Saudação',
    [EtapaConversa.COLETA_NOME]:       'Coletando nome',
    [EtapaConversa.COLETA_PROBLEMA]:   'Descrevendo problema',
    [EtapaConversa.QUALIFICACAO]:      'Qualificando',
    [EtapaConversa.AGENDAMENTO]:       'Agendamento',
    [EtapaConversa.ENCERRAMENTO]:      'Encerrado',
    [EtapaConversa.ATENDIMENTO_HUMANO]: 'Humano',
  };
  return map[e] ?? e;
}

function statusBadge(s: StatusConversa) {
  const map: Record<StatusConversa, { label: string; color: string }> = {
    [StatusConversa.ATIVA]:       { label: 'Ativa',       color: '#3b82f6' },
    [StatusConversa.AGUARDANDO]:  { label: 'Aguardando',  color: '#f59e0b' },
    [StatusConversa.QUALIFICADO]: { label: 'Qualificado', color: '#22c55e' },
    [StatusConversa.ENCERRADA]:   { label: 'Encerrada',   color: '#6b7280' },
    [StatusConversa.TRANSFERIDA]: { label: 'Transferida', color: '#8b5cf6' },
  };
  return map[s] ?? { label: s, color: '#6b7280' };
}

const PIPELINE_COLUNAS: { etapa: EtapaPipeline; label: string; color: string }[] = [
  { etapa: EtapaPipeline.NOVO_LEAD,        label: 'Novo Lead',       color: '#3b82f6' },
  { etapa: EtapaPipeline.CONTATO_FEITO,    label: 'Contato Feito',   color: '#f59e0b' },
  { etapa: EtapaPipeline.REUNIAO_MARCADA,  label: 'Reunião Marcada', color: '#8b5cf6' },
  { etapa: EtapaPipeline.PROPOSTA_ENVIADA, label: 'Proposta',        color: '#ec4899' },
  { etapa: EtapaPipeline.CONTRATADO,       label: 'Contratado',      color: '#22c55e' },
  { etapa: EtapaPipeline.PERDIDO,          label: 'Perdido',         color: '#ef4444' },
];

// ─── Aba: Inbox ───────────────────────────────────────────────────────────────

interface InboxProps {
  contatos: ContatoCRM[];
  mensagensPorContato: Record<string, MensagemCRM[]>;
  config: ConfiguracaoCRM;
  tenantId: string;
  knowledge: CRMKnowledgeBase;
  geminiApiKey?: string;
  autoIniciarContatoId?: string | null;
  onContatoAtualizado: (c: ContatoCRM) => void;
  onMensagemEnviada: (contatoId: string, msg: MensagemCRM) => void;
  onExcluirConversa: (contatoId: string) => void;
  onAutoIniciado: () => void;
}

const Inbox: React.FC<InboxProps> = ({
  contatos, mensagensPorContato, config, tenantId, knowledge, geminiApiKey,
  autoIniciarContatoId, onContatoAtualizado, onMensagemEnviada, onExcluirConversa, onAutoIniciado,
}) => {
  const [selecionado, setSelecionado] = useState<ContatoCRM | null>(contatos[0] ?? null);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);

  const mensagens = selecionado ? (mensagensPorContato[selecionado.id] ?? []) : [];

  // Humano em controle quando contato foi transferido ou está em atendimento humano
  const isHumanMode = selecionado != null && (
    selecionado.status === StatusConversa.TRANSFERIDA ||
    selecionado.etapa === EtapaConversa.ATENDIMENTO_HUMANO
  );
  const isEncerrado = selecionado?.status === StatusConversa.ENCERRADA;

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length, selecionado]);

  // Sincroniza o contato selecionado quando o array externo muda (ex: após assumir/encerrar)
  useEffect(() => {
    if (selecionado) {
      const atualizado = contatos.find(c => c.id === selecionado.id);
      if (atualizado) setSelecionado(atualizado);
    }
  }, [contatos]);

  // Auto-inicia conversa quando vindo da aba Contatos → "Iniciar Conversa com Bot"
  useEffect(() => {
    if (!autoIniciarContatoId) return;
    const alvo = contatos.find(c => c.id === autoIniciarContatoId);
    if (!alvo) return;
    setSelecionado(alvo);
    onAutoIniciado();
    // Dispara saudação do bot automaticamente se a conversa ainda não tem mensagens
    const jaTemMensagens = (mensagensPorContato[alvo.id] ?? []).length > 0;
    if (jaTemMensagens) return;
    setEnviando(true);
    (async () => {
      try {
        const basePrompt = buildRichSystemPrompt(knowledge);
        const richPrompt = alvo.instrucaoBot?.trim()
          ? `OBJETIVO DESTA CONVERSA (instrução do escritório para este contato):\n${alvo.instrucaoBot.trim()}\n\n---\n\n${basePrompt}`
          : basePrompt;
        const resultado = await processarMensagem(
          alvo.id, '', tenantId, config, geminiApiKey, richPrompt
        );
        if (resultado.resposta) {
          const msgBot: MensagemCRM = {
            id: `msg-${Date.now()}`,
            contatoId: alvo.id, canal: alvo.canal,
            direcao: 'saida', conteudo: resultado.resposta,
            timestamp: new Date(), lida: true, tenantId,
            origemBot: true, remetenteNome: 'Bot',
          };
          onMensagemEnviada(alvo.id, msgBot);
          onContatoAtualizado({ ...alvo, etapa: resultado.novaEtapa, ultimaMensagem: new Date() });
        }
      } finally { setEnviando(false); }
    })();
  }, [autoIniciarContatoId]);

  const contatosFiltrados = contatos.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca)
  );

  function assumirAtendimento() {
    if (!selecionado) return;
    const atualizado: ContatoCRM = {
      ...selecionado,
      etapa: EtapaConversa.ATENDIMENTO_HUMANO,
      status: StatusConversa.TRANSFERIDA,
    };
    onContatoAtualizado(atualizado);
    setSelecionado(atualizado);
    // Mensagem de sistema informando a transferência
    const msgSistema: MensagemCRM = {
      id: `sys-${Date.now()}`,
      contatoId: selecionado.id,
      canal: selecionado.canal,
      direcao: 'saida',
      conteudo: '— Atendimento assumido por um agente humano —',
      timestamp: new Date(),
      lida: true,
      tenantId,
      origemBot: false,
      remetenteNome: 'Sistema',
    };
    onMensagemEnviada(selecionado.id, msgSistema);
  }

  function encerrarAtendimento() {
    if (!selecionado) return;
    const atualizado: ContatoCRM = {
      ...selecionado,
      etapa: EtapaConversa.ENCERRAMENTO,
      status: StatusConversa.ENCERRADA,
    };
    onContatoAtualizado(atualizado);
    setSelecionado(atualizado);
    const msgSistema: MensagemCRM = {
      id: `sys-${Date.now()}`,
      contatoId: selecionado.id,
      canal: selecionado.canal,
      direcao: 'saida',
      conteudo: '— Atendimento encerrado —',
      timestamp: new Date(),
      lida: true,
      tenantId,
      origemBot: false,
      remetenteNome: 'Sistema',
    };
    onMensagemEnviada(selecionado.id, msgSistema);
  }

  async function enviarMensagem() {
    if (!input.trim() || !selecionado || enviando || isEncerrado) return;
    setEnviando(true);
    const texto = input.trim();
    setInput('');

    if (isHumanMode) {
      // Atendente humano envia mensagem diretamente ao cliente (saída)
      const msgAgente: MensagemCRM = {
        id: `msg-${Date.now()}`,
        contatoId: selecionado.id,
        canal: selecionado.canal,
        direcao: 'saida',
        conteudo: texto,
        timestamp: new Date(),
        lida: true,
        tenantId,
        origemBot: false,
        remetenteNome: 'Atendente',
      };
      onMensagemEnviada(selecionado.id, msgAgente);
      onContatoAtualizado({ ...selecionado, ultimaMensagem: new Date() });
      setEnviando(false);
      return;
    }

    // Modo bot: simula mensagem do cliente → bot responde
    const msgUsuario: MensagemCRM = {
      id: `msg-${Date.now()}`,
      contatoId: selecionado.id,
      canal: selecionado.canal,
      direcao: 'entrada',
      conteudo: texto,
      timestamp: new Date(),
      lida: true,
      tenantId,
      remetenteNome: selecionado.nome,
    };
    onMensagemEnviada(selecionado.id, msgUsuario);

    try {
      const basePrompt = buildRichSystemPrompt(knowledge);
      // Injeta instrução específica do contato no topo do system prompt
      const richPrompt = selecionado.instrucaoBot?.trim()
        ? `OBJETIVO DESTA CONVERSA (instrução do escritório para este contato):\n${selecionado.instrucaoBot.trim()}\n\n---\n\n${basePrompt}`
        : basePrompt;
      const resultado = await processarMensagem(
        selecionado.id, msgUsuario.conteudo, tenantId, config,
        geminiApiKey, richPrompt
      );
      // Bot não deve responder se o contato foi transferido durante o processamento
      if (resultado.resposta) {
        const resposta: MensagemCRM = {
          id: `msg-${Date.now() + 1}`,
          contatoId: selecionado.id,
          canal: selecionado.canal,
          direcao: 'saida',
          conteudo: resultado.resposta,
          timestamp: new Date(),
          lida: true,
          tenantId,
          origemBot: true,
          remetenteNome: 'Bot',
        };
        onMensagemEnviada(selecionado.id, resposta);
      }
      const novoStatus = resultado.transferirParaHumano ? StatusConversa.TRANSFERIDA : selecionado.status;
      const novaEtapa  = resultado.transferirParaHumano ? EtapaConversa.ATENDIMENTO_HUMANO : resultado.novaEtapa;
      const atualizado: ContatoCRM = {
        ...selecionado,
        etapa: novaEtapa,
        score: resultado.scoreAtualizado,
        ultimaMensagem: new Date(),
        status: novoStatus,
      };
      onContatoAtualizado(atualizado);
      setSelecionado(atualizado);
      // Se bot transferiu automaticamente, notificar no chat
      if (resultado.transferirParaHumano) {
        const msgSis: MensagemCRM = {
          id: `sys-${Date.now() + 2}`,
          contatoId: selecionado.id,
          canal: selecionado.canal,
          direcao: 'saida',
          conteudo: '— Bot transferiu para atendimento humano —',
          timestamp: new Date(),
          lida: true,
          tenantId,
          origemBot: false,
          remetenteNome: 'Sistema',
        };
        onMensagemEnviada(selecionado.id, msgSis);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '620px', gap: 0, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      {/* Lista de conversas */}
      <div style={{ width: 300, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar conversa..."
              style={{ width: '100%', padding: '7px 10px 7px 30px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: 'white', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {contatosFiltrados.map(c => {
            const badge = statusBadge(c.status);
            const ativo = selecionado?.id === c.id;
            const humanAtivo = c.status === StatusConversa.TRANSFERIDA || c.etapa === EtapaConversa.ATENDIMENTO_HUMANO;
            return (
              <div
                key={c.id}
                onClick={() => setSelecionado(c)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                  background: ativo ? '#eff6ff' : 'white',
                  borderLeft: ativo ? '3px solid #3b82f6' : humanAtivo ? '3px solid #8b5cf6' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.canal === 'whatsapp'
                      ? <MessageCircle size={13} style={{ color: '#25d366' }} />
                      : <Instagram size={13} style={{ color: '#e1306c' }} />
                    }
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.nome}</span>
                    {humanAtivo && <UserCheck size={11} style={{ color: '#8b5cf6' }} />}
                  </div>
                  {c.ultimaMensagem && (
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(c.ultimaMensagem)}</span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{etapaLabel(c.etapa)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 10,
                      background: badge.color + '20', color: badge.color, fontWeight: 600
                    }}>{badge.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(c.score) }}>{c.score}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Área de chat */}
      {selecionado ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
          {/* Header do chat */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: isHumanMode ? '#faf5ff' : 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{selecionado.nome}</span>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    background: statusBadge(selecionado.status).color + '20',
                    color: statusBadge(selecionado.status).color, fontWeight: 600
                  }}>{statusBadge(selecionado.status).label}</span>
                  {isHumanMode && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#f3e8ff', color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <UserCheck size={10} /> Atendimento humano
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {selecionado.telefone} · Score: <strong style={{ color: scoreColor(selecionado.score) }}>{selecionado.score}/100</strong>
                </div>
              </div>
              {/* Botões de controle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {!isHumanMode && !isEncerrado && geminiApiKey && (
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: '#f0fdf4', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Bot size={12} /> Bot ativo
                  </span>
                )}
                {!isHumanMode && !isEncerrado && selecionado.instrucaoBot && (
                  <span
                    title={selecionado.instrucaoBot}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: '#f0fdf4', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, cursor: 'help' }}
                  >
                    <Bot size={12} /> Instrução ativa
                  </span>
                )}
                {!isHumanMode && !isEncerrado && (
                  <button
                    onClick={assumirAtendimento}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 8, border: '1px solid #8b5cf6',
                      background: 'white', color: '#7c3aed', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    <UserCheck size={13} /> Assumir Atendimento
                  </button>
                )}
                {isHumanMode && !isEncerrado && (
                  <button
                    onClick={encerrarAtendimento}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 8, border: '1px solid #ef4444',
                      background: 'white', color: '#dc2626', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    <PhoneOff size={13} /> Encerrar Atendimento
                  </button>
                )}
                {isEncerrado && (
                  <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Atendimento encerrado</span>
                )}
                {selecionado.tags.map(t => (
                  <span key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: '#eff6ff', color: '#3b82f6', fontWeight: 600 }}>{t}</span>
                ))}
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir todas as mensagens da conversa com ${selecionado.nome}?`)) {
                      onExcluirConversa(selecionado.id);
                      setSelecionado(null);
                    }
                  }}
                  title="Excluir conversa"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', padding: 4 }}
                >
                  <XCircle size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mensagens.map(m => {
              const isSystem = m.remetenteNome === 'Sistema';
              if (isSystem) {
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '3px 12px', borderRadius: 10, fontStyle: 'italic' }}>
                      {m.conteudo}
                    </span>
                  </div>
                );
              }
              const isEntrada = m.direcao === 'entrada';
              const bubbleBg = isEntrada ? 'white'
                : m.origemBot ? '#3b82f6'
                : '#7c3aed'; // humano = roxo
              const senderLabel = isEntrada
                ? (m.remetenteNome ?? selecionado.nome)
                : m.origemBot ? 'Bot 🤖' : (m.remetenteNome ?? 'Atendente 👤');
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isEntrada ? 'flex-start' : 'flex-end', gap: 2 }}>
                  <span style={{ fontSize: 10, color: '#9ca3af', paddingLeft: isEntrada ? 4 : 0, paddingRight: isEntrada ? 0 : 4 }}>
                    {senderLabel}
                  </span>
                  <div style={{
                    maxWidth: '70%', padding: '8px 12px',
                    borderRadius: isEntrada ? '0 12px 12px 12px' : '12px 0 12px 12px',
                    background: bubbleBg,
                    color: isEntrada ? '#111827' : 'white',
                    fontSize: 13, boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  }}>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>{m.conteudo}</p>
                    <div style={{ fontSize: 11, marginTop: 4, textAlign: 'right', opacity: 0.7 }}>
                      {m.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {!isEntrada && <CheckCheck size={11} style={{ marginLeft: 4, display: 'inline' }} />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={msgEndRef} />
          </div>

          {/* Input */}
          {isEncerrado ? (
            <div style={{ padding: '14px 16px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'center', fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
              Esta conversa foi encerrada
            </div>
          ) : (
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${isHumanMode ? '#ddd6fe' : '#e5e7eb'}`, display: 'flex', gap: 10, alignItems: 'flex-end', background: isHumanMode ? '#faf5ff' : 'white' }}>
              {isHumanMode && (
                <span style={{ fontSize: 11, color: '#7c3aed', alignSelf: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <UserCheck size={12} /> Você
                </span>
              )}
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); } }}
                placeholder={isHumanMode ? 'Responder como atendente (Enter para enviar)...' : 'Simular mensagem do cliente (Enter para enviar)...'}
                rows={2}
                style={{ flex: 1, padding: '10px 14px', fontSize: 13, border: `1px solid ${isHumanMode ? '#c4b5fd' : '#e5e7eb'}`, borderRadius: 10, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              <button
                onClick={enviarMensagem}
                disabled={!input.trim() || enviando}
                style={{
                  width: 42, height: 42, borderRadius: '50%', border: 'none',
                  background: input.trim() ? (isHumanMode ? '#7c3aed' : '#3b82f6') : '#e5e7eb',
                  cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {enviando
                  ? <RefreshCw size={16} style={{ color: 'white', animation: 'spin 1s linear infinite' }} />
                  : <Send size={16} style={{ color: input.trim() ? 'white' : '#9ca3af' }} />
                }
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexDirection: 'column', gap: 8 }}>
          <MessageCircle size={40} />
          <span>Selecione uma conversa</span>
        </div>
      )}
    </div>
  );
};

// ─── Aba: Pipeline ────────────────────────────────────────────────────────────

interface PipelineProps {
  leads: LeadCRM[];
  onLeadMovido: (id: string, etapa: EtapaPipeline) => void;
}

const Pipeline: React.FC<PipelineProps> = ({ leads, onLeadMovido }) => {
  const [dragging, setDragging] = useState<string | null>(null);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 12, minWidth: 900 }}>
        {PIPELINE_COLUNAS.map(col => {
          const leadsColuna = leads.filter(l => l.etapaPipeline === col.etapa);
          return (
            <div
              key={col.etapa}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragging) {
                  onLeadMovido(dragging, col.etapa);
                  setDragging(null);
                }
              }}
              style={{ flex: 1, minWidth: 150, background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}
            >
              <div style={{ padding: '10px 12px', borderBottom: '3px solid ' + col.color, background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: '#374151' }}>{col.label}</span>
                  <span style={{ fontSize: 11, background: col.color + '20', color: col.color, padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>
                    {leadsColuna.length}
                  </span>
                </div>
              </div>

              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                {leadsColuna.map(lead => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    style={{
                      background: 'white', padding: '10px 12px', borderRadius: 8,
                      border: '1px solid #e5e7eb', cursor: 'grab',
                      boxShadow: dragging === lead.id ? '0 4px 12px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                      opacity: dragging === lead.id ? 0.6 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 4 }}>{lead.nomeContato}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, lineHeight: 1.4 }}>{lead.areaJuridica}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 6, fontWeight: 700,
                        background: lead.urgencia === 'alta' ? '#fee2e2' : lead.urgencia === 'media' ? '#fef3c7' : '#f3f4f6',
                        color: lead.urgencia === 'alta' ? '#dc2626' : lead.urgencia === 'media' ? '#d97706' : '#6b7280',
                      }}>
                        {lead.urgencia === 'alta' ? '🔴 Urgente' : lead.urgencia === 'media' ? '🟡 Média' : '🟢 Baixa'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(lead.score) }}>{lead.score}</span>
                    </div>
                    {lead.dataAgendamento && (
                      <div style={{ fontSize: 10, color: '#8b5cf6', marginTop: 6 }}>
                        📅 {lead.dataAgendamento.toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                ))}
                {leadsColuna.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#d1d5db', fontSize: 12 }}>
                    Arraste leads aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Aba: Contatos ────────────────────────────────────────────────────────────

const ETAPA_OPTIONS = Object.values(EtapaConversa);
const STATUS_OPTIONS = Object.values(StatusConversa);
const CANAL_OPTIONS: Canal[] = ['whatsapp', 'instagram'];
const PIPELINE_OPTIONS = Object.values(EtapaPipeline);

const PIPELINE_LABELS: Record<EtapaPipeline, string> = {
  [EtapaPipeline.NOVO_LEAD]:        'Novo Lead',
  [EtapaPipeline.CONTATO_FEITO]:    'Contato Feito',
  [EtapaPipeline.REUNIAO_MARCADA]:  'Reunião Marcada',
  [EtapaPipeline.PROPOSTA_ENVIADA]: 'Proposta Enviada',
  [EtapaPipeline.CONTRATADO]:       'Contratado',
  [EtapaPipeline.PERDIDO]:          'Perdido',
};

interface FormContato {
  nome: string; telefone: string; email: string;
  canal: Canal; etapa: EtapaConversa; status: StatusConversa;
  score: number; tagsTexto: string; observacoes: string;
}

interface FormPipeline {
  etapaPipeline: EtapaPipeline;
  areaJuridica: string;
  urgencia: 'baixa' | 'media' | 'alta';
  problemaRelatado: string;
  advogadoResponsavel: string;
  dataAgendamento: string;
  observacoesLead: string;
}

const FORM_VAZIO: FormContato = {
  nome: '', telefone: '', email: '', canal: 'whatsapp',
  etapa: EtapaConversa.SAUDACAO, status: StatusConversa.ATIVA,
  score: 0, tagsTexto: '', observacoes: '',
};

const PIPELINE_VAZIO: FormPipeline = {
  etapaPipeline: EtapaPipeline.NOVO_LEAD,
  areaJuridica: '', urgencia: 'baixa',
  problemaRelatado: '', advogadoResponsavel: '',
  dataAgendamento: '', observacoesLead: '',
};

function contatoParaForm(c: ContatoCRM): FormContato {
  return {
    nome: c.nome, telefone: c.telefone, email: c.email ?? '',
    canal: c.canal, etapa: c.etapa, status: c.status,
    score: c.score, tagsTexto: c.tags.join(', '),
    observacoes: c.observacoes ?? '',
  };
}

function leadParaPipeline(l: LeadCRM): FormPipeline {
  return {
    etapaPipeline: l.etapaPipeline,
    areaJuridica: l.areaJuridica,
    urgencia: l.urgencia,
    problemaRelatado: l.problemaRelatado,
    advogadoResponsavel: l.advogadoResponsavel ?? '',
    dataAgendamento: l.dataAgendamento ? l.dataAgendamento.toISOString().split('T')[0] : '',
    observacoesLead: l.observacoes ?? '',
  };
}

interface ContatosProps {
  contatos: ContatoCRM[];
  leads: LeadCRM[];
  tenantId: string;
  onContatoAtualizado: (c: ContatoCRM) => void;
  onNovoContato: (c: ContatoCRM) => void;
  onExcluirContato: (id: string) => void;
  onLeadUpsert: (lead: LeadCRM) => void;
  onIniciarConversa: (c: ContatoCRM) => void;
}

const Contatos: React.FC<ContatosProps> = ({
  contatos, leads, tenantId,
  onContatoAtualizado, onNovoContato, onExcluirContato, onLeadUpsert, onIniciarConversa,
}) => {
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<ContatoCRM | null>(null);
  const [modoNovo, setModoNovo] = useState(false);
  const [abaPainel, setAbaPainel] = useState<'dados' | 'pipeline' | 'bot'>('dados');
  const [form, setForm] = useState<FormContato>(FORM_VAZIO);
  const [formPipeline, setFormPipeline] = useState<FormPipeline>(PIPELINE_VAZIO);
  const [instrucaoBot, setInstrucaoBot] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [salvoPipeline, setSalvoPipeline] = useState(false);
  const [salvoBot, setSalvoBot] = useState(false);
  const [erro, setErro] = useState('');

  const filtrados = contatos.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca) ||
    (c.email ?? '').toLowerCase().includes(busca.toLowerCase())
  );

  function leadDoContato(contatoId: string): LeadCRM | undefined {
    return leads.find(l => l.contatoId === contatoId);
  }

  function abrirDetalhe(c: ContatoCRM) {
    setSelecionado(c);
    setModoNovo(false);
    setForm(contatoParaForm(c));
    setInstrucaoBot(c.instrucaoBot ?? '');
    const lead = leadDoContato(c.id);
    setFormPipeline(lead ? leadParaPipeline(lead) : PIPELINE_VAZIO);
    setSalvo(false); setSalvoPipeline(false); setSalvoBot(false);
    setErro('');
  }

  function abrirNovo() {
    setSelecionado(null);
    setModoNovo(true);
    setAbaPainel('dados');
    setForm(FORM_VAZIO);
    setInstrucaoBot('');
    setFormPipeline(PIPELINE_VAZIO);
    setSalvo(false); setErro('');
  }

  function fecharPainel() { setSelecionado(null); setModoNovo(false); }

  function campoForm(key: keyof FormContato, value: any) {
    setForm(f => ({ ...f, [key]: value }));
  }
  function campoPipeline(key: keyof FormPipeline, value: any) {
    setFormPipeline(f => ({ ...f, [key]: value }));
  }

  // Retorna o contato atualizado com os dados do form atual (sem instrucaoBot)
  function buildContatoAtualizado(base: ContatoCRM | null): ContatoCRM {
    const tags = form.tagsTexto.split(',').map(t => t.trim()).filter(Boolean);
    return {
      id: base?.id ?? `c-${Date.now()}`,
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      email: form.email.trim() || undefined,
      canal: form.canal,
      etapa: form.etapa,
      status: form.status,
      score: form.score,
      tags,
      observacoes: form.observacoes,
      instrucaoBot: base?.instrucaoBot,
      criadoEm: base?.criadoEm ?? new Date(),
      ultimaMensagem: base?.ultimaMensagem,
      tenantId,
    };
  }

  function s