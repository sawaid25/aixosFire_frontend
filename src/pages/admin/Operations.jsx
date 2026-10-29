import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Link } from 'react-router-dom';
import PageLoader from '../../components/PageLoader';
import {
    Activity, CheckCircle, Clock, XCircle, AlertCircle,
    MessageSquare, Users, Wrench, ArrowRight, RefreshCw,
    Zap, Bot, UserCheck, Phone, Shield, TrendingUp, Bell
} from 'lucide-react';
import StatCard from '../../components/admin/StatCard';

const STATUS_STAGES = [
    { key: 'pending',     label: 'Pending',     color: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-400' },
    { key: 'scheduled',   label: 'Scheduled',   color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
    { key: 'in progress', label: 'In Progress', color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
    { key: 'completed',   label: 'Completed',   color: 'bg-green-100 text-green-700',  dot: 'bg-emerald-500' },
    { key: 'rejected',    label: 'Rejected',    color: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
];

const normalizeStatus = (s) => {
    const v = (s||'').toLowerCase().trim();
    if (['accepted','closed'].includes(v)) return 'completed';
    if (['cancelled'].includes(v)) return 'rejected';
    return v;
};

const Operations = () => {
    const [loading, setLoading] = useState(true);
    const [inquiries, setInquiries] = useState([]);
    const [agents, setAgents] = useState([]);
    const [complaints, setComplaints] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const [
                { data: iData },
                { data: aData },
                { data: cData },
            ] = await Promise.all([
                supabase.from('inquiries')
                    .select('id,inquiry_no,type,status,created_at,follow_up_date,agent_id,customers(business_name),agents(name,territory)')
                    .order('created_at', { ascending: false })
                    .limit(200),
                supabase.from('agents').select('id,name,territory,status').order('name'),
                supabase.from('complaints').select('id,user_id,user_role,message,is_admin,is_read,created_at').order('created_at', { ascending: false }).limit(100),
            ]);
            setInquiries(iData || []);
            setAgents(aData || []);
            setComplaints(cData || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { load(); }, []);

    const metrics = useMemo(() => {
        const byStatus = {};
        inquiries.forEach(i => {
            const s = normalizeStatus(i.status);
            byStatus[s] = (byStatus[s] || 0) + 1;
        });

        const activeAgents = agents.filter(a => ['accepted','active'].includes((a.status||'').toLowerCase())).length;
        const openComplaints = complaints.filter(c => !c.is_admin && !c.is_read).length;
        const botReplies = complaints.filter(c => c.is_admin).length;
        const maintenanceInq = inquiries.filter(i => (i.type||'').toLowerCase() === 'maintenance');

        // Today's activity
        const today = new Date().toISOString().split('T')[0];
        const todayInquiries = inquiries.filter(i => i.created_at?.split('T')[0] === today);

        return { byStatus, activeAgents, openComplaints, botReplies, maintenanceInq, todayInquiries };
    }, [inquiries, agents, complaints]);

    // Kanban columns
    const kanbanCols = useMemo(() => {
        return STATUS_STAGES.map(stage => ({
            ...stage,
            items: inquiries.filter(i => normalizeStatus(i.status) === stage.key).slice(0, 8),
            count: inquiries.filter(i => normalizeStatus(i.status) === stage.key).length,
        }));
    }, [inquiries]);

    // Open complaint threads
    const openThreads = useMemo(() => {
        const map = new Map();
        complaints.forEach(c => {
            if (!map.has(c.user_id)) map.set(c.user_id, { userId: c.user_id, role: c.user_role, last: c.message, at: c.created_at, unread: 0 });
            if (!c.is_admin && !c.is_read) map.get(c.user_id).unread += 1;
        });
        return Array.from(map.values()).filter(t => t.unread > 0).slice(0, 6);
    }, [complaints]);

    if (loading) return <PageLoader message="Loading operations center..." />;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin · Operations</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Service Operations</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Live inquiry pipeline, complaint center & team monitoring.</p>
                </div>
                <button onClick={() => load(true)} disabled={refreshing}
                    className="btn-outline text-sm py-2 px-4 flex items-center gap-2">
                    <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''}/>
                    Refresh
                </button>
            </div>

            {/* Live KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Activity}      title="Total Active"       value={metrics.byStatus['in progress'] || 0} color="bg-amber-500"   subtext="Currently in progress" />
                <StatCard icon={Clock}         title="Pending Queue"      value={metrics.byStatus['pending'] || 0}     color="bg-blue-500"    subtext="Awaiting assignment" />
                <StatCard icon={AlertCircle}   title="Open Complaints"    value={metrics.openComplaints}               color="bg-red-500"     subtext="Unread messages" />
                <StatCard icon={Users}         title="Active Agents"      value={metrics.activeAgents}                 color="bg-emerald-500" subtext="Online & active" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={CheckCircle}   title="Completed Today"    value={metrics.todayInquiries.filter(i => normalizeStatus(i.status) === 'completed').length}  color="bg-teal-500" />
                <StatCard icon={Wrench}        title="Maintenance"        value={metrics.maintenanceInq.length}        color="bg-slate-700"   subtext="Open maintenance reqs" />
                <StatCard icon={MessageSquare} title="Complaint Threads"  value={new Set(complaints.map(c => c.user_id)).size} color="bg-violet-500" />
                <StatCard icon={Bot}           title="Bot Replies Sent"   value={metrics.botReplies}                   color="bg-sky-500"     subtext="Auto-handled by AI" />
            </div>

            {/* Inquiry Pipeline Kanban */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900">Inquiry Pipeline</h3>
                    <Link to="/admin/services" className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                        Full Service Queue <ArrowRight size={12}/>
                    </Link>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto">
                    {kanbanCols.map(col => (
                        <div key={col.key} className="min-w-[160px]">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`}/>
                                    <span className="text-xs font-bold text-slate-600 capitalize">{col.label}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">{col.count}</span>
                            </div>
                            <div className="space-y-2">
                                {col.items.map(inq => (
                                    <div key={inq.id} className={`rounded-xl p-3 text-xs border ${col.color} border-current/10`}>
                                        <p className="font-bold truncate">{inq.inquiry_no || `#${inq.id?.toString().slice(-5)}`}</p>
                                        <p className="opacity-75 truncate mt-0.5">{inq.customers?.business_name || '—'}</p>
                                        {inq.agents?.name && <p className="opacity-60 mt-0.5 truncate">↳ {inq.agents.name}</p>}
                                    </div>
                                ))}
                                {col.count > 8 && (
                                    <p className="text-xs text-slate-400 text-center py-1">+{col.count - 8} more</p>
                                )}
                                {col.count === 0 && (
                                    <div className="rounded-xl p-3 bg-slate-50 text-xs text-slate-300 text-center">Empty</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Operations Grid: Complaint Center + Team Status */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* AI Bot + Escalation Flow */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
                        <Zap size={16} className="text-amber-700"/> Complaint & Escalation Flow
                    </h3>
                    <div className="space-y-3">
                        {/* Flow steps */}
                        {[
                            { icon: MessageSquare, label: 'Customer Submits Complaint', desc: 'Via app chat window', color: 'bg-blue-50 text-blue-600', status: 'Intake' },
                            { icon: Bot,           label: 'AI Bot Handles Query',       desc: 'FAQ & status checks', color: 'bg-violet-50 text-violet-600', status: 'Auto' },
                            { icon: UserCheck,     label: 'Human Agent Takes Over',    desc: 'If bot unresolved', color: 'bg-amber-50 text-amber-700', status: 'Escalate' },
                            { icon: Shield,        label: 'Admin Review & Resolution', desc: 'Complex & priority cases', color: 'bg-red-50 text-red-600', status: 'Final' },
                        ].map(({ icon: Icon, label, desc, color, status }, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}>
                                    <Icon size={16}/>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900">{label}</p>
                                    <p className="text-xs text-slate-400">{desc}</p>
                                </div>
                                <span className="text-xs font-bold text-slate-400 flex-shrink-0">{status}</span>
                                {i < 3 && (
                                    <div className="absolute ml-5 mt-10 text-slate-200">↓</div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                        {[
                            { label: 'Open',     value: metrics.openComplaints, color: 'text-red-600' },
                            { label: 'Bot Sent', value: metrics.botReplies, color: 'text-violet-600' },
                            { label: 'Threads',  value: new Set(complaints.map(c => c.user_id)).size, color: 'text-slate-900' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="bg-slate-50 rounded-2xl p-3 text-center">
                                <p className="text-xs text-slate-400">{label}</p>
                                <p className={`text-xl font-bold ${color}`}>{value}</p>
                            </div>
                        ))}
                    </div>
                    <Link to="/admin/complaints" className="mt-4 flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors w-full">
                        <MessageSquare size={15}/> Open Complaint Center
                    </Link>
                </div>

                {/* Unread Complaint Threads */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Bell size={16} className="text-red-500"/> Unread Threads
                        </h3>
                        <Link to="/admin/complaints" className="text-xs font-bold text-primary-600 hover:underline">
                            View all →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {openThreads.length === 0 && (
                            <div className="text-center py-8">
                                <CheckCircle size={32} className="mx-auto text-emerald-300 mb-2"/>
                                <p className="text-sm text-slate-400">All complaints are resolved!</p>
                            </div>
                        )}
                        {openThreads.map(thread => (
                            <Link key={thread.userId} to="/admin/complaints"
                                className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-bold text-primary-700">{(thread.role||'U')[0].toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                        <p className="text-xs font-bold text-slate-700 capitalize">{thread.role || 'User'}</p>
                                        {thread.unread > 0 && (
                                            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{thread.unread}</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">{thread.last}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Agent Team Status */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-slate-900">Agent Team Status</h3>
                    <Link to="/admin/agents" className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                        Manage agents <ArrowRight size={12}/>
                    </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {agents.slice(0, 12).map(agent => {
                        const agentInqs = inquiries.filter(i => i.agent_id === agent.id);
                        const active = agentInqs.filter(i => normalizeStatus(i.status) === 'in progress').length;
                        const pending = agentInqs.filter(i => normalizeStatus(i.status) === 'pending').length;
                        const isActive = ['accepted','active'].includes((agent.status||'').toLowerCase());
                        return (
                            <Link key={agent.id} to={`/admin/agents/${agent.id}`}
                                className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
                                <div className="relative flex-shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm">
                                        {(agent.name||'?')[0].toUpperCase()}
                                    </div>
                                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}/>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{agent.name}</p>
                                    <p className="text-xs text-slate-400 truncate">{agent.territory || 'No zone'}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-bold text-amber-700">{active} active</p>
                                    <p className="text-xs text-slate-400">{pending} pending</p>
                                </div>
                            </Link>
                        );
                    })}
                    {agents.length === 0 && (
                        <p className="col-span-3 text-sm text-slate-400 text-center py-6">No agents registered.</p>
                    )}
                </div>
            </div>

            {/* Maintenance Tracker */}
            {metrics.maintenanceInq.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Wrench size={16} className="text-slate-500"/> Maintenance Requests
                        </h3>
                        <span className="text-xs font-bold text-slate-400">{metrics.maintenanceInq.length} total</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {metrics.maintenanceInq.slice(0, 8).map(inq => (
                            <div key={inq.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                                <div className="p-2 rounded-xl bg-slate-200 flex-shrink-0">
                                    <Wrench size={14} className="text-slate-600"/>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{inq.inquiry_no || `#${inq.id?.toString().slice(-6)}`}</p>
                                    <p className="text-xs text-slate-400 truncate">{inq.customers?.business_name || '—'}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold flex-shrink-0 ${
                                    normalizeStatus(inq.status) === 'completed' ? 'bg-green-100 text-green-700' :
                                    normalizeStatus(inq.status) === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-amber-100 text-amber-700'
                                }`}>{inq.status||'Pending'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Operations;
