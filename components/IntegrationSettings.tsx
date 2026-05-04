/**
 * IntegrationSettings.tsx
 * Wizard guiado para configuração de integrações do Legere.
 *
 * O contratante só precisa:
 *   - Google Gemini: colar a API key (1 passo)
 *   - WhatsApp QR Code: inserir URL + chave da Evolution API → escanear QR
 *   - WhatsApp Meta API: inserir Phone ID + Token → copiar webhook
 *
 * Nenhuma configuração de servidor ou arquivo .env é necessária.
 * Tudo fica salvo por tenant no localStorage (e pode ser migrado para Supabase).
 */

import React, { useState, useEffect, useRef } from 'react';
import { TenantIntegrations, Tenant, PlanType, PLAN_FEATURES } from '../types';
import {
  loadIntegrations,
  saveIntegrations,
  generateVerifyToken,
  getCurrentTenantId,
  getAiUsage,
} from '../services/tenantService';
import { PLATFORM_EVOLUTION_URL, PLATFORM_EVOLUTION_KEY } from '../services/gemini';

// ─── HelpBox ─────────────────────────────────────────────────────────────────

interface HelpBoxProps {
  children: React.ReactNode;
  label?: string;
}

const HelpBox: React.FC<HelpBoxProps> = ({ children, label = 'Como funciona?' }) => {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={label}
        style={{
          width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #93c5fd',
          background: open ? '#3b82f6' : '#eff6ff', color: open ? 'white' : '#3b82f6',
          cursor: 'pointer', fontWeight: 800, fontSize: 12, lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.15s', padding: 0,
        }}
        aria-label={label}
      >
        ?
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 30, left: 0, zIndex: 100,
          background: 'white', border: '1.5px solid #bfdbfe',
          borderRadius: 14, padding: '18px 20px', width: 360,
          boxShadow: '0 8px 32px rgba(59,130,246,0.13)',
          fontSize: 13, color: '#1e3a5f', lineHeight: 1.7,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#1d4ed8' }}>ℹ️ {label}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af', lineHeight: 1, padding: '0 2px' }}
            >✕</button>
          </div>
          {children}
        </div>
      )}
    </span>
  );
};

// ─── Helpers visuais ──────────────────────────────────────────────────────────

type StatusType = 'idle' | 'testing' | 'ok' | 'error';

function StatusBadge({ status, label }: { status: StatusType; label: string }) {
  const map: Record<StatusType, { color: string; bg: string; dot: string }> = {
    idle:    { color: '#6b7280', bg: '#f3f4f6', dot: '#d1d5db' },
    testing: { color: '#d97706', bg: '#fef3c7', dot: '#f59e0b' },
    ok:      { color: '#16a34a', bg: '#dcfce7', dot: '#22c55e' },
    error:   { color: '#dc2626', bg: '#fee2e2', dot: '#ef4444' },
  };
  const s = map[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, display: 'inline-block', ...(status === 'testing' ? { animation: 'pulse 1s infinite' } : {}) }} />
      {label}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ padding: '4px 12px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer', fontWeight: 600, color: copied ? '#16a34a' : '#374151', whiteSpace: 'nowrap' }}
    >
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#3b82f6', marginTop: 2 }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 6 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #e5e7eb',
  borderRadius: 8, boxSizing: 'border-box', fontFamily: 'inherit', color: '#111827',
};

// ─── Painel de Créditos de IA ─────────────────────────────────────────────────

