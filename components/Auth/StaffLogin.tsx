import React, { useState } from 'react';
import { Logo, APP_NAME, APP_TAGLINE } from '../../constants';
import { UserRole, Tenant } from '../../types';

interface StaffLoginProps {
  onLogin: (email: string, password: string) => void;
  onSignUp: (name: string, email: string, role: UserRole, password: string, oabNumber?: string, oabState?: string) => void;
  onClientLogin: (document: string, password: string) => void;
  onRegisterFirm: () => void;
  /** Abre o onboarding direto no modo assinatura (sem trial) */
  onSubscribeNow?: () => void;
  /** Quando presente, o usuário acessou via link de convite de um escritório */
  inviteTenant?: Tenant | null;
}

const StaffLogin: React.FC<StaffLoginProps> = ({ onLogin, onSignUp, onClientLogin, onRegisterFirm, onSubscribeNow, inviteTenant }) => {
  // Se vier de link de convite, começa direto no formulário de cadastro
  const [view, setView] = useState<'LOGIN' | 'SIGNUP' | 'CLIENT'>(inviteTenant ? 'SIGNUP' : 'LOGIN');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [name, setName]             = useState('');
  const [signUpPass, setSignUpPass] = useState('');
  const [role, setRole]             = useState<UserRole>(UserRole.LAWYER);
  const [oabNumber, setOabNumber]   = useState('');
  const [oabState, setOabState]     = useState('');
  const [clientDoc, setClientDoc]       = useState('');
  const [clientPass, setClientPass]     = useState('');

  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); onLogin(email, password); };
  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    onSignUp(name, email, role, signUpPass, oabNumber || undefined, oabState || undefined);
    // Se não for convite, volta ao login. Se for convite, App.tsx exibe a tela de confirmação.
    if (!inviteTenant) setView('LOGIN');
  };

  return (
    <div className="w-full flex flex-col md:flex-row bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden border dark:border-slate-700 min-h-[600px] animate-in zoom-in-95 duration-500">

      {/* Painel Esquerdo */}
      <div className="md:w-1/2 bg-navy-800 p-12 text-white flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 100 L100 0 L100 100 Z" fill="white" />
          </svg>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <Logo className="w-12 h-12" />
            <div>
              <h1 className="font-serif font-bold text-xl tracking-widest uppercase">{APP_NAME}</h1>
              <p className="text-[10px] text-navy-300 uppercase tracking-[0.2em]">{APP_TAGLINE}</p>
            </div>
          </div>

          <h2 className="text-3xl font-serif font-bold leading-tight mb-4">
            Confiamos tanto no nosso produto que{' '}
            <span className="text-gold-800 underline decoration-gold-800/30">liberamos ele para você testar por 7 dias.</span>
          </h2>
          <p className="text-navy-200 text-sm leading-relaxed mb-6">
            Por nossa conta e risco. Sem cartão de crédito. Sem letras miúdas. Sem asteriscos. Se em 7 dias o Legere não transformar a gestão do seu escritório, você não paga nada.
          </p>

          {/* Lista de recursos */}
          <ul className="space-y-2 mb-8">
            {[
              'Processos, prazos e audiências em um só lugar',
              'Publicações DJEN sincronizadas automaticamente',
              'IA Jurídica para petições e análises',
              'Portal do cliente com acesso seguro',
              'Financeiro, chat interno e muito mais',
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-navy-200">
                <svg className="w-4 h-4 text-gold-800 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                </svg>
                {item}
              </li>
            ))}
          </ul>

          {/* CTA principal — trial */}
          {!inviteTenant && view !== 'CLIENT' && (
            <button
              onClick={onRegisterFirm}
              className="w-full bg-gold-800 hover:bg-amber-500 text-white font-bold py-4 rounded-2xl text-sm uppercase tracking-widest transition-all shadow-2xl shadow-gold-800/40 mb-3"
            >
              🚀 Começar 7 dias grátis agora
            </button>
          )}

          {/* Opção assinar imediatamente */}
          {!inviteTenant && view !== 'CLIENT' && (
            <button
              onClick={onSubscribeNow ?? onRegisterFirm}
              className="w-full bg-transparent border border-navy-600 hover:border-white text-navy-300 hover:text-white font-bold py-3 rounded-2xl text-[11px] uppercase tracking-widest transition-all"
            >
              Já conheço o Legere — quero assinar agora →
            </button>
          )}
        </div>

        <div className="relative z-10 space-y-3 mt-6">
          <button onClick={() => setView(view === 'CLIENT' ? 'LOGIN' : 'CLIENT')}
            className="flex items-center gap-2 text-xs font-bold text-gold-800 uppercase tracking-widest hover:text-white transition-colors">
            {view === 'CLIENT' ? '← Voltar ao Login' : 'Acesso para Clientes →'}
          </button>
        </div>
      </div>

      {/* Painel Direito */}
      <div className="md:w-1/2 p-12 flex flex-col justify-between overflow-y-auto custom-scrollbar">
        <div className="flex-1 flex flex-col justify-center">

          {/* LOGIN STAFF */}
          {view === 'LOGIN' && (
            <>
              <h3 className="text-2xl font-serif font-bold text-navy-800 dark:text-white mb-8">Acesso ao Sistema</h3>
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">E-mail</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-gold-800 outline-none dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Senha</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                      className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-gold-800 outline-none dark:text-white" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-navy-800 text-white font-bold py-4 rounded-xl shadow-xl hover:bg-gold-800 transition-all uppercase text-sm tracking-widest">
                  Entrar
                </button>
                <p className="text-center text-xs text-gray-500">
                  Não tem conta?{' '}
                  <button type="button" onClick={() => setView('SIGNUP')} className="text-navy-800 font-bold hover:underline">
                    Solicite registro
                  </button>
                </p>
                <p className="text-center text-xs text-gray-400">
                  Escritório novo?{' '}
                  <button type="button" onClick={onRegisterFirm} className="text-gold-800 font-bold hover:underline">
                    Teste 7 dias grátis
                  </button>
                </p>
              </form>
            </>
          )}

          {/* SIGNUP STAFF */}
          {view === 'SIGNUP' && (
            <>
              {/* Banner de convite */}
              {inviteTenant && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl flex items-start gap-3">
                  <span className="text-2xl mt-0.5">🏛️</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-widest">Convite recebido</p>
                    <p className="text-sm font-bold text-navy-800 dark:text-white mt-0.5">{inviteTenant.name}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">Preencha o formulário para solicitar seu acesso. O administrador irá aprovar em seguida.</p>
                  </div>
                </div>
              )}
              <h3 className="text-2xl font-serif font-bold text-navy-800 dark:text-white mb-8">
                {inviteTenant ? 'Criar Minha Conta' : 'Solicitar Acesso'}
              </h3>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nome Completo *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required
                    className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">E-mail *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Senha *</label>
                  <input type="password" value={signUpPass} onChange={e => setSignUpPass(e.target.value)} required
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Função *</label>
                  <select value={role} onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none">
                    <option value={UserRole.LAWYER}>Advogado(a)</option>
                    <option value={UserRole.INTERN}>Estagiário(a)</option>
                    <option value={UserRole.RECEPTION}>Secretária / Recepção</option>
                    <option value={UserRole.FINANCE}>Financeiro</option>
                  </select>
                </div>
                {(role === UserRole.LAWYER || role === UserRole.INTERN) && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">OAB Nº</label>
                      <input value={oabNumber} onChange={e => setOabNumber(e.target.value)}
                        placeholder="Ex: 123456"
                        className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">UF</label>
                      <input value={oabState} onChange={e => setOabState(e.target.value.toUpperCase().slice(0,2))}
                        placeholder="SP"
                        maxLength={2}
                        className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none font-mono text-center" />
                    </div>
                  </div>
                )}
                <button type="submit" className="w-full bg-navy-800 text-white font-bold py-4 rounded-xl shadow-xl hover:bg-gold-800 transition-all uppercase text-sm tracking-widest mt-2">
                  Enviar para Aprovação
                </button>
                <p className="text-center text-xs text-gray-500">
                  Já tem conta?{' '}
                  <button type="button" onClick={() => setView('LOGIN')} className="text-navy-800 font-bold hover:underline">Voltar ao login</button>
                </p>
              </form>
            </>
          )}

          {/* LOGIN CLIENTE */}
          {view === 'CLIENT' && (
            <>
              <h3 className="text-2xl font-serif fo