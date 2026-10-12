import React from 'react';
import { MessageSquare, Calendar, Trash2, X, Plus } from 'lucide-react';
import { formatKsaTime } from '../../../../utils/dateTime';

const ChatHistorySidebar = ({ sessions, onSelectChat, selectedChatId, onClearHistory, onNewChat, isOpen, onClose }) => {
  const groupedSessions = sessions.reduce((acc, session) => {
    const date = new Date(session.created_at).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {});

  return (
    <aside
      className={`
        fixed lg:static top-0 left-0 z-50 h-full w-[280px] shrink-0
        bg-white border-r border-slate-200 flex flex-col overflow-hidden
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
        <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
          <MessageSquare size={18} className="text-primary-600" />
          History
        </h2>
        <div className="flex items-center gap-1">
          <button 
            onClick={onClearHistory}
            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
            title="Clear History"
          >
            <Trash2 size={16} />
          </button>
          <button 
            onClick={onClose}
            className="lg:hidden p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors"
            title="Close Sidebar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="p-3 pb-0">
        <button
          onClick={() => {
            onNewChat?.();
            if (window.innerWidth < 1024) onClose();
          }}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {Object.keys(groupedSessions).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <MessageSquare size={32} className="opacity-20 mb-2" />
            <p className="text-xs font-medium">No chat history yet</p>
          </div>
        ) : (
          Object.entries(groupedSessions).map(([date, dateSessions]) => (
            <div key={date} className="space-y-1">
              <div className="px-3 py-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <Calendar size={10} />
                {date}
              </div>
              {dateSessions.map((session) => {
                const firstUserMsg = session.ai_chat_messages
                  ?.filter(m => m.role === 'user')
                  ?.[0];
                const preview = session.title || firstUserMsg?.message || 'New conversation';
                const msgCount = session.ai_chat_messages?.length || 0;

                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      onSelectChat(session);
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer ${
                      selectedChatId === session.id 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <p className="text-sm font-medium truncate pr-4 leading-tight">
                      {preview}
                    </p>
                    <span className="text-[10px] opacity-60 mt-1 block font-medium">
                      {formatKsaTime(session.created_at)}
                      {msgCount > 0 && ` · ${msgCount} messages`}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

export default ChatHistorySidebar;