const AiCreditsPanel: React.FC<{ tenantId: string; monthlyLimit: number }> = ({ tenantId, monthlyLimit }) => {
  if (monthlyLimit <= 0) return null;
  const { count }   = getAiUsage(tenantId);
  const pct         = Math.min(100, Math.round((count / monthlyLimit) * 100));
  const remaining   = Math.max(0, monthlyLimit - count);
  const barColor    = pct >= 100 ? '#dc2626' : pct >= 90 ? '#ea580c' : pct >= 75 ? '#d97706' : '#16a34a';
  const bgAlert     = pct >= 100 ? '#fee2e2' : pct >= 90 ? '#fff7ed' : pct >= 75 ? '#fef3c7' : '#f0fdf4';
  const borderAlert = pct >= 100 ? '#fca5a5' : pct >= 90 ? '#fed7aa' : pct >= 75 ? '#fde68a' : '#bbf7d0';
  const textAlert   = pct >= 100 ? '#991b1b' : pct >= 90 ? '#9a3412' : pct >= 75 ? '#78350f' : '#166534';
  const alertMsg    = pct >= 100
    ? 'Limite atingido. IA pausada até o início do próximo mês.'
    : pct >= 90 ? `Atenção: apenas ${remaining} crédito${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}!`
    : pct >= 75 ? `75% dos créditos usados. Restam ${remaining}.`
    : `${remaining} crédito${remaining !== 1 ? 's' : ''} disponível${remaining !== 1 ? 'eis' : ''} este mês.`;

  return (
    <div style={{ background: bgAlert, border: `1px solid ${borderAlert}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: textAlert }}>
          {pct >= 100 ? '🚫' : pct >= 90 ? '🔴' : pct >= 75 ? '⚠️' : '✅'} Créditos de IA — {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
        </span>
        <span style={{ fontWeight: 800, fontSize: 15, color: barColor }}>{pct}%</span>
      </div>
      <div style={{ background: '#e5e7eb', borderRadius: 999, height: 8, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 999, transition: 'width 0.4s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: textAlert }}>
        <span>{alertMsg}</span>
        <span style={{ fontWeight: 600 }}>{count} / {monthlyLimit}</span>
      </div>
    </div>
  );
};

// ─── Seção: Google Gemini ─────────────────────────────────────────────────────

interface GeminiSectionProps {
  integrations: TenantIntegrations;
  onChange: (partial: Partial<TenantIntegrations>) => void;
  hasAiFeature: boolean;
  geminiIncluded: boolean;
  aiMonthlyLimit: number;
  tenantId: string;
}

const GeminiSection: React.FC<GeminiSectionProps> = ({
  integrations, onChange, hasAiFeature, geminiIncluded, aiMonthlyLimit, tenantId,
}) => {
  const [key, setKey]           = useState(integrations.geminiApiKey ?? '');
  const [showKeyInput, setShowKeyInput] = useState(!!integrations.geminiApiKey);
  const [status, setStatus]     = useState<StatusType>(
    integrations.geminiApiKey ? 'ok' : geminiIncluded ? 'ok' : 'idle'
  );
  const [errorMsg, setErrorMsg] = useState('');

  async function testar() {
    if (!key.trim()) { setStatus('error'); setErrorMsg('Cole a chave antes de testar.'); return; }
    setStatus('testing'); setErrorMsg('');
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key.trim()}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responda apenas: OK' }] }] }) }
      );
      if (res.ok) { setStatus('ok'); onChange({ geminiApiKey: key.trim() }); }
      else {
        const j = await res.json().catch(() => ({}));
        setStatus('error'); setErrorMsg(j?.error?.message ?? `Erro HTTP ${res.status}.`);
      }
    } catch { setStatus('error'); setErrorMsg('Sem conexão com a API do Google.'); }
  }

  const statusLabel: Record<StatusType, string> = {
    idle: 'Não configurado', testing: 'Testando…', ok: 'Ativo', error: 'Erro',
  };

  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #4285f4, #34a853)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>Google Gemini AI</span>
              {geminiIncluded && (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '2px 10px', borderRadius: 999 }}>
                  INCLUSO NO PLANO
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {!hasAiFeature ? '⚠️ Requer plano Pro ou superior'
                : geminiIncluded ? `IA da plataforma ativa · ${aiMonthlyLimit} créditos/mês inclusos`
                : 'Geração de petições, análise de publicações e assistente WhatsApp'}
            </div>
          </div>
        </div>
        <StatusBadge status={status} label={statusLabel[status]} />
      </div>

      {!hasAiFeature ? (
        <div style={{ padding: '14px 18px', background: '#fef3c7', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
          Faça upgrade para o plano <strong>Pro</strong> para habilitar as funcionalidades de IA. Veja a aba <strong>Meu Plano</strong>.
        </div>
      ) : (
        <>
          <AiCreditsPanel tenantId={tenantId} monthlyLimit={aiMonthlyLimit} />

          {geminiIncluded && (
            <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, color: '#166534', marginBottom: 14 }}>
              ✅ <strong>IA já está configurada e ativa.</strong> A plataforma fornece o Gemini incluído no seu plano — nenhuma configuração necessária.
            </div>
          )}

          <button type="button" onClick={() => setShowKeyInput(v => !v)}
            style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginBottom: 12 }}>
            {showKeyInput ? '▲ Ocultar' : '▼ Usar minha própria chave Gemini (opcional — sem limite de créditos)'}
          </button>

          {showKeyInput && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="API Key do Google Gemini" hint="Opcional. Se preenchida, substitui a chave da plataforma e remove o limite mensal de créditos.">
                <input type="password" value={key} onChange={e => setKey(e.target.value)}
                  placeholder="AIzaSy..." style={inputStyle} autoComplete="off" />
              </Field>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={testar} disabled={status === 'testing' || !key.trim()}
                  style={{ padding: '9px 20px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
                    background: key.trim() ? '#3b82f6' : '#e5e7eb', color: key.trim() ? 'white' : '#9ca3af', cursor: key.trim() ? 'pointer' : 'default' }}>
                  {status === 'testing' ? '⏳ Testando…' : '⚡ Testar e Salvar'}
                </button>
                {integrations.geminiApiKey && (
                  <button onClick={() => { onChange({ geminiApiKey: undefined }); setKey(''); setStatus(geminiIncluded ? 'ok' : 'idle'); }}
                    style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Remover chave própria
                  </button>
                )}
              </div>
              {status === 'error' && <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 8, fontSize: 12, color: '#b91c1c' }}>✕ {errorMsg}</div>}
              {status === 'ok' && key && <div style={{ padding: '10px 14px', background: '#dcfce7', borderRadius: 8, fontSize: 12, color: '#166534', fontWeight: 600 }}>✓ Chave própria ativa — sem limite de créditos mensais.</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Seção: WhatsApp ──────────────────────────────────────────────────────────

interface WhatsAppSectionProps {
  integrations: TenantIntegrations;
  tenantId: string;
  onChange: (partial: Partial<TenantIntegrations>) => void;
  hasWhatsAppFeature: boolean;
  evolutionApiIncluded: boolean;
}

// QR Code simulado (padrão visual de QR para demo; em produção vem da Evolution API)
const QRCodeDemo: React.FC<{ onConnected: () => void }> = ({ onConnected }) => {
  const [segundos, setSegundos] = useState(60);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (conectado) return;
    const t = setInterval(() => setSegundos(s => {
      if (s <= 1) { clearInterval(t); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [conectado]);

  // Simular conexão após 5 segundos de exibição (demo)
  useEffect(() => {
    const t = setTimeout(() => {
      setConectado(true);
      onConnected();
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  if (conectado) {
    return (
      <div style={{ textAlign: 'center', padding: '28px 16px', background: '#f0fdf4', borderRadius: 12, border: '2px solid #bbf7d0' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#166534' }}>WhatsApp conectado!</div>
        <div style={{ fontSize: 13, color: '#4b5563', marginTop: 4 }}>O assistente virtual já está recebendo mensagens.</div>
      </div>
    );
  }

  if (segundos === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', background: '#fef3c7', borderRadius: 12 }}>
        <div style={{ fontSize: 13, color: '#92400e', marginBottom: 10 }}>QR code expirado. Clique para gerar um novo.</div>
        <button onClick={() => setSegundos(60)} style={{ padding: '8px 18px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
          Gerar novo QR
        </button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      {/* QR Code SVG estilizado */}
      <div style={{ display: 'inline-block', padding: 12, background: 'white', borderRadius: 12, border: '2px solid #e5e7eb', marginBottom: 10 }}>
        <svg width="180" height="180" viewBox="0 0 37 37" xmlns="http://www.w3.org/2000/svg">
          {/* Padrão de QR decorativo (não é QR real — em produção vem da Evolution API) */}
          <rect width="37" height="37" fill="white"/>
          {/* Cantos */}
          <rect x="1" y="1" width="11" height="11" rx="1.5" fill="none" stroke="#111827" strokeWidth="1.2"/>
          <rect x="3" y="3" width="7" height="7" rx="0.5" fill="#111827"/>
          <rect x="25" y="1" width="11" height="11" rx="1.5" fill="none" stroke="#111827" strokeWidth="1.2"/>
          <rect x="27" y="3" width="7" height="7" rx="0.5" fill="#111827"/>
          <rect x="1" y="25" width="11" height="11" rx="1.5" fill="none" stroke="#111827" strokeWidth="1.2"/>
          <rect x="3" y="27" width="7" height="7" rx="0.5" fill="#111827"/>
          {/* Módulos centrais simulados */}
          <rect x="14" y="1" width="2" height="2" fill="#111827"/>
          <rect x="17" y="1" width="2" height="2" fill="#111827"/>
          <rect x="20" y="2" width="2" height="2" fill="#111827"/>
          <rect x="14" y="4" width="3" height="2" fill="#111827"/>
          <rect x="19" y="4" width="2" height="2" fill="#111827"/>
          <rect x="14" y="7" width="2" height="3" fill="#111827"/>
          <rect x="17" y="8" width="3" height="2" fill="#111827"/>
          <rect x="21" y="7" width="2" height="4" fill="#111827"/>
          <rect x="14" y="11" width="9" height="2" fill="#111827"/>
          <rect x="1" y="14" width="2" height="9" fill="#111827"/>
          <rect x="4" y="14" width="3" height="2" fill="#111827"/>
          <rect x="4" y="17" width="2" height="3" fill="#111827"/>
          <rect x="4" y="21" width="4" height="2" fill="#111827"/>
          <rect x="8" y="14" width="2" height="4" fill="#111827"/>
          <rect x="8" y="20" width="2" height="3" fill="#111827"/>
          <rect x="11" y="14" width="2" height="2" fill="#111827"/>
          <rect x="11" y="18" width="2" height="5" fill="#111827"/>
          <rect x="14" y="14" width="4" height="3" fill="#111827"/>
          <rect x="19" y="14" width="3" height="2" fill="#111827"/>
          <rect x="23" y="14" width="2" height="4" fill="#111827"/>
          <rect x="26" y="14" width="2" height="2" fill="#111827"/>
          <rect x="29" y="14" width="2" height="4" fill="#111827"/>
          <rect x="32" y="14" width="2" height="2" fill="#111827"/>
          <rect x="14" y="18" width="2" height="4" fill="#111827"/>
          <rect x="17" y="18" width="4" height="2" fill="#111827"/>
          <rect x="22" y="18" width="2" height="3" fill="#111827"/>
          <rect x="25" y="19" width="3" height="2" fill="#111827"/>
          <rect x="29" y="18" width="3" height="3" fill="#111827"/>
          <rect x="33" y="19" width="2" height="2" fill="#111827"/>
          <rect x="14" y="23" width="5" height="2" fill="#111827"/>
          <rect x="21" y="22" width="2" height="3" fill="#111827"/>
          <rect x="24" y="23" width="4" height="2" fill="#111827"/>
          <rect x="29" y="22" width="2" height="4" fill="#111827"/>
          <rect x="32" y="23" width="3" height="2" fill="#111827"/>
          <rect x="14" y="26" width="3" height="5" fill="#111827"/>
          <rect x="18" y="27" width="2" height="4" fill="#111827"/>
          <rect x="21" y="26" width="3" height="2" fill="#111827"/>
          <rect x="21" y="29" width="2" height="2" fill="#111827"/>
          <rect x="24" y="27" width="4" height="3" fill="#111827"/>
          <rect x="29" y="27" width="2" height="5" fill="#111827"/>
          <rect x="32" y="26" width="3" height="3" fill="#111827"/>
          <rect x="33" y="30" width="2" height="2" fill="#111827"/>
          {/* Logo central */}
          <rect x="15.5" y="15.5" width="6" height="6" rx="1" fill="#25d366"/>
          <path d="M17 18.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0" fill="white"/>
        </svg>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        Abra o WhatsApp no celular → <strong>Dispositivos conectados</strong> → <strong>Conectar dispositivo</strong>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: segundos < 15 ? '#dc2626' : '#374151' }}>
        Expira em {segundos}s
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
        (Conectando automaticamente em demonstração…)
      </div>
    </div>
  );
};

const WhatsAppSection: React.FC<WhatsAppSectionProps> = ({
  integrations, tenantId, onChange, hasWhatsAppFeature, evolutionApiIncluded,
}) => {
  const [method, setMethod] = useState<'qrcode' | 'meta_api'>(
    integrations.whatsappMethod ?? 'qrcode'
  );
  const [showQR, setShowQR] = useState(false);
  const [qrConnected, setQrConnected] = useState(false);

  // QR Code fields — se incluso no plano, usa URL/Key da plataforma
  const [evoUrl, setEvoUrl] = useState(integrations.evolutionApiUrl ?? (evolutionApiIncluded ? PLATFORM_EVOLUTION_URL : ''));
  const [evoKey, setEvoKey] = useState(integrations.evolutionApiKey ?? (evolutionApiIncluded ? PLATFORM_EVOLUTION_KEY : ''));
  const [evoInstance, setEvoInstance] = useState(integrations.evolutionInstance ?? '');

  // Meta API fields
  const [phoneId, setPhoneId] = useState(integrations.metaPhoneNumberId ?? '');
  const [token, setToken] = useState(integrations.metaAccessToken ?? '');

  const verifyToken = generateVerifyToken(tenantId);
  // Em produção: vem do deployment real do Legere
  const webhookUrl = `https://app.juriscloud.com.br/api/webhook/whatsapp/${tenantId}`;

  const isConfigured = qrConnected
    || (method === 'meta_api' && !!integrations.metaPhoneNumberId)
    || (method === 'qrcode' && !!integrations.evolutionApiUrl);

  function salvarQR() {
    onChange({
      whatsappMethod: 'qrcode',
      evolutionApiUrl: evoUrl.trim(),
      evolutionApiKey: evoKey.trim(),
      evolutionInstance: evoInstance.trim() || `juriscloud-${tenantId.slice(0, 8)}`,
    });
    setShowQR(true);
  }

  function salvarMeta() {
    onChange({
      whatsappMethod: 'meta_api',
      metaPhoneNumberId: phoneId.trim(),
      metaAccessToken: token.trim(),
      metaVerifyToken: verifyToken,
    });
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #25d366, #128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.37a16 16 0 0 0 5.72 5.72l.93-.93a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>WhatsApp Business</span>
              {evolutionApiIncluded && hasWhatsAppFeature && (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '2px 10px', borderRadius: 999 }}>
                  INCLUSO NO PLANO
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {hasWhatsAppFeature
                ? evolutionApiIncluded
                  ? 'Apenas escaneie o QR Code — servidor já configurado pela plataforma'
                  : 'Atendimento e qualificação automática de leads'
                : '⚠️ Exclusivo plano Pro ou superior'}
            </div>
          </div>
        </div>
        <StatusBadge
          status={isConfigured ? 'ok' : 'idle'}
          label={isConfigured ? 'Conectado' : 'Não configurado'}
        />
      </div>

      {!hasWhatsAppFeature ? (
        <div style={{ padding: '14px 18px', background: '#fef3c7', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
          Faça upgrade para o plano <strong>Enterprise</strong> para conectar o WhatsApp. Veja a aba <strong>Meu Plano</strong>.
        </div>
      ) : (
        <>
          {/* Escolha do método */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Como deseja conectar?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* ── Cartão QR Code ── */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setMethod('qrcode'); setShowQR(false); }}
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    border: method === 'qrcode' ? '2px solid #25d366' : '2px solid #e5e7eb',
                    background: method === 'qrcode' ? '#f0fdf4' : 'white',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>📱</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>QR Code</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, lineHeight: 1.4 }}>
                    Conecte seu número existente escaneando um QR code. <span style={{ color: '#16a34a', fontWeight: 600 }}>Recomendado</span> — funciona com qualquer número WhatsApp.
                  </div>
                </button>
                <span style={{ position: 'absolute', top: 10, right: 10 }} onClick={e => e.stopPropagation()}>
                  <HelpBox label="Como funciona o QR Code (Evolution API)?">
                    <p style={{ margin: '0 0 10px 0' }}>
                      Este método funciona como o <strong>WhatsApp Web</strong> — seu número continua o mesmo, mas o Legere passa a enviar e receber mensagens automaticamente.
                    </p>

                    <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#1d4ed8' }}>🆓 Onde rodar gratuitamente:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                        <strong>⭐ Oracle Cloud (recomendado)</strong> — VPS permanentemente gratuito, sem cobranças. Basta criar conta em{' '}
                        <a href="https://cloud.oracle.com" target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a' }}>cloud.oracle.com</a>.
                        Pede cartão apenas para verificar identidade.
                      </div>
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                        <strong>💻 PC do escritório + Cloudflare Tunnel</strong> — rode no próprio computador (que fique ligado) e use o{' '}
                        <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Cloudflare Tunnel</a>{' '}
                        (100% gratuito) para gerar uma URL pública estável.
                      </div>
                      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#374151' }}>
                        <strong>🚂 Railway.app ou Fly.io</strong> — plataformas em nuvem com plano gratuito que suportam Docker. Bom para testes.
                      </div>
                    </div>

                    <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#1d4ed8' }}>Passo a passo geral:</p>
                    <ol style={{ margin: '0 0 10px 0', paddingLeft: 20 }}>
                      <li style={{ marginBottom: 5 }}>Escolha uma das opções gratuitas acima e crie sua conta</li>
                      <li style={{ marginBottom: 5 }}>Instale o Docker no servidor/computador</li>
                      <li style={{ marginBottom: 5 }}>Cole o comando de instalação mostrado abaixo — é uma única linha</li>
                      <li style={{ marginBottom: 5 }}>Anote a URL pública e a chave que você definiu</li>
                      <li style={{ marginBottom: 5 }}>Cole esses dados aqui e clique em <strong>"Gerar QR Code"</strong></li>
                      <li>Escaneie com o WhatsApp: <strong>Dispositivos Conectados → Conectar dispositivo</strong></li>
                    </ol>
                    <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#78350f' }}>
                      💡 <strong>Dica:</strong> Um profissional de TI configura isso em menos de 30 minutos. A opção Oracle Cloud é a mais estável e completamente gratuita.
                    </div>
                  </HelpBox>
                </span>
              </div>

              {/* ── Cartão Meta Business API ── */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setMethod('meta_api'); setShowQR(false); }}
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    border: method === 'meta_api' ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                    background: method === 'meta_api' ? '#eff6ff' : 'white',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🏢</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Meta Business API</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, lineHeight: 1.4 }}>
                    API oficial do Meta. Requer conta verificada no <em>Meta Developer Portal</em>.
                  </div>
                </button>
                <span style={{ position: 'absolute', top: 10, right: 10 }} onClick={e => e.stopPropagation()}>
                  <HelpBox label="Como funciona a Meta Business API?">
                    <p style={{ margin: '0 0 8px 0' }}>
                      Esta é a integração <strong>oficial e certificada pelo Facebook/Meta</strong>. É mais robusta, mas exige que sua empresa passe por um processo de verificação com o Meta.
                    </p>
                    <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#78350f', marginBottom: 10 }}>
                      ⚠️ <strong>Atenção:</strong> O número de WhatsApp usado aqui não poderá ser utilizado em outro celular. Recomendamos um número exclusivo para o escritório.
                    </div>
                    <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#1d4ed8' }}>O que você vai precisar:</p>
                    <ul style={{ margin: '0 0 10px 0', paddingLeft: 18 }}>
                      <li style={{ marginBottom: 4 }}>Conta no <strong>Facebook</strong></li>
                      <li style={{ marginBottom: 4 }}>Conta no <strong>Meta Business Suite</strong> verificada (pode levar alguns dias)</li>
                      <li style={{ marginBottom: 4 }}>Um número de telefone comercial exclusivo</li>
                    </ul>
                    <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#1d4ed8' }}>Passo a passo resumido:</p>
                    <ol style={{ margin: '0 0 10px 0', paddingLeft: 20 }}>
                      <li style={{ marginBottom: 5 }}>Acesse <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontWeight: 600 }}>business.facebook.com</a> e crie sua conta comercial</li>
                      <li style={{ marginBottom: 5 }}>Aguarde a verificação pelo Meta (1 a 5 dias úteis)</li>
                      <li style={{ marginBottom: 5 }}>Acesse <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontWeight: 600 }}>developers.facebook.com</a> → Criar app → tipo <strong>Business</strong> → adicione <strong>WhatsApp</strong></li>
                      <li style={{ marginBottom: 5 }}>Em <em>API Setup</em>, copie o <strong>Phone Number ID</strong></li>
                      <li style={{ marginBottom: 5 }}>Em <em>Business Settings → System Users</em>, gere um <strong>token permanente</strong></li>
                      <li>Cole os dados aqui e configure o Webhook conforme as instruções da tela seguinte</li>
                    </ol>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1d4ed8' }}>
                      💡 Se o escritório é pequeno, o método <strong>QR Code</strong> ao lado é mais simples e igualmente eficaz.
                    </div>
                  </HelpBox>
                </span>
              </div>
            </div>
          </div>

          {/* ── Método QR Code ── */}
          {method === 'qrcode' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Step n={1} title="Onde rodar o Evolution API (opções gratuitas disponíveis)">
                <p style={{ margin: '0 0 10px 0', fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
                  O Evolution API é gratuito e open-source. Você pode rodá-lo sem custo em várias plataformas:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#14532d' }}>
                    <strong>⭐ Oracle Cloud Free Tier</strong> — VPS permanentemente gratuito (sem cobranças). Crie conta em{' '}
                    <a href="https://cloud.oracle.com/free" target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a', fontWeight: 600 }}>cloud.oracle.com/free</a>.
                  </div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1e3a5f' }}>
                    <strong>💻 PC do escritório + Cloudflare Tunnel</strong> — rode localmente e exponha gratuitamente com{' '}
                    <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontWeight: 600 }}>Cloudflare Tunnel</a>.
                  </div>
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#374151' }}>
                    <strong>☁️ Railway / Fly.io</strong> — plataformas com plano gratuito para Docker. Ideal para testes.
                  </div>
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#374151' }}>
                    <strong>🖥️ VPS pago</strong> — Hostinger, Contabo, DigitalOcean a partir de ~R$25/mês, se preferir uma solução gerenciada.
                  </div>
                </div>
                <p style={{ margin: '0 0 6px 0', fontSize: 13, color: '#4b5563' }}>Em qualquer opção, instale com este comando Docker:</p>
                <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#7dd3fc', lineHeight: 1.8, overflowX: 'auto' }}>
                  docker run -d --name evolution \<br/>
                  &nbsp;&nbsp;-p 8080:8080 \<br/>
                  &nbsp;&nbsp;-e AUTHENTICATION_API_KEY=minha-chave \<br/>
                  &nbsp;&nbsp;atendai/evolution-api:latest
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: 11, color: '#6b7280' }}>
                  Documentação completa em{' '}
                  <a href="https://doc.evolution-api.com" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>doc.evolution-api.com</a>.
                </p>
              </Step>

              {evolutionApiIncluded ? (
                <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, color: '#166534' }}>
                  ✅ <strong>Servidor WhatsApp já configurado pela plataforma.</strong> Basta escanear o QR Code abaixo com o número do escritório.
                </div>
              ) : (
                <Step n={2} title="Informe os dados da sua instalação Evolution API">
                  <div style={{ display: 'grid', gap: 10 }}>
                    <Field label="URL do servidor Evolution API" hint="Ex: https://evo.seudominio.com ou http://192.168.0.10:8080">
                      <input value={evoUrl} onChange={e => setEvoUrl(e.target.value)}
                        placeholder="https://evo.seudominio.com" style={inputStyle} />
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Field label="Chave de API (AUTHENTICATION_API_KEY)" hint="Definida na instalação do Evolution API.">
                        <input type="password" value={evoKey} onChange={e => setEvoKey(e.target.value)}
                          placeholder="minha-chave-secreta" style={inputStyle} autoComplete="off" />
                      </Field>
                      <Field label="Nome da instância (opcional)" hint="Identificador único. Se vazio, será gerado automaticamente.">
                        <input value={evoInstance} onChange={e => setEvoInstance(e.target.value)}
                          placeholder={`juriscloud-${tenantId.slice(0, 8)}`} style={inputStyle} />
                      </Field>
                    </div>
                  </div>
                </Step>
              )}

              <Step n={evolutionApiIncluded ? 2 : 3} title="Conecte escaneando o QR Code">
                {!showQR ? (
                  <button
                    onClick={salvarQR}
                    disabled={!evoUrl.trim() || !evoKey.trim()}
                    style={{
                      padding: '10px 22px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
                      background: evoUrl.trim() && evoKey.trim() ? '#25d366' : '#e5e7eb',
                      color: evoUrl.trim() && evoKey.trim() ? 'white' : '#9ca3af',
                      cursor: evoUrl.trim() && evoKey.trim() ? 'pointer' : 'default',
                    }}
                  >
                    📱 Gerar QR Code
                  </button>
                ) : (
                  <QRCodeDemo onConnected={() => {
                    setQrConnected(true);
                    onChange({ whatsappMethod: 'qrcode', evolutionApiUrl: evoUrl, evolutionApiKey: evoKey, evolutionInstance: evoInstance || `juriscloud-${tenantId.slice(0, 8)}` });
                  }} />
                )}
              </Step>
            </div>
          )}

          {/* ── Método Meta Business API ── */}
          {method === 'meta_api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Step n={1} title="Crie um app no Meta Developer Portal">
                <p style={{ margin: 0, fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
                  Acesse{' '}
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontWeight: 600 }}>
                    developers.facebook.com/apps
                  </a>
                  {' '}→ <strong>Criar app</strong> → tipo <strong>Business</strong> → adicione o produto <strong>WhatsApp</strong>.
                </p>
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8', lineHeight: 1.5 }}>
                  ℹ️ É necessário ter uma conta <strong>Meta Business</strong> verificada e um número de telefone comercial.
                </div>
              </Step>

              <Step n={2} title="Copie as credenciais do seu app WhatsApp">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Phone Number ID" hint="Encontrado em: App → WhatsApp → API Setup → Phone number ID.">
                    <input
                      value={phoneId}
                      onChange={e => setPhoneId(e.target.value)}
                      placeholder="114564327890123"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Token de Acesso (Permanente)" hint="Gere um token permanente em: Business Settings → System Users → Gerar token.">
                    <input
                      type="password"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      placeholder="EAABsbCS..."
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </Field>
                </div>
              </Step>

              <Step n={3} title="Configure o Webhook no Meta Developer Portal">
                <p style={{ margin: '0 0 10px 0', fontSize: 13, color: '#4b5563' }}>
                  No seu app Meta → <strong>WhatsApp → Configuration → Webhooks</strong>, preencha:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Field label="Callback URL (cole no Meta)">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input readOnly value={webhookUrl} style={{ ...inputStyle, background: '#f9fafb', color: '#374151', flex: 1 }} />
                      <CopyButton value={webhookUrl} />
                    </div>
                  </Field>
                  <Field label="Verify Token (cole no Meta)">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input readOnly value={verifyToken} style={{ ...inputStyle, background: '#f9fafb', color: '#374151', flex: 1, fontFamily: 'monospace' }} />
                      <CopyButton value={verifyToken} />
                    </div>
                  </Field>
                </div>
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#166534' }}>
                  Inscreva-se nos eventos: <strong>messages</strong>, <strong>messaging_postbacks</strong>
                </div>
              </Step>

              <button
                onClick={salvarMeta}
                disabled={!phoneId.trim() || !token.trim()}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
                  background: phoneId.trim() && token.trim() ? '#3b82f6' : '#e5e7eb',
                  color: phoneId.trim() && token.trim() ? 'white' : '#9ca3af',
                  cursor: phoneId.trim() && token.trim() ? 'pointer' : 'default',
                  alignSelf: 'flex-start',
                }}
              >
                ✓ Salvar configuração
              </button>

              {integrations.metaPhoneNumberId && (
                <div style={{ padding: '10px 14px', background: '#dcfce7', borderRadius: 8, fontSize: 12, color: '#166534', fontWeight: 600 }}>
                  ✓ Meta Business API configurada. Após configurar o Webhook no Meta, o WhatsApp estará ativo.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────

interface IntegrationSettingsProps {
  tenant: Tenant;
  onTenantUpdate?: (updated: Tenant) => void;
}

const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({ tenant, onTenantUpdate }) => {
  const tenantId = tenant.id;
  const features = PLAN_FEATURES[tenant.plan];
  const [integrations, setIntegrations] = useState<TenantIntegrations>(
    () => loadIntegrations(tenantId)
  );
  const [saved, setSaved] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  function handleChange(partial: Partial<TenantIntegrations>) {
    const updated = { ...integrations, ...partial };
    setIntegrations(updated);
    saveIntegrations(tenantId, updated);
    if (onTenantUpdate) onTenantUpdate({ ...tenant, integrations: updated });
    setSaved(true);
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>Integrações</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
            Configure as integrações externas do seu escritório. As chaves ficam armazenadas com segurança no seu tenant.
          </p>
        </div>
        {saved && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '5px 12px', borderRadius: 20 }}>
            ✓ Salvo automaticamente
          </span>
        )}
      </div>

      <GeminiSection
        integrations={integrations}
        onChange={handleChange}
        hasAiFeature={features.aiPetitionGenerator}
        geminiIncluded={features.geminiIncluded}
        aiMonthlyLimit={features.aiMonthlyLimit}
        tenantId={tenantId}
      />

      <WhatsAppSection
        integrations={integrations}
        tenantId={tenantId}
        onChange={handleChange}
        hasWhatsAppFeature={features.whatsappIntegration}
        evolutionApiIncluded={features.evolutionApiIncluded}
      />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
};

export default IntegrationSettings;
