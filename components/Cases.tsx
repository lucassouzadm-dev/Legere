
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Modal from './Modal';
import { CaseStatus, Case } from '../types';
import { getCurrentTenantId } from '../services/tenantService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

interface CasesProps {
  cases: Case[];
  setCases: React.Dispatch<React.SetStateAction<any[]>>;
  clients: any[];
  users: any[];
}

const COLORS = ['#1E3A8A', '#D4AF37', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#3B82F6'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const Cases: React.FC<CasesProps> = ({ cases, setCases, clients, users }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'quarter' | 'semester' | 'year'>('year');
  const [editingCase, setEditingCase] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para o Autocomplete de Cliente no Modal
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientSuggestionsRef = useRef<HTMLDivElement>(null);

  // Sincroniza campos de busca ao abrir para edição
  useEffect(() => {
    if (editingCase) {
      const client = clients.find(c => c.id === editingCase.clientId);
      if (client) {
        setClientSearch(client.name);
        setSelectedClientId(client.id);
      }
    } else {
      setClientSearch('');
      setSelectedClientId('');
    }
  }, [editingCase, clients, isModalOpen]);

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSuggestionsRef.current && !clientSuggestionsRef.current.contains(event.target as Node)) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtragem dinâmica baseada no termo de busca (Listagem principal)
  const filteredCasesList = useMemo(() => {
    if (!searchTerm.trim()) return cases;
    const lowerQ = searchTerm.toLowerCase();
    return cases.filter(c => 
      c.cnj.toLowerCase().includes(lowerQ) ||
      c.clientName.toLowerCase().includes(lowerQ) ||
      (c.opposingParty ?? '').toLowerCase().includes(lowerQ) ||
      c.area.toLowerCase().includes(lowerQ)
    );
  }, [cases, searchTerm]);

  // Sugestões de clientes para o Autocomplete
  const filteredClientSuggestions = useMemo(() => {
    if (!clientSearch.trim() || selectedClientId && clients.find(c => c.id === selectedClientId)?.name === clientSearch) return [];
    const q = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.document.includes(q)
    ).slice(0, 5);
  }, [clientSearch, clients, selectedClientId]);

  const analyticsData = useMemo(() => {
    const now = new Date();
    const filterDate = new Date();

    if (periodFilter === 'quarter') filterDate.setMonth(now.getMonth() - 3);
    else if (periodFilter === 'semester') filterDate.setMonth(now.getMonth() - 6);
    else if (periodFilter === 'year') filterDate.setFullYear(now.getFullYear() - 1);

    const filtered = cases.filter(c => {
      const cDate = new Date(c.distributionDate || c.createdAt || '2024-01-01');
      return cDate >= filterDate;
    });

    const grouped = filtered.reduce((acc: any, c) => {
      acc[c.lawyerId] = (acc[c.lawyerId] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(grouped).map(lawyerId => ({
      name: users.find(u => u.id === lawyerId)?.name?.split(' ')[0] || 'Outros',
      count: grouped[lawyerId]
    })).sort((a,b) => b.count - a.count);
  }, [cases, users, periodFilter]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Validação de cliente selecionado via autocomplete
    if (!selectedClientId) {
      alert("Por favor, selecione um cliente válido das sugestões.");
      return;
    }

    const client = clients.find(c => c.id === selectedClientId);

    const caseData = {
      id:              editingCase?.id || `p${Date.now()}`,
      cnj:             formData.get('cnj') as string,
      clientId:        selectedClientId,
      clientName:      client?.name || 'Cliente Indefinido',
      opposingParty:   (formData.get('opposingParty') as string) || '',
      area:            formData.get('area') as string,
      court:           (formData.get('court') as string) || '',
      status:          formData.get('status') as CaseStatus,
      value:           Number(formData.get('value')),
      lawyerId:        formData.get('lawyerId') as string,
      lastMovement:    (formData.get('lastMovement') as string) || editingCase?.lastMovement || 'Processo cadastrado no sistema.',
      // Preserva probability e risk ao editar; usa defaults ao criar
      probability:     editingCase?.probability ?? 50,
      risk:            editingCase?.risk ?? 'MEDIUM',
      createdAt:       editingCase?.createdAt || new Date().toISOString(),
      distributionDate: formData.get('distributionDate') as string || new Date().toISOString().split('T')[0],
      tenantId:        editingCase?.tenantId || getCurrentTenantId(),
    };

    if (editingCase) {
      setCases(cases.map(c => c.id === editingCase.id ? caseData : c));
    } else {
      setCases([caseData, ...cases]);
    }
    handleClose();
  };

  const handleEdit = (c: any) => {
    setEditingCase(c);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente excluir este processo? Todos os prazos vinculados deverão ser revistos.")) {
      setCases(cases.filter(c => c.id !== id));
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingCase(null);
    setClientSearch('');
    setSelectedClientId('');
    setShowClientSuggestions(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif dark:text-white">Gestão de Processos</h2>
          <p className="text-sm text-gray-500">Controle jurisdicional e movimentações.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowAnalytics(!showAnalytics)} 
            className={`px-6 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${showAnalytics ? 'bg-gold-800 border-gold-800 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-white hover:bg-gray-50'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            {showAnalytics ? 'Fechar Estatísticas' : 'Ver Estatísticas'}
          </button>
          <button onClick={() => setIsModalOpen(true)} className="bg-navy-800 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-gold-800 transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            Distribuir Ação
          </button>
        </div>
      </div>

      <div className="relative group max-w-md">
        <input 
          type="text" 
          placeholder="Filtrar por CNJ ou Cliente..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-10 py-3 text-sm focus:ring-2 focus:ring-gold-800 outline-none dark:text-white shadow-sm transition-all"
        />
        <svg className="absolute left-3 top-3.5 w-4 h-4 text-gray-400 group-focus-within:text-gold-800 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-3.5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {showAnalytics && (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border dark:border-slate-700 shadow-xl animate-in zoom-in-95 duration-300">
           <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-10">
              <div>
                <h3 className="text-xl font-bold dark:text-white">Produtividade por Responsável</h3>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-1">Volume de novos processos distribuídos</p>
              </div>
              <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl border dark:border-slate-700">
                 <button onClick={() => setPeriodFilter('quarter')} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${periodFilter === 'quarter' ? 'bg-white dark:bg-slate-700 text-navy-800 dark:text-gold-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Trimestre</button>
                 <button onClick={() => setPeriodFilter('semester')} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${periodFilter === 'semester' ? 'bg-white dark:bg-slate-700 text-navy-800 dark:text-gold-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Semestre</button>
                 <button onClick={() => setPeriodFilter('year')} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${periodFilter === 'year' ? 'bg-white dark:bg-slate-700 text-navy-800 dark:text-gold-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Ano</button>
              </div>
           </div>

           <div className="h-[350px] w-full">
              {analyticsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                         {analyticsData.map((_, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                         ))}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                   <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                   <p>Nenhum dado localizado para este período.</p>
                </div>
              )}
           </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/50 dark:bg-slate-900/50 text-[10px] font-bold uppercase text-gray-400 border-b dark:border-slate-700">
            <tr>
              <th className="p-4">CNJ / Distribuição</th>
              <th className="p-4">Área / Responsável</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Valor</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-slate-700">
            {filteredCasesList.length > 0 ? filteredCasesList.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="p-4">
                  <p className="font-mono text-xs font-bold text-navy-800 dark:text-navy-100">{item.cnj}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Dist.: {item.distributionDate ? new Date(item.distributionDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{item.clientName}</p>
                  {item.opposingParty && (
                    <p className="text-[10px] text-red-500 dark:text-red-400 font-bold mt-0.5">
                      <span className="text-gray-400 font-normal">vs.</span> {item.opposingParty}
                    </p>
                  )}
                </td>
                <td className="p-4">
                  <p className="font-bold dark:text-white">{item.area}</p>
                  {item.court && <p className="text-[10px] text-gray-400 font-medium mt-0.5 truncate max-w-[160px]">{item.court}</p>}
                  <p className="text-[10px] text-gold-800 uppercase font-bold mt-0.5">{users.find(u => u.id === item.lawyerId)?.name || 'Sem Resp.'}</p>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                    item.status === 'WON' ? 'bg-green-100 text-green-700' : 
                    item.status === 'LOST' ? 'bg-red-100 text-red-700' : 
                    'bg-navy-50 text-navy-700'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="p-4 text-right font-bold dark:text-white">{formatCurrency(item.value)}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-navy-800 p-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                    <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-600 p-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="p-20 text-center opacity-30 italic">
                  <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Nenhum processo localizado para "{searchTerm}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose} title={editingCase ? "Editar Processo" : "Novo Processo"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Número CNJ</label>
              <input name="cnj" defaultValue={editingCase?.cnj} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm font-mono dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Data de Distribuição</label>
              <input name="distributionDate" type="date" defaultValue={editingCase?.distributionDate || new Date().toISOString().split('T')[0]} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" />
            </div>
            
            {/* NOVO CAMPO AUTOCOMPLETE DE CLIENTE */}
            <div className="relative" ref={clientSuggestionsRef}>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Cliente Vinculado</label>
              <input 
                type="text"
                placeholder="Busque por nome ou CPF/CNPJ..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setSelectedClientId('');
                  setShowClientSuggestions(true);
                }}
                onFocus={() => setShowClientSuggestions(true)}
                required
                className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none"
              />
              
              {showClientSuggestions && filteredClientSuggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                  {filteredClientSuggestions.map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setClientSearch(client.name);
                        setSelectedClientId(client.id);
                        setShowClientSuggestions(false);
                      }}
                      className="w-full text-left p-3 hover:bg-navy-50 dark:hover:bg-slate-700 border-b last:border-0 dark:border-slate-700 transition-colors"
                    >
                      <p className="text-xs font-bold dark:text-white">{client.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{client.document}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedClientId && (
                <div className="absolute right-3 top-[34px]">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Parte Contrária</label>
              <input
                name="opposingParty"
                defaultValue={editingCase?.opposingParty}
                placeholder="Nome da parte adversa..."
                className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Advogado Responsável</label>
              <select name="lawyerId" defaultValue={editingCase?.lawyerId} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none">
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Área</label>
              <input name="area" defaultValue={editingCase?.area} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Tribunal / Vara</label>
              <input name="court" defaultValue={editingCase?.court} placeholder="Ex: TJBA — 1ª Vara Cível de Salvador" className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Valor da Causa</label>
              <input name="value" type="number" step="0.01" defaultValue={editingCase?.value} required className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm font-bold dark:text-white" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Última Movimentação (Visível ao Cliente)</label>
              <textarea name="lastMovement" defaultValue={editingCase?.lastMovement} rows={3} className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white" placeholder="Descreva o status atual para o cliente..."></textarea>
            </div>
            <div className="col-span-2">
               <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Status Processual</label>
               <select name="status" defaultValue={editingCase?.status || 'ONGOING'} className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-sm dark:text-white">
                 <option value="ONGOING">Em Curso</option>
                 <option value="SUSPENDED">Suspenso</option>
                 <option value="ARCHIVED">Arquivado</option>
                 <option value="WON">Vencido (Procedente)</option>
                 <option value="LOST">Perdido (Improcedente)</option>
                 <option value="SETTLEMENT">Acordo</option>
               </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-8">
            <button type="button" onClick={handleClose} className="px-6 py-2 rounded-xl text-sm font-bold text-gray-400">Cancelar</button>
            <button type="submit" className="px-8 py-2 bg-navy-800 text-white rounded-xl text-sm font-bold hover:bg-gold-800 transition-all">Salvar Processo</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Cases;
