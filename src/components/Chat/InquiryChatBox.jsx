import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Loader2, X, ArrowDown } from 'lucide-react';
import { getDirectMessagesHistory, sendDirectMessage, updateDirectMessageStatus, markMessagesAsRead } from '../../api/chatApi';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';

const InquiryChatBox = ({
    inquiryId,
    recipientId,
    recipientRole = 'customer',
    title = 'Discussion',
    onClose,
}) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const chatEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const lastMessageCount = useRef(0);

    const scrollToBottom = (behavior = 'smooth') => {
        chatEndRef.current?.scrollIntoView({ behavior });
    };

    const handleScroll = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    };

    const fetchMessages = async (isInitial = false) => {
        if (!user?.id || !recipientId) return;
        try {
            const data = await getDirectMessagesHistory(user.id, recipientId, inquiryId);
            setMessages(data);

            const unreadIds = data
                .filter(m => String(m.receiver_id) === String(user.id) && m.status !== 'read')
                .map(m => m.id);
            if (unreadIds.length > 0) {
                await markMessagesAsRead(unreadIds);
                setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, status: 'read' } : m));
            }

            const sentIdsFromOther = data
                .filter(m => String(m.receiver_id) === String(user.id) && m.status === 'sent')
                .map(m => m.id);
            if (sentIdsFromOther.length > 0) {
                await Promise.all(sentIdsFromOther.map(id => updateDirectMessageStatus(id, 'delivered')));
            }

            if (isInitial || data.length > lastMessageCount.current) {
                lastMessageCount.current = data.length;
                setTimeout(() => scrollToBottom(isInitial ? 'auto' : 'smooth'), 100);
            }
        } catch (e) {
            console.error('Fetch messages failed:', e);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    useEffect(() => {
        if (!user?.id || !recipientId || !inquiryId) return;
        fetchMessages(true);

        // Realtime is the fast path, but the `messages` table's realtime/RLS config
        // can't be relied on (the other party's replies were only landing in the
        // notification bell, not here). Poll as a safety net — same approach ChatModal
        // already uses — so incoming messages show up even when the socket is silent.
        const poll = setInterval(() => fetchMessages(false), 4000);

        const channel = supabase
            .channel(`inquiry_messages_${inquiryId}_${recipientId}`)
            .on('postgres_changes', { event: 'INSERT', table: 'messages', filter: `inquiry_id=eq.${inquiryId}` },
                (payload) => {
                    setMessages((prev) => {
                        if (prev.some(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new];
                    });
                }
            )
            .subscribe();

        return () => {
            clearInterval(poll);
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, recipientId, inquiryId]);

    useEffect(() => {
        if (messages.length > lastMessageCount.current) {
            scrollToBottom('smooth');
            lastMessageCount.current = messages.length;
        }
    }, [messages.length]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !user?.id || !recipientId || sending) return;

        setSending(true);
        const msgContent = newMessage;
        setNewMessage('');

        const optimisticMsg = {
            id: 'temp-' + Date.now(),
            sender_id: user.id,
            content: msgContent,
            created_at: new Date().toISOString(),
            status: 'sending'
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        try {
            const currentRole = user.role || 'user';
            let extinguisherId = null;
            if (messages?.length > 0) {
                const existing = messages.find(m => m.extinguisher_id);
                if (existing) extinguisherId = existing.extinguisher_id;
            }
            const result = await sendDirectMessage(user.id, recipientId, inquiryId, msgContent, currentRole, extinguisherId);
            if (result) fetchMessages(false);
        } catch (e) {
            console.error('Send failed:', e);
            setMessages((prev) => prev.filter(m => m.id !== optimisticMsg.id));
            setNewMessage(msgContent);
        } finally {
            setSending(false);
            scrollToBottom('smooth');
        }
    };

    const getStatusIcon = (status) => {
        if (status === 'read') return <span className="text-[10px] text-blue-300 font-bold ml-1">✓✓</span>;
        if (status === 'delivered') return <span className="text-[10px] text-white/40 font-bold ml-1">✓✓</span>;
        if (status === 'sent') return <span className="text-[10px] text-white/40 font-bold ml-1">✓</span>;
        if (status === 'sending') return <Loader2 size={10} className="animate-spin inline ml-1 text-white/30" />;
        return null;
    };

    const groupMessagesByDate = (msgs) => {
        const groups = [];
        let lastDate = '';
        msgs.forEach((msg) => {
            const d = new Date(msg.created_at);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            let label;
            if (d.toDateString() === today.toDateString()) label = 'Today';
            else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
            else label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

            if (label !== lastDate) {
                groups.push({ type: 'date', date: label });
                lastDate = label;
            }
            groups.push({ type: 'msg', ...msg });
        });
        return groups;
    };

    const grouped = groupMessagesByDate(messages);
    const roleInitial = (recipientRole || 'U')[0].toUpperCase();

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
            {/* ── Header ── */}
            <div className="shrink-0 bg-gradient-to-r from-slate-800 via-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-primary-500/25">
                            {roleInitial}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-slate-800 rounded-full" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{title}</h4>
                        <p className="text-[10px] text-emerald-300/80 font-medium">Online now</p>
                    </div>
                </div>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                    >
                        <X size={16} className="text-white" />
                    </button>
                )}
            </div>

            {/* ── Messages ── */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto px-3 py-3 relative"
                style={{
                    backgroundColor: '#efeae2',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d5cfca' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
            >
                {loading && messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-slate-400" size={24} />
                        <p className="text-xs font-medium text-slate-500">Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6">
                        <div className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center mb-3 shadow-sm">
                            <MessageCircle size={30} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-600">Start a conversation</p>
                        <p className="text-[11px] text-slate-400 mt-1">Send a message to begin chatting</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {grouped.map((item, idx) => {
                            if (item.type === 'date') {
                                return (
                                    <div key={`d-${idx}`} className="flex justify-center py-2">
                                        <span className="px-3 py-1 bg-white/90 rounded-md text-[10px] font-semibold text-slate-500 shadow-sm">
                                            {item.date}
                                        </span>
                                    </div>
                                );
                            }

                            const isMe = String(item.sender_id) === String(user?.id);
                            const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return (
                                <div key={item.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[75%] px-3 py-1.5 text-[13px] leading-relaxed shadow-sm
                                            ${isMe
                                                ? 'bg-primary-500 text-white rounded-lg rounded-br-sm'
                                                : 'bg-white text-slate-800 rounded-lg rounded-bl-sm'
                                            }`}
                                    >
                                        {!isMe && (
                                            <p className="text-[10px] font-bold text-primary-500 capitalize">{recipientRole}</p>
                                        )}
                                        <p className="whitespace-pre-wrap break-words">{item.content || item.message}</p>
                                        <div className={`flex items-center gap-1 -mb-0.5 ${isMe ? 'justify-end' : 'justify-end'}`}>
                                            <span className={`text-[9px] ${isMe ? 'text-white/50' : 'text-slate-400'}`}>{time}</span>
                                            {isMe && getStatusIcon(item.status)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div ref={chatEndRef} />

                {showScrollBtn && (
                    <button
                        type="button"
                        onClick={() => scrollToBottom('smooth')}
                        className="sticky bottom-2 mx-auto w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-all z-10 border border-slate-200"
                    >
                        <ArrowDown size={16} className="text-slate-500" />
                    </button>
                )}
            </div>

            {/* ── Input ── */}
            <form onSubmit={handleSend} className="shrink-0 px-3 py-2 bg-[#f0f2f5] border-t border-slate-200/80 flex items-center gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                    placeholder="Type a message..."
                    className="flex-1 min-w-0 bg-white rounded-full px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 border border-slate-200 focus:border-primary-400 focus:ring-1 focus:ring-primary-200 outline-none transition-all disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="w-9 h-9 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 text-white rounded-full shadow-md transition-all flex items-center justify-center active:scale-90 shrink-0"
                >
                    {sending
                        ? <Loader2 size={16} className="animate-spin" />
                        : <Send size={16} className="translate-x-px" />
                    }
                </button>
            </form>
        </div>
    );
};

export default InquiryChatBox;
