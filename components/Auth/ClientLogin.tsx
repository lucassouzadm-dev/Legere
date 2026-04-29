
import React, { useState } from 'react';
import { Logo } from '../../constants';

// Fix: Updated interface to include onClientLogin
interface ClientLoginProps {
  onClientLogin: (document: string) => void;
  onBack: () => void;
}

const ClientLogin: React.FC<ClientLoginProps> = ({ onClientLogin, onBack }) => {
  const [loginForm, setLoginForm] = useState({ document: '', password: '' });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Trigger handleClientLogin from App.tsx
    onClientLogin(loginForm.document);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden border dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-navy-800 p-10 text-center flex flex-col items-center">
        <Logo className="w-16 h-16 mb-6" />
        <h1 className="text-white font-serif font-bold text-2xl uppercase tracking-widest">Portal do Cliente</h1>
        <p className="text-gold-800 text-[10px] mt-2 uppercase font-bold tracking-[0.3em]">Legere</p>
      </div>
      <div className="p-10">
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">CPF ou CNPJ</label>
            <input 
              type="text" 
              required
              placeholder="000.000.000-00"
              className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-gold-800 outline-none dark:text-white"
              value={loginForm.document}
              onChange={e => setLoginForm({...loginForm, document: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Senha de Convite</label>
            <input 
              type="password" 
              required
              placeholder="••••••••"
              className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-gold-800 outline-none dark:text-white"
              value={loginForm.password}
              onChange={e => setLoginForm({...loginForm, password: e.target.value})}
            />
          </div>
          <button type="submit" className="w-full bg-navy-800 text-white font-bold py-5 rounded-xl shadow-xl hover:bg-gold-800 transition-all uppercase text-xs tracking-widest">
            Acessar Área do Cliente
          </button>
        </form>
        
        <div className="mt-8 pt-8 border-t dark:border-slate-700 flex flex-col items-center gap-4">
           <button 
             onClick={onBack}
             className="text-[10px] font-bold text-gray-400 hover:text-navy-800 uppercase tracking-widest flex items-center gap-2"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
             Voltar para Login Staff
           </button>
           
           <div className="mt-4 text-center space-y-2 opacity-50">
              <p className="text-[7px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                Ambiente Protegido em Conformidade com a LGPD
              </p>
              <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest leading-tight">
                © 2024 Oliveira Lima e Souza Advogados Associados.<br/>
                Direitos de criação e uso reservados.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ClientLogin;
