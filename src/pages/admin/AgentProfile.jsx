import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../api/client';
import PageLoader from '../../components/PageLoader';
import { toast } from 'react-hot-toast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts';
import {
    ArrowLeft, User, Phone, MapPin, Calendar, CheckCircle,
    Clock, XCircle, Activity, AlertTriangle, Award,
    TrendingUp, TrendingDown, Eye, Target, Zap, Timer, MessageSquare,
    Star, Users, Search, X, UserCheck, Trash2, Shield, Mail, RefreshCw, UserCog
} from 'lucide-react';
import PerformanceBadge from '../../components/admin/PerformanceBadge';
import StatCard from '../../components/admin/StatCard';

/* ─── Benchmark Configuration ─────────────────────────── */
const BENCHMARK = {
    validation:   { hours: 24,  label: '24 hours',  color: '#8b5cf6' },
    refilling:    { hours: 72,  label: '3 days',    color: '#3b82f6' },
    maintenance:  { hours: 504, label: '3 weeks',   color: '#f97316' },
    installation: { hours: 504, label: '3 weeks',   color: '#f97316' },
    inspection:   { hours: 24,  label: '24 hours',  color: '#06b6d4' },
};
const DEFAULT_BENCHMARK = { hours: 72, label: '3 days', color: '#94a3b8' };

const getBenchmark = (type) => BENCHMARK[(type || '').toLowerCase()] || DEFAULT_BENCHMARK;

/* ─── Benchmark Calculation ────────────────────────────── */
const calcBenchmark = (inq) => {
    const start        = new Date(inq.created_at);
    const bm           = getBenchmark(inq.type);
    const benchmarkEnd = new Date(start.getTime() + bm.hours * 3_600_000);

    const isCompleted = ['completed', 'accepted', 'closed'].includes((inq.status || '').toLowerCase());
    const isRejected  = ['rejected', 'cancelled'].includes((inq.status || '').toLowerCase());

    // Best available closing date: updated_at (most accurate) → follow_up_date
    let closingDate = null;
    if (isCompleted || isRejected) {
        if (inq.updated_at)      closingDate = new Date(inq.updated_at);
        else if (inq.follow_up_date) closingDate = new Date(inq.follow_up_date);
    }

    let benchmarkStatus = 'pending';
    let withinBenchmark = null;

    if (isCompleted && closingDate) {
        withinBenchmark = closingDate <= benchmarkEnd;
        benchmarkStatus = withinBenchmark ? 'within' : 'missed';
    } else if (!isCompleted && !isRejected) {
        benchmarkStatus = new Date() > benchmarkEnd ? 'at_risk' : 'on_track';
    } else if (isRejected) {
        benchmarkStatus = 'rejected';
    }

    const durationMs    = closingDate ? Math.max(0, closingDate - start) : null;
    const durationHours = durationMs !== null ? Math.round(durationMs / 3_600_000) : null;
    const durationDays  = durationHours !== null ? (durationHours / 24).toFixed(1) : null;

    // Bar fill: proportion of actual vs benchmark (capped at 200% for display)
    const barFillPct = durationHours !== null
        ? Math.min(200, Math.round((durationHours / bm.hours) * 100))
        : null;

    return { start, benchmarkEnd, closingDate, benchmarkStatus, withinBenchmark, durationHours, durationDays, barFillPct, bmHours: bm.hours, bmLabel: bm.label };
};

