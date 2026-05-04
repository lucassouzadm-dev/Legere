import React, { useState } from 'react';
import { Logo, APP_NAME, APP_TAGLINE, BRAZIL_STATES } from '../../constants';
import { PlanType, PLAN_FEATURES, PLAN_PRICES, PLAN_LABELS } from '../../types';

interface TenantOnboardingProps {
  onComplete: (firmData: {
    firmName: string;
    slogan: string;
    cnpj: string;
    phone: string;
    email: string;
    plan: PlanType;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    oabNumber?: string;
    oabState?: string;
    isTrial: boolean;
  }) => void;
  onBack: () => void;
  /** 'trial' (padrão) = 7 dias Enterprise grátis | 'subscribe' = escolha de plano imediata */
  initialMode?: 'trial' | 'subscribe';
}

const planColors: Record<PlanType, string> = {
  [PlanType.ESSENCIAL]:    'border-gray-300 hover:border-navy-800',
  [PlanType.PROFISSIONAL]: 'border-gold-800 bg-amber-50/50 dark:bg-amber-900/10',
  [PlanType.ENTERPRISE]:   'border-navy-800 hover:border-navy-900',
};
const planBadge: Record<PlanType, string | null> = {
  [PlanType.ESSENCIAL]:    null,
  [PlanType.PROFISSIONAL]: 'Mais Popular',
  [PlanType.ENTERPRISE]:   'Completo',
};

const TenantOnboarding: React.FC<TenantOnboardingProps> = ({ onComplete, onBack, initialMode = 'trial' }) => {
  // isTrial = true → 2 passos sem seleção de plano (Enterprise gratuito por 7 dias)
  // isTrial = false → 3 passos com seleção de plano
  const [isTrial, setIsTrial]     = useState(initialMode === 'trial');
  const [step, setStep]           = useState<1 | 2 | 3>(1);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(PlanType.PROFISSIONAL);

  // Step 1 — dados do escritório
  const [firmName, setFirmName]   = useState('');
  const [slogan, setSlogan]       = useState('');
  const [cnpj, setCnpj]           = useState('');
  const [phone, setPhone]         = useState('');
  const [firmEmail, setFirmEmail] = useState('');

  // Step admin (passo 2 no trial, passo 3 na assinatura)
  const [adminName, setAdminName]   = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass]   = useState('');
  const [adminPass2, setAdminPass2] = useState('');
  const [oabNumber, setOabNumber]   = useState('');
  const [oabState, setOabState]     = useState('');

  const totalSteps = isTrial ? 2 : 3;

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(isTrial ? 2 : 2); // em ambos os casos vai para step 2
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPass !== adminPass2) { alert('As senhas não conferem.'); return; }
    if (adminPass.length < 8) { alert('A senha deve ter pelo menos 8 caracteres.'); return; }
    onComplete({
      firmName, slogan, cnpj, phone, email: firmEmail,
      plan: isTrial ? PlanType.ENTERPRISE : selectedPlan,
      adminName, adminEmail, adminPassword: adminPass,
      oabNumber: oabNumber || undefined,
      oabState: oabState || undefined,
      isTrial,
    });
  };

  // Mudar para modo "assinar agora"
  const switchToSubscribe = () => {
    setIsTrial(false);
    setStep(1);
  };

  // Voltar para modo trial
  const switchToTrial = () => {
    setIsTrial(true);
    setStep(1);
  };

  const planList: PlanType[] = [PlanType.ESSENCIAL, PlanType.PROFISSIONAL, PlanType.ENTERPRISE];

  // Labels dos passos conforme o modo
  const stepLabels = isTrial
    ? ['Escritório', 'Administrador']
    : ['Escritório', 'Plano', 'Administrador'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in">

        {/* Header */}
        <div className="bg-navy-800 p-8 text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo className="w-10 h-10" />
            <div>
              <h1 className="font-serif font-bold text-xl tracking-wider">{APP_NAME}</h1>
              <p className="text-[10px] text-navy-300 uppercase tracking-widest">{APP_TAGLINE}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stepLabels.map((label, i) => {
              const s = i + 1;
              return (
                <div key={s} className={`flex items-center gap-2 ${s < totalSteps ? 'after:content-["→"] after:text-navy-400 after:ml-2' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${step >= s ? 'bg-gold-800 text-white' : 'bg-navy-700 text-navy-400'}`}>
                    {s}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest hidden md:inline
                    ${step >= s ? 'text-white' : 'text-navy-400'}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-8">

          {/* ── Step 1 — Dados do Escritório ────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">

              {/* Banner trial ou assinatura */}
              {isTrial ? (
                <div className="flex items-start gap-4 p-5 bg-gradient-to-r from-gold-800/10 to-amber-50 dark:from-gold-800/20 dark:to-slate-900 rounded-2xl border border-gold-800/30">
                  <div className="text-3xl">🎁</div>
                  <div className="flex-1">
                    <p className="font-bold text-navy-800 dark:text-white text-sm">
                      7 dias grátis com o Legere Enterprise completo
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      Sem cartão de crédito. Sem letras miúdas. Por nossa conta e risco — se não gostar, não paga nada.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={switchToSubscribe}
                    className="text-[10px] font-bold text-gold-800 hover:text-navy-800 dark:hover:text-white uppercase tracking-widest whitespace-nowrap transition-colors mt-1"
                  >
                    Já conheço →
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-4 p-5 bg-navy-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700">
                  <div className="text-3xl">⭐</div>
                  <div className="flex-1">
                    <p className="font-bold text-navy-800 dark:text-white text-sm">Modo: Assinatura imediata</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Você escolherá o plano no próximo passo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={switchToTrial}
                    className="text-[10px] font-bold text-navy-800 dark:text-gold-800 hover:underline uppercase tracking-widest whitespace-nowrap mt-1"
                  >
                    ← Quero testar grátis
                  </button>
                </div>
              )}

              <form onSubmit={handleStep1} className="space-y-6 max-w-lg mx-auto">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-navy-800 dark:text-white mb-1">Cadastre seu Escritório</h2>
                  <p className="text-sm text-gray-500">Estas informações identificam seu escritório na plataforma.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nome do Escritório *</label>
                    <input required value={firmName} onChange={e => setFirmName(e.target.value)}
                      placeholder="Ex: Silva & Associados Advogados"
                      className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Slogan do Escritório
                      <span className="ml-2 text-gray-300 normal-case font-normal">— aparece no topo do painel</span>
                    </label>
                    <input
                      value={slogan}
                      onChange={e => setSlogan(e.target.value)}
                      placeholder="Ex: Advocacia séria, resultado garantido."
                      maxLength={120}
                      className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none italic"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Opcional. Pode ser alterado a qualquer momento nas Configurações.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">CNPJ</label>
                      <input value={cnpj} onChange={e => setCnpj(e.target.value)}
                        placeholder="00.000.000/0001-00"
                        className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Telefone</label>
                      <input value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">E-mail do Escritório *</label>
                    <input required type="email" value={firmEmail} onChange={e => setFirmEmail(e.target.value)}
                      placeholder="contato@seuescritorio.com.br"
                      className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={onBack}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-600 border dark:border-slate-700 dark:text-slate-400 transition-colors">
                    ← Voltar ao Login
                  </button>
                  <button type="submit"
                    className="flex-1 bg-navy-800 text-white py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-gold-800 transition-all shadow-lg">
                    Próximo →
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Step 2 (modo assinatura) — Escolha de Plano ─────────────────── */}
          {step === 2 && !isTrial && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-serif font-bold text-navy-800 dark:text-white mb-1">Escolha seu Plano</h2>
                <p className="text-sm text-gray-500">Você pode fazer upgrade a qualquer momento nas configurações.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {planList.map(plan => {
                  const feat = PLAN_FEATURES[plan];
                  const badge = planBadge[plan];
                  const selected = selectedPlan === plan;
                  return (
                    <button key={plan} type="button" onClick={() => setSelectedPlan(plan)}
                      className={`relative p-6 rounded-[1.5rem] border-2 text-left transition-all
                        ${selected ? 'border-gold-800 shadow-xl shadow-gold-800/20' : planColors[plan]}`}>
                      {badge && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-800 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                          {badge}
                        </span>
                      )}
                      {selected && (
                        <div className="absolute top-4 right-4 w-5 h-5 bg-gold-800 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </div>
                      )}
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{PLAN_LABELS[plan]}</p>
                      <p className="text-3xl font-bold text-navy-800 dark:text-white mb-1">
                        R${PLAN_PRICES[plan]}<span className="text-sm font-normal text-gray-400">/mês</span>
                      </p>
                      <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        <p>👥 {feat.maxUsers === -1 ? 'Usuários ilimitados' : `Até ${feat.maxUsers} usuários`}</p>
                        <p>👤 {feat.maxClients === -1 ? 'Clientes ilimitados' : `Até ${feat.maxClients} clientes`}</p>
                        <p className={feat.djenAutoSync ? 'text-green-700' : 'text-gray-300 line-through'}>📋 DJEN automático</p>
                        <p className={feat.aiPetitionGenerator ? 'text-green-700' : 'text-gray-300 line-through'}>🤖 IA Jurídica</p>
                        <p className={feat.clientPortal ? 'text-green-700' : 'text-gray-300 line-through'}>🔗 Portal do cliente</p>
                        <p className={feat.whatsappIntegration ? 'text-green-700' : 'text-gray-300 line-through'}>💬 WhatsApp API</p>
                        <p className={feat.prioritySupport ? 'text-green-700' : 'text-gray-300 line-through'}>⚡ Suporte prioritário</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-600 border dark:border-slate-700 transition-colors">
                  ← Voltar
                </button>
                <button type="button" onClick={() => setStep(3)}
                  className="flex-1 bg-navy-800 text-white py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-gold-800 transition-all shadow-lg">
                  Plano {PLAN_LABELS[selectedPlan]} selecionado — Próximo →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2 (trial) ou Step 3 (assinatura) — Administrador ────────── */}
          {((step === 2 && isTrial) || (step === 3 && !isTrial)) && (
            <form onSubmit={handleAdminSubmit} className="space-y-6 max-w-lg mx-auto">

              {/* Resumo do que o usuário está prestes a criar */}
              {isTrial && (
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-700">
                  <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                  <p className="text-sm text-green-800 dark:text-green-300">
                    <strong>Legere Enterprise por 7 dias grátis</strong> — sem cartão, sem letras miúdas.
                  </p>
                </div>
              )}

              <div>
                <h2 className="text-2xl font-serif font-bold text-navy-800 dark:text-white mb-1">Criar Conta de Administrador</h2>
                <p className="text-sm text-gray-500">O administrador terá acesso total e poderá convidar os demais membros da equipe.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nome Completo *</label>
                  <input required value={adminName} onChange={e => setAdminName(e.target.value)}
                    placeholder="Dr. João da Silva"
                    className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">E-mail de Acesso *</label>
                  <input required type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                 