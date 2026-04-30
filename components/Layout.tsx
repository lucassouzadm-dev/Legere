import React, { useState, useEffect, useRef } from 'react';
import { ICONS, Logo, APP_NAME } from '../constants';
import { UserRole, Tenant } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeModule: string;
  setActiveModule: (module: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userRole: UserRole | null;
  userName: string;
  userId: string;
  onLogout: () => void;
  notifications: any[];
  setNotifications: React.Dispatch<React.SetStateAction<any[]>>;
  unreadPublications?: number;
  urgentDeadlines?: number;
  djenSyncing?: boolean;
  tenant: Tenant | null;
  allData: {
    clients: any[];
    cases: any[];
    tasks: any[];
    deadlines: any[];
    transactions: any[];
    events: any[];
  };
  totalUnreadChat?: number;
  showWhatsAppCRM?: boolean;
  /** Lista de IDs de módulo permitidos para o perfil atual (undefined = sem restrição) */
  allowedModules?: string[];
}

const Layout: React.FC<LayoutProps> = ({
  children, activeModule, setActiveModule, isDarkMode, toggleDarkMode,
  userRole, userName, userId, onLogout, notifications, setNotifications,
  unreadPublications = 0, urgentDeadlines = 0, djenSyncing = false, tenant, totalUnreadChat = 0,
  showWhatsAppCRM = false, allowedModules,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const notifyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifyRef.current && !notifyRef.current.contains(event.target as Node)) setIsNotifyOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { id: 'dashboard',    label: 'Dashboard',        icon: ICONS.Dashboard, roles: [UserRole.ADMIN, UserRole.LAWYER, UserRole.INTERN, UserRole.RECEPTION, UserRole.FINANCE] },
    { id: 'calendar',     label: 'Agenda',            icon: (p: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>, roles: [UserRole.ADMIN, UserRole.LAWYER, UserRole.INTERN, UserRole.RECEPTION] },
    { id: 'crm',          label: 'Clientes & CRM',    icon: ICONS.Clients, roles: [UserRole.ADMIN, UserRole.LAWYER, UserRole.RECEPTION] },
    { id: 'cases',        label: 'Processos',         icon: ICONS.Cases, roles: [UserRole.ADMIN, UserRole.LAWYER, UserRole.INTERN, UserRole.RECEPTION, UserRole.FINANCE] },
    { id: 'deadlines',    label: 'Prazos',            icon: ICONS.Deadlines, roles: [UserRole.ADMIN, UserRole.LAWYER, UserRole.INTERN] },
    { id: 'hearings',     label: 'Audiências',        icon: (p: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m14 13-7.5 7.5a1.93 1.93 0 0 1-2.7-2.7L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg>, roles: [UserRole.ADMIN, UserRole.LAWYER, UserRole.INTERN] },
    { id: 'tasks',        label: 'Tarefas',           icon: ICONS.Tasks, roles: [UserRole.ADMIN, UserRole.LAWYER, UserRole.INTERN, UserRole.RECEPTION] },
    { id: 'ia',           label: 'IA Jurídica',       icon: ICONS.AI, roles: [UserRole.ADMIN, UserRole.LAWYER] },
    { id: 'finance',      label: 'Financeiro',        icon: ICONS.Finance, roles: [UserRole.ADMIN, UserRole.FINANCE] },
    { id: 'chat',         label: 'Comunicação',       icon: ICONS.Chat, roles: [UserRole.ADMIN, UserRole.LAWYER, UserRole.INTERN, UserRole.RECEPTION, UserRole.FINANCE] },
    { id: 'publications', label: 'Publicações DJEN',  icon: (p: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>, roles: [UserRole.ADMIN, UserRole.LAWYER, UserRole.INTERN] },
    ...(showWhatsAppCRM ? [{ id: 'whatsapp_crm', label: 'CRM WhatsApp', icon: (p: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.37a16 16 0 0 0 5.72 5.72l.93-.93a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, roles: [UserRole.ADMIN, UserRole.LAWYER] }] : []),
    { id: 'settings',     label: 'Configurações',     icon: (p: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>, roles: [UserRole.ADMIN, UserRole.LAWYER, UserRole.INTERN, UserRole.RECEPTION, UserRole.FINANCE] },
  ];

  const filteredMenu = menuItems.filter(item => {
    // Filtro 1: role hardcoded (fallback original)
    if (!userRole || !item.roles.includes(userRole)) return false;
    // Filtro 2: permissões configuráveis pelo admin (se definidas)
    if (allowedModules && allowedModules.length > 0) {
      return allowedModules.includes(item.id);
    }
    return true;
  });
  const myNotifications = notifications.filter(n => n.recipientId === userId);
  const unreadCount = myNotifications.filter(n => !n.read).length;

  const inferModule = (n: any): string | null => {
    const t = n.title ?? '';
    if (t.startsWith('Novo Prazo:') || t.includes('Prazo')) return 'deadlines';
    if (t === 'Pagamento Aprovado' || t === 'Pagamento Recusado') return 'finance';
    if (t.startsWith('Chat de ') || t.startsWith('#')) return 'chat';
    if (t === 'Agenda Alterada' || t === 'Novo Evento') return 'calendar';
    if (t.startsWith('Nova Tarefa:')) return 'tasks';
    if (t.toLowerCase().includes('publicação') || t.toLowerCase().includes('djen')) return 'publications';
    if (t.toLowerCase().includes('audiência')) return 'hearings';
    return null;
  };

  const firmInitial = (tenant?.name ?? APP_NAME).charAt(0).toUpperCase();

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark' : ''}`}>
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-0 md:w-20'} transition-all duration-300 ease-in-out bg-navy-800 text-white flex flex-col shadow-2xl z-40 fixed md:relative h-full overflow-hidden`}>
        <div className={`p-6 flex items-center gap-4 border-b border-navy-700 min-w-[288px] ${!isSidebarOpen ? 'md:justify-center md:px-0' : ''}`}>
          <Logo className="w-10 h-10 flex-shrink-0" />
          {isSidebarOpen && (
            <div className="overflow-hidden whitespace-nowrap animate-in fade-in duration-300">
              <h1 className="font-serif font-bold text-base leading-tight tracking-wider uppercase truncate max-w-[160px]">
                {tenant?.name ?? APP_NAME}
              </h1>
              <p className="text-[9px] text-navy-300 uppercase tracking-[0.2em] font-medium">Sistema Jurídico</p>
            </div>
          )}
        </div>

        <nav className="flex-1 mt-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredMenu.map((item) => (
            <button key={item.id} onClick={() => { setActiveModule(item.id); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group relative
                ${activeModule === item.id ? 'bg-gold-800 text-white shadow-lg' : 'text-navy-100 hover:bg-navy-700 hover:translate-x-1'}
                ${!isSidebarOpen ? 'md:justify-center' : ''}`}>
              <div className="relative flex-shrink-0">
                <item.icon className={`w-5 h-5 ${activeModule === item.id ? 'text-white' : 'text-navy-300 group-hover:scale-110'}`} />
                {item.id === 'publications' && unreadPublications > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-[9px] text-white flex items-center justify-center rounded-full font-black shadow">{unreadPublications > 9 ? '9+' : unreadPublications}</span>
                )}
                {item.id === 'deadlines' && urgentDeadlines > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 text-[9px] text-white flex items-center justify-center rounded-full font-black shadow">{urgentDeadlines > 9 ? '9+' : urgentDeadlines}</span>
                )}
                {item.id === 'chat' && totalUnreadChat > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 text-[9px] text-white flex items-center justify-center rounded-full font-black shadow">{totalUnreadChat > 9 ? '9+' : totalUnreadChat}</span>
                )}
              </div>
              {isSidebarOpen && <span className="text-sm font-semibold tracking-wide whitespace-nowrap flex-1 text-left">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-navy-700">
          <button onClick={onLogout} className={`w-full flex items-center gap-4 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors ${!isSidebarOpen ? 'md:justify-center' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            {isSidebarOpen && <span className="text-sm font-bold uppercase tracking-widest">Sair</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden transition-all duration-300">
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-4 md:px-8 z-30 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-navy-800 dark:text-gold-800 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            {djenSyncing && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-full border border-blue-200 animate-pulse">
                <svg className="w-3 h-3 text-blue-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Consultando DJEN...</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 md:gap-4" ref={notifyRef}>
            {/* Notificações */}
            <div className="relative">
              <button onClick={() => setIsNotifyOpen(!isNotifyOpen)}
                className={`p-2 transition-all rounded-full flex items-center justify-center border-2 ${isNotifyOpen ? 'bg-navy-800 text-white border-navy-800' : 'bg-gray-50 dark:bg-slate-700 border-transparent text-gray-500 hover:border-gold-800'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-[10px] text-white flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800 animate-bounce font-black shadow-lg">{unreadCount}</span>}
              </button>
              {isNotifyOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border dark:border-slate-700 z-50 animate-in fade-in overflow-hidden">
                  <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-navy-50/50 dark:bg-slate-900/50">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-navy-800 dark:text-white">Seus Alertas</h4>
                    <button onClick={() => { setNotifications(notifications.map(n => n.recipientId === userId ? { ...n, read: true } : n)); setIsNotifyOpen(false); }}
                      className="text-[9px] text-navy-800 dark:text-gold-800 font-bold hover:underline uppercase">Marcar lidas</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {myNotifications.length === 0 ? (
                      <div className="p-12 text-center text-xs text-gray-400 italic">Nenhuma notificação.</div>
                    ) : myNotifications.map(n => {
                      const mod = inferModule(n);
                      return (
                        <button key={n.id} onClick={() => { if (!n.read) setNotifications((prev: any[]) => prev.map((x: any) => x.id === n.id ? { ...x, read: true } : x)); if (mod) { setActiveModule(mod); setIsNotifyOpen(false); } }}
                          className={`w-full text-left p-4 border-b last:border-0 dark:border-slate-700 transition-colors hover:bg-navy-50 dark:hover:bg-navy-900/40 ${!n.read ? 'bg-navy-50/30 dark:bg-gold-800/5' : ''}`}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-tighter truncate">{n.title}</p>
                            <span className="text-[8px] text-gray-400 font-bold ml-2 shrink-0">{n.time}</span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{n.message}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleDarkMode} className={`p-2 transition-all rounded-full ${isDarkMode ? 'bg-gold-800 text-white shadow-lg' : 'bg-gray-100 text-navy-800'}`}>
              {isDarkMode ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M2 12h2"/><path d="M20 12h2"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>}
            </button>

            <div className="flex items-center gap-3 border-l pl-4 border-gray-200 dark:border-slate-700 ml-1">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-bold dark:text-white leading-none">{userName}</p>
                <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest mt-1">{userRole}</p>
              </div>
              <div className="w-10 h-10 rounded-xl border-2 border-gold-800/30 bg-navy-800 flex items-center justify-center text-white font-bold shrink-0 shadow-lg">{userName.charAt(0)}</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar bg-gray-50 dark:bg-slate-900">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
