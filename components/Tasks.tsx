
import React, { useState, useRef, useEffect } from 'react';
import { Priority, Comment, Task, User, Case, UserRole } from '../types';
import Modal from './Modal';
import { sendNotificationEmail } from '../services/notificationService';

const columns = [
  { id: 'TODO', title: 'A Fazer', color: 'bg-gray-400' },
  { id: 'DOING', title: 'Em Andamento', color: 'bg-blue-500' },
  { id: 'REVIEW', title: 'Em Revisão', color: 'bg-yellow-500' },
  { id: 'DONE', title: 'Concluído', color: 'bg-green-500' },
];

interface TasksProps {
  users: User[];
  clients: any[];
  cases: Case[];
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  currentUser: any;
  addNotification: (title: string, message: string, recipientId: string) => void;
  onNewComment: (content: string) => void;
}

const Tasks: React.FC<TasksProps> = ({ users, clients, cases, tasks, setTasks, currentUser, addNotification, onNewComment }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState('');
  
  const [processSearch, setProcessSearch] = useState('');
  const [showProcessSuggestions, setShowProcessSuggestions] = useState(false);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);

  // Administradores podem alternar para ver todas as tarefas
  const [showAll, setShowAll] = useState(false);

  // ── Filtro de visibilidade ────────────────────────────────────────────────
  // Cada usuário enxerga apenas as tarefas em que:
  //   1) é o responsável designado
  //   2) é o criador da tarefa
  //   3) foi mencionado (@nome) em algum comentário
  // Tarefas sem createdBy (legado) continuam visíveis para manter compatibilidade.
  // ADMIN com showAll=true vê todas sem restrição.
  const isUserMentionedInTask = (task: Task): boolean => {
    if (!task.comments || task.comments.length === 0) return false;
    const firstName = currentUser.name.split(' ')[0].toLowerCase();
    const fullName = currentUser.name.toLowerCase();
    return task.comments.some(c => {
      const content = c.content.toLowerCase();
      return content.includes(`@${firstName}`) || content.includes(`@${fullName}`);
    });
  };

  const isTaskVisible = (task: Task): boolean => {
    if (currentUser.role === UserRole.ADMIN && showAll) return true;
    if (task.responsible === currentUser.name) return true;
    if (task.createdBy === currentUser.id) return true;
    if (isUserMentionedInTask(task)) return true;
    // Compatibilidade: tarefas sem criador definido continuam visíveis para todos
    if (!task.createdBy) return true;
    return false;
  };

  const visibleTasks = tasks.filter(isTaskVisible);

  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);

  // Anexo do comentário
  const [commentFile, setCommentFile] = useState<{
    data: string; name: string; type: string; size: number;
  } | null>(null);

  const filteredMentionUsers = users.filter(u => 
    u.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  useEffect(() => {
    if (processSearch.length > 2) {
      const matches = cases.filter(c => 
        c.cnj.includes(processSearch) || 
        c.clientName.toLowerCase().includes(processSearch.toLowerCase())
      );
      setFilteredCases(matches);
      setShowProcessSuggestions(matches.length > 0);
    } else {
      setShowProcessSuggestions(false);
    }
  }, [processSearch, cases]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const query = textBeforeCursor.substring(lastAtSymbol + 1);
      if (!query.includes('\n')) {
        setMentionQuery(query);
        setShowMentionList(true);
        setMentionIndex(0);
      } else {
        setShowMentionList(false);
      }
    } else {
      setShowMentionList(false);
    }
    setCommentText(value);
  };

  const insertMention = (userName: string) => {
    if (!commentInputRef.current) return;
    
    const value = commentText;
    const cursorPosition = commentInputRef.current.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    const textAfterCursor = value.substring(cursorPosition);
    const newText = value.substring(0, lastAtSymbol) + `@${userName} ` + textAfterCursor;
    
    setCommentText(newText);
    setShowMentionList(false);
    
    setTimeout(() => {
      commentInputRef.current?.focus();
      const newPos = lastAtSymbol + userName.length + 2;
      commentInputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionList && filteredMentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredMentionUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentionUsers[mentionIndex].name);
      } else if (e.key === 'Escape') {
        setShowMentionList(false);
      }
    }
  };

  // ── Selecionar arquivo para o comentário ─────────────────────────────────
  const handleCommentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo permitido: 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCommentFile({
        data: ev.target?.result as string,
        name: file.name,
        type: file.type,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloadAttachment = (att: NonNullable<Comment['attachment']>) => {
    const link = document.createElement('a');
    link.href = att.data;
    link.download = att.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && !commentFile) return;
    if (!selectedTask) return;

    const mentionRegex = /@([^@\n\s,.;:!?]+)/g;
    let match;
    const mentionsFound: string[] = [];

    while ((match = mentionRegex.exec(commentText)) !== null) {
      const term = match[1].toLowerCase().trim();
      const targetUser = users.find(u => {
        const fullName = u.name.toLowerCase();
        const firstName = fullName.split(' ')[0];
        return fullName.includes(term) || firstName === term;
      });
      
      if (targetUser && !mentionsFound.includes(targetUser.id)) {
        mentionsFound.push(targetUser.id);
        
        // ENVIA APENAS SE O DESTINATÁRIO FOR DIFERENTE DO REMETENTE
        if (targetUser.id !== currentUser.id) {
          addNotification(`Marcação: ${selectedTask.title}`, `${currentUser.name} mencionou você.`, targetUser.id);
          
          sendNotificationEmail({
            to: targetUser.email,
            subject: `Nova menção em tarefa: ${selectedTask.title}`,
            body: `Olá ${targetUser.name},\n\nVocê acaba de ser mencionado por ${currentUser.name} em um comentário da tarefa "${selectedTask.title}".\n\nConteúdo:\n"${commentText}"`,
            type: 'MENTION'
          });
        }
      }
    }

    const newComment: Comment = {
      id: String(Date.now()),
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: commentText,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
      ...(commentFile ? { attachment: commentFile } : {}),
    };

    const updatedTasks = tasks.map(t => {
      if (t.id === selectedTask.id) {
        return { ...t, comments: [...(t.comments || []), newComment] };
      }
      return t;
    });

    setTasks(updatedTasks);
    onNewComment(commentText);
    setCommentText('');
    setCommentFile(null);

    const current = updatedTasks.find(t => t.id === selectedTask.id);
    if (current) setSelectedTask(current);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const deadlineInput = formData.get('deadline') as string;
    
    const displayDeadline = deadlineInput 
      ? new Date(deadlineInput + 'T00:00:00').toLocaleDateString('pt-BR') 
      : 'Não definido';

    const newTask: Task = {
      id: String(Date.now()),
      title: formData.get('title') as string,
      client: processSearch,
      priority: formData.get('priority') as Priority,
      deadline: displayDeadline,
      status: 'TODO',
      responsible: formData.get('responsible') as string,
      createdBy: currentUser.id,
      comments: []
    };
    setTasks(prev => [newTask, ...prev]);

    // Notifica o responsável pela nova tarefa
    const responsibleUser = users.find((u: any) => u.name === newTask.responsible);
    if (responsibleUser && responsibleUser.id !== currentUser.id) {
      addNotification(
        `Nova Tarefa: ${newTask.title}`,
        `Você foi designado(a) como responsável pela tarefa "${newTask.title}" com prazo ${displayDeadline}.`,
        responsibleUser.id
      );
      sendNotificationEmail({
        to: responsibleUser.email,
        subject: `Nova Tarefa: ${newTask.title}`,
        body: `Você foi designado(a) como responsável pela tarefa "${newTask.title}" com prazo ${displayDeadline}.`,
        type: 'MENTION',
      });
    }

    setIsModalOpen(false);
    setProcessSearch('');
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const setTaskDone = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'DONE' } : t));
  };

  const deleteTask = (id: string) => {
    if (confirm("Deseja excluir esta tarefa?")) {
      setTasks(prev => prev.filter(t => t.id !== id));
      if (selectedTask?.id === id) setSelectedTask(null);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in slide-in-from-right duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold font-serif dark:text-white">Fluxo de Tarefas</h2>
          <p className="text-sm text-gray-500">
            {currentUser.role === UserRole.ADMIN && showAll
              ? 'Exibindo todas as tarefas do escritório.'
              : 'Exibindo tarefas em que você é responsável, criador ou foi mencionado.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Administradores podem ver todas as tarefas */}
          {currentUser.role === UserRole.ADMIN && (
            <button
              onClick={() => setShowAll(prev => !prev)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
                showAll
                  ? 'bg-gold-800 text-white border-gold-800'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-gold-800'
              }`}
              title={showAll ? 'Ocultar tarefas de outros usuários' : 'Ver todas as tarefas do escritório'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              {showAll ? 'Ver minhas tarefas' : 'Ver todas'}
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-navy-800 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-gold-800 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4"/></svg>
            Nova Tarefa
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 h-full min-w-[1000px]">
          {columns.map((col) => (
            <div key={col.id} className="flex-1 flex flex-col min-w-[280px]">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-6 rounded-full ${col.color}`}></div>
                  <h3 className="font-bold text-gray-700 dark:text-white uppercase tracking-wider text-xs">{col.title}</h3>
                  <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 px-2 py-0.5 rounded text-[10px] font-bold">
                    {visibleTasks.filter(t => t.status === col.id).length}
                  </span>
                </div>
              </div>

              <div 
                className="flex-1 bg-gray-100/50 dark:bg-slate-800/50 rounded-2xl p-3 space-y-3 border-2 border-dashed border-gray-200 dark:border-slate-700 transition-colors"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {visibleTasks.filter(t => t.status === col.id).length === 0 && (
                  <div className="p-10 text-center text-gray-400 italic text-[10px] uppercase font-bold opacity-30">Solte aqui para mover</div>
                )}
                {visibleTasks.filter(t => t.status === col.id).map(task => (
                  <div 
                    key={task.id} 
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => setSelectedTask(task)}
                    className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all group cursor-move ${task.status === 'DONE' ? 'opacity-70' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter ${
                        task.status === 'DONE' ? 'bg-green-100 text-green-700' :
                        task.priority === Priority.URGENT ? 'bg-red-100 text-red-700' : 
                        task.priority === Priority.HIGH ? 'bg-orange-100 text-orange-700' : 
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {task.status === 'DONE' ? 'Concluída' : task.priority}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {task.status !== 'DONE' && (
                          <button onClick={(e) => { e.stopPropagation(); setTaskDone(task.id); }} className="p-1 text-green-500 hover:bg-green-50 rounded-md">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="p-1 text-gray-400 hover:text-red-500">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                    <h4 className={`font-bold text-sm text-gray-800 dark:text-white leading-tight mb-1 ${task.status === 'DONE' ? 'line-through text-gray-400' : ''}`}>{task.title}</h4>
                    <p className="text-[10px] text-gray-500 truncate mb-3">{task.client}</p>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-slate-700/50">
                       <div className="flex items-center gap-1.5">
                          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z"/></svg>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{task.deadline}</span>
                       </div>
                       {task.comments && task.comments.length > 0 && (
                         <div className="flex items-center gap-1 bg-gold-50 dark:bg-gold-900/20 px-1.5 py-0.5 rounded-md border border-gold-100 dark:border-gold-900/30">
                            <svg className="w-3 h-3 text-gold-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                            <span className="text-[10px] font-black text-gold-800">{task.comments.length}</span>
                         </div>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} title="Detalhes da Tarefa">
        {selectedTask && (
          <div className="space-y-8">
            <div className="p-6 bg-gray-50 dark:bg-slate-900 rounded-3xl border dark:border-slate-700">
               <h3 className="text-2xl font-bold dark:text-white mb-2">{selectedTask.title}</h3>
               <p className="text-sm text-gray-500">Relacionado: {selectedTask.client}</p>
            </div>
            <div className="space-y-6">
               <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-navy-800 dark:text-gold-800 border-b dark:border-slate-700 pb-2">Colaboração Interna</h4>
               <div className="max-h-64 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {(!selectedTask.comments || selectedTask.comments.length === 0) ? (
                    <p className="text-center py-10 text-xs text-gray-400 italic">Nenhum comentário ainda.</p>
                  ) : selectedTask.comments.map(c => (
                    <div key={c.id} className={`flex flex-col ${c.senderId === currentUser.id ? 'items-end' : 'items-start'}`}>
                      <div className={`p-4 rounded-2xl max-w-[90%] text-sm space-y-2 ${c.senderId === currentUser.id ? 'bg-navy-800 text-white rounded-tr-none' : 'bg-gray-100 dark:bg-slate-700 dark:text-white rounded-tl-none'}`}>
                         <p className="text-[9px] font-bold uppercase opacity-60">{c.senderName}</p>
                         {c.content && <p className="leading-relaxed">{c.content}</p>}

                         {/* Anexo do comentário */}
                         {c.attachment && (
                           <button
                             type="button"
                             onClick={() => downloadAttachment(c.attachment!)}
                             className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-colors w-full text-left mt-1
                               ${c.senderId === currentUser.id
                                 ? 'bg-white/15 hover:bg-white/25 text-white'
                                 : 'bg-navy-50 dark:bg-slate-600 hover:bg-navy-100 dark:hover:bg-slate-500 text-navy-800 dark:text-white'
                               }`}
                             title="Clique para baixar"
                           >
                             {/* Ícone pelo tipo do arquivo */}
                             {c.attachment.type.startsWith('image/') ? (
                               <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                             ) : c.attachment.type === 'application/pdf' ? (
                               <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                             ) : (
                               <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                             )}
                             <span className="flex-1 truncate">{c.attachment.name}</span>
                             <span className="opacity-60 shrink-0">{formatFileSize(c.attachment.size)}</span>
                             {/* Seta de download */}
                             <svg className="w-3 h-3 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                           </button>
                         )}
                      </div>
                      <p className="text-[8px] text-gray-400 mt-1 uppercase font-bold">{c.timestamp}</p>
                    </div>
                  ))}
               </div>

               {/* Pré-visualização do arquivo selecionado */}
               {commentFile && (
                 <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 mt-3">
                   <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                   <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex-1 truncate">{commentFile.name}</span>
                   <span className="text-[10px] text-blue-500 shrink-0">{formatFileSize(commentFile.size)}</span>
                   <button type="button" onClick={() => setCommentFile(null)} className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-500 transition-colors" title="Remover arquivo">
                     <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                   </button>
                 </div>
               )}

               <form onSubmit={handleAddComment} className="relative mt-3">
                  {showMentionList && filteredMentionUsers.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800 border rounded-2xl shadow-2xl z-50 overflow-hidden">
                       <div className="p-2 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2">Mencionar...</p>
                       </div>
                       {filteredMentionUsers.map((user, idx) => (
                         <button key={user.id} onClick={() => insertMention(user.name)} onMouseEnter={() => setMentionIndex(idx)} className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${mentionIndex === idx ? 'bg-navy-50 dark:bg-slate-700' : ''}`}>
                            <div className="w-6 h-6 rounded-full bg-navy-800 text-white flex items-center justify-center text-[10px] font-bold">{user.name.charAt(0)}</div>
                            <p className="text-xs font-bold dark:text-white">{user.name}</p>
                         </button>
                       ))}
                    </div>
                  )}
                  <textarea ref={commentInputRef} value={commentText} onChange={handleCommentChange} onKeyDown={handleKeyDown} placeholder="Adicione um comentário... use @nome" className="w-full bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-2xl p-4 pr-24 text-sm outline-none focus:ring-2 focus:ring-gold-800 dark:text-white resize-none shadow-inner" rows={3} />

                  {/* Botão de anexar arquivo */}
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleCommentFileSelect} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`absolute right-14 bottom-3 p-2 rounded-xl transition-all shadow-sm
                      ${commentFile
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-300 hover:bg-navy-100 dark:hover:bg-slate-600'
                      }`}
                    title="Anexar arquivo (máx. 10 MB)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                  </button>

                  {/* Botão de enviar */}
                  <button type="submit" disabled={!commentText.trim() && !commentFile} className="absolute right-3 bottom-3 p-2 bg-navy-800 text-white rounded-xl hover:bg-gold-800 transition-all shadow-lg disabled:opacity-30">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                  </button>
               </form>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Tarefa Operacional">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase text-[10px] tracking-widest">Título da Tarefa</label>
              <input name="title" required className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-gold-800 outline-none" />
            </div>
            <div className="col-span-2 relative">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase text-[10px] tracking-widest">Processo Relacionado</label>
              <input value={processSearch} onChange={(e) => setProcessSearch(e.target.value)} onFocus={() => processSearch.length > 2 && setShowProcessSuggestions(true)} required className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white font-mono focus:ring-2 focus:ring-gold-800 outline-none" />
              {showProcessSuggestions && (
                <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-800 border rounded-xl shadow-2xl z-50 overflow-hidden mt-1 animate-in fade-in duration-200">
                   {filteredCases.map(c => (
                     <button key={c.id} type="button" onClick={() => { setProcessSearch(`${c.cnj} - ${c.clientName}`); setShowProcessSuggestions(false); }} className="w-full flex items-center gap-3 p-3 text-left hover:bg-navy-50 border-b last:border-0 dark:hover:bg-slate-700 transition-colors">
                        <p className="text-xs font-bold truncate dark:text-white">{c.cnj}</p>
                     </button>
                   ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase text-[10px] tracking-widest">Prazo Fatal</label>
              <input name="deadline" type="date" required className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase text-[10px] tracking-widest">Prioridade</label>
              <select name="priority" className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white">
                <option value={Priority.LOW}>Baixa</option>
                <option value={Priority.MEDIUM}>Média</option>
                <option value={Priority.HIGH}>Alta</option>
                <option value={Priority.URGENT}>Urgente</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase text-[10px] tracking-widest">Responsável</label>
              <select name="responsible" className="w-full bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg p-2.5 text-sm dark:text-white">
                {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-8">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-gray-500">Cancelar</button>
            <button type="submit" className="px-8 py-2 bg-navy-800 text-white rounded-lg text-sm font-bold hover:bg-gold-800 shadow-lg transition-all">Criar Tarefa</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Tasks;
