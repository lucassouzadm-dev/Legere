import React, { useState } from 'react';
import Modal from './Modal';
import { UserRole, UserStatus, PlanType, PLAN_FEATURES, PLAN_PRICES, PLAN_LABELS, Tenant } from '../types';
import { BRAZIL_STATES } from '../constants';
import IntegrationSettings from './IntegrationSettings';
import PermissionsSettings from './PermissionsSettings';
import { authService } from '../services/authService';
import { usersDb } from '../services/db';

interface SettingsProps {
  users: any[];
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  clients: any[];
  currentUser: any;
  tenant: Tenant | null;
  onTenantUpdate?: (updated: Tenant) => void;
  resetDatabase: () => void;
}

const roleLabels: Record<UserRole, { label: string; color: string }> = {
  [UserRole.ADMIN]:     { label: 'Administrador', color: 'bg-red-100 text-red-700 border-red-200' },
  [UserRole.LAWYER]:    { label: 'Advogado',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
  [UserRole.INTERN]:    { label: 'Estagiário',    color: 'bg-orange-100 text-orange-700 border-orange-200' },
  [UserRole.FINANCE]:   { label: 'Financeiro',    color: 'bg-green-100 text-green-700 border-green-200' },
  [UserRole.RECEPTION]: { label: 'Secretária',    color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const Settings: React.FC<SettingsProps> = ({ users, setUsers, clients, currentUser, tenant, onTenantUpdate, resetDatabase }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'usuarios' | 'pendentes' | 'clientes' | 'plano' | 'permissoes' | 'integracoes' | 'sistema'>('profile');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [clientDoc, setClientDoc] = useState('');
  const [generatedPass, setGeneratedPass] = useState('');
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Slogan do escritório (editável pelo admin)
  const [slogan, setSlogan] = useState(tenant?.slogan ?? '');
  const [sloganSaved, setSloganSaved] = useState(false);

  // Dados profissionais do usuário logado
  const [profileName,      setProfileName]      = useState(currentUser.name ?? '');
  const [profileOabNumber, setProfileOabNumber] = useState(currentUser.oabNumber ?? '');
  const [profileOabState,  setProfileOabState]  = useState(currentUser.oabState ?? '');
  const [profileSaved,     setProfileSaved]     = useState(false);

  function handleSloganSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !onTenantUpdate) return;
    const updated: Tenant = { ...tenant, slogan: slogan.trim() || undefined };
    onTenantUpdate(updated);
    // Persistência local até migração para Supabase
    try {
      const key = `legere_tenant_${tenant.id}`;
      const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
      localStorage.setItem(key, JSON.stringify({ ...saved, slogan: slogan.trim() || undefined }));
    } catch {}
    setSloganSaved(true);
    setTimeout(() => setSloganSaved(false), 2500);
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...currentUser,
      name:      profileName.trim() || currentUser.name,
      oabNumber: profileOabNumber.trim() || null,
      oabState:  profileOabState.trim().toUpperCase().slice(0, 2) || null,
    };
    setUsers((prev: any[]) => prev.map(u => u.id === currentUser.id ? updated : u));
    await usersDb.upsert(updated);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const isAdmin = currentUser.role === UserRole.ADMIN;
  const currentPlan: PlanType = (tenant?.plan ?? PlanType.ESSENCIAL) as PlanType;
  const features = PLAN_FEATURES[currentPlan];

  const generateClientPassword = () => {
    const cleanDoc = clientDoc.replace(/\D/g, '');
    if (!cleanDoc) return alert('Insira o CPF/CNPJ do cliente.');
    const clientExists = clients.some((c: any) => c.document.replace(/\D/g, '') === cleanDoc);
    if (!clientExists) return alert('Cliente não localizado. Cadastre-o primeiro no CRM.');
    const pass = `JC@${cleanDoc.substring(0, 4)}${new Date().getFullYear()}`;
    setGeneratedPass(pass);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.next.length < 6) return alert('A nova senha deve ter pelo menos 6 caracteres.');
    if (passwords.next !== passwords.confirm) return alert('Confirmação não confere.');

    // Modo Supabase Auth: senha gerenciada com segurança via JWT
    const result = await authService.updatePassword(passwords.next);
    if (!result.fallback) {
      if (!result.success) return alert(result.error || 'Erro ao atualizar senha.');
      setPasswordSuccess(true);
      setPasswords({ current: '', next: '', confirm: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
      return;
    }

    // Fallback localStorage: valida a senha atual manualmente
    if (passwords.current !== currentUser.password) return alert('Senha atual incorreta.');
    setUsers((prev: any[]) => prev.map(u => u.id === currentUser.id ? { ...u, password: passwords.next } : u));
    setPasswordSuccess(true);
    setPasswords({ current: '', next: '', confirm: '' });
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  const handleSubmitUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ud = {
      ...editingUser,
      name: fd.get('name') as string,
      email: fd.get('email') as string,
      role: fd.get('role') as UserRole,
      oabNumber: (fd.get('oabNumber') as string) || null,
      oabState: (fd.get('oabState') as string) || null,
      monthlyGoal: Number(fd.get('monthlyGoal')) || 0,
      status: editingUser?.status || UserStatus.APPROVED,
      password: (fd.get('password') as string) || editingUser?.password || '123456',
      tenantId: currentUser.tenantId,
    };
    if (editingUser?.id) setUsers((prev: any[]) => prev.map(u => u.id === editingUser.id ? ud : u));
    else setUsers((prev: any[]) => [...prev, { ...ud, id: `u-${Date.now()}` }]);
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const tabs = [
    { id: 'profile',      label: 'Minha Conta',     icon: '👤' },
    ...(isAdmin ? [
      { id: 'usuarios',    label: 'Equipe',            icon: '👥' },
      { id: 'pendentes',   label: 'Aprovações',        icon: '⏳', count: users.filter(u => u.status === UserStatus.PENDING).length },
      { id: 'clientes',    label: 'Portal Clientes',   icon: '🔐' },
      { id: 'plano',       label: 'Meu Plano',         icon: '⭐' },
      { id: 'permissoes',  label: 'Controle de Acesso', icon: '🛡️' },
    ] : [
      { id: 'plano',       label: 'Meu Plano',         icon: '⭐' },
    ]),
    { id: 'integracoes',   label: 'Integrações',       icon: '🔌' },
    { id: 'sistema',       label: 'Manutenção',        icon: '⚙️' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold font-serif dark:text-white">Configurações & Gestão</h2>
        <p className="text-sm text-gray-500">{tenant?.name ?? 'Seu escritório'} — Painel administrativo central.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-2">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`w-full text-left px-5 py-3.5 rounded-2xl text-sm font-bold transition-all flex items-center justify-between border
                ${activeTab === tab.id ? 'bg-navy-800 text-white shadow-xl border-navy-800' : 'text-gray-500 hover:bg-white dark:hover:bg-slate-800 border-transparent'}`}>
              <div className="flex items-center gap-3"><span className="text-xl">{tab.icon}</span>{tab.label}</div>
              {(tab as any).count > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{(tab as any).count}</span>}
            </button>
          ))}
        </div>

        <div className="md:col-span-3">

          {/* ── Minha Conta ──────────────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 shadow-sm space-y-8">
              <div className="flex items-center gap-6 pb-6 border-b dark:border-slate-700">
                <div className="w-20 h-20 rounded-3xl bg-navy-800 text-white flex items-center justify-center text-3xl font-bold shadow-2xl">{currentUser.name.charAt(0)}</div>
                <div>
                  <h3 className="text-2xl font-bold dark:text-white">{currentUser.name}</h3>
                  <p className="text-sm text-gray-500">{currentUser.email}</p>
                  {currentUser.oabNumber && <p className="text-sm text-gold-800 font-bold mt-1">OAB {currentUser.oabNumber}/{currentUser.oabState}</p>}
                  <span className={`inline-block mt-2 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest border ${roleLabels[currentUser.role as UserRole]?.color}`}>
                    {roleLabels[currentUser.role as UserRole]?.label}
                  </span>
                </div>
              </div>
              {isAdmin && tenant && (
                <form onSubmit={handleSloganSave} className="max-w-md space-y-4 pb-6 border-b dark:border-slate-700">
                  <h4 className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-[0.2em]">Identidade do Escritório</h4>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Nome do Escritório
                    </label>
                    <input
                      readOnly
                      value={tenant.name}
                      className="w-full bg-gray-100 dark:bg-slate-950 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-gray-400 text-gray-500 outline-none cursor-not-allowed"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Para alterar o nome do escritório, entre em contato com o suporte.</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Slogan — exibido no topo do painel
                    </label>
                    <input
                      value={slogan}
                      onChange={e => setSlogan(e.target.value)}
                      placeholder="Ex: Advocacia séria, resultado garantido."
                      maxLength={120}
                      className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none italic"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      Frase exibida em itálico no painel. Deixe em branco para não exibir.
                    </p>
                  </div>
                  <button type="submit"
                    className="w-full bg-navy-800 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold-800 transition-all">
                    {sloganSaved ? '✓ Slogan salvo!' : 'Salvar Slogan'}
                  </button>
                </form>
              )}

              {/* ── Dados Profissionais ── */}
              <form onSubmit={handleProfileSave} className="max-w-md space-y-4 pb-6 border-b dark:border-slate-700">
                <h4 className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-[0.2em]">Dados Profissionais</h4>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nome Completo</label>
                  <input value={profileName} onChange={e => setProfileName(e.target.value)} required
                    className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
                </div>
                {(currentUser.role === UserRole.LAWYER || currentUser.role === UserRole.INTERN || currentUser.role === UserRole.ADMIN) && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      OAB — necessário para consulta de publicações DJEN
                    </label>
                    <div className="flex gap-3">
                      <input value={profileOabNumber} onChange={e => setProfileOabNumber(e.target.value)}
                        placeholder="Nº OAB (ex: 123456)"
                        className="flex-1 bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none font-mono" />
                      <select value={profileOabState} onChange={e => setProfileOabState(e.target.value)}
                        className="w-24 bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none">
                        <option value="">UF</option>
                        {BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Preencha para habilitar a busca automática de publicações judiciais no DJEN.
                    </p>
                  </div>
                )}
                <button type="submit"
                  className="w-full bg-navy-800 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold-800 transition-all">
                  {profileSaved ? '✓ Dados salvos!' : 'Salvar Dados Profissionais'}
                </button>
              </form>

              <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
                <h4 className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-[0.2em]">Segurança e Senha</h4>
                {(['current','next','confirm'] as const).map((k, i) => (
                  <div key={k}>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{['Senha Atual','Nova Senha','Confirmar Nova Senha'][i]}</label>
                    <input type="password" required value={passwords[k]} onChange={e => setPasswords({ ...passwords, [k]: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
                  </div>
                ))}
                <button type="submit" className="w-full bg-navy-800 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold-800 transition-all">Atualizar Senha</button>
                {passwordSuccess && <p className="text-center text-[10px] font-bold text-green-500 uppercase animate-bounce">Senha alterada com sucesso!</p>}
              </form>
            </div>
          )}

          {/* ── Equipe ──────────────────────────────────────────────────────── */}
          {activeTab === 'usuarios' && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xl dark:text-white">Profissionais do Escritório</h3>
                <button onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
                  className="bg-navy-800 text-white px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold-800 transition-all">
                  + Novo Membro
                </button>
              </div>
              {users.filter(u => u.status === UserStatus.APPROVED).map((user: any) => (
                <div key={user.id} className="p-4 border dark:border-slate-700 rounded-3xl flex items-center justify-between hover:border-gold-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-navy-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-navy-800 font-bold border dark:border-slate-700 text-xl">{user.name.charAt(0)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold dark:text-white">{user.name}</p>
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase border ${roleLabels[user.role as UserRole]?.color}`}>{roleLabels[user.role as UserRole]?.label}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold">{user.email}</p>
                      {user.oabNumber && <p className="text-[10px] text-gold-800 font-bold">OAB {user.oabNumber}/{user.oabState}</p>}
                      <p className="text-[10px] text-gray-400">Meta: {fmt(user.monthlyGoal || 0)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingUser(user); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-navy-800 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    </button>
                    <button onClick={() => { if (confirm('Remover profissional?')) setUsers((prev: any[]) => prev.filter(u => u.id !== user.id)); }}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Aprovações ──────────────────────────────────────────────────── */}
          {activeTab === 'pendentes' && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 shadow-sm space-y-6">
              <h3 className="font-bold text-xl dark:text-white">Solicitações de Acesso</h3>
              {users.filter(u => u.status === UserStatus.PENDING).map((u: any) => (
                <div key={u.id} className="p-6 bg-gray-50 dark:bg-slate-900/50 rounded-3xl border dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold dark:text-white">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email} · solicitou como <b>{u.role}</b></p>
                    {u.oabNumber && <p className="text-xs text-gold-800 font-bold">OAB {u.oabNumber}/{u.oabState}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setUsers((prev: any[]) => prev.map(x => x.id === u.id ? { ...x, status: UserStatus.REJECTED } : x))}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold uppercase hover:bg-red-600 hover:text-white transition-all">Recusar</button>
                    <button onClick={() => setUsers((prev: any[]) => prev.map(x => x.id === u.id ? { ...x, status: UserStatus.APPROVED } : x))}
                      className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-green-700 transition-all">Aprovar</button>
                  </div>
                </div>
              ))}
              {users.filter(u => u.status === UserStatus.PENDING).length === 0 && (
                <div className="text-center py-20 opacity-30 italic text-sm">Nenhuma solicitação pendente.</div>
              )}
            </div>
          )}

          {/* ── Portal Clientes ──────────────────────────────────────────────── */}
          {activeTab === 'clientes' && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 shadow-sm space-y-8">
              <div>
                <h3 className="font-bold text-xl dark:text-white mb-1">Gerador de Acessos ao Portal</h3>
                <p className="text-sm text-gray-500">Gere as credenciais que os clientes usarão para acompanhar os autos.</p>
              </div>
              {!features.clientPortal && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="text-sm text-amber-700 font-bold">🔒 Portal do Cliente disponível a partir do Plano Profissional.</p>
                </div>
              )}
              <div className={`max-w-md space-y-4 ${!features.clientPortal ? 'opacity-40 pointer-events-none' : ''}`}>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">CPF/CNPJ do Cliente</label>
                  <div className="flex gap-2">
                    <input type="text" value={clientDoc} onChange={e => setClientDoc(e.target.value)} placeholder="Somente números..."
                      className="flex-1 bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white font-mono focus:ring-2 focus:ring-gold-800 outline-none" />
                    <button onClick={generateClientPassword}
                      className="bg-navy-800 text-white px-6 py-3 rounded-xl text-[10px] font-bold uppercase hover:bg-gold-800 transition-all">
                      Gerar
                    </button>
                  </div>
                </div>
                {generatedPass && (
                  <div className="p-6 bg-gold-50 dark:bg-gold-800/10 border-2 border-gold-800/20 rounded-2xl">
                    <p className="text-[10px] font-bold text-gold-800 uppercase tracking-widest mb-3">Senha Gerada</p>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700">
                      <span className="font-mono text-lg font-bold text-navy-800 dark:text-white">{generatedPass}</span>
                      <button onClick={() => { navigator.clipboard.writeText(generatedPass); alert('Copiado!'); }} className="p-2 text-gray-400 hover:text-navy-800">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Meu Plano ───────────────────────────────────────────────────── */}
          {activeTab === 'plano' && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 shadow-sm space-y-8">
              <div>
                <h3 className="font-bold text-xl dark:text-white mb-1">Plano Atual</h3>
                <p className="text-sm text-gray-500">Gerencie a assinatura do escritório.</p>
              </div>
              <div className="flex items-center gap-4 p-6 bg-navy-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700">
                <div className="w-16 h-16 bg-navy-800 rounded-2xl flex items-center justify-center text-gold-800 text-2xl font-black shadow-lg">⭐</div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Plano Ativo</p>
                  <p className="text-3xl font-bold text-navy-800 dark:text-white">{PLAN_LABELS[currentPlan]}</p>
                  <p className="text-gold-800 font-bold">R$ {PLAN_PRICES[currentPlan]}/mês</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ['👥 Usuários', features.maxUsers === -1 ? 'Ilimitados' : `Até ${features.maxUsers}`],
                  ['👤 Clientes', features.maxClients === -1 ? 'Ilimitados' : `Até ${features.maxClients}`],
                  ['📋 DJEN Automático', features.djenAutoSync ? '✅ Incluso' : '❌ Não incluso'],
                  ['🤖 IA Jurídica', features.aiPetitionGenerator ? '✅ Incluso' : '❌ Não incluso'],
                  ['🔗 Portal do Cliente', features.clientPortal ? '✅ Incluso' : '❌ Não incluso'],
                  ['💬 WhatsApp API', features.whatsappIntegration ? '✅ Incluso' : '❌ Não incluso'],
                  ['📊 Relatórios Avançados', features.advancedReports ? '✅ Incluso' : '❌ Não incluso'],
                  ['⚡ Suporte Prioritário', features.prioritySupport ? '✅ Incluso' : '❌ Não incluso'],
                ].map(([label, value]) => (
                  <div key={label} className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-700 flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
                    <span className={`text-sm font-bold ${String(value).startsWith('✅') ? 'text-green-600' : String(value).startsWith('❌') ? 'text-gray-300' : 'text-navy-800 dark:text-white'}`}>{value}</span>
                  </div>
                ))}
              </div>
              {currentPlan !== PlanType.ENTERPRISE && (
                <div className="p-6 bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl text-white">
                  <p className="font-bold text-lg mb-1">Precisa de mais recursos?</p>
                  <p className="text-navy-200 text-sm mb-4">Faça upgrade para desbloquear DJEN automático, IA Jurídica, portal do cliente e muito mais.</p>
                  <button className="bg-gold-800 text-white px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-amber-600 transition-all">
                    Ver Planos e Fazer Upgrade
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Controle de Acesso ───────────────────────────────────────────── */}
          {activeTab === 'permissoes' && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 shadow-sm">
              {tenant
                ? <PermissionsSettings tenantId={tenant.id} />
                : <p className="text-sm text-gray-500">Tenant não carregado.</p>
              }
            </div>
          )}

          {/* ── Integrações ──────────────────────────────────────────────────── */}
          {activeTab === 'integracoes' && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 shadow-sm">
              {tenant
                ? <IntegrationSettings tenant={tenant} />
                : <p className="text-sm text-gray-500">Tenant não carregado.</p>
              }
            </div>
          )}

          {/* ── Manutenção ───────────────────────────────────────────────────── */}
          {activeTab === 'sistema' && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 shadow-sm space-y-8">
              <div className="flex items-center gap-4 text-red-600">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <div>
                  <h3 className="font-bold text-xl">Zona de Manutenção Crítica</h3>
                  <p className="text-sm text-gray-500">Ações irreversíveis sobre os dados do escritório.</p>
                </div>
              </div>
              <div className="p-8 border-2 border-red-100 dark:border-red-900/20 rounded-[2rem] bg-red-50/30 space-y-4">
                <h4 className="font-bold text-red-700">Redefinição Total dos Dados</h4>
                <p className="text-xs text-gray-600 max-w-2xl leading-relaxed">Remove permanentemente todos os clientes, processos, lançamentos, tarefas e prazos do navegador local. Somente os dados do Supabase são preservados.</p>
                <button onClick={resetDatabase} className="px-10 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-red-700 transition-all shadow-xl">
                  Limpar Cache Local
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal de Membro */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser?.id ? 'Editar Membro' : 'Cadastrar Novo Profissional'}>
        <form onSubmit={handleSubmitUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nome Completo</label>
              <input name="name" defaultValue={editingUser?.name} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">E-mail</label>
              <input name="email" type="email" defaultValue={editingUser?.email} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Senha</label>
              <input name="password" type="password" placeholder={editingUser?.id ? 'Em branco = manter atual' : 'Mínimo 6 caracteres'} required={!editingUser?.id}
                className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Função</label>
              <select name="role" defaultValue={editingUser?.role || UserRole.LAWYER}
                className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white">
                <option value={UserRole.LAWYER}>Advogado(a)</option>
                <option value={UserRole.ADMIN}>Administrador</option>
                <option value={UserRole.INTERN}>Estagiário(a)</option>
                <option value={UserRole.RECEPTION}>Secretária</option>
                <option value={UserRole.FINANCE}>Financeiro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Meta Mensal (R$)</label>
              <input name="monthlyGoal" type="number" step="0.01" defaultValue={editingUser?.monthlyGoal}
                className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">OAB Nº</label>
              <input name="oabNumber" defaultValue={editingUser?.oabNumber || ''}
                placeholder="Ex: 123456"
                className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white font-mono focus:ring-2 focus:ring-gold-800 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">OAB UF</label>
              <select name="oabState" defaultValue={editingUser?.oabState || ''}
                className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none">
                <option value="">— Selecione —</option>
                {BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl text-sm font-bold text-gray-400">Cancelar</button>
            <button type="submit" className="px-8 py-2 bg-navy-800 text-white rounded-xl text-sm font-bold hover:bg-gold-800 transition-all uppercase tracking-widest text-[10px]">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Settings;
