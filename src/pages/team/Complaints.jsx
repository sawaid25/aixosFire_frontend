import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageSquare, Inbox, Mail, TrendingUp, Bot, Eye, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTeamComplaints, getTeamComplaintThread, sendTeamComplaintReply, teamErrorMessage } from '../../api/team';
import { hasTeamPermission } from '../../constants/teamPermissions';
import { formatKsaDateTime } from '../../utils/dateTime';
import { teamSenderLabel } from '../../utils/complaintSender';
import StatCard from '../../components/admin/StatCard';
import PageLoader from '../../components/PageLoader';
import useTeamData from './useTeamData';
import { TeamPageHeader, EmptyState, ErrorBanner, FilterTabs } from './TeamUi';

const ROLE_TABS = [
    { value: 'all', label: 'All' },
    { value: 'agent', label: 'Agents' },
    { value: 'partner', label: 'Partners' },
    { value: 'customer', label: 'Customers' },
];

const ROLE_BADGE = {
    agent: 'bg-primary-50 text-primary-700',
    partner: 'bg-indigo-50 text-indigo-700',
    customer: 'bg-blue-50 text-blue-700',
};

const threadKey = (t) => `${t.user_role}:${t.user_id}`;

/** Who sent a message, as shown in the conversation. */
const senderLabel = (m, selected, myId) => {
    if (!m.is_admin) return selected.name || selected.user_role;
    if (m.is_bot) return 'AI Support';
    const team = teamSenderLabel(m);
    if (team) return String(m.sender_team_member_id) === String(myId) ? `${team} (you)` : team;
    return 'Admin';
};

