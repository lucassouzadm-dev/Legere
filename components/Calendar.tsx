
import React, { useState } from 'react';
import Modal from './Modal';
import { sendNotificationEmail } from '../services/notificationService';

const eventTypes = {
  HEARING: { label: 'Audiência', color: 'bg-navy-800', textColor: 'text-white' },
  MEETING: { label: 'Reunião', color: 'bg-green-500', textColor: 'text-white' },
  DEADLINE: { label: 'Prazo', color: 'bg-red-500', textColor: 'text-white' },
  SERVICE: { label: 'Atendimento', color: 'bg-gold-800', textColor: 'text-navy-900' },
};

interface CalendarProps {
  users: any[];
  currentUser: any;
  clients: any[];
  cases: any[];
  events: any[];
  setEvents: React.Dispatch<React.SetStateAction<any[]>>;
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  addNotification: (title: string, message: string, recipientId: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({ users, currentUser, clients, cases, events, setEvents, setUsers, addNotification }) => {
  const [viewDate, setViewDate] = useState(new Date()); 
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  const monthName = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setIsDayModalOpen(true);
  };

  const handleOpenAddModal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    setIsDayModalOpen(false);
    setIsEventModalOpen(true);
  };

  const handleDeleteEvent = (id: number) => {
    if (confirm("Deseja remover este compromisso?")) {
      setEvents(prev => prev.filter(e => e.id !== id));
      setIsDayModalOpen(false);
    }
  };

  const handleSaveEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dateStr = formData.get('date') as string;
    const eventDate = new Date(dateStr + 'T00:00:00');
    const responsibleName = formData.get('responsible') as string;

    const eventData = {
      id: editingEvent?.id || Date.now(),
      title: formData.get('title') as string,
      type: formData.get('type') as string,
      time: formData.get('time') as string,
      day: eventDate.getDate(),
      month: eventDate.getMonth(),
      year: eventDate.getFullYear(),
      responsible: responsibleName,
      notes: formData.get('notes') as string
    };

    // Notificação direcionada ao Responsável
    const targetUser = users.find(u => u.name.includes(responsibleName) || u.name === responsibleName);
    if (targetUser && targetUser.id !== currentUser.id) {
      addNotification(
        `${editingEvent ? 'Agenda Alterada' : 'Novo Evento na Agenda'}`, 
        `${eventData.title} às ${eventData.time} em ${eventDate.toLocaleDateString('pt-BR')}`,
        targetUser.id
      );

      sendNotificationEmail({
        to: targetUser.email,
        subject: `${editingEvent ? 'Alteração' : 'Novo Evento'} na sua Agenda: ${eventData.title}`,
        body: `Olá ${targetUser.name}, um evento foi atribuído a você.\n\nData: ${eventDate.toLocaleDateString('pt-BR')}\nHora: ${eventData.time}\nTipo: ${eventData.type}\nDetalhes: ${eventData.notes || 'N/A'}`,
        type: 'EVENT'
      });
    }