/* ─── Small helpers ────────────────────────────────────── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const INQUIRIES_PER_PAGE = 15;

const getTimeBounds = (period) => {
    const now = new Date();
    if (period === 'today') {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        return { start, end: now };
    }
    if (period === 'week') {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
    }
    if (period === 'month') {
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }
    return null;
};

const getBadgeClass = (s) => {
    const v = (s || '').toLowerCase();
    if (['completed', 'accepted', 'closed'].includes(v)) return 'bg-green-100 text-green-700';
    if (['rejected', 'cancelled'].includes(v))            return 'bg-red-100 text-red-700';
    if (['in progress', 'scheduled'].includes(v))         return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
};

const fmt = (date) => date ? new Date(date).toLocaleDateString() : '—';
const fmtFull = (date) => date ? new Date(date).toLocaleString() : '—';

/* ─── Benchmark Status Pill ────────────────────────────── */
const BmPill = ({ status }) => {
    const map = {
        within:   { cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle,    label: 'Within Benchmark' },
        missed:   { cls: 'bg-red-100 text-red-700',         icon: AlertTriangle,  label: 'Benchmark Missed' },
        on_track: { cls: 'bg-blue-100 text-blue-700',       icon: Target,         label: 'On Track' },
        at_risk:  { cls: 'bg-amber-100 text-amber-700',     icon: Timer,          label: 'At Risk' },
        pending:  { cls: 'bg-slate-100 text-slate-500',     icon: Clock,          label: 'Pending' },
        rejected: { cls: 'bg-slate-100 text-slate-400',     icon: XCircle,        label: 'Rejected' },
    };
    const { cls, icon: Icon, label } = map[status] || map.pending;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${cls}`}>
            <Icon size={11} /> {label}
        </span>
    );
};

/* ─── Visual Benchmark Bar ─────────────────────────────── */
const BmBar = ({ barFillPct, withinBenchmark, status }) => {
    if (barFillPct === null || status === 'rejected') return null;

    // For completed: show fill vs benchmark; for open: show elapsed vs benchmark
    const isPending = ['on_track', 'at_risk', 'pending'].includes(status);
    const clampedPct = Math.min(100, barFillPct); // visual cap at bar width

    return (
        <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Start</span>
                <span className="font-semibold text-slate-500">Benchmark ▾</span>
                <span>{isPending ? 'Now' : 'Closed'}</span>
            </div>
            <div className="relative w-full bg-slate-100 rounded-full h-2.5 overflow-visible">
                {/* Benchmark marker line at 100% */}
                <div className="absolute right-0 top-0 h-2.5 w-0.5 bg-slate-400 z-10 rounded-full" />

                {/* Actual fill */}
                <div
                    className={`h-2.5 rounded-full transition-all duration-700 ${
                        isPending
                            ? 'bg-blue-400'
                            : withinBenchmark
                            ? 'bg-emerald-500'
                            : 'bg-red-500'
                    }`}
                    style={{ width: `${clampedPct}%` }}
                />

                {/* Overflow indicator if missed */}
                {!isPending && !withinBenchmark && barFillPct > 100 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-500 border-2 border-white flex items-center justify-center z-20">
                        <span className="text-white" style={{ fontSize: 7 }}>!</span>
                    </div>
                )}
            </div>
            {barFillPct > 100 && !isPending && (
                <p className="text-xs text-red-500 font-semibold mt-1">
                    {Math.round(barFillPct - 100)}% over benchmark
                </p>
            )}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   SENIOR AGENT MODAL
══════════════════════════════════════════════════════════ */
const SeniorAgentModal = ({ isOpen, onClose, targetAgent, currentSeniorRecord, onSuccess }) => {
    const { user } = useAuth();
    const [allAgents, setAllAgents]       = useState([]);
    const [search, setSearch]             = useState('');
    const [selected, setSelected]         = useState([]);   // array of agent objects
    const [loadingAgents, setLoadingAgents] = useState(false);
    const [submitting, setSubmitting]     = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const searchRef = useRef(null);

    // Load all agents (excluding the target) when modal opens
    useEffect(() => {
        if (!isOpen) return;
        setSearch('');
        setConfirmRemove(false);
        const load = async () => {
            setLoadingAgents(true);
            try {
                const { data } = await supabase
                    .from('agents')
                    .select('id, name, email, status, profile_photo, territory')
                    .eq('status', 'accepted')
                    .neq('id', targetAgent.id)
                    .order('name');
                setAllAgents(data || []);

                // Pre-select current team members if re-opening modal
                if (currentSeniorRecord) {
                    const { data: teamData } = await supabase
                        .from('senior_agent_teams')
                        .select('agent_id, agents(id, name, email, status, profile_photo, territory)')
                        .eq('senior_agent_id', currentSeniorRecord.id);
                    setSelected((teamData || []).map(t => t.agents).filter(Boolean));
                } else {
                    setSelected([]);
                }
            } finally {
                setLoadingAgents(false);
            }
        };
        load();
        setTimeout(() => searchRef.current?.focus(), 100);
    }, [isOpen, targetAgent?.id, currentSeniorRecord]);

    const filtered = allAgents.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
    );

    const toggleAgent = (agent) => {
        setSelected(prev => {
            const exists = prev.find(a => a.id === agent.id);
            if (exists) return prev.filter(a => a.id !== agent.id);
            if (prev.length >= 10) { toast.error('Maximum 10 team members'); return prev; }
            return [...prev, agent];
        });
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/auth/promote-senior-agent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: targetAgent.id,
                    agentEmail: targetAgent.email,
                    agentName: targetAgent.name,
                    assignedAgentIds: selected.map(a => a.id),
                    adminName: user?.name || 'Admin',
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Promotion failed');
            toast.success('Agent promoted! Activation email sent.');
            onSuccess?.();
            onClose();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateTeam = async () => {
        if (!currentSeniorRecord) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/senior-agents/${currentSeniorRecord.id}/team`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignedAgentIds: selected.map(a => a.id) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Update failed');
            toast.success('Team updated successfully');
            onSuccess?.();
            onClose();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveSenior = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/senior-agents/agent/${targetAgent.id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Remove failed');
            toast.success('Senior agent status removed');
            onSuccess?.();
            onClose();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
            setConfirmRemove(false);
        }
    };

    if (!isOpen) return null;

    const isEdit = !!currentSeniorRecord;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 flex items-start justify-between border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 rounded-2xl">
                            <Star size={18} className="text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">
                                {isEdit ? 'Manage Senior Agent Team' : 'Promote to Senior Agent'}
                            </h3>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {isEdit ? `Update team for ${targetAgent?.name}` : `Assign a team to ${targetAgent?.name}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Selected pills */}
                {selected.length > 0 && (
                    <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                            Selected Team ({selected.length}/10)
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {selected.map(a => (
                                <span key={a.id} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                                    {a.name}
                                    <button onClick={() => toggleAgent(a)} className="text-amber-500 hover:text-amber-700 ml-0.5">
                                        <X size={11} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Search agents by name or email…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary-400 outline-none text-sm"
                        />
                    </div>
                </div>

                {/* Agent list */}
                <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
                    {loadingAgents ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-8">No agents found.</p>
                    ) : (
                        filtered.map(agent => {
                            const isChosen = !!selected.find(a => a.id === agent.id);
                            return (
                                <button
                                    key={agent.id}
                                    onClick={() => toggleAgent(agent)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${isChosen ? 'border-amber-400 bg-amber-50' : 'border-slate-100 hover:border-slate-300 bg-white'}`}
                                >
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                                        {agent.profile_photo
                                            ? <img src={agent.profile_photo} alt={agent.name} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={16} /></div>
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{agent.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{agent.email}</p>
                                    </div>
                                    {agent.territory && (
                                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg hidden sm:block">{agent.territory}</span>
                                    )}
                                    {isChosen && <CheckCircle size={18} className="text-amber-500 flex-shrink-0" />}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer actions */}
                <div className="p-6 pt-4 border-t border-slate-100 flex-shrink-0 space-y-3">
                    {isEdit && (
                        confirmRemove ? (
                            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                                <p className="text-sm text-red-700 font-medium flex-1">Remove senior agent status from {targetAgent.name}?</p>
                                <button onClick={handleRemoveSenior} disabled={submitting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg">
                                    {submitting ? '…' : 'Confirm Remove'}
                                </button>
                                <button onClick={() => setConfirmRemove(false)} className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmRemove(true)} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                <Trash2 size={15} /> Remove Senior Agent Status
                            </button>
                        )
                    )}
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={isEdit ? handleUpdateTeam : handleSubmit}
                            disabled={submitting || (!isEdit && selected.length === 0)}
                            className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-lg shadow-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Star size={15} />
                                    {isEdit ? 'Update Team' : 'Promote & Send Email'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   LOGIN AS AGENT — CONFIRMATION MODAL
══════════════════════════════════════════════════════════ */
const LoginAsAgentModal = ({ isOpen, onClose, agentName, submitting, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-amber-100 rounded-2xl">
                        <UserCog size={18} className="text-amber-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900">Login as {agentName}?</h3>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                    You'll temporarily view the app exactly as this agent, without their password. This action
                    is logged and expires automatically after 45 minutes. You can return to your own account
                    at any time via the banner shown while impersonating.
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-lg shadow-amber-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>
                            <UserCog size={15} /> Login as Agent
                        </>}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
const AgentProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { startImpersonation } = useAuth();
    const [searchParams] = useSearchParams();
    const [loading, setLoading]             = useState(true);
    const [agent, setAgent]                 = useState(null);
    const [inquiries, setInquiries]         = useState([]);
    const [activeTab, setActiveTab]         = useState(searchParams.get('tab') || 'overview');
    const [statusFilter, setStatusFilter]   = useState('All');
    const [timePeriod, setTimePeriod]       = useState('all');
    const [inquiriesPage, setInquiriesPage] = useState(1);
    const [complaints, setComplaints]       = useState([]);
    const [complaintsLoading, setComplaintsLoading] = useState(false);
    const [seniorRecord, setSeniorRecord]       = useState(null);
    const [showSeniorModal, setShowSeniorModal] = useState(false);
    const [resending, setResending]             = useState(false);
    const [showImpersonateConfirm, setShowImpersonateConfirm] = useState(false);
    const [impersonating, setImpersonating]     = useState(false);

    const handleLoginAsAgent = async () => {
        setImpersonating(true);
        try {
            const result = await startImpersonation(id);
            if (result.success) {
                navigate('/agent/dashboard');
            } else {
                toast.error(result.error || 'Failed to start impersonation');
            }
        } finally {
            setImpersonating(false);
            setShowImpersonateConfirm(false);
        }
    };

    const resendActivationEmail = async () => {
        if (!seniorRecord || resending) return;
        setResending(true);
        try {
            const res  = await fetch(`${API_URL}/auth/promote-senior-agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    agentId: id,
                    teamAgentIds: [],
                    resendOnly: true,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Activation email resent successfully.');
                const { data: sa } = await supabase.from('senior_agents').select('id,is_activated,promoted_by,created_at').eq('agent_id', id).maybeSingle();
                setSeniorRecord(sa || null);
            } else {
                toast.error(data.error || 'Failed to resend email.');
            }
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setResending(false);
        }
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [{ data: agentData }, { data: inqData }, { data: saData }] = await Promise.all([
                    supabase.from('agents').select('*').eq('id', id).maybeSingle(),
                    supabase.from('inquiries')
                        .select('id,inquiry_no,type,status,created_at,follow_up_date,updated_at,customers(id,business_name,address)')
                        .eq('agent_id', id)
                        .order('created_at', { ascending: false }),
                    supabase.from('senior_agents').select('id,is_activated,promoted_by,created_at').eq('agent_id', id).maybeSingle(),
                ]);
                setAgent(agentData);
                setInquiries(inqData || []);
                setSeniorRecord(saData || null);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    // Sync active tab when URL changes (e.g. navigated from notification)
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) setActiveTab(tab);
    }, [searchParams]);

    // Load this agent's complaint messages when the complaints tab is opened
    useEffect(() => {
        if (activeTab !== 'complaints') return;
        const loadComplaints = async () => {
            setComplaintsLoading(true);
            try {
                const { data } = await supabase
                    .from('complaints')
                    .select('*')
                    .eq('user_id', id)
                    .order('created_at', { ascending: false });
                setComplaints(data || []);
            } catch (err) {
                console.error('AgentProfile complaints load error:', err);
            } finally {
                setComplaintsLoading(false);
            }
        };
        loadComplaints();
    }, [activeTab, id]);

    /* ── Core metrics ── */
    const metrics = useMemo(() => {
        const total     = inquiries.length;
        const completed = inquiries.filter(i => ['completed', 'accepted', 'closed'].includes((i.status || '').toLowerCase())).length;
        const pending   = inquiries.filter(i => !['completed', 'accepted', 'closed', 'rejected', 'cancelled'].includes((i.status || '').toLowerCase())).length;
        const rejected  = inquiries.filter(i => ['rejected', 'cancelled'].includes((i.status || '').toLowerCase())).length;
        const score     = total ? Math.round((completed / total) * 100) : 0;

        const monthMap = {};
        inquiries.forEach(i => {
            const d   = new Date(i.created_at);
            const key = MONTHS[d.getMonth()];
            if (!monthMap[key]) monthMap[key] = { name: key, total: 0, completed: 0 };
            monthMap[key].total += 1;
            if (['completed', 'accepted', 'closed'].includes((i.status || '').toLowerCase())) monthMap[key].completed += 1;
        });
        const trendData = MONTHS.filter(m => monthMap[m]).map(m => monthMap[m]);

        const typeMap = {};
        inquiries.forEach(i => { const t = i.type || 'Unknown'; typeMap[t] = (typeMap[t] || 0) + 1; });
        const typeData = Object.entries(typeMap).map(([name, count]) => ({ name, count }));

        return { total, completed, pending, rejected, score, trendData, typeData };
    }, [inquiries]);

    /* ── Benchmark metrics ── */
    const bmMetrics = useMemo(() => {
        let withinCount = 0, missedCount = 0, totalDurHours = 0, durCount = 0;

        const typeMap = {};
        inquiries.forEach(inq => {
            const { benchmarkStatus, durationHours } = calcBenchmark(inq);
            const t = (inq.type || 'Unknown').charAt(0).toUpperCase() + (inq.type || 'Unknown').slice(1);
            if (!typeMap[t]) typeMap[t] = { name: t, within: 0, missed: 0 };

            if (benchmarkStatus === 'within') { withinCount++; typeMap[t].within++; }
            if (benchmarkStatus === 'missed') { missedCount++; typeMap[t].missed++; }

            if (durationHours !== null) { totalDurHours += durationHours; durCount++; }
        });

        const evaluated   = withinCount + missedCount;
        const successRate = evaluated ? Math.round((withinCount / evaluated) * 100) : 0;
        const avgHours    = durCount ? Math.round(totalDurHours / durCount) : 0;
        const avgDays     = avgHours ? (avgHours / 24).toFixed(1) : '—';
        const chartData   = Object.values(typeMap).filter(t => t.within + t.missed > 0);

        return { withinCount, missedCount, successRate, avgDays, evaluated, chartData };
    }, [inquiries]);

    /* ── Summary stats for the Inquiries tab header cards ── */
    const inquiryStats = useMemo(() => {
        const now        = new Date();
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            total:     inquiries.length,
            today:     inquiries.filter(i => new Date(i.created_at) >= todayStart).length,
            thisWeek:  inquiries.filter(i => new Date(i.created_at) >= weekStart).length,
            thisMonth: inquiries.filter(i => new Date(i.created_at) >= monthStart).length,
        };
    }, [inquiries]);

    /* ── Filter for Inquiries tab ── */
    const filteredInquiries = useMemo(() => {
        let result = inquiries;

        const bounds = getTimeBounds(timePeriod);
        if (bounds) {
            result = result.filter(i => {
                const d = new Date(i.created_at);
                return d >= bounds.start && d <= bounds.end;
            });
        }

        if (statusFilter !== 'All') {
            result = result.filter(i => {
                const s = (i.status || '').toLowerCase();
                if (statusFilter === 'Completed') return ['completed', 'accepted', 'closed'].includes(s);
                if (statusFilter === 'Rejected')  return ['rejected', 'cancelled'].includes(s);
                if (statusFilter === 'Pending')   return !['completed', 'accepted', 'closed', 'rejected', 'cancelled'].includes(s);
                return true;
            });
        }

        return result;
    }, [inquiries, statusFilter, timePeriod]);

    const totalInquiryPages    = Math.ceil(filteredInquiries.length / INQUIRIES_PER_PAGE);
    const paginatedInquiries   = useMemo(() => {
        const start = (inquiriesPage - 1) * INQUIRIES_PER_PAGE;
        return filteredInquiries.slice(start, start + INQUIRIES_PER_PAGE);
    }, [filteredInquiries, inquiriesPage]);

    if (loading) return <PageLoader message="Loading agent profile..." />;
    if (!agent) return (
        <div className="text-center py-20">
            <User size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500">Agent not found.</p>
            <Link to="/admin/agents" className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:underline">
                <ArrowLeft size={14} /> Back to Agents
            </Link>
        </div>
    );

    const TABS = [
        { id: 'overview',   label: 'Overview' },
        { id: 'inquiries',  label: `Inquiries (${metrics.total})` },
        // { id: 'timeline',   label: 'Activity Timeline' },
        { id: 'complaints', label: 'Complaints & Issues' },
    ];

    return (
        <div className="space-y-6">
            {/* Back */}
            <Link to="/admin/agents" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
                <ArrowLeft size={16} /> Back to Agent Management
            </Link>

            {/* Profile Card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                        {agent.profile_photo
                            ? <img src={agent.profile_photo} alt={agent.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={32} /></div>
                        }
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-display font-bold text-slate-900">{agent.name}</h2>
                                <p className="text-sm text-slate-500 mt-0.5">{agent.email}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <PerformanceBadge score={metrics.score} />
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${['accepted', 'active'].includes((agent.status || '').toLowerCase()) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {agent.status || 'Unknown'}
                                </span>
                                {seniorRecord && (
                                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${seniorRecord.is_activated ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                        <Star size={11} /> {seniorRecord.is_activated ? 'Senior Agent' : 'Senior (Pending)'}
                                    </span>
                                )}
                                <button
                                    onClick={() => setShowSeniorModal(true)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${seniorRecord ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
                                >
                                    <Star size={12} />
                                    {seniorRecord ? 'Manage Team' : 'Make Senior Agent'}
                                </button>
                                {seniorRecord && !seniorRecord.is_activated && (
                                    <button
                                        onClick={resendActivationEmail}
                                        disabled={resending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-60"
                                    >
                                        {resending
                                            ? <RefreshCw size={12} className="animate-spin" />
                                            : <Mail size={12} />
                                        }
                                        Resend Activation
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowImpersonateConfirm(true)}
                                    disabled={!['accepted', 'active'].includes((agent.status || '').toLowerCase())}
                                    title={!['accepted', 'active'].includes((agent.status || '').toLowerCase()) ? 'Only active/accepted agents can be impersonated' : undefined}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <UserCog size={12} />
                                    Login as Agent
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
                            {agent.phone    && <span className="flex items-center gap-1.5"><Phone size={14} />{agent.phone}</span>}
                            {agent.territory && <span className="flex items-center gap-1.5"><MapPin size={14} />{agent.territory}</span>}
                            <span className="flex items-center gap-1.5"><Calendar size={14} />Joined {new Date(agent.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={Activity}    title="Total Assigned" value={metrics.total}     color="bg-blue-500" />
                <StatCard icon={CheckCircle} title="Completed"      value={metrics.completed}  color="bg-emerald-500" />
                <StatCard icon={Clock}       title="Pending"        value={metrics.pending}    color="bg-amber-500" />
                <StatCard icon={XCircle}     title="Rejected"       value={metrics.rejected}   color="bg-red-500" />
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Performance</p>
                    <p className="text-2xl font-bold text-slate-900 mb-2">{metrics.score}%</p>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="h-2 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${metrics.score}%` }} />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1 w-fit shadow-sm">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === t.id ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══ OVERVIEW TAB ══ */}
            {activeTab === 'overview' && (
                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <h3 className="font-bold text-slate-900 mb-5">Monthly Activity</h3>
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metrics.trendData}>
                                    <defs>
                                        <linearGradient id="gAgt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                    <Area type="monotone" dataKey="total"     name="Total"     stroke="#3b82f6" strokeWidth={2.5} fill="url(#gAgt)" />
                                    <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2}   fillOpacity={0} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <h3 className="font-bold text-slate-900 mb-5">Inquiries by Type</h3>
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={metrics.typeData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={90} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ INQUIRIES TAB ══ */}
            {activeTab === 'inquiries' && (
                <div className="space-y-4">

                    {/* ── Summary stat cards (clickable to filter by period) ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { key: 'all',   label: 'All Time',   value: inquiryStats.total,     accent: 'slate' },
                            { key: 'today', label: 'Today',      value: inquiryStats.today,     accent: 'blue' },
                            { key: 'week',  label: 'This Week',  value: inquiryStats.thisWeek,  accent: 'violet' },
                            { key: 'month', label: 'This Month', value: inquiryStats.thisMonth, accent: 'emerald' },
                        ].map(({ key, label, value, accent }) => {
                            const active = timePeriod === key;
                            const colors = {
                                slate:   { border: active ? 'border-slate-800'   : 'border-slate-100',   text: 'text-slate-900',   sub: 'text-slate-400'  },
                                blue:    { border: active ? 'border-blue-500'    : 'border-slate-100',   text: 'text-blue-700',    sub: 'text-blue-400'   },
                                violet:  { border: active ? 'border-violet-500'  : 'border-slate-100',   text: 'text-violet-700',  sub: 'text-violet-400' },
                                emerald: { border: active ? 'border-emerald-500' : 'border-slate-100',   text: 'text-emerald-700', sub: 'text-emerald-400'},
                            }[accent];
                            return (
                                <button
                                    key={key}
                                    onClick={() => { setTimePeriod(key); setInquiriesPage(1); }}
                                    className={`bg-white rounded-2xl border-2 p-4 text-left transition-all shadow-soft hover:shadow-md ${colors.border}`}
                                >
                                    <p className={`text-xs font-bold uppercase tracking-widest ${colors.sub}`}>{label}</p>
                                    <p className={`text-2xl font-bold mt-1 ${colors.text}`}>{value}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Inquiries</p>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Table card ── */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-slate-100">
                            <div>
                                <h3 className="font-bold text-slate-900">Assigned Inquiries</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {filteredInquiries.length} {filteredInquiries.length === 1 ? 'inquiry' : 'inquiries'}{' '}
                                    {timePeriod === 'today' ? '· today' : timePeriod === 'week' ? '· this week' : timePeriod === 'month' ? '· this month' : '· all time'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {['All', 'Pending', 'Completed', 'Rejected'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => { setStatusFilter(f); setInquiriesPage(1); }}
                                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${statusFilter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                                    >{f}</button>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider">
                                        <th className="px-6 py-3">Inquiry No</th>
                                        <th className="px-6 py-3">Customer</th>
                                        <th className="px-6 py-3">Type</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Created</th>
                                        <th className="px-6 py-3">Last Updated</th>
                                        <th className="px-6 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {paginatedInquiries.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center">
                                                <Activity size={28} className="mx-auto text-slate-200 mb-2" />
                                                <p className="text-slate-400 text-sm font-medium">No inquiries match the selected filters.</p>
                                                <p className="text-xs text-slate-300 mt-1">Try a different time period or status filter.</p>
                                            </td>
                                        </tr>
                                    )}
                                    {paginatedInquiries.map(inq => (
                                        <tr key={inq.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900 text-sm">{inq.inquiry_no || `#${inq.id?.toString().slice(-6)}`}</td>
                                            <td className="px-6 py-4 text-sm text-slate-700 font-medium">{inq.customers?.business_name || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500 capitalize">{inq.type || '—'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getBadgeClass(inq.status)}`}>{inq.status || 'Pending'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{fmtFull(inq.created_at)}</td>
                                            <td className="px-6 py-4 text-sm text-slate-400">{inq.updated_at ? fmtFull(inq.updated_at) : '—'}</td>
                                            <td className="px-6 py-4">
                                                <Link
                                                    to={`/admin/inquiries/${inq.id}`}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-700 text-white px-3 py-1.5 rounded-xl transition-colors"
                                                >
                                                    <Eye size={11} /> View Details
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalInquiryPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                                <p className="text-xs text-slate-400">
                                    Showing {((inquiriesPage - 1) * INQUIRIES_PER_PAGE) + 1}–{Math.min(inquiriesPage * INQUIRIES_PER_PAGE, filteredInquiries.length)} of {filteredInquiries.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setInquiriesPage(p => Math.max(1, p - 1))}
                                        disabled={inquiriesPage === 1}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >← Prev</button>
                                    <span className="text-xs text-slate-500 font-medium px-1">{inquiriesPage} / {totalInquiryPages}</span>
                                    <button
                                        onClick={() => setInquiriesPage(p => Math.min(totalInquiryPages, p + 1))}
                                        disabled={inquiriesPage === totalInquiryPages}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >Next →</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══ ACTIVITY TIMELINE TAB ══ (moved to InquiryDetail page) */}
            {false && activeTab === 'timeline' && (
                <div className="space-y-6">

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Target size={16} className="text-slate-500" />
                            <h3 className="font-bold text-slate-900 text-sm">Service Benchmark Targets</h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {Object.entries(BENCHMARK).map(([type, bm]) => (
                                <div key={type} className="text-center p-3 rounded-2xl bg-slate-50">
                                    <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1.5" style={{ background: bm.color }} />
                                    <p className="text-xs font-bold text-slate-700 capitalize">{type}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{bm.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5">
                            <div className="p-2.5 rounded-xl bg-blue-500 w-fit mb-3"><Activity size={16} className="text-white" /></div>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Activities</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.total}</p>
                        </div>
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5">
                            <div className="p-2.5 rounded-xl bg-emerald-500 w-fit mb-3"><CheckCircle size={16} className="text-white" /></div>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Within Benchmark</p>
                            <p className="text-2xl font-bold text-emerald-700 mt-1">{bmMetrics.withinCount}</p>
                        </div>
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5">
                            <div className="p-2.5 rounded-xl bg-red-500 w-fit mb-3"><AlertTriangle size={16} className="text-white" /></div>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Missed Benchmark</p>
                            <p className="text-2xl font-bold text-red-600 mt-1">{bmMetrics.missedCount}</p>
                        </div>
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5">
                            <div className="p-2.5 rounded-xl bg-violet-500 w-fit mb-3"><Award size={16} className="text-white" /></div>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Success Rate</p>
                            <p className="text-2xl font-bold text-violet-700 mt-1">{bmMetrics.successRate}%</p>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                                <div className="h-1.5 rounded-full bg-violet-500 transition-all" style={{ width: `${bmMetrics.successRate}%` }} />
                            </div>
                        </div>
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5">
                            <div className="p-2.5 rounded-xl bg-amber-500 w-fit mb-3"><Timer size={16} className="text-white" /></div>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Avg Completion</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{bmMetrics.avgDays}</p>
                            <p className="text-xs text-slate-400 mt-0.5">days average</p>
                        </div>
                    </div>

                    {bmMetrics.chartData.length > 0 && (
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h3 className="font-bold text-slate-900">Benchmark Performance by Service Type</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Green = Within Benchmark · Red = Benchmark Missed</p>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Within</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Missed</span>
                                </div>
                            </div>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={bmMetrics.chartData} layout="vertical" barSize={14}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={90} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="within" name="Within Benchmark" fill="#10b981" radius={[0, 3, 3, 0]} stackId="a" />
                                        <Bar dataKey="missed" name="Benchmark Missed" fill="#f87171" radius={[0, 3, 3, 0]} stackId="a" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-900">Inquiry Timeline</h3>
                            <p className="text-xs text-slate-400">{inquiries.length} total activities</p>
                        </div>

                        {inquiries.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-10">No activities recorded.</p>
                        )}

                        <div className="relative">
                            <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-100" />

                            <div className="space-y-4">
                                {inquiries.map((inq) => {
                                    const bm = calcBenchmark(inq);
                                    const bmConfig = getBenchmark(inq.type);

                                    return (
                                        <div key={inq.id} className="flex gap-4 pl-14 relative">
                                            {/* Dot */}
                                            <div className={`absolute left-3.5 top-4 w-3.5 h-3.5 rounded-full border-2 border-white z-10 flex-shrink-0 ${
                                                bm.benchmarkStatus === 'within'   ? 'bg-emerald-500' :
                                                bm.benchmarkStatus === 'missed'   ? 'bg-red-500'     :
                                                bm.benchmarkStatus === 'at_risk'  ? 'bg-amber-500'   :
                                                bm.benchmarkStatus === 'on_track' ? 'bg-blue-500'    :
                                                bm.benchmarkStatus === 'rejected' ? 'bg-slate-400'   : 'bg-slate-300'
                                            }`} />

                                            <div className="flex-1 border border-slate-100 rounded-2xl p-4 hover:shadow-sm transition-shadow bg-white">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-bold text-slate-900">
                                                                {inq.inquiry_no || `#${inq.id?.toString().slice(-6)}`}
                                                            </p>
                                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getBadgeClass(inq.status)}`}>
                                                                {inq.status || 'Pending'}
                                                            </span>
                                                            <BmPill status={bm.benchmarkStatus} />
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            <span className="font-medium">{inq.customers?.business_name || '—'}</span>
                                                            {' · '}
                                                            <span className="capitalize">{inq.type || '—'}</span>
                                                            {' · '}
                                                            <span className="text-slate-400">Target: {bmConfig.label}</span>
                                                        </p>
                                                    </div>
                                                    <Link
                                                        to={`/admin/inquiries/${inq.id}`}
                                                        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-700 text-white px-3 py-1.5 rounded-xl transition-colors"
                                                    >
                                                        <Eye size={12} /> View Details
                                                    </Link>
                                                </div>

                                                <div className="grid grid-cols-3 gap-3 mt-4">
                                                    <div className="bg-slate-50 rounded-xl p-3">
                                                        <p className="text-xs text-slate-400 font-semibold mb-1">Start Date</p>
                                                        <p className="text-xs font-bold text-slate-700">{fmt(inq.created_at)}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">{new Date(inq.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                                        <p className="text-xs text-amber-600 font-semibold mb-1">Benchmark Date</p>
                                                        <p className="text-xs font-bold text-amber-800">{fmt(bm.benchmarkEnd)}</p>
                                                        <p className="text-xs text-amber-500 mt-0.5">{bmConfig.label} limit</p>
                                                    </div>
                                                    <div className={`rounded-xl p-3 ${bm.closingDate ? (bm.withinBenchmark ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100') : 'bg-slate-50'}`}>
                                                        <p className={`text-xs font-semibold mb-1 ${bm.closingDate ? (bm.withinBenchmark ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'}`}>
                                                            Closing Date
                                                        </p>
                                                        <p className={`text-xs font-bold ${bm.closingDate ? (bm.withinBenchmark ? 'text-emerald-800' : 'text-red-700') : 'text-slate-400'}`}>
                                                            {bm.closingDate ? fmt(bm.closingDate) : 'Not closed'}
                                                        </p>
                                                        {bm.durationDays && (
                                                            <p className={`text-xs mt-0.5 ${bm.withinBenchmark ? 'text-emerald-500' : 'text-red-400'}`}>
                                                                {bm.durationDays}d to complete
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4">
                                                    <BmBar
                                                        barFillPct={bm.barFillPct}
                                                        withinBenchmark={bm.withinBenchmark}
                                                        status={bm.benchmarkStatus}
                                                    />
                                                </div>

                                                {bm.durationHours !== null && (
                                                    <div className="mt-3 flex items-center gap-2">
                                                        {bm.withinBenchmark
                                                            ? <TrendingUp size={13} className="text-emerald-500 flex-shrink-0" />
                                                            : <TrendingDown size={13} className="text-red-500 flex-shrink-0" />
                                                        }
                                                        <p className="text-xs text-slate-500">
                                                            Completed in{' '}
                                                            <span className={`font-bold ${bm.withinBenchmark ? 'text-emerald-700' : 'text-red-600'}`}>
                                                                {bm.durationHours < 24
                                                                    ? `${bm.durationHours}h`
                                                                    : `${bm.durationDays} days`
                                                                }
                                                            </span>
                                                            {' · '}Benchmark: {bmConfig.label}
                                                        </p>
                                                    </div>
                                                )}

                                                {bm.benchmarkStatus === 'at_risk' && (
                                                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                                                        <AlertTriangle size={13} className="flex-shrink-0" />
                                                        Benchmark deadline passed — this inquiry is overdue.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ SENIOR AGENT MODAL ══ */}
            <SeniorAgentModal
                isOpen={showSeniorModal}
                onClose={() => setShowSeniorModal(false)}
                targetAgent={agent}
                currentSeniorRecord={seniorRecord}
                onSuccess={async () => {
                    const { data } = await supabase.from('senior_agents').select('id,is_activated,promoted_by,created_at').eq('agent_id', id).maybeSingle();
                    setSeniorRecord(data || null);
                }}
            />

            {/* ══ LOGIN AS AGENT MODAL ══ */}
            <LoginAsAgentModal
                isOpen={showImpersonateConfirm}
                onClose={() => setShowImpersonateConfirm(false)}
                agentName={agent.name}
                submitting={impersonating}
                onConfirm={handleLoginAsAgent}
            />

            {/* ══ COMPLAINTS & ISSUES TAB ══ */}
            {activeTab === 'complaints' && (
                <div className="space-y-4">

                    {/* ── Complaint Thread List ── */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <MessageSquare size={16} className="text-primary-500" />
                                Complaints & Queries
                                {complaints.length > 0 && (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                                        {complaints.filter(c => !c.is_admin && !c.is_bot).length} message{complaints.filter(c => !c.is_admin && !c.is_bot).length !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </h3>
                        </div>

                        {complaintsLoading ? (
                            <div className="flex items-center justify-center py-14">
                                <div className="w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : complaints.length === 0 ? (
                            <div className="text-center py-14">
                                <MessageSquare size={32} className="mx-auto text-slate-200 mb-3" />
                                <p className="text-slate-400 text-sm font-medium">No complaints or queries raised by this agent.</p>
                                <p className="text-xs text-slate-300 mt-1">Complaints appear here when the agent submits one.</p>
                            </div>
                        ) : (
                            <div className="p-6">
                                {/* Single thread card — one agent = one complaint thread */}
                                {(() => {
                                    const isOpen = complaints.some(c => c.status === 'open');
                                    const agentMessages = complaints.filter(c => !c.is_admin && !c.is_bot);
                                    const firstMsg = complaints[complaints.length - 1];
                                    const lastMsg = complaints[0];
                                    return (
                                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                            {/* Card header */}
                                            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-orange-100 rounded-xl">
                                                        <MessageSquare size={15} className="text-orange-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">Complaint Thread</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {complaints.length} message{complaints.length !== 1 ? 's' : ''}
                                                            {' · '}Started {new Date(firstMsg?.created_at).toLocaleDateString()}
                                                            {agentMessages.length > 0 && ` · ${agentMessages.length} from agent`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${isOpen ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                    {isOpen ? 'Open' : 'Resolved'}
                                                </span>
                                            </div>

                                            {/* Recent message previews (last 3) */}
                                            <div className="divide-y divide-slate-50">
                                                {complaints.slice(0, 3).map(c => (
                                                    <div key={c.id} className={`px-5 py-3.5 ${c.is_admin ? 'bg-blue-50/40' : ''}`}>
                                                        <div className="flex items-start gap-2.5">
                                                            <div className={`p-1 rounded-lg flex-shrink-0 mt-0.5 ${c.is_admin ? 'bg-blue-100' : 'bg-slate-100'}`}>
                                                                <User size={11} className={c.is_admin ? 'text-blue-600' : 'text-slate-500'} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className="text-xs font-bold text-slate-600">
                                                                        {c.is_bot ? 'Bot' : c.is_admin ? 'Admin' : (agent.name || 'Agent')}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {new Date(c.created_at).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{c.message}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {complaints.length > 3 && (
                                                    <div className="px-5 py-2.5 text-xs text-slate-400 text-center bg-slate-50/50">
                                                        +{complaints.length - 3} more message{complaints.length - 3 !== 1 ? 's' : ''} in full conversation
                                                    </div>
                                                )}
                                            </div>

                                            {/* CTA: open full conversation in ComplaintCenter */}
                                            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/30">
                                                <Link
                                                    to={`/admin/complaints?userId=${id}`}
                                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors"
                                                >
                                                    <MessageSquare size={14} />
                                                    View Complaint Details
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* ── Hold History ── */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-500" />
                            Hold History
                        </h3>
                        {(agent.status || '').toLowerCase() === 'hold' ? (
                            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-amber-800">Agent is currently on hold</p>
                                    <p className="text-xs text-amber-600 mt-0.5">
                                        Last updated: {new Date(agent.updated_at || agent.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400">No hold history recorded for this agent.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentProfile;
