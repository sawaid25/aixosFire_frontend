import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
    getComplaintMessages,
    markThreadMessagesAsRead,
    sendAdminComplaintReply,
    sendBotComplaintReply,
    sendUserComplaint
} from '../../api/complaintsApi';
import { aiService } from '../../services/ai.service';
import { formatKsaTime } from '../../utils/dateTime';

const ComplaintChat = ({ userId, userRole, isAdminView = false }) => {
    const threadUserId = userId == null ? '' : String(userId).trim();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [aiTyping, setAiTyping] = useState(false);
    const [draft, setDraft] = useState('');
    const endRef = useRef(null);

    const loadMessages = async () => {
        if (!threadUserId) return;
        console.log('[ComplaintChat] loadMessages for threadUserId:', threadUserId, '| isAdminView:', isAdminView);
        const data = await getComplaintMessages(threadUserId);
        console.log('[ComplaintChat] Loaded', data.length, 'messages — user:', data.filter(m => !m.is_admin).length, '| bot/admin:', data.filter(m => m.is_admin).length);
        setMessages(data);
    };

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            if (!threadUserId) return;
            setLoading(true);
            try {
                await loadMessages();
                await markThreadMessagesAsRead({
                    userId: threadUserId,
                    readAdminMessages: !isAdminView
                });
            } catch (err) {
                console.error('Failed to load complaint messages', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        init();
        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [threadUserId, isAdminView]);

    useEffect(() => {
        if (!threadUserId) return undefined;

        const channelName = `complaints_${threadUserId}_${isAdminView ? 'admin' : 'user'}`;
        console.log('[ComplaintChat] Setting up realtime channel:', channelName);

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'complaints',
                    filter: `user_id=eq.${threadUserId}`,
                },
                (payload) => {
                    console.log('[ComplaintChat] Realtime INSERT received:', {
                        id: payload.new.id,
                        is_admin: payload.new.is_admin,
                        is_bot: payload.new.is_bot,
                        preview: payload.new.message?.slice(0, 50),
                    });
                    setMessages((prev) => {
                        // Replace optimistic entry if it exists, otherwise append
                        const withoutOptimistic = prev.filter(m => !String(m.id).startsWith('optimistic-'));
                        if (withoutOptimistic.some((m) => m.id === payload.new.id)) return prev;
                        return [...withoutOptimistic, payload.new];
                    });
                }
            )
            .subscribe((status) => {
                console.log('[ComplaintChat] Subscription status:', status, '| channel:', channelName);
            });

        return () => {
            console.log('[ComplaintChat] Removing channel:', channelName);
            supabase.removeChannel(channel);
        };
    }, [threadUserId, isAdminView]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, aiTyping]);

    const handleSend = async (e) => {
        e.preventDefault();
        const message = draft.trim();
        if (!message || !threadUserId || sending || aiTyping) return;

        console.log('[ComplaintChat] handleSend →', { message, threadUserId, userRole, isAdminView });

        setSending(true);
        setDraft('');

        if (isAdminView) {
            // Admin manual reply
            try {
                await sendAdminComplaintReply({ userId: threadUserId, userRole, message });
                await loadMessages();
            } catch (err) {
                console.error('[ComplaintChat] Admin reply failed:', err);
                setDraft(message);
            } finally {
                setSending(false);
            }
            return;
        }

        // User (agent / partner / customer) flow
        // Step 1 — Optimistic: show message immediately in local state
        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMsg = {
            id: optimisticId,
            user_id: threadUserId,
            user_role: userRole,
            message,
            is_admin: false,
            is_bot: false,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        setSending(false);

        try {
            // Step 2 — Persist user message to DB
            const saved = await sendUserComplaint({ userId: threadUserId, userRole, message });
            // Replace optimistic with real DB row
            setMessages((prev) =>
                prev.map((m) => (m.id === optimisticId ? { ...optimisticMsg, ...saved } : m))
            );
            console.log('[ComplaintChat] User message saved → id:', saved?.id);
        } catch (err) {
            console.error('[ComplaintChat] Failed to save user message:', err);
            // Remove optimistic on failure and restore draft
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            setDraft(message);
            return;
        }

        // Step 3 — Call Gemini AI
        setAiTyping(true);
        try {
            const aiReply = await aiService.getComplaintReply(message, userRole);
            console.log('[ComplaintChat] AI reply received, saving to DB...');
            await sendBotComplaintReply({ userId: threadUserId, userRole, message: aiReply });
        } catch (aiErr) {
            console.error('[ComplaintAI] Failed to get AI reply:', aiErr);
            await sendBotComplaintReply({ userId: threadUserId, userRole, message: null });
        } finally {
            setAiTyping(false);
            // Final sync to confirm both messages are in state
            await loadMessages();
        }
    };

    const grouped = useMemo(() => {
        const rows = [];
        let lastLabel = '';
        messages.forEach((msg) => {
            const date = new Date(msg.created_at);
            const label = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            if (label !== lastLabel) {
                rows.push({ type: 'date', label });
                lastLabel = label;
            }
            rows.push({ type: 'message', ...msg });
        });
        return rows;
    }, [messages]);

    const getSenderLabel = (item) => {
        const fromAdmin = item.is_admin === true;
        const fromBot = item.is_bot === true;

        if (fromAdmin && fromBot) return 'AI Support Bot';
        if (isAdminView) return fromAdmin ? 'You (Admin)' : `${(userRole || 'User')}`;
        return fromAdmin ? 'Admin' : 'You';
    };

    const formatTime = (value) => {
        return formatKsaTime(value);
    };

    return (
        <div className="flex h-[70vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-900">Complaint Chat</h2>
                <p className="text-xs text-slate-500 capitalize">
                    {isAdminView ? `Thread for ${userRole}` : 'Talk to admin support team'}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4">
                {loading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-slate-500">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">Loading chat...</span>
                    </div>
                ) : grouped.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                        <MessageCircle size={26} className="mb-2 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-600">Start your complaint...</p>
                        {!threadUserId && (
                            <p className="mt-2 text-xs text-red-500">Missing user id. Please re-login.</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {grouped.map((item, idx) => {
                            if (item.type === 'date') {
                                return (
                                    <div key={`date-${idx}`} className="py-2 text-center">
                                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-slate-500">
                                            {item.label}
                                        </span>
                                    </div>
                                );
                            }

                            const isAdminBubble = item.is_admin === true;
                            const isOwnMessage = isAdminView ? isAdminBubble : !isAdminBubble;
                            const senderLabel = getSenderLabel(item);
                            return (
                                <div key={item.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                                            isAdminBubble
                                                ? 'bg-primary-500 text-white'
                                                : 'bg-white text-slate-800'
                                        }`}
                                    >
                                        <p
                                            className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${
                                                isAdminBubble ? 'text-white/80' : 'text-slate-500'
                                            }`}
                                        >
                                            {senderLabel}
                                        </p>
                                        <p className="whitespace-pre-wrap break-words">{item.message}</p>
                                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                                            <span>{formatTime(item.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {aiTyping && (
                            <div className="flex justify-start">
                                <div className="max-w-[78%] rounded-2xl bg-white px-3 py-2 text-sm shadow-sm">
                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                        AI Support
                                    </p>
                                    <div className="flex items-center gap-1 py-1">
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>
                )}
            </div>

            <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-100 bg-white p-3">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={aiTyping ? 'AI is typing...' : 'Type your complaint message...'}
                    className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-primary-400"
                    disabled={sending || aiTyping || !threadUserId}
                />
                <button
                    type="submit"
                    disabled={sending || aiTyping || !draft.trim() || !threadUserId}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white disabled:bg-slate-300"
                >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
            </form>
        </div>
    );
};

export default ComplaintChat;