const TeamComplaints = () => {
    const { user } = useAuth();
    const canReply = hasTeamPermission(user, 'complaints', 'reply');
    const [role, setRole] = useState('all');
    const [selected, setSelected] = useState(null);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const load = useCallback(() => getTeamComplaints(), []);
    const { data, loading, error, reload } = useTeamData(load);

    const loadThread = useCallback(
        () => (selected ? getTeamComplaintThread(selected.user_role, selected.user_id) : Promise.resolve([])),
        [selected],
    );
    const { data: messages, loading: threadLoading, error: threadError, reload: reloadThread } = useTeamData(loadThread);

    const selectThread = (t) => { setSelected(t); setDraft(''); };

    const sendReply = async (e) => {
        e.preventDefault();
        const message = draft.trim();
        if (!message || !selected || sending) return;
        setSending(true);
        try {
            await sendTeamComplaintReply(selected.user_role, selected.user_id, message);
            setDraft('');
            await Promise.all([reloadThread(), reload()]);
        } catch (err) {
            toast.error(teamErrorMessage(err, 'Failed to send reply.'));
        } finally {
            setSending(false);
        }
    };

    const stats = data?.stats;
    const threads = useMemo(() => (data?.threads || []).filter((t) => role === 'all' || t.user_role === role), [data, role]);

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading complaints..." />}
            <TeamPageHeader eyebrow="Complaints" title="Complaints" subtitle="Complaint conversations from agents, partners and customers (read-only)." />
            {error && <ErrorBanner message={error} />}

            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon={Inbox} title="Conversations" value={stats.threads} subtext={`${stats.open} open · ${stats.closed} closed`} color="bg-orange-500" />
                    <StatCard icon={Mail} title="Unread messages" value={stats.unread} color="bg-primary-500" />
                    <StatCard icon={TrendingUp} title="Messages (30 days)" value={stats.messages_last_30_days} color="bg-blue-500" />
                    <StatCard icon={Bot} title="Replies" value={stats.admin_replies + stats.bot_replies} subtext={`${stats.admin_replies} admin · ${stats.bot_replies} AI`} color="bg-indigo-500" />
                </div>
            )}

            {stats && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <FilterTabs tabs={ROLE_TABS.map((t) => ({ ...t, label: t.value === 'all' ? t.label : `${t.label} (${stats.by_role[t.value] || 0})` }))} value={role} onChange={setRole} />
                    {!canReply && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Eye size={14} /> View only — replies are handled by Admin.</p>}
                </div>
            )}

            {!loading && !error && threads.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No complaints" message="There are no complaint conversations in this category." />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden max-h-[600px] overflow-y-auto custom-scrollbar">
                        <div className="divide-y divide-slate-100">
                            {threads.map((t) => (
                                <button
                                    key={threadKey(t)}
                                    type="button"
                                    onClick={() => selectThread(t)}
                                    className={`w-full text-left px-5 py-4 transition-colors ${selected && threadKey(selected) === threadKey(t) ? 'bg-primary-50/60' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <p className="text-sm font-bold text-slate-900 truncate">{t.name || `${t.user_role} #${t.user_id}`}</p>
                                        {t.unread > 0 && <span className="px-2 py-0.5 rounded-full bg-primary-500 text-white text-[10px] font-bold flex-shrink-0">{t.unread}</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 truncate mb-2">{t.last_message}</p>
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <span className={`px-2 py-0.5 rounded-md font-bold capitalize ${ROLE_BADGE[t.user_role] || 'bg-slate-100 text-slate-600'}`}>{t.user_role}</span>
                                        <span className={`px-2 py-0.5 rounded-md font-bold ${t.status === 'closed' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}`}>{t.status === 'closed' ? 'Closed' : 'Open'}</span>
                                        <span className="text-slate-400 ml-auto">{formatKsaDateTime(t.last_at)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-white rounded-3xl shadow-soft border border-slate-100 p-6 min-h-[300px] relative">
                        {!selected ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-16">
                                <MessageSquare size={40} className="text-slate-200 mb-3" />
                                <p className="text-sm">Select a conversation to read it.</p>
                            </div>
                        ) : (
                            <>
                                <div className="border-b border-slate-100 pb-4 mb-4">
                                    <h2 className="text-lg font-bold text-slate-900">{selected.name || `${selected.user_role} #${selected.user_id}`}</h2>
                                    <p className="text-xs text-slate-500 capitalize">{selected.user_role} · {selected.messages} message{selected.messages === 1 ? '' : 's'}</p>
                                </div>
                                {threadError && <ErrorBanner message={threadError} />}
                                {threadLoading && !messages?.length ? (
                                    <p className="text-sm text-slate-500">Loading conversation...</p>
                                ) : (
                                    <div className="space-y-3 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
                                        {(messages || []).map((m) => {
                                            const isTeam = Boolean(m.sender_team_member_id);
                                            const bubble = !m.is_admin ? 'bg-slate-100 text-slate-900'
                                                : m.is_bot ? 'bg-indigo-50 text-indigo-900'
                                                : isTeam ? 'bg-primary-500 text-white'
                                                : 'bg-slate-900 text-white';
                                            const muted = m.is_admin && !m.is_bot ? 'text-white/75' : 'text-slate-500';
                                            return (
                                                <div key={m.id} className={`flex ${m.is_admin ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${bubble}`}>
                                                        <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${muted}`}>{senderLabel(m, selected, user?.id)}</p>
                                                        <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                                                        <p className={`text-[10px] mt-1 ${muted}`}>{formatKsaDateTime(m.created_at)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {canReply && (
                                    <form onSubmit={sendReply} className="flex gap-2 border-t border-slate-100 pt-4 mt-4">
                                        <input
                                            type="text"
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value)}
                                            maxLength={4000}
                                            placeholder={`Reply as ${user?.name || 'yourself'}...`}
                                            className="input-field flex-1 py-2.5"
                                            disabled={sending}
                                        />
                                        <button
                                            type="submit"
                                            disabled={sending || !draft.trim()}
                                            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white hover:bg-primary-600 disabled:bg-slate-300"
                                            aria-label="Send reply"
                                        >
                                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        </button>
                                    </form>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamComplaints;
