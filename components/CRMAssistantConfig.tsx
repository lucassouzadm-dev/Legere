/**
 * CRMAssistantConfig.tsx
 * Configuração completa do assistente virtual do CRM WhatsApp.
 *
 * Organizado em seções colapsáveis com indicador de completude.
 * Cada campo tem tooltip explicando por que aquela informação importa para o bot.
 */

import React, { useState, useCallback } from 'react';
import {
  CRMKnowledgeBase, AdvogadoCRM, AreaAtuacaoCRM, FaqItem,
  saveKnowledge, calcularScore, buildRichSystemPrompt,
} from '../services/crmKnowledge';
import { BRAZIL_STATES } from '../constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';
const textareaCls = `${inputCls} resize-y`;
const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1';

function Field({ label, hint, children, required }: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-4">
      <label className={labelCls}>
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}%</span>;
}

// ─── Seção colapsável ─────────────────────────────────────────────────────────

function Section({ title, icon, score, max, children, defaultOpen = false }:
  { title: string; icon: string; score: number; max: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const pct = Math.round((score / max) * 100);
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span className="font-bold text-gray-800 text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <ScoreBadge score={pct} />
          </div>
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && <div className="p-5 bg-white border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface CRMAssistantConfigProps {
  knowledge: CRMKnowledgeBase;
  tenantId: string;
  onChange: (kb: CRMKnowledgeBase) => void;
}

const CRMAssistantConfig: React.FC<CRMAssistantConfigProps> = ({ knowledge, tenantId, onChange }) => {
  const [kb, setKb] = useState<CRMKnowledgeBase>(knowledge);
  const [saved, setSaved] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const update = useCallback(<K extends keyof CRMKnowledgeBase>(key: K, value: CRMKnowledgeBase[K]) => {
    setKb(prev => {
      const next = { ...prev, [key]: value };
      saveKnowledge(tenantId, next);
      onChange(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return next;
    });
  }, [tenantId, onChange]);

  const score = calcularScore(kb);

  // ── Advogados ──────────────────────────────────────────────────────────────

  function addAdvogado() {
    update('advogados', [...kb.advogados, { id: uid(), nome: '', oab: '', especialidades: '', bio: '' }]);
  }
  function updateAdvogado(id: string, field: keyof AdvogadoCRM, value: string) {
    update('advogados', kb.advogados.map(a => a.id === id ? { ...a, [field]: value } : a));
  }
  function removeAdvogado(id: string) {
    update('advogados', kb.advogados.filter(a => a.id !== id));
  }

  // ── Áreas ──────────────────────────────────────────────────────────────────

  function addArea() {
    update('areas', [...kb.areas, { id: uid(), area: '', casosAceitos: '', casosRecusados: '', exemplosCasos: '' }]);
  }
  function updateArea(id: string, field: keyof AreaAtuacaoCRM, value: string) {
    update('areas', kb.areas.map(a => a.id === id ? { ...a, [field]: value } : a));
  }
  function removeArea(id: string) {
    update('areas', kb.areas.filter(a => a.id !== id));
  }

  // ── FAQ ────────────────────────────────────────────────────────────────────

  function addFaq() {
    update('faq', [...kb.faq, { id: uid(), pergunta: '', resposta: '' }]);
  }
  function updateFaq(id: string, field: keyof FaqItem, value: string) {
    update('faq', kb.faq.map(f => f.id === id ? { ...f, [field]: value } : f));
  }
  function removeFaq(id: string) {
    update('faq', kb.faq.filter(f => f.id !== id));
  }

  // ── Seções de score ────────────────────────────────────────────────────────

  const s = (nome: string) => score.secoes.find(x => x.nome === nome) ?? { score: 0, max: 1, faltando: [] };

  return (
    <div>
      {/* Cabeçalho com score global */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">Assistente Virtual — Base de Conhecimento</h3>
          <p className="text-sm text-gray-500 mt-1">
            Quanto mais completo, mais inteligente e preciso será o atendimento automático.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {saved && <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">✓ Salvo</span>}
          <div className="text-center">
            <div className="text-3xl font-black" style={{ color: score.total >= 80 ? '#16a34a' : score.total >= 50 ? '#d97706' : '#dc2626' }}>
              {score.total}%
            </div>
            <div className="text-xs text-gray-400">completo</div>
          </div>
        </div>
      </div>

      {/* Alertas de itens faltando */}
      {score.total < 60 && (
        <div className="mb-5 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
          <strong>⚠️ Base de conhecimento incompleta.</strong> O assistente responderá de forma genérica até você preencher as seções abaixo.
          <div className="mt-2 flex flex-wrap gap-2">
            {score.secoes.filter(s => s.faltando.length > 0).flatMap(s =>
              s.faltando.map(f => (
                <span key={f} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{s.nome}: {f}</span>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Seção 1: Identidade ─────────────────────────────────────────────── */}
      <Section title="1. Identidade do Escritório" icon="🏢" score={s('Identidade').score} max={s('Identidade').max} defaultOpen>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <Field label="Nome completo do escritório" required hint="Nome exato que o bot usará ao se apresentar.">
            <input className={inputCls} value={kb.nomeCompleto} onChange={e => update('nomeCompleto', e.target.value)} placeholder="Ex: Silva & Associados Advogados" />
          </Field>
          <Field label="E-mail profissional" hint="Para informar ao cliente quando necessário.">
            <input className={inputCls} value={kb.email} onChange={e => update('email', e.target.value)} placeholder="contato@escritorio.adv.br" />
          </Field>
          <Field label="Endereço (rua e número)">
            <input className={inputCls} value={kb.endereco} onChange={e => update('endereco', e.target.value)} placeholder="Rua das Flores, 123, sala 45" />
          </Field>
          <Field label="Bairro">
            <input className={inputCls} value={kb.bairro} onChange={e => update('bairro', e.target.value)} placeholder="Centro" />
          </Field>
          <Field label="Cidade" required>
            <input className={inputCls} value={kb.cidade} onChange={e => update('cidade', e.target.value)} placeholder="Salvador" />
          </Field>
          <Field label="Estado" required>
            <select className={inputCls} value={kb.estado} onChange={e => update('estado', e.target.value)}>
              <option value="">Selecione</option>
              {BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Telefone fixo">
            <input className={inputCls} value={kb.telefoneFixo} onChange={e => update('telefoneFixo', e.target.value)} placeholder="(71) 3333-4444" />
          </Field>
          <Field label="Celular / WhatsApp">
            <input className={inputCls} value={kb.celular} onChange={e => update('celular', e.target.value)} placeholder="(71) 99999-8888" />
          </Field>
          <Field label="Site">
            <input className={inputCls} value={kb.site} onChange={e => update('site', e.target.value)} placeholder="www.escritorio.adv.br" />
          </Field>
          <Field label="Instagram">
            <input className={inputCls} value={kb.instagram} onChange={e => update('instagram', e.target.value)} placeholder="@escritorio" />
          </Field>
        </div>
        <Field label="Como chegar / referência" hint="O bot informa isso quando o cliente pergunta sobre localização.">
          <textarea className={textareaCls} rows={2} value={kb.comoChegar} onChange={e => update('comoChegar', e.target.value)} placeholder="Próximo ao fórum, ao lado do Banco do Brasil. Estacionamento no local." />
        </Field>
      </Section>

      {/* ── Seção 2: Equipe ─────────────────────────────────────────────────── */}
      <Section title="2. Equipe de Advogados" icon="👨‍⚖️" score={s('Equipe').score} max={s('Equipe').max}>
        <Field label="Apresentação geral da equipe" hint="Texto de abertura sobre o escritório — o bot usa para se apresentar.">
          <textarea className={textareaCls} rows={2} value={kb.apresentacaoEquipe} onChange={e => update('apresentacaoEquipe', e.target.value)}
            placeholder="Somos um escritório com 10 anos de atuação, especializado em direito de família e trabalhista, atendendo em toda a Bahia." />
        </Field>

        {kb.advogados.map((adv, i) => (
          <div key={adv.id} className="border border-blue-100 rounded-xl p-4 mb-3 bg-blue-50/30">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Advogado {i + 1}</span>
              <button type="button" onClick={() => removeAdvogado(adv.id)} className="text-xs text-red-500 hover:text-red-700">✕ Remover</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <Field label="Nome completo" required>
                <input className={inputCls} value={adv.nome} onChange={e => updateAdvogado(adv.id, 'nome', e.target.value)} placeholder="Dr. João Silva" />
              </Field>
              <Field label="OAB (nº e estado)" required hint='Ex: "SP 123456" ou "BA 98765"'>
                <input className={inputCls} value={adv.oab} onChange={e => updateAdvogado(adv.id, 'oab', e.target.value)} placeholder="BA 123456" />
              </Field>
              <Field label="Especialidades" required hint="O bot usa para direcionar o cliente ao advogado certo.">
                <input className={inputCls} value={adv.especialidades} onChange={e => updateAdvogado(adv.id, 'especialidades', e.target.value)} placeholder="Direito de Família, Divórcios, Guarda" />
              </Field>
              <Field label="Mini-bio (opcional)" hint="Frase curta que o bot pode dizer ao apresentar o advogado.">
                <input className={inputCls} value={adv.bio ?? ''} onChange={e => updateAdvogado(adv.id, 'bio', e.target.value)} placeholder="20 anos de experiência em direito trabalhista" />
              </Field>
            </div>
          </div>
        ))}
        <button type="button" onClick={addAdvogado}
          className="mt-1 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-semibold border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-50 transition-colors">
          + Adicionar advogado
        </button>
      </Section>

      {/* ── Seção 3: Áreas de Atuação ──────────────────────────────────────── */}
      <Section title="3. Áreas de Atuação (detalhado)" icon="⚖️" score={s('Áreas de Atuação').score} max={s('Áreas de Atuação').max}>
        <p className="text-xs text-gray-500 mb-4 bg-gray-50 p-3 rounded-lg">
          Esta é a seção mais importante. Detalhe cada área para que o bot consiga identificar se o caso do cliente se encaixa no perfil do escritório — e informar corretamente quando não for o caso.
        </p>

        {kb.areas.map((area, i) => (
          <div key={area.id} className="border border-green-100 rounded-xl p-4 mb-4 bg-green-50/20">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Área {i + 1}</span>
              <button type="button" onClick={() => removeArea(area.id)} className="text-xs text-red-500 hover:text-red-700">✕ Remover</button>
            </div>
            <Field label="Nome da área" required>
              <input className={inputCls} value={area.area} onChange={e => updateArea(area.id, 'area', e.target.value)} placeholder="Direito de Família" />
            </Field>
            <Field label="Casos que ACEITAMOS nessa área" required hint="Seja específico. O bot usa isso para confirmar que pode ajudar.">
              <textarea className={textareaCls} rows={2} value={area.casosAceitos} onChange={e => updateArea(area.id, 'casosAceitos', e.target.value)}
                placeholder="Divórcio consensual e litigioso, guarda de filhos, pensão alimentícia, inventário, adoção." />
            </Field>
            <Field label="Casos que NÃO atendemos nessa área" required hint="Crucial para não gerar expectativas erradas. O bot saberá indicar que não é o perfil do escritório.">
              <textarea className={textareaCls} rows={2} value={area.casosRecusados} onChange={e => updateArea(area.id, 'casosRecusados', e.target.value)}
                placeholder="Não atendemos casos de violência doméstica com urgência extrema (indicar defensoria pública)." />
            </Field>
            <Field label="Exemplos de casos (para o bot reconhecer)" hint="Termos que clientes usam no dia a dia ao descrever o problema.">
              <textarea className={textareaCls} rows={2} value={area.exemplosCasos} onChange={e => updateArea(area.id, 'exemplosCasos', e.target.value)}
                placeholder="'quero me separar', 'meu marido não paga pensão', 'briga pela guarda do meu filho', 'minha mãe faleceu e preciso inventário'" />
            </Field>
          </div>
        ))}
        <button type="button" onClick={addArea}
          className="mt-1 flex items-center gap-2 text-sm text-green-700 hover:text-green-900 font-semibold border border-green-200 rounded-lg px-4 py-2 hover:bg-green-50 transition-colors">
          + Adicionar área de atuação
        </button>
      </Section>

      {/* ── Seção 4: Atendimento e Horários ───────────────────────────────── */}
      <Section title="4. Horários e Atendimento" icon="🕐" score={2} max={2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <Field label="Horário de funcionamento" required>
            <input className={inputCls} value={kb.horarioAtendimento} onChange={e => update('horarioAtendimento', e.target.value)} placeholder="Segunda a Sexta, das 8h às 18h" />
          </Field>
          <Field label="Atendimento no sábado (deixe vazio se não atende)">
            <input className={inputCls} value={kb.horarioSabado} onChange={e => update('horarioSabado', e.target.value)} placeholder="Sábados das 9h ao meio-dia" />
          </Field>
        </div>
        <Field label="Tempo de resposta pelo WhatsApp" hint="O bot informa essa expectativa para o cliente.">
          <input className={inputCls} value={kb.tempoRespostaWhatsApp} onChange={e => update('tempoRespostaWhatsApp', e.target.value)} placeholder="Respondemos em até 2 horas no horário de atendimento" />
        </Field>
        <Field label="O que fazer fora do horário / urgências" hint="Instrução que o bot dará para clientes que entram em contato fora do expediente.">
          <textarea className={textareaCls} rows={2} value={kb.politicaUrgencia} onChange={e => update('politicaUrgencia', e.target.value)}
            placeholder="Em casos urgentes com prazo processual, deixe sua mensagem que responderemos na abertura do escritório. Para emergências reais, ligue: (71) 99999-8888." />
        </Field>
      </Section>

      {/* ── Seção 5: Honorários ────────────────────────────────────────────── */}
      <Section title="5. Consulta e Honorários" icon="💰" score={s('Honorários').score} max={s('Honorários').max}>
        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-xl">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={kb.primeiraConsultaGratuita}
              onChange={e => update('primeiraConsultaGratuita', e.target.checked)}
              className="w-4 h-4 rounded" />
            <span className="text-sm font-semibold text-gray-700">Primeira consulta gratuita</span>
          </label>
          <span className="text-xs text-gray-400">O bot informará isso automaticamente quando o cliente perguntar sobre custos.</span>
        </div>

        {!kb.primeiraConsultaGratuita && (
          <Field label="Valor da consulta" hint="O bot informará este valor quando perguntado. Pode ser uma faixa.">
            <input className={inputCls} value={kb.valorConsulta} onChange={e => update('valorConsulta', e.target.value)} placeholder="R$ 200,00 por hora" />
          </Field>
        )}

        <Field label="Modelos de honorários praticados" required hint="Ex: fixo, por êxito, misto. O bot explica o modelo ao cliente.">
          <textarea className={textareaCls} rows={2} value={kb.modelosHonorarios} onChange={e => update('modelosHonorarios', e.target.value)}
            placeholder="Trabalhamos com honorários fixos para consultas e causas simples, e por êxito para ações trabalhistas e previdenciárias. Sempre em contrato." />
        </Field>
        <Field label="Política de orçamento" required hint="Quando e como o escritório envia a proposta de honorários.">
          <textarea className={textareaCls} rows={2} value={kb.politicaOrcamento} onChange={e => update('politicaOrcamento', e.target.value)}
            placeholder="Após a consulta inicial, enviamos proposta detalhada de honorários em até 24 horas por e-mail ou WhatsApp." />
        </Field>
        <Field label="Formas de pagamento aceitas" required>
          <input className={inputCls} value={kb.formasPagamento} onChange={e => update('formasPagamento', e.target.value)} placeholder="PIX, transferência bancária, cartão de crédito (parcelamos em até 12x)" />
        </Field>
      </Section>

      {/* ── Seção 6: Qualificação de Leads ────────────────────────────────── */}
      <Section title="6. Qualificação de Leads" icon="🎯" score={s('Qualificação').score} max={s('Qualificação').max}>
        <Field label="Dados mínimos que o bot SEMPRE deve coletar" required hint="O bot não encerrará a conversa sem esses dados. Eles ficam disponíveis no pipeline.">
          <textarea className={textareaCls} rows={2} value={kb.dadosMinimosColetar} onChange={e => update('dadosMinimosColetar', e.target.value)}
            placeholder="Nome completo, número de telefone, cidade de residência, área jurídica do problema, nível de urgência (urgente / em breve / sem pressa)." />
        </Field>
        <Field label="O que o escritório considera 'urgente'" required hint="O bot identificará urgência nas mensagens e usará mensagem de urgência configurada.">
          <textarea className={textareaCls} rows={2} value={kb.criteriosUrgencia} onChange={e => update('criteriosUrgencia', e.target.value)}
            placeholder="Prazo processual vencendo em até 5 dias, ameaça de prisão, cumprimento de sentença iminente, violação de medida protetiva." />
        </Field>
        <Field label="Perguntas específicas que o bot deve fazer" hint="Além das padrão, quais informações ajudam a qualificar melhor para o seu escritório?">
          <textarea className={textareaCls} rows={3} value={kb.perguntasQualificacao} onChange={e => update('perguntasQualificacao', e.target.value)}
            placeholder="Em casos trabalhistas: perguntar se ainda está empregado ou foi demitido, e data da demissão. Em família: perguntar se há filhos menores envolvidos." />
        </Field>
        <div className="flex items-center gap-3 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={kb.qualificarPorArea}
              onChange={e => update('qualificarPorArea', e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Identificar a área jurídica antes de qualificar o lead</span>
          </label>
        </div>
      </Section>

      {/* ── Seção 7: FAQ ───────────────────────────────────────────────────── */}
      <Section title="7. Perguntas Frequentes (FAQ)" icon="❓" score={s('FAQ').score} max={s('FAQ').max}>
        <p className="text-xs text-gray-500 mb-4">
          O bot consultará essas respostas quando o cliente fizer perguntas similares. Recomendamos ao menos 5 perguntas.
        </p>

        {kb.faq.map((item, i) => (
          <div key={item.id} className="border border-purple-100 rounded-xl p-4 mb-3 bg-purple-50/20">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-purple-700">Pergunta {i + 1}</span>
              <button type="button" onClick={() => removeFaq(item.id)} className="text-xs text-red-500 hover:text-red-700">✕</button>
            </div>
            <Field label="Pergunta do cliente">
              <input className={inputCls} value={item.pergunta} onChange={e => updateFaq(item.id, 'pergunta', e.target.value)}
                placeholder="Quanto tempo leva um processo de divórcio?" />
            </Field>
            <Field label="Resposta do bot">
              <textarea className={textareaCls} rows={2} value={item.resposta} onChange={e => updateFaq(item.id, 'resposta', e.target.value)}
                placeholder="O divórcio consensual pode ser concluído em 30 a 60 dias em cartório. Já o litigioso pode levar de 6 meses a alguns anos, dependendo do juízo. Agende uma consulta para avaliarmos seu caso." />
            </Field>
          </div>
        ))}
        <button type="button" onClick={addFaq}
          className="flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900 font-semibold border border-purple-200 rounded-lg px-4 py-2 hover:bg-purple-50 transition-colors">
          + Adicionar pergunta
        </button>
      </Section>

      {/* ── Seção 8: Tom e Personalidade ──────────────────────────────────── */}
      <Section title="8. Personalidade do Assistente" icon="🎭" score={2} max={2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <Field label="Nome do assistente virtual" hint="Como o bot se apresentará. Ex: 'Olá! Sou a Júlia, assistente do escritório…'">
            <input className={inputCls} value={kb.nomeAssistente} onChange={e => update('nomeAssistente', e.target.value)} placeholder="Júlia" />
          </Field>
          <Field label="Tom de comunicação" hint="Escolha o tom que melhor representa a identidade do escritório.">
            <select className={inputCls} value={kb.tomComunicacao} onChange={e => update('tomComunicacao', e.target.value as any)}>
              <option value="formal">Formal — extremamente respeitoso e protocolar</option>
              <option value="profissional_amigavel">Profissional e amigável — cordial sem ser informal</option>
              <option value="informal">Próximo e descontraído — linguagem do dia a dia</option>
            </select>
          </Field>
        </div>
        <div className="flex gap-6 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={kb.usarNomeProprio} onChange={e => update('usarNomeProprio', e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Chamar o cliente pelo nome durante a conversa</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={kb.usarEmoji} onChange={e => update('usarEmoji', e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Usar emojis com moderação 😊</span>
          </label>
        </div>
      </Section>

      {/* ── Seção 9: Mensagens Personalizadas ─────────────────────────────── */}
      <Section title="9. Mensagens Personalizadas" icon="✉️" score={s('Mensagens').score} max={s('Mensagens').max}>
        <p className="text-xs text-gray-500 mb-4">Se deixar em branco, o bot gerará mensagens automáticas baseadas no contexto.</p>
        <Field label="Mensagem de boas-vindas" required hint="Primeira mensagem que o cliente recebe ao iniciar o contato.">
          <textarea className={textareaCls} rows={3} value={kb.mensagemBoasVindas} onChange={e => update('mensagemBoasVindas', e.target.value)}
            placeholder="Olá! 👋 Bem-vindo ao Silva & Associados. Sou a Júlia, sua assistente virtual. Estou aqui para entender sua situação jurídica e conectar você com nossos especialistas. Como posso ajudá-lo hoje?" />
        </Field>
        <Field label="Mensagem fora do horário de atendimento" required>
          <textarea className={textareaCls} rows={2} value={kb.mensagemForaHorario} onChange={e => update('mensagemForaHorario', e.target.value)}
            placeholder="Olá! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Deixe sua mensagem que retornaremos assim que abrirmos. Em casos urgentes com prazo processual, ligue: (71) 99999-8888." />
        </Field>
        <Field label="Mensagem ao detectar urgência alta">
          <textarea className={textareaCls} rows={2} value={kb.mensagemUrgencia} onChange={e => update('mensagemUrgencia', e.target.value)}
            placeholder="Entendi que seu caso é urgente! 🚨 Vou priorizar o seu atendimento. Um de nossos advogados entrará em contato em até 1 hora. Enquanto isso, pode me passar mais detalhes?" />
        </Field>
        <Field label="Mensagem ao transferir para advogado" required hint="Enviada quando o bot encaminha o lead para atendimento humano.">
          <textarea className={textareaCls} rows={2} value={kb.mensagemTransferenciaHumano} onChange={e => update('mensagemTransferenciaHumano', e.target.value)}
            placeholder="Obrigada pelas informações, {nome}! Vou encaminhar seu caso para um de nossos advogados, que entrará em contato em breve para agendar sua consulta. 📅" />
        </Field>
        <Field label="Mensagem de encerramento">
          <textarea className={textareaCls} rows={2} value={kb.mensagemEncerramento} onChange={e => update('mensagemEncerramento', e.target.value)}
            placeholder="Foi um prazer! Nosso escritório estará à disposição. Até breve! 😊" />
        </Field>
      </Section>

      {/* ── Seção 10: Regras Especiais ────────────────────────────────────── */}
      <Section title="10. Regras e Restrições" icon="📋" score={1} max={1}>
        <Field label="Casos que o escritório NÃO atende (de nenhuma área)" hint="O bot informará educadamente e, quando possível, indicará alternativas.">
          <textarea className={textareaCls} rows={2} value={kb.casosNaoAtender} onChange={e => update('casosNaoAtender', e.target.value)}
            placeholder="Não atendemos: direito tributário empresarial complexo, crimes dolosos, contratos internacionais. Para essas áreas, indicamos a OAB local para indicação de especialista." />
        </Field>
        <Field label="Região de atendimento" hint="O bot informará se o cliente está fora da região de atuação.">
          <input className={inputCls} value={kb.regiaoAtendimento} onChange={e => update('regiaoAtendimento', e.target.value)}
            placeholder="Atendemos em toda a Bahia e casos federais de qualquer estado. Atendimento remoto disponível para todo o Brasil." />
        </Field>
        <Field label="Instrução para clientes já existentes" hint="Como o bot deve orientar quem já é cliente do escritório.">
          <textarea className={textareaCls} rows={2} value={kb.clientesExistentes} onChange={e => update('clientesExistentes', e.target.value)}
            placeholder="Se você já é nosso cliente, entre em contato diretamente com o advogado responsável pelo seu processo ou pelo e-mail clientes@escritorio.adv.br." />
        </Field>
        <Field label="Instruções de sigilo e ética" hint="Lembretes éticos adicionais para o comportamento do bot.">
          <textarea className={textareaCls} rows={2} value={kb.instrucoesSigilo} onChange={e => update('instrucoesSigilo', e.target.value)}
            placeholder="Nunca mencione outros clientes do escritório. Não confirme se uma pessoa específica é ou foi cliente. Em caso de dúvida ética, transfira para atendimento humano." />
        </Field>
        <Field label="Outras instruções livres para o assistente">
          <textarea className={textareaCls} rows={3} value={kb.outrasInstrucoes} onChange={e => update('outrasInstrucoes', e.target.value)}
            placeholder="Regras específicas do seu escritório que não se encaixam nas categorias acima." />
        </Field>
      </Section>

      {/* Preview do Prompt */}
      <div className="mt-4">
        <button type="button" onClick={() => setShowPrompt(p => !p)}
          className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-2">
          {showPrompt ? '▲ Ocultar' : '▼ Visualizar'} prompt gerado para a IA
        </button>
        {showPrompt && (
          <pre className="mt-3 p-4 bg-slate-900 text-slate-200 rounded-xl text-xs overflow-auto max-h-80 leading-relaxed whitespace-pre-wrap">
            {buildRichSystemPrompt(kb)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default CRMAssistantConfig;
