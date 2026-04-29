
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { ClientStatus, Client, ServiceLog, UserRole, ClientNotice, ClientDocument } from '../types';

interface CRMProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  currentUser: any;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const statusLabels: { [key in ClientStatus]: { label: string, color: string } } = {
  [ClientStatus.LEAD]: { label: 'Lead', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  [ClientStatus.PROSPECT]: { label: 'Prospecto', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  [ClientStatus.CONTRACT_SENT]: { label: 'Contrato Enviado', color: 'bg-gold-100 text-gold-700 border-gold-300' },
  [ClientStatus.ACTIVE]: { label: 'Ativo', color: 'bg-green-100 text-green-700 border-green-200' },
  [ClientStatus.INACTIVE]: { label: 'Inativo', color: 'bg-gray-100 text-gray-500 border-gray-200' },
  [ClientStatus.EX_CLIENT]: { label: 'Ex-Cliente', color: 'bg-red-100 text-red-700 border-red-200' },
};

const CRM: React.FC<CRMProps> = ({ clients, setClients, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const selectedClient = clients.find(c => c.id === selectedClientId) || null;
  
  const [newLogContent, setNewLogContent] = useState('');
  const [newLogTag, setNewLogTag] = useState('Geral');
  const [logFilterTag, setLogFilterTag] = useState('Todas');
  
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [newNoticeDate, setNewNoticeDate] = useState('');

  const isAdmin = currentUser.role === UserRole.ADMIN;

  const filteredAndSortedClients = useMemo(() => {
    let result = [...clients];
    if (searchTerm.trim()) {
      const lowerQ = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(lowerQ) || 
        c.document.includes(lowerQ)
      );
    }
    if (statusFilter !== 'ALL') {
      result = result.filter(c => c.status === statusFilter);
    }
    result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return result;
  }, [clients, searchTerm, statusFilter]);

  const uniqueLogTags = useMemo(() => {
    if (!selectedClient?.serviceLogs) return ['Todas'];
    const tags = new Set(selectedClient.serviceLogs.map(l => l.tag || 'Geral'));
    return ['Todas', ...Array.from(tags)];
  }, [selectedClient]);

  const filteredLogs = useMemo(() => {
    if (!selectedClient?.serviceLogs) return [];
    if (logFilterTag === 'Todas') return selectedClient.serviceLogs;
    return selectedClient.serviceLogs.filter(l => (l.tag || 'Geral') === logFilterTag);
  }, [selectedClient, logFilterTag]);

  const needsContact = (lastDate: string | undefined) => {
    if (!lastDate) return true;
    const last = new Date(lastDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = now.getTime() - last.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 30;
  };

  const handleDownload = (content: string, fileName: string) => {
    try {
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = content;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const clientData: Client = {
      id: editingClient?.id || `c${Date.now()}`,
      name: formData.get('name') as string,
      type: formData.get('type') as any,
      document: formData.get('document') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      status: formData.get('status') as ClientStatus,
      birthDate: formData.get('birthDate') as string,
      lastContactDate: formData.get('lastContactDate') as string,
      area: formData.get('area') as string,
      totalContract: isAdmin ? Number(formData.get('totalContract')) : (editingClient?.totalContract || 0),
      totalPaid: isAdmin ? Number(formData.get('totalPaid')) : (editingClient?.totalPaid || 0),
      createdAt: editingClient?.createdAt || new Date().toISOString(),
      documents: editingClient?.documents || [],
      serviceLogs: editingClient?.serviceLogs || [],
      notices: editingClient?.notices || [],
      tags: editingClient?.tags || [],
      score: editingClient?.score || 0
    };

    if (editingClient) {
      setClients(clients.map(c => c.id === editingClient.id ? clientData : c));
    } else {
      setClients([clientData, ...clients]);
    }
    handleClose();
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !newLogContent.trim()) return;

    const newLog: ServiceLog = {
      id: String(Date.now()),
      date: new Date().toLocaleString('pt-BR'),
      content: newLogContent,
      authorName: currentUser.name,
      tag: newLogTag
    };

    const updatedClients = clients.map(c => {
      if (c.id === selectedClient.id) {
        return {
          ...c,
          lastContactDate: new Date().toISOString().split('T')[0],
          serviceLogs: [newLog, ...(c.serviceLogs || [])]
        };
      }
      return c;
    });

    setClients(updatedClients);
    setNewLogContent('');
    setNewLogTag('Geral');
  };

  const handleAddNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !newNoticeContent.trim()) return;

    const newNotice: ClientNotice = {
      id: String(Date.now()),
      content: newNoticeContent,
      date: newNoticeDate || undefined,
      createdAt: new Date().toISOString()
    };

    const updatedClients = clients.map(c => {
      if (c.id === selectedClient.id) {
        return { ...c, notices: [newNotice, ...(c.notices || [])] };
      }
      return c;
    });

    setClients(updatedClients);
    setNewNoticeContent('');
    setNewNoticeDate('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClient) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target?.result as string;
      const newDoc: ClientDocument = {
        id: Date.now().toString(),
        name: file.name,
        date: new Date().toLocaleDateString('pt-BR'),
        type: file.type.split('/')[1]?.toUpperCase() || 'FILE',
        status: 'DISPONÍVEL',
        content: fileData,
        sentBy: 'OFFICE'
      };

      const updatedClients = clients.map(c => {
        if (c.id === selectedClient.id) {
          return { ...c, documents: [newDoc, ...(c.documents || [])] };
        }
        return c;
      });
      setClients(updatedClients);
    };
    reader.readAsDataURL(file);
  };

  const deleteDocument = (docId: string) => {
    if (!selectedClient || !confirm("Deseja remover este documento?")) return;
    const updatedClients = clients.map(c => {
      if (c.id === selectedClient.id) {
        return { ...c, documents: (c.documents || []).filter(d => d.id !== docId) };
      }
      return c;
    });
    setClients(updatedClients);
  };

  const deleteNotice = (noticeId: string) => {
    if (!selectedClient) return;
    if (!confirm("Deseja remover este aviso? Ele deixará de ser visível para o cliente.")) return;
    const updatedClients = clients.map(c => {
      if (c.id === selectedClient.id) {
        return { ...c, notices: (c.notices || []).filter(n => n.id !== noticeId) };
      }
      return c;
    });
    setClients(updatedClients);
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleOpenLogs = (client: Client) => {
    setSelectedClientId(client.id);
    setLogFilterTag('Todas');
    setIsLogsModalOpen(true);
  };

  const handleOpenNotices = (client: Client) => {
    setSelectedClientId(client.id);
    setIsNoticeModalOpen(true);
  };

  const handleOpenDocs = (client: Client) => {
    setSelectedClientId(client.id);
    setIsDocsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      setClients(clients.filter(c => c.id !== id));
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold font-serif dark:text-white">Clientes & CRM</h2>
          <p className="text-sm text-gray-500">Gestão completa do relacionamento e histórico de atendimentos.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-navy-800 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-gold-800 transition-all flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          Novo Cliente
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative group flex-1 w-full">
          <input 
            type="text" 
            placeholder="Buscar por nome ou documento..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-10 py-3 text-sm focus:ring-2 focus:ring-gold-800 outline-none dark:text-white shadow-sm transition-all"
          />
          <svg className="absolute left-3 top-3.5 w-4 h-4 text-gray-400 group-focus-within:text-gold-800 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>

        <div className="w-full md:w-64">
           <select 
             value={statusFilter}
             onChange={(e) => setStatusFilter(e.target.value)}
             className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-gold-800 outline-none dark:text-white shadow-sm transition-all"
           >
             <option value="ALL">Todos os Status</option>
             <option value={ClientStatus.LEAD}>Status: Lead</option>
             <option value={ClientStatus.PROSPECT}>Status: Prospecto</option>
             <option value={ClientStatus.CONTRACT_SENT}>Status: Contrato Enviado</option>
             <option value={ClientStatus.ACTIVE}>Status: Ativo</option>
             <option value={ClientStatus.INACTIVE}>Status: Inativo</option>
             <option value={ClientStatus.EX_CLIENT}>Status: Ex-Cliente</option>
           </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="border-b dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 text-[10px] font-bold uppercase text-gray-400">
              <th className="p-4">Cliente / Contato</th>
              {isAdmin && <th className="p-4">Financeiro</th>}
              <th className="p-4">Status da Jornada</th>
              <th className="p-4">Relacionamento</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-slate-700">
            {filteredAndSortedClients.length > 0 ? filteredAndSortedClients.map(client => (
              <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-800 flex items-center justify-center font-bold text-sm border dark:border-slate-700 shadow-sm">{client.name.charAt(0)}</div>
                    <div>
                       <p className="text-sm font-bold dark:text-white leading-none mb-1">{client.name}</p>
                       <p className="text-[10px] text-gray-400 font-mono">{client.document}</p>
                    </div>
                  </div>
                </td>
                {isAdmin && (
                  <td className="p-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold dark:text-white">{formatCurrency(client.totalPaid)}</p>
                      <div className="w-24 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                         <div className="h-full bg-gold-800 transition-all" style={{ width: `${Math.min(100, (client.totalPaid / (client.totalContract || 1)) * 100)}%` }}></div>
                      </div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">De {formatCurrency(client.totalContract)}</p>
                    </div>
                  </td>
                )}
                <td className="p-4">
                  <span className={`px-3 py-1 text-[9px] font-bold rounded-full uppercase border shadow-sm ${statusLabels[client.status as ClientStatus]?.color || 'bg-gray-100 text-gray-500'}`}>
                    {statusLabels[client.status as ClientStatus]?.label || client.status}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Últ. Contato:</span>
                      <span className={`text-[10px] font-bold ${needsContact(client.lastContactDate) ? 'text-red-600 font-extrabold animate-pulse' : 'text-gray-400'}`}>
                        {client.lastContactDate ? new Date(client.lastContactDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Nunca'}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => handleOpenLogs(client)} className="text-[8px] bg-navy-50 dark:bg-slate-700 text-navy-800 dark:text-gold-800 font-bold px-1.5 py-0.5 rounded uppercase hover:bg-navy-800 hover:text-white transition-all">
                        {client.serviceLogs?.length || 0} Histórico
                      </button>
                      <button onClick={() => handleOpenNotices(client)} className="text-[8px] bg-blue-50 dark:bg-slate-700 text-blue-800 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded uppercase hover:bg-blue-600 hover:text-white transition-all">
                        {client.notices?.length || 0} Avisos
                      </button>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleOpenDocs(client)} className="p-2 text-gray-400 hover:text-navy-800 transition-all" title="Documentos">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z"/></svg>
                    </button>
                    <button onClick={() => handleEdit(client)} className="p-2 text-gray-400 hover:text-navy-800 transition-all" title="Editar"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                    <button onClick={() => handleDelete(client.id)} className="p-2 text-gray-400 hover:text-red-600 transition-all" title="Excluir"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="p-20 text-center opacity-30 italic">Nenhum cliente localizado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Histórico com Categorização (Tags) */}
      <Modal isOpen={isLogsModalOpen} onClose={() => { setIsLogsModalOpen(false); setSelectedClientId(null); }} title={`Atendimentos: ${selectedClient?.name}`}>
        <div className="space-y-8">
           <form onSubmit={handleAddLog} className="space-y-4 bg-gray-50 dark:bg-slate-900 p-6 rounded-3xl border dark:border-slate-700">
              <div className="flex flex-col md:flex-row gap-4">
                 <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Assunto / Caso de Referência (Tag)</label>
                    <input 
                      type="text" 
                      list="common-tags" 
                      value={newLogTag} 
                      onChange={(e) => setNewLogTag(e.target.value)}
                      placeholder="Ex: Caso Cível, Inventário, Geral..."
                      className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-2 text-xs outline-none focus:ring-2 focus:ring-gold-800 dark:text-white"
                    />
                    <datalist id="common-tags">
                       <option value="Geral" />
                       <option value="Cível" />
                       <option value="Trabalhista" />
                       <option value="Inventário" />
                       <option value="Consulta Inicial" />
                    </datalist>
                 </div>
              </div>
              <textarea value={newLogContent} onChange={(e) => setNewLogContent(e.target.value)} placeholder="Resuma o que foi conversado ou as providências tomadas..." className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-gold-800 dark:text-white resize-none" rows={3} required />
              <div className="flex justify-end">
                <button type="submit" className="bg-navy-800 text-white px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold-800 transition-all shadow-lg">Registrar Atendimento</button>
              </div>
           </form>

           <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b dark:border-slate-700 pb-4">
                 <h4 className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-[0.2em]">Linha do Tempo</h4>
                 
                 {/* SISTEMA DE FILTRO POR TAG */}
                 <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Filtrar Caso:</span>
                    <div className="flex flex-wrap gap-1">
                       {uniqueLogTags.map(tag => (
                          <button 
                            key={tag}
                            onClick={() => setLogFilterTag(tag)}
                            className={`px-3 py-1 rounded-full text-[9px] font-bold transition-all border ${logFilterTag === tag ? 'bg-gold-800 text-white border-gold-800 shadow-md' : 'bg-white dark:bg-slate-800 text-gray-400 border-gray-200 dark:border-slate-700 hover:border-gold-800'}`}
                          >
                             {tag}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                 {filteredLogs.length === 0 ? (
                    <p className="text-center py-10 text-xs text-gray-400 italic">Nenhum registro encontrado para este filtro.</p>
                 ) : filteredLogs.map((log) => (
                   <div key={log.id} className="relative pl-8 before:content-[''] before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-0.5 before:bg-gray-200 dark:before:bg-slate-700">
                      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border-2 border-gold-800 z-10 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-gold-800"></div></div>
                      <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 p-4 rounded-2xl shadow-sm hover:border-gold-800 transition-colors">
                         <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                               <p className="text-[10px] font-bold text-gold-800 uppercase">{log.date}</p>
                               <span className="bg-navy-50 dark:bg-navy-900/50 text-navy-800 dark:text-gold-800 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-navy-100 dark:border-gold-900/20">{log.tag || 'Geral'}</span>
                            </div>
                            <p className="text-[8px] font-bold text-gray-400 uppercase">Por: {log.authorName}</p>
                         </div>
                         <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{log.content}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </Modal>

      {/* Modal de Avisos ao Cliente */}
      <Modal isOpen={isNoticeModalOpen} onClose={() => { setIsNoticeModalOpen(false); setSelectedClientId(null); }} title={`Avisos para ${selectedClient?.name}`}>
        <div className="space-y-8">
           <form onSubmit={handleAddNotice} className="space-y-4 bg-blue-50/50 dark:bg-slate-900 p-6 rounded-3xl border border-blue-100 dark:border-slate-700">
              <div className="grid grid-cols-1 gap-4">
                 <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Conteúdo do Aviso (Visível no Portal)</label>
                    <textarea value={newNoticeContent} onChange={(e) => setNewNoticeContent(e.target.value)} placeholder="Digite o aviso para o cliente..." className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-gold-800 dark:text-white resize-none" rows={3} required />
                 </div>
                 <div className="w-full md:w-1/2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Data de Referência / Agendamento (Opcional)</label>
                    <input type="date" value={newNoticeDate} onChange={(e) => setNewNoticeDate(e.target.value)} className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-2 text-xs outline-none focus:ring-2 focus:ring-gold-800 dark:text-white" />
                 </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="bg-navy-800 text-white px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold-800 transition-all shadow-lg">Publicar Aviso no Portal</button>
              </div>
           </form>

           <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] border-b dark:border-slate-700 pb-2">Avisos Ativos</h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                 {(!selectedClient?.notices || selectedClient.notices.length === 0) ? (
                    <p className="text-center py-10 text-xs text-gray-400 italic">Nenhum aviso publicado.</p>
                 ) : selectedClient.notices.map((notice) => (
                   <div key={notice.id} className="p-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm flex items-center justify-between group">
                      <div className="flex-1">
                         <div className="flex items-center gap-2 mb-1">
                            <p className="text-[10px] font-bold text-gold-800 uppercase">{new Date(notice.createdAt).toLocaleDateString('pt-BR')}</p>
                            {notice.date && <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase">Ref: {new Date(notice.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                         </div>
                         <p className="text-sm dark:text-white">{notice.content}</p>
                      </div>
                      <button onClick={() => deleteNotice(notice.id)} className="p-2 text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </Modal>

      {/* Outros Modais (Documentos, Cadastro) permanecem integrados com a estrutura base */}
      <Modal isOpen={isDocsModalOpen} onClose={() => { setIsDocsModalOpen(false); setSelectedClientId(null); }} title={`Documentos de ${selectedClient?.name}`}>
        <div className="space-y-8">
           <div className="bg-navy-50/50 dark:bg-navy-800/10 p-6 rounded-3xl border border-navy-100 dark:border-navy-800/20">
              <h4 className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-widest mb-4">Enviar Documento</h4>
              <label className="w-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-navy-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 cursor-pointer hover:border-gold-800 transition-all group">
                 <svg className="w-8 h-8 text-navy-300 group-hover:text-gold-800 transition-colors mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Clique para selecionar</span>
                 <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
           </div>
           <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {(!selectedClient?.documents || selectedClient.documents.length === 0) ? <p className="text-center py-10 text-xs text-gray-400 italic">Pasta vazia.</p> : selectedClient.documents.map(doc => (
                <div key={doc.id} className="p-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm flex items-center justify-between group">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-800 flex items-center justify-center"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
                      <div>
                         <p className="text-sm font-bold dark:text-white truncate max-w-[200px]">{doc.name}</p>
                         <p className="text-[8px] text-gray-400 font-bold uppercase">{doc.date} • {doc.sentBy === 'OFFICE' ? 'Enviado por Legere' : 'Pelo Cliente'}</p>
                      </div>
                   </div>
                   <div className="flex gap-2">
                      {doc.content && <button onClick={() => handleDownload(doc.content!, doc.name)} className="p-2 text-navy-800 dark:text-gold-800 hover:bg-navy-50 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg></button>}
                      <button onClick={() => deleteDocument(doc.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </Modal>

      {/* Modal Cadastro/Edição de Cliente */}
      <Modal isOpen={isModalOpen} onClose={handleClose} title={editingClient ? `Editar Ficha: ${editingClient.name}` : "Novo Cadastro de Cliente"}>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-[0.2em] border-b dark:border-slate-700 pb-2">Identificação</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nome Completo</label><input name="name" defaultValue={editingClient?.name} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">CPF/CNPJ</label><input name="document" defaultValue={editingClient?.document} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm font-mono dark:text-white" /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo</label><select name="type" defaultValue={editingClient?.type || 'PF'} className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white"><option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option></select></div>
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">E-mail</label><input name="email" type="email" defaultValue={editingClient?.email} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Telefone</label><input name="phone" defaultValue={editingClient?.phone} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" /></div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-[0.2em] border-b dark:border-slate-700 pb-2">Status CRM</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nascimento</label><input name="birthDate" type="date" defaultValue={editingClient?.birthDate} className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" /></div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fase da Jornada</label>
                <select name="status" defaultValue={editingClient?.status || ClientStatus.ACTIVE} className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white">
                  <option value={ClientStatus.LEAD}>Lead</option>
                  <option value={ClientStatus.PROSPECT}>Prospecto</option>
                  <option value={ClientStatus.CONTRACT_SENT}>Contrato Enviado</option>
                  <option value={ClientStatus.ACTIVE}>Ativo</option>
                  <option value={ClientStatus.INACTIVE}>Inativo</option>
                  <option value={ClientStatus.EX_CLIENT}>Ex-cliente</option>
                </select>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-navy-800 dark:text-gold-800 uppercase tracking-[0.2em] border-b dark:border-slate-700 pb-2">Financeiro</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Valor Contrato (R$)</label><input name="totalContract" type="number" step="0.01" defaultValue={editingClient?.totalContract} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm font-bold dark:text-white" /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Valor Pago (R$)</label><input name="totalPaid" type="number" step="0.01" defaultValue={editingClient?.totalPaid || 0} required className="w-full bg-navy-50 dark:bg-slate-800 border-navy-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-navy-800 dark:text-gold-800" /></div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 mt-8 border-t dark:border-slate-700 pt-6">
            <button type="button" onClick={handleClose} className="px-6 py-2 rounded-xl text-sm font-bold text-gray-400">Cancelar</button>
            <button type="submit" className="px-10 py-3 bg-navy-800 text-white rounded-2xl text-xs font-bold hover:bg-gold-800 transition-all uppercase tracking-widest">Salvar Ficha</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CRM;
