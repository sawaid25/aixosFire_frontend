import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatKsaTime } from '../../utils/dateTime';

const ChatMessage = ({ message, isFromCurrentUser }) => {
    const { content, created_at, sender_id, sender_type, isOptimistic } = message;
    const { user } = useAuth();

    // ←←← Yeh line sabse important hai ←←←
    // Prop priority > fallback
    const isMe = isFromCurrentUser !== undefined
        ? isFromCurrentUser
        : (user && sender_type === user.role);

    // Format timestamp
    const timestamp = formatKsaTime(created_at);

    const senderName = sender_type === 'customer' ? `Customer #${sender_id}` :
        sender_type === 'partner' ? `Partner #${sender_id}` :
            sender_type === 'agent' ? `Agent #${sender_id}` :
                `Staff (${sender_type})`;

    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${sender_id || 'system'}`;

    const getRoleStyles = () => {
        if (isMe)
            return 'bg-primary-500 text-white rounded-br-none shadow-primary-200';

        switch (sender_type) {
            case 'customer':
                return 'bg-blue-50 text-blue-900 border border-blue-100 rounded-bl-none';
            case 'agent':
                return 'bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-bl-none';
            case 'partner':
                return 'bg-purple-50 text-purple-900 border border-purple-100 rounded-bl-none';
            default:
                return 'bg-white text-slate-700 border border-slate-100 rounded-bl-none';
        }
    };

    const getRoleLabelStyles = () => {
        switch (sender_type) {
            case 'customer': return 'text-blue-500';
            case 'agent': return 'text-emerald-500';
            case 'partner': return 'text-purple-500';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className={`flex w-full mb-4 px-2 ${isMe ? 'justify-end' : 'justify-start'} ${isOptimistic ? 'opacity-70' : 'opacity-100'} transition-opacity duration-300`}>
            <div className={`flex max-w-[85%] sm:max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>

                {/* Avatar */}
                <div className="flex-shrink-0 mb-1">
                    <img
                        src={avatar}
                        alt={senderName}
                        className={`w-8 h-8 rounded-xl border object-cover bg-white ${isMe ? 'border-primary-100' : 'border-slate-100'}`}
                    />
                </div>

                {/* Message Bubble Column */}
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && (
                        <span className={`text-[10px] font-black uppercase tracking-widest ml-1 mb-1.5 ${getRoleLabelStyles()}`}>
                            {senderName}
                        </span>
                    )}

                    <div
                        className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed border transition-all ${getRoleStyles()}`}
                    >
                        {content}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 mx-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                            {timestamp}
                        </span>
                        {isOptimistic && (
                            <span className="text-[9px] text-slate-300 font-medium italic">Sending...</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatMessage;