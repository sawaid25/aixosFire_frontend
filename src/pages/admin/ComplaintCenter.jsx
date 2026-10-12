import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import ComplaintChat from '../../components/Chat/ComplaintChat';
import { getComplaintThreads } from '../../api/complaintsApi';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { formatKsaDateTime } from '../../utils/dateTime';

const ComplaintCenter = () => {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const [threads, setThreads] = useState([]);
    const [activeThread, setActiveThread] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const loadThreads = async () => {
        try {
            const data = await getComplaintThreads();
            setThreads(data);
            if (!activeThread && data.length > 0) {
                setActiveThread(data[0]);
            }
        } catch (err) {
            console.error('Failed to load complaint threads', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadThreads();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-select a thread when navigated from Agent Profile (?userId=<agentId>)
    useEffect(() => {
        if (!threads.length) return;
        const targetUserId = searchParams.get('userId');
        if (!targetUserId) return;
        const target = threads.find((t) => t.userId === targetUserId);
        if (target) setActiveThread(target);
    }, [threads, searchParams]);

    useEffect(() => {
        const channel = supabase
            .channel('admin_complaints_center')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'complaints' }, loadThreads)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!user?.id) return undefined;

        const touchPresence = async (active) => {
            const { error } = await supabase
                .from('admin_presence')
                .upsert({
                    admin_id: user.id,
                    is_active: active,
                    last_seen_at: new Date().toISOString()
                });
            if (error) {
                console.warn('Failed to update admin presence', error);
            }
        };

        touchPresence(true);
        const interval = setInterval(() => touchPresence(true), 60 * 1000);

        return () => {
            clearInterval(interval);
            touchPresence(false);
        };
    }, [user?.id]);

    const visibleThreads = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return threads;
        return threads.filter((t) => String(t.userId).toLowerCase().includes(term) || String(t.userRole).toLowerCase().includes(term));
    }, [threads, search]);

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900">Complaint Center</h1>
                <p className="text-slate-500">Track and reply to all user complaint threads in one place.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[330px_1fr]">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 p-4">
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search user id or role"
                                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-400"
                            />
                        </div>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto">
                        {loading ? (
                            <p className="p-5 text-sm text-slate-500">Loading threads...</p>
                        ) : visibleThreads.length === 0 ? (
                            <p className="p-5 text-sm text-slate-500">No complaint threads yet.</p>
                        ) : (
                            visibleThreads.map((thread) => (
                                <button
                                    key={thread.userId}
                                    onClick={() => setActiveThread(thread)}
                                    className={`w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${
                                        activeThread?.userId === thread.userId ? 'bg-primary-50' : ''
                                    }`}
                                >
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <p className="truncate text-sm font-bold text-slate-900">{thread.userId}</p>
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                                            {thread.userRole}
                                        </span>
                                    </div>
                                    <p className="line-clamp-2 text-xs text-slate-500">{thread.lastMessage}</p>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-[10px] text-slate-400">
                                            {formatKsaDateTime(thread.createdAt)}
                                        </span>
                                        {thread.unreadCount > 0 && (
                                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                                {thread.unreadCount} new
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div>
                    {activeThread ? (
                        <ComplaintChat
                            userId={activeThread.userId}
                            userRole={activeThread.userRole}
                            isAdminView
                        />
                    ) : (
                        <div className="flex h-[70vh] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white text-center">
                            <MessageSquare size={30} className="mb-3 text-slate-300" />
                            <p className="text-sm font-semibold text-slate-600">Select a complaint thread</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ComplaintCenter;