    if (editingEvent) {
      setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? eventData : ev));
    } else {
      setEvents(prev => [...prev, eventData]);
    }
    
    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
  };

  const dayEvents = selectedDay !== null 
    ? events.filter(e => e.day === selectedDay && e.month === currentMonth && e.year === currentYear)
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif dark:text-white">Agenda</h2>
          <p className="text-sm text-gray-500">Gestão de audiências e prazos.</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border dark:border-slate-700">
           <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 19l-7-7 7-7"/></svg></button>
           <span className="px-4 text-sm font-bold dark:text-white capitalize">{monthName}</span>
           <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 5l7 7-7 7"/></svg></button>
        </div>
        <button onClick={() => handleOpenAddModal()} className="bg-navy-800 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-gold-800 transition-all flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4"/></svg> Novo Evento
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50">
            {weekDays.map(wd => <div key={wd} className="p-4 text-center text-[10px] font-bold uppercase text-gray-400">{wd}</div>)}
          </div>
          <div className="grid grid-cols-7 h-[600px] auto-rows-fr">
            {emptyDays.map(i => <div key={`empty-${i}`} className="border-r border-b dark:border-slate-700 bg-gray-50/30"></div>)}
            {daysArray.map(day => {
              const currentDayEvents = events.filter(e => e.day === day && e.month === currentMonth && e.year === currentYear);
              return (
                <div key={day} onClick={() => handleDayClick(day)} className={`border-r border-b dark:border-slate-700 p-2 hover:bg-gold-50/50 transition-all cursor-pointer ${isToday(day) ? 'bg-gold-50/20' : ''}`}>
                  <span className={`text-xs font-bold ${isToday(day) ? 'bg-navy-800 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-400'}`}>{day}</span>
                  <div className="mt-2 space-y-1">
                     {currentDayEvents.slice(0, 3).map(ev => (
                       <div key={ev.id} className={`${eventTypes[ev.type as keyof typeof eventTypes].color} text-white p-1 rounded text-[8px] font-bold truncate`}>
                          {ev.time} {ev.title}
                       </div>
                     ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border shadow-sm">
              <h3 className="font-bold text-sm text-gray-400 mb-4">Próximos Dias</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                 {events.filter(e => e.month === currentMonth).sort((a,b) => a.day - b.day).map(ev => (
                   <div key={ev.id} onClick={() => handleDayClick(ev.day)} className="flex gap-3 cursor-pointer border-b pb-2 last:border-0 hover:bg-gray-50 p-1 rounded-lg">
                      <div className={`w-1 rounded-full ${eventTypes[ev.type as keyof typeof eventTypes].color}`}></div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400">Dia {ev.day} • {ev.time}</p>
                        <p className="text-xs font-bold dark:text-white">{ev.title}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      <Modal isOpen={isDayModalOpen} onClose={() => setIsDayModalOpen(false)} title={`Eventos do Dia ${selectedDay}`}>
        <div className="space-y-4">
          {dayEvents.length === 0 ? <p className="text-center py-4 text-gray-400 italic text-sm">Sem compromissos.</p> : dayEvents.map(ev => (
            <div key={ev.id} className="p-4 bg-gray-50 dark:bg-slate-900 border rounded-2xl flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-10 rounded-full ${eventTypes[ev.type as keyof typeof eventTypes].color}`}></div>
                <div>
                  <p className="text-xs font-bold text-navy-800 dark:text-gold-800">{ev.time} - {ev.title}</p>
                  <p className="text-[10px] text-gray-500">Resp: {ev.responsible}</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEditEvent(ev)} className="p-2 text-gray-400 hover:text-navy-800"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                <button onClick={() => handleDeleteEvent(ev.id)} className="p-2 text-gray-400 hover:text-red-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
              </div>
            </div>
          ))}
          <button onClick={() => { setIsDayModalOpen(false); handleOpenAddModal(); }} className="w-full py-3 border-2 border-dashed rounded-2xl text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:border-gold-800">+ Adicionar Evento</button>
        </div>
      </Modal>

      <Modal isOpen={isEventModalOpen} onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }} title={editingEvent ? "Editar Evento" : "Novo Evento"}>
        <form onSubmit={handleSaveEvent} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="text-xs font-bold uppercase text-gray-400">Título</label><input name="title" required defaultValue={editingEvent?.title} className="w-full bg-gray-50 dark:bg-slate-900 border rounded-xl p-3 text-sm dark:text-white" /></div>
            <div><label className="text-xs font-bold uppercase text-gray-400">Tipo</label><select name="type" defaultValue={editingEvent?.type || "HEARING"} className="w-full bg-gray-50 dark:bg-slate-900 border rounded-xl p-3 text-sm dark:text-white"><option value="HEARING">Audiência</option><option value="MEETING">Reunião</option><option value="DEADLINE">Prazo</option><option value="SERVICE">Atendimento</option></select></div>
            <div><label className="text-xs font-bold uppercase text-gray-400">Responsável</label><select name="responsible" defaultValue={editingEvent?.responsible || currentUser?.name} className="w-full bg-gray-50 dark:bg-slate-900 border rounded-xl p-3 text-sm dark:text-white">{users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
            <div><label className="text-xs font-bold uppercase text-gray-400">Data</label><input name="date" type="date" required defaultValue={editingEvent ? `${editingEvent.year}-${String(editingEvent.month + 1).padStart(2, '0')}-${String(editingEvent.day).padStart(2, '0')}` : new Date().toISOString().split('T')[0]} className="w-full bg-gray-50 dark:bg-slate-900 border rounded-xl p-3 text-sm dark:text-white" /></div>
            <div><label className="text-xs font-bold uppercase text-gray-400">Horário</label><input name="time" type="time" required defaultValue={editingEvent?.time} className="w-full bg-gray-50 dark:bg-slate-900 border rounded-xl p-3 text-sm dark:text-white" /></div>
            <div className="col-span-2"><label className="text-xs font-bold uppercase text-gray-400">Notas</label><textarea name="notes" rows={3} defaultValue={editingEvent?.notes} className="w-full bg-gray-50 dark:bg-slate-900 border rounded-xl p-3 text-sm dark:text-white" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-8">
            <button type="button" onClick={() => setIsEventModalOpen(false)} className="px-6 py-2 text-sm font-bold text-gray-400">Cancelar</button>
            <button type="submit" className="px-8 py-2 bg-navy-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Calendar;
