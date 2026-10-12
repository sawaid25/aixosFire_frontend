import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import { formatKsaTime } from '../../../../utils/dateTime';

const ChatMessage = ({ role, message, timestamp }) => {
  const isAssistant = role === 'assistant';

  return (
    <div className={`flex w-full gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${
        isAssistant 
        ? 'bg-slate-100 border-slate-200 text-slate-600' 
        : 'bg-primary-100 border-primary-200 text-primary-700'
      }`}>
        {isAssistant ? <Bot size={16} /> : <User size={16} />}
      </div>

      <div className={`flex flex-col max-w-[90%] md:max-w-[80%] gap-1.5 ${isAssistant ? 'items-start' : 'items-end'}`}>
        <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed border ${
          isAssistant 
          ? 'bg-slate-100 border-slate-200 text-slate-700' 
          : 'bg-primary-600 border-primary-600 text-white'
        }`}>
          <div className={`prose prose-sm max-w-none ${isAssistant ? 'prose-slate' : 'prose-invert'} [&_p]:text-sm [&_p]:leading-6`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 my-3 bg-white">
                    <table className="w-full border-collapse min-w-[640px]" {...props} />
                  </div>
                ),
                thead: ({node, ...props}) => <thead className="bg-slate-100" {...props} />,
                th: ({node, ...props}) => (
                  <th className="px-3 py-2.5 text-left text-xs uppercase font-bold tracking-wide text-slate-700 border-b border-slate-200" {...props} />
                ),
                td: ({node, ...props}) => (
                  <td className="px-3 py-2.5 text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap" {...props} />
                ),
                tr: ({node, ...props}) => <tr className="hover:bg-slate-50" {...props} />,
                p: ({node, ...props}) => <p className="mb-0 last:mb-0" {...props} />
              }}
            >
              {message}
            </ReactMarkdown>
          </div>
        </div>
        
        {timestamp && (
          <div className={`px-1 opacity-70 ${isAssistant ? '' : 'text-right'}`}>
            <span className="text-[10px] text-slate-500">
              {formatKsaTime(timestamp)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
