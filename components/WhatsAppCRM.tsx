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
  onContatoAtualizado: (c: ContatoCRM) => void;
  onMensagemEnviada: (contatoId: string, msg: MensagemCRM) => void;
}

const Inbox: React.FC<InboxProps> = ({
  contatos, mensagensPorContato, config, tenantId, knowledge, geminiApiKey,
  onContatoAtualizado, onMensagemEnviada,
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

interface ContatosProps {
  contatos: ContatoCRM[];
  onContatoAtualizado: (c: ContatoCRM) => void;
}

const Contatos: React.FC<ContatosProps> = ({ contatos, onContatoAtualizado }) => {
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<ContatoCRM | null>(null);
  const [instrucao, setInstrucao] = useState('');
  const [obs, setObs] = useState('');
  const [salvo, setSalvo] = useState(false);

  const filtrados = contatos.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca)
  );

  function abrirDetalhe(c: ContatoCRM) {
    setSelecionado(c);
    setInstrucao(c.instrucaoBot ?? '');
    setObs(c.observacoes ?? '');
    setSalvo(false);
  }

  function salvarDetalhe() {
    if (!selecionado) return;
    onContatoAtualizado({ ...selecionado, instrucaoBot: instrucao.trim() || undefined, observacoes: obs });
    setSelecionado(prev => prev ? { ...prev, instrucaoBot: instrucao.trim() || undefined, observacoes: obs } : prev);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
      {/* Lista */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 12, position: 'relative', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar contato..."
            style={{ width: '100%', padding: '8px 12px 8px 34px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map(c => {
            const badge = statusBadge(c.status);
            const ativo = selecionado?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => abrirDetalhe(c)}
                style={{
                  background: ativo ? '#eff6ff' : 'white', padding: '14px 18px', borderRadius: 10,
                  border: `1px solid ${ativo ? '#93c5fd' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', gap: 16,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: '#eff6ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#3b82f6', flexShrink: 0,
                }}>
                  {c.nome.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{c.nome}</span>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: badge.color + '20', color: badge.color, fontWeight: 600 }}>{badge.label}</span>
                    {c.canal === 'whatsapp'
                      ? <MessageCircle size={13} style={{ color: '#25d366' }} />
                      : <Instagram size={13} style={{ color: '#e1306c' }} />
                    }
                    {c.instrucaoBot && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#f0fdf4', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Bot size={10} /> Bot instruído
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>📞 {c.telefone}</span>
                    <span>Etapa: {etapaLabel(c.etapa)}</span>
                    {c.ultimaMensagem && <span>⏱ {timeAgo(c.ultimaMensagem)}</span>}
                  </div>
                  {c.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {c.tags.map(t => (
                        <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: '#f3f4f6', color: '#374151' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(c.score) }}>{c.score}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Score</div>
                </div>
              </div>
            );
          })}
          {filtrados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>
              Nenhum contato encontrado
            </div>
          )}
        </div>
      </div>

      {/* Painel de detalhe */}
      {selecionado && (
        <div style={{ width: 340, flexShrink: 0, border: '1px solid #e5e7eb', borderRadius: 12, background: 'white', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'flex-start' }}>
          {/* Cabeçalho */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#3b82f6', flexShrink: 0 }}>
              {selecionado.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{selecionado.nome}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{selecionado.telefone}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: statusBadge(selecionado.status).color + '20', color: statusBadge(selecionado.status).color, fontWeight: 600 }}>
              {statusBadge(selecionado.status).label}
            </span>
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: '#f3f4f6', color: '#374151', fontWeight: 600 }}>
              {etapaLabel(selecionado.etapa)}
            </span>
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: '#fdf4ff', color: '#9333ea', fontWeight: 700 }}>
              Score {selecionado.score}
            </span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: 0 }} />

          {/* Instruções do Bot */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Bot size={14} style={{ color: '#3b82f6' }} /> Instruções para o Bot
            </label>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
              Defina o objetivo da conversa para este contato. O assistente virtual usará essas instruções ao interagir.
            </p>
            <textarea
              value={instrucao}
              onChange={e => setInstrucao(e.target.value)}
              rows={4}
              placeholder="Ex: Este contato demonstrou interesse em ação trabalhista. Focar em coletar informações sobre o vínculo empregatício e agendar consulta urgente com Dr. Paulo."
              style={{
                width: '100%', padding: '9px 12px', fontSize: 12, border: '1px solid #e5e7eb',
                borderRadius: 8, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                lineHeight: 1.5, color: '#111827',
              }}
            />
          </div>

          {/* Observações */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#111827', display: 'block', marginBottom: 6 }}>
              Observações
            </label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={3}
              placeholder="Notas internas sobre este contato..."
              style={{
                width: '100%', padding: '9px 12px', fontSize: 12, border: '1px solid #e5e7eb',
                borderRadius: 8, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                lineHeight: 1.5, color: '#111827',
              }}
            />
          </div>

          <button
            onClick={salvarDetalhe}
            style={{
              padding: '10px 0', borderRadius: 8, border: 'none',
              background: salvo ? '#22c55e' : '#3b82f6', color: 'white',
              fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            {salvo ? '✓ Salvo!' : 'Salvar Alterações'}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Aba: Configurações CRM ───────────────────────────────────────────────────

interface ConfiguracoesCRMProps {
  config: ConfiguracaoCRM;
  onSalvar: (c: ConfiguracaoCRM) => void;
}

const ConfiguracoesCRM: React.FC<ConfiguracoesCRMProps> = ({ config, onSalvar }) => {
  const [form, setForm] = useState<ConfiguracaoCRM>({ ...config });
  const [areasTexto, setAreasTexto] = useState(config.areasAtuacao.join('\n'));
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    onSalvar({
      ...form,
      areasAtuacao: areasTexto.split('\n').map(s => s.trim()).filter(Boolean),
      // phoneNumberId e apiKeyWhatsApp são gerenciados em Configurações → Integrações
    });
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nome do Escritório (exibido no chat)</label>
          <input
            value={form.nomeEscritorio}
            onChange={e => setForm(f => ({ ...f, nomeEscritorio: e.target.value }))}
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Áreas de Atuação (uma por linha)</label>
          <textarea
            value={areasTexto}
            onChange={e => setAreasTexto(e.target.value)}
            rows={5}
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Horário de Atendimento</label>
          <input
            value={form.horarioAtendimento}
            onChange={e => setForm(f => ({ ...f, horarioAtendimento: e.target.value }))}
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Saudação Personalizada (opcional)</label>
          <textarea
            value={form.saudacaoPersonalizada ?? ''}
            onChange={e => setForm(f => ({ ...f, saudacaoPersonalizada: e.target.value || undefined }))}
            rows={3}
            placeholder="Olá! Bem-vindo ao nosso escritório..."
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{
          borderTop: '1px solid #e5e7eb', paddingTop: 16,
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🔗</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
              Integração com WhatsApp (Evolution API ou Meta Business)
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
              A conexão com o WhatsApp — seja via <strong>QR Code (Evolution API)</strong> ou via <strong>Meta Cloud API</strong> — é configurada em um único lugar para evitar duplicidade:
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
              Acesse <strong>Configurações Gerais → Integrações → WhatsApp Business</strong>.
            </p>
          </div>
        </div>

        <button
          onClick={salvar}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: salvo ? '#22c55e' : '#3b82f6', color: 'white',
            fontWeight: 700, fontSize: 14, cursor: 'pointer', alignSelf: 'flex-start',
            transition: 'background 0.2s',
          }}
        >
          {salvo ? '✓ Salvo!' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────

type Aba = 'inbox' | 'pipeline' | 'contatos' | 'configuracoes' | 'assistente';

const WhatsAppCRM: React.FC = () => {
  const tenantId = getCurrentTenantId() ?? 'demo';
  const [config, setConfig] = useState<ConfiguracaoCRM>(getConfiguracaoPadrao());
  const [knowledge, setKnowledge] = useState<CRMKnowledgeBase>(() =>
    loadKnowledge(tenantId, getConfiguracaoPadrao().nomeEscritorio)
  );
  const [geminiApiKey] = useState<string | undefined>(() => {
    const integrations = loadIntegrations(tenantId);
    return integrations.geminiApiKey || undefined;
  });
  const [contatos, setContatos] = useState<ContatoCRM[]>([]);
  const [leads, setLeads] = useState<LeadCRM[]>([]);
  const [mensagens, setMensagens] = useState<Record<string, MensagemCRM[]>>({});
  const [aba, setAba] = useState<Aba>('inbox');

  const kbScore = calcularScore(knowledge);
  const kbPct = Math.round(
    Object.values(kbScore).reduce((a, b) => a + b, 0) /
    Object.values(kbScore).length
  );

  // Métricas rápidas
  const totalAtivos   = contatos.filter(c => c.status === StatusConversa.ATIVA).length;
  const qualificados  = contatos.filter(c => c.status === StatusConversa.QUALIFICADO).length;
  const contratados   = leads.filter(l => l.etapaPipeline === EtapaPipeline.CONTRATADO).length;
  const scoreMediano  = contatos.length ? Math.round(contatos.reduce((s, c) => s + c.score, 0) / contatos.length) : 0;

  function moverLead(id: string, etapa: EtapaPipeline) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, etapaPipeline: etapa } : l));
  }

  const abas: { id: Aba; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'inbox',         label: 'Inbox',              icon: <MessageCircle size={15} /> },
    { id: 'pipeline',      label: 'Pipeline',           icon: <TrendingUp size={15} /> },
    { id: 'contatos',      label: 'Contatos',           icon: <Users size={15} /> },
    { id: 'assistente',    label: 'Assistente Virtual', icon: <Bot size={15} />, badge: `${kbPct}%` },
    { id: 'configuracoes', label: 'Configurações',      icon: <Settings size={15} /> },
  ];

  return (
    <div style={{ padding: '24px 28px', fontFamily: "'Inter', sans-serif" }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #25d366, #128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={18} style={{ color: 'white' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>CRM WhatsApp</h2>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Atendimento e qualificação de leads via mensageria</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {geminiApiKey ? (
            <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a', background: '#f0fdf4', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
              <Bot size={13} /> IA conectada
            </span>
          ) : (
            <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: '#d97706', background: '#fffbeb', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
              <Bot size={13} /> IA não configurada
            </span>
          )}
          <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: '#22c55e' }}>
            <Wifi size={13} /> Enterprise ativo
          </span>
        </div>
      </div>

      {/* Cards de métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Conversas Ativas',    value: totalAtivos,   icon: <MessageCircle size={18} />, color: '#3b82f6' },
          { label: 'Leads Qualificados',  value: qualificados,  icon: <Star size={18} />,           color: '#f59e0b' },
          { label: 'Contratos Fechados',  value: contratados,   icon: <CheckCheck size={18} />,    color: '#22c55e' },
          { label: 'Score Médio',         value: scoreMediano,  icon: <TrendingUp size={18} />,    color: '#8b5cf6' },
        ].map(m => (
          <div key={m.label} style={{ background: 'white', borderRadius: 12, padding: '16px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{m.label}</p>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#111827' }}>{m.value}</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: m.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>
                {m.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 0 }}>
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontWeight: aba === a.id ? 700 : 500,
              color: aba === a.id ? '#3b82f6' : '#6b7280', fontSize: 13,
              borderBottom: aba === a.id ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -1, borderRadius: 0,
              transition: 'all 0.15s',
            }}
          >
            {a.icon}
            {a.label}
            {a.badge && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700,
                background: kbPct >= 80 ? '#dcfce7' : kbPct >= 50 ? '#fef9c3' : '#fee2e2',
                color: kbPct >= 80 ? '#16a34a' : kbPct >= 50 ? '#a16207' : '#dc2626',
                marginLeft: 2,
              }}>{a.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      {aba === 'inbox' && (
        <Inbox
          contatos={contatos}
          mensagensPorContato={mensagens}
          config={config}
          tenantId={tenantId}
          knowledge={knowledge}
          geminiApiKey={geminiApiKey}
          onContatoAtualizado={c => setContatos(prev => prev.map(x => x.id === c.id ? c : x))}
          onMensagemEnviada={(cid, msg) => setMensagens(prev => ({
            ...prev, [cid]: [...(prev[cid] ?? []), msg]
          }))}
        />
      )}
      {aba === 'pipeline' && (
        <Pipeline leads={leads} onLeadMovido={moverLead} />
      )}
      {aba === 'contatos' && (
        <Contatos
          contatos={contatos}
          onContatoAtualizado={c => setContatos(prev => prev.map(x => x.id === c.id ? c : x))}
        />
      )}
      {aba === 'assistente' && (
        <CRMAssistantConfig
          knowledge={knowledge}
          tenantId={tenantId}
          onChange={kb => { setKnowledge(kb); saveKnowledge(tenantId, kb); }}
        />
      )}
      {aba === 'configuracoes' && (
        <ConfiguracoesCRM config={config} onSalvar={setConfig} />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default WhatsAppCRM;
