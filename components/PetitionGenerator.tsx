
import React, { useState } from 'react';
import { generateLegalDocument } from '../services/gemini';

interface PetitionGeneratorProps {
  clients: any[];
  cases: any[];
}

interface AttachedFile {
  name: string;
  data: string; // base64
  mimeType: string;
}

const PetitionGenerator: React.FC<PetitionGeneratorProps> = ({ clients, cases }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [formData, setFormData] = useState({
    type: 'Petição Inicial',
    clientName: '',
    facts: '',
    thesis: '',
    tone: 'Técnico-formal',
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await fileToBase64(file);
      newFiles.push({
        name: file.name,
        data: base64.split(',')[1], // remove header
        mimeType: file.type
      });
    }
    setAttachedFiles(prev => [...prev, ...newFiles]);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!formData.facts && attachedFiles.length === 0) {
      alert("Por favor, descreva os fatos ou anexe documentos para análise.");
      return;
    }

    setLoading(true);
    try {
      const doc = await generateLegalDocument({
        type: formData.type,
        clientData: { name: formData.clientName || 'Cliente' },
        facts: formData.facts,
        thesis: formData.thesis,
        tone: formData.tone,
        attachments: attachedFiles.map(f => ({ data: f.data, mimeType: f.mimeType }))
      });
      setResult(doc || 'Falha ao gerar documento.');
    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro ao gerar a peça. Verifique sua conexão ou limite de arquivos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-12rem)] animate-in slide-in-from-bottom duration-500">
      {/* Input Panel */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl overflow-y-auto space-y-6 custom-scrollbar">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-navy-800 rounded-xl flex items-center justify-center shadow-lg shadow-navy-800/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold font-serif dark:text-white">Assistente de IA Jurídica</h2>
            <p className="text-gray-500 text-sm">Criação de petições embasadas em documentos e provas.</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tipo de Peça</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none transition-all"
              >
                <option>Petição Inicial</option>
                <option>Contestação</option>
                <option>Réplica</option>
                <option>Recurso de Apelação</option>
                <option>Agravo de Instrumento</option>
                <option>Embargos de Declaração</option>
                <option>Habeas Corpus</option>
                <option>Contrato de Honorários</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Cliente (Opcional)</label>
              <select 
                value={formData.clientName}
                onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none transition-all"
              >
                <option value="">Selecionar Cliente...</option>
                {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Narrativa dos Fatos</label>
            <textarea 
              rows={4}
              value={formData.facts}
              onChange={(e) => setFormData({...formData, facts: e.target.value})}
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-4 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none resize-none transition-all"
              placeholder="Descreva o caso ou deixe em branco se for anexar documentos com os fatos..."
            />
          </div>

          {/* ÁREA DE ANEXOS */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Anexar Provas e Documentos (Para análise da IA)</label>
            <div className="space-y-3">
              <div className="relative">
                <input 
                  type="file" 
                  multiple 
                  id="legal-docs" 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                />
                <label 
                  htmlFor="legal-docs" 
                  className="w-full flex items-center justify-center gap-3 bg-gray-50 dark:bg-slate-900 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-6 cursor-pointer hover:border-gold-800 hover:bg-gold-50/50 dark:hover:bg-slate-700/50 transition-all group"
                >
                  <svg className="w-6 h-6 text-gray-400 group-hover:text-gold-800 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                  <span className="text-xs font-bold text-gray-500 group-hover:text-navy-800 dark:group-hover:text-white transition-colors uppercase tracking-widest">
                    Adicionar Provas (Imagens/Documentos)
                  </span>
                </label>
              </div>

              {attachedFiles.length > 0 && (
                <div className="grid grid-cols-1 gap-2">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl animate-in fade-in slide-in-from-left-2">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-navy-800 rounded-lg text-white">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        </div>
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 truncate">{file.name}</span>
                      </div>
                      <button onClick={() => removeFile(idx)} className="text-red-400 hover:text-red-600 p-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tese Principal</label>
            <input 
              type="text"
              value={formData.thesis}
              onChange={(e) => setFormData({...formData, thesis: e.target.value})}
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-3 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none transition-all"
              placeholder="Ex: Danos Morais, Inexistência de Débito..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tom da Peça</label>
              <select 
                value={formData.tone}
                onChange={(e) => setFormData({...formData, tone: e.target.value})}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-3 text-sm dark:text-white"
              >
                <option>Técnico-formal</option>
                <option>Moderado-persuasivo</option>
                <option>Agressivo-assertivo</option>
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3.5 bg-navy-800 text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-gold-800 transition-all shadow-xl disabled:opacity-50 uppercase text-[10px] tracking-widest"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 2v4a2 2 0 002 2h4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9l-2 2 2 2M14 9l2 2-2 2"/></svg>
                    Gerar Peça
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor/Result Panel */}
      <div className="bg-white dark:bg-slate-800 p-0 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden">
        <div className="p-4 border-b dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900/50">
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="p-2.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-gray-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg></button>
            <button onClick={() => { navigator.clipboard.writeText(result); alert("Copiado!") }} className="p-2.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-gray-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg></button>
          </div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest px-3 py-1 bg-gray-100 dark:bg-slate-700 rounded-full">Minuta Digital</span>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-12 bg-gray-100 dark:bg-slate-900 flex justify-center custom-scrollbar">
          <div className="w-full sm:w-[210mm] min-h-[297mm] h-fit bg-white dark:bg-slate-800 shadow-2xl p-6 sm:p-[30mm] text-gray-900 dark:text-white font-serif leading-relaxed whitespace-pre-wrap text-[13px] border dark:border-slate-700">
            {result || (
              <div className="flex flex-col items-center justify-center h-[200mm] text-gray-300 dark:text-slate-700 space-y-4">
                <svg className="w-24 h-24 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <p className="text-lg italic font-sans">Aguardando geração da peça...</p>
                <p className="text-[10px] font-sans uppercase tracking-[0.3em] opacity-40">Legere</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PetitionGenerator;
