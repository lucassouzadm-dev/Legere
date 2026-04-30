import React, { useState } from 'react';
import { Logo, APP_NAME, APP_TAGLINE } from '../../constants';
import { UserRole, Tenant } from '../../types';

interface StaffLoginProps {
  onLogin: (email: string, password: string) => void;
  onSignUp: (name: string, email: string, role: UserRole, password: string, oabNumber?: string, oabState?: string) => void;
  onClientLogin: (document: string, password: string) => void;
  onRegisterFirm: () => void;
  /** Quando presente, o usuário acessou via link de convite de um escritório */
  inviteTenant?: Tenant | null;
}

const StaffLogin: React.FC<StaffLoginProps> = ({ onLogin, onSignUp, onClientLogin, onRegisterFirm, inviteTenant }) => {
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
          <div className="flex items-center gap-3 mb-12">
            <Logo className="w-12 h-12" />
            <div>
              <h1 className="font-serif font-bold text-xl tracking-widest uppercase">{APP_NAME}</h1>
              <p className="text-[10px] text-navy-300 uppercase tracking-[0.2em]">{APP_TAGLINE}</p>
            </div>
          </div>
          <h2 className="text-4xl font-serif font-bold leading-tight mb-6">
            Gestão Jurídica de <span className="text-gold-800 underline decoration-gold-800/30">Alta Performance</span>
          </h2>
          <p className="text-navy-200 text-sm max-w-sm leading-relaxed">
            Plataforma SaaS completa para escritórios de advocacia. Processos, prazos, publicações DJEN, financeiro e muito mais.
          </p>
        </div>
        <div className="relative z-10 space-y-3">
          <button onClick={() => setView(view === 'CLIENT' ? 'LOGIN' : 'CLIENT')}
            className="flex items-center gap-2 text-xs font-bold text-gold-800 uppercase tracking-widest hover:text-white transition-colors">
            {view === 'CLIENT' ? '← Voltar ao Login' : 'Acesso para Clientes →'}
          </button>
          {!inviteTenant && (
            <button onClick={onRegisterFirm}
              className="flex items-center gap-2 text-xs font-bold text-navy-300 uppercase tracking-widest hover:text-white transition-colors">
              🏢 Registrar novo escritório →
            </button>
          )}
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
                    Cadastrar escritório
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
              <h3 className="text-2xl font-serif font-bold text-navy-800 dark:text-white mb-8">Acesso do Cliente</h3>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Acesse o portal para acompanhar seu processo. Use seu CPF ou CNPJ e a senha de convite fornecida pelo escritório.</p>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">CPF ou CNPJ (somente números)</label>
                  <input type="text" value={clientDoc} onChange={e => setClientDoc(e.target.value)}
                    placeholder="Somente números..."
                    className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-gold-800 outline-none dark:text-white font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Senha de Convite</label>
                  <input type="password" value={clientPass} onChange={e => setClientPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-gold-800 outline-none dark:text-white" />
                </div>
                <button onClick={() => onClientLogin(clientDoc, clientPass)}
                  className="w-full bg-navy-800 text-white font-bold py-4 rounded-xl shadow-xl hover:bg-gold-800 transition-all uppercase text-sm tracking-widest">
                  Acessar Portal
                </button>
                <button onClick={() => setView('LOGIN')}
                  className="w-full text-gray-400 text-sm hover:text-navy-800 transition-colors">
                  ← Voltar ao login
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 pt-6 border-t dark:border-slate-700 text-center opacity-60">
          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
            ⚡ Powered by {APP_NAME} &nbsp;|&nbsp; Conforme LGPD (Lei 13.709/18) &nbsp;|&nbsp; Dados isolados por escritório
          </p>
        </div>
      </div>
    </div>
  );
};

export default StaffLogin;
