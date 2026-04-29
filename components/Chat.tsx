
import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { UserRole } from '../types';

interface ChatProps {
  users: any[];
  currentUser: any;
  channels: any[];
  setChannels: React.Dispatch<React.SetStateAction<any[]>>;
  chatMessages: any[];
  setChatMessages: React.Dispatch<React.SetStateAction<any[]>>;
  onNewMessage: (msg: any) => void;
  addNotification: (title: string, message: string, recipientId: string) => void;
  unreadChatCounts: Record<string, number>;
  activeChatId: string;
  setActiveChatId: (id: string) => void;
}

const Chat: React.FC<ChatProps> = ({
  users,
  currentUser,
  channels,
  setChannels,
  chatMessages,
  setChatMessages,
  onNewMessage,
  addNotification,
  unreadChatCounts,
  activeChatId,
  setActiveChatId
}) => {
  const getDmChatId = (id1: string, id2: string) => {
    const ids = [id1, id2].sort();
    return `dm-${ids[0]}-${ids[1]}`;
  };

  const [activeChat, setActiveChatInternal] = useState<any>(() => {
    const saved = localStorage.getItem('juriscloud_last_active_chat');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return channels[0]; }
    }
    return channels[0] || { id: 'empty', name: 'Nenhum Canal', type: 'CHANNEL', members: [] };
  });

  const [inputValue, setInputValue] = useState('');
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [isSyncing, setIsSyncing] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mantém activeChat sincronizado quando channels é atualizado externamente
  // (ex.: outro usuário adiciona membro, ou Supabase sync chega)
  useEffect(() => {
    if (activeChat?.type === 'CHANNEL') {
      const updated = channels.find(ch => ch.id === activeChat.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(activeChat)) {
        setActiveChatInternal(updated);
      }
    }
  }, [channels]);

  useEffect(() => {
    if (activeChat && activeChat.id !== 'empty') {
      setActiveChatId(activeChat.id);
      localStorage.setItem('juriscloud_last_active_chat', JSON.stringify(activeChat));
    }
  }, [activeChat, setActiveChatId]);

  useEffect(() => {
    setIsSyncing(true);
    const timer = setTimeout(() => setIsSyncing(false), 400);
    return () => clearTimeout(timer);
  }, [activeChatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeChatId, isSyncing]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessage = {
      id: Date.now(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: inputValue,
      time: now,
      chatId: activeChat.id,
    };

    onNewMessage(newMessage);

    // Notificação de mensagem direta (DM)
    if (activeChat.type === 'DM' && activeChat.recipientId) {
      const preview = inputValue.length > 60 ? inputValue.slice(0, 60) + '…' : inputValue;
      addNotification(`Mensagem de ${currentUser.name}`, preview, activeChat.recipientId);
    }

    // Detecção de @menções — notifica cada usuário mencionado
    const mentionRegex = /@([A-Za-zÀ-ÿ0-9._-]+)/g;
    let match;
    const notifiedIds = new Set<string>();
    while ((match = mentionRegex.exec(inputValue)) !== null) {
      const mentionedName = match[1].toLowerCase();
      const mentioned = users.find(u =>
        u.name.toLowerCase().replace(/\s+/g, '.').includes(mentionedName) ||
        u.name.toLowerCase().split(' ')[0].includes(mentionedName)
      );
      if (mentioned && mentioned.id !== currentUser.id && !notifiedIds.has(mentioned.id)) {
        notifiedIds.add(mentioned.id);
        const preview = inputValue.length > 60 ? inputValue.slice(0, 60) + '…' : inputValue;
        addNotification(
          `${currentUser.name} mencionou você`,
          `Em #${activeChat.name}: "${preview}"`,
          mentioned.id
        );
      }
    }

    setInputValue('');
  };

  const handleToggleMember = (userId: string) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id === activeChat.id) {
        const isMember = ch.members.includes(userId);
        const updated = {
          ...ch,
          members: isMember
            ? ch.members.filter((id: string) => id !== userId)
            : [...ch.members, userId],
        };
        // Sincroniza o estado local activeChat para que os botões reflitam
        // imediatamente após adicionar/remover, sem esperar re-render do pai
        setActiveChatInternal(updated);
        return updated;
      }
      return ch;
    }));
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    const newChannel = { id: `ch-${Date.now()}`, name: newChannelName.trim(), members: [currentUser.id], type: 'CHANNEL' };
    setChannels(prev => [...prev, newChannel]);
    setNewChannelName('');
    setIsCreateChannelOpen(false);
    setActiveChatInternal(newChannel);
  };

  const filteredMessages = chatMessages.filter(m => m.chatId === activeChatId);
  const dms = users.filter(u => u.id !== currentUser.id && u.status === 'APPROVED');

  return (
    <div className="h-[calc(100vh-12rem)] flex bg-white dark:bg-slate-800 rounded-3xl shadow-xl border dark:border-slate-700 overflow-hidden animate-in fade-in duration-500">
      <div className="w-72 bg-gray-50 dark:bg-slate-900 border-r dark:border-slate-700 flex flex-col shrink-0">
        <div className="p-6 border-b dark:border-slate-700">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] dark:text-white">Mensagens</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          <div>
            <div className="flex items-center justify-between px-2 mb-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Canais da Banca</h3>
              <button onClick={() => setIsCreateChannelOpen(true)} className="w-5 h-5 bg-navy-100 dark:bg-slate-700 text-navy-800 dark:text-gold-800 rounded-md flex items-center justify-center hover:bg-gold-800 hover:text-white transition-all shadow-sm">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
              </button>
            </div>
            <div className="space-y-1">
              {channels.map(ch => (
                <div key={ch.id} className="relative group">
                  <button 
                    onClick={() => setActiveChatInternal(ch)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeChatId === ch.id ? 'bg-navy-800 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                  >
                    <span className="opacity-40">#</span> {ch.name}
                    {unreadChatCounts[ch.id] > 0 && activeChatId !== ch.id && (
                      <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-gold-800 text-white text-[10px] flex items-center justify-center rounded-full animate-pulse shadow-md font-black">
                        {unreadChatCounts[ch.id]}
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">Profissionais</h3>
            <div className="space-y-1">
              {dms.map(u => {
                const dmChatId = getDmChatId(currentUser.id, u.id);
                const unread = unreadChatCounts[dmChatId] || 0;
                return (
                  <button 
                    key={u.id}
                    onClick={() => setActiveChatInternal({ id: dmChatId, name: u.name, type: 'DM', recipientId: u.id })}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeChatId === dmChatId ? 'bg-navy-800 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-navy-50 flex items-center justify-center text-[11px] font-bold text-navy-800 border dark:border-slate-700 shrink-0">
                        {u.name.charAt(0)}
                    </div>
                    <div className="text-left overflow-hidden flex-1">
                      <p className="truncate leading-tight">{u.name}</p>
                      <p className="text-[8px] font-bold uppercase opacity-60">Privada</p>
                    </div>
                    {unread > 0 && activeChatId !== dmChatId && (
                      <span className="min-w-[20px] h-5 px-1.5 bg-gold-800 text-white text-[10px] flex items-center justify-center rounded-full animate-pulse shadow-md font-black shrink-0">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-gray-50/30 dark:bg-slate-900/10">
        <div className="p-6 border-b dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg ${activeChat.type === 'CHANNEL' ? 'bg-gold-800 text-white' : 'bg-navy-800 text-white'}`}>
              {activeChat.type === 'CHANNEL' ? '#' : activeChat.name.charAt(0)}
            </div>
            <div>
              <h4 className="font-bold dark:text-white text-lg leading-none">{activeChat.name}</h4>
              <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest mt-1">Conexão Segura</p>
            </div>
          </div>
          {activeChat.type === 'CHANNEL' && activeChat.id !== 'empty' && (
            <button onClick={() => setIsManageOpen(true)} className="p-3 text-gray-400 hover:text-navy-800 dark:hover:text-gold-800 transition-colors bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-700 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {isSyncing ? (
            <div className="h-full flex items-center justify-center"><p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Sincronizando...</p></div>
          ) : activeChat.id === 'empty' ? (
             <div className="h-full flex items-center justify-center opacity-30 italic text-sm">Selecione uma conversa.</div>
          ) : filteredMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center opacity-30 italic text-sm">Nenhuma mensagem ainda.</div>
          ) : (
            filteredMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                <div className={`max-w-[75%] ${msg.senderId === currentUser.id ? 'items-end' : 'items-start'}`}>
                  {msg.senderId !== currentUser.id && <p className="text-[10px] font-bold text-navy-800 dark:text-gold-800 ml-1 mb-1">{msg.senderName}</p>}
                  <div className={`p-4 rounded-[1.5rem] shadow-sm text-sm ${msg.senderId === currentUser.id ? 'bg-navy-800 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 dark:text-white rounded-tl-none border dark:border-slate-700'}`}>
                    {msg.content.split(/(@[A-Za-zÀ-ÿ0-9._-]+)/g).map((part: string, i: number) =>
                      part.startsWith('@') ? (
                        <span key={`${msg.id}-mention-${i}`} className={`font-bold rounded px-0.5 ${msg.senderId === currentUser.id ? 'text-gold-300 bg-white/10' : 'text-navy-800 dark:text-gold-800 bg-navy-50 dark:bg-slate-700'}`}>{part}</span>
                      ) : part
                    )}
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1 px-1 font-bold uppercase">{msg.time}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-white dark:bg-slate-800 border-t dark:border-slate-700">
          <form onSubmit={handleSendMessage} className="flex gap-4">
            <input 
              type="text" 
              disabled={activeChat.id === 'empty' || isSyncing}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Mensagem para ${activeChat.name}...`} 
              className="flex-1 bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-gold-800 dark:text-white disabled:opacity-50"
            />
            <button type="submit" disabled={!inputValue.trim()} className="bg-navy-800 text-white px-8 rounded-2xl hover:bg-gold-800 transition-all shadow-xl disabled:opacity-50 font-bold uppercase text-[10px] tracking-widest">Enviar</button>
          </form>
        </div>
      </div>

      <Modal isOpen={isCreateChannelOpen} onClose={() => setIsCreateChannelOpen(false)} title="Novo Canal">
        <form onSubmit={handleCreateChannel} className="space-y-6">
          <input type="text" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-2xl p-4 text-sm dark:text-white" placeholder="Nome do Grupo..." />
          <button type="submit" className="w-full py-4 bg-navy-800 text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-gold-800">Criar Grupo</button>
        </form>
      </Modal>

      <Modal isOpen={isManageOpen} onClose={() => setIsManageOpen(false)} title={`Membros: #${activeChat.name}`}>
        <div className="space-y-2">
           {users.filter(u => u.status === 'APPROVED').map(u => (
             <div key={u.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-700">
                <p className="text-sm font-bold dark:text-white">{u.name}</p>
                <button onClick={() => handleToggleMember(u.id)} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest ${activeChat.members?.includes(u.id) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {activeChat.members?.includes(u.id) ? 'Remover' : 'Adicionar'}
                </button>
             </div>
           ))}
        </div>
      </Modal>
    </div>
  );
};

export default Chat;
