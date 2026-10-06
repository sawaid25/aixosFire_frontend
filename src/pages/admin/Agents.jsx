import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Link } from 'react-router-dom';
import { Check, X, User, Phone, MapPin, FileText, Shield, Pause, Eye, MessageSquare, BarChart2 } from 'lucide-react';
import PageLoader from '../../components/PageLoader';
import { AGENT_STATUS } from '../../constants/agentApprovalStatus';
import { updateAgentStatus } from '../../api/admin';

const TABS = [
    { value: AGENT_STATUS.PENDING, label: 'Pending' },
    { value: AGENT_STATUS.ACCEPTED, label: 'Active' },
    { value: AGENT_STATUS.REJECTED, label: 'Rejected' },
    { value: AGENT_STATUS.HOLD, label: 'Hold' },
];

function normalizeStatus(raw) {
    const s = (raw || '').toLowerCase();
    if (s === 'active') return AGENT_STATUS.ACCEPTED;
    if (s === 'suspended') return AGENT_STATUS.REJECTED;
    if (Object.values(AGENT_STATUS).includes(s)) return s;
    return AGENT_STATUS.PENDING;
}

function statusBadgeClasses(status) {
    const s = normalizeStatus(status);
    if (s === AGENT_STATUS.ACCEPTED) return 'bg-green-100 text-green-700';
    if (s === AGENT_STATUS.REJECTED) return 'bg-red-100 text-red-700';
    if (s === AGENT_STATUS.HOLD) return 'bg-yellow-100 text-yellow-800';
    return 'bg-slate-100 text-slate-600';
}

function statusLabel(status) {
    const s = normalizeStatus(status);
    if (s === AGENT_STATUS.ACCEPTED) return 'Accepted';
    if (s === AGENT_STATUS.REJECTED) return 'Rejected';
    if (s === AGENT_STATUS.HOLD) return 'Hold';
    if (s === AGENT_STATUS.PENDING) return 'Pending';
    return status || 'Unknown';
}

const AgentManagement = () => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(AGENT_STATUS.PENDING);

    const fetchAgents = useCallback(async () => {
        setLoading(true);
        try {
            const LEGACY_MAP = {
                [AGENT_STATUS.ACCEPTED]: 'active',
                [AGENT_STATUS.REJECTED]: 'suspended',
            };
            const legacy = LEGACY_MAP[activeTab];
            let query = supabase.from('agents').select('*');

            if (legacy) {
                query = query.or(`status.ilike.${activeTab},status.ilike.${legacy}`);
            } else {
                query = query.ilike('status', activeTab);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            console.log('fetchAgents tab:', activeTab, 'data:', data, 'error:', error);
            if (error) throw error;
            setAgents(data || []);
        } catch (err) {
            console.error('fetchAgents error:', err);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchAgents();
    }, [fetchAgents]);

    /**
     * PATCH /admin/agents/:id/status — the backend also routes an Agent's open
     * inquiries to Admin when they stop being active (hold / rejected).
     */
    const setAgentStatus = async (id, nextStatus, { confirmReject = true } = {}) => {
        if (nextStatus === AGENT_STATUS.HOLD) {
            if (!window.confirm('Are you sure you want to HOLD this agent?')) return;
        } else if (nextStatus === AGENT_STATUS.REJECTED && confirmReject) {
            if (!window.confirm('Are you sure you want to reject this agent?')) return;
        }

        try {
            const result = await updateAgentStatus(id, nextStatus);
            const routed = result?.routed_to_admin || [];
            if (routed.length > 0) {
                alert(`${routed.length} open ${routed.length === 1 ? 'inquiry was' : 'inquiries were'} sent to Admin for reassignment (Inquiries → Needs Agent).`);
            }
            await fetchAgents();
        } catch (err) {
            console.error('setAgentStatus', err);
            alert(`Failed to update agent: ${err?.response?.data?.error || err.message || err}`);
        }
    };

    const getImageUrl = (filename) => {
        return filename;
    };

    const tabLabel = (value) => TABS.find((t) => t.value === value)?.label ?? value;

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading agents..." />}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin · Management</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Agent Management</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Approve applications, manage agents & review performance.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/admin/analytics" className="btn-outline text-sm py-2 px-4 flex items-center gap-2">
                        <BarChart2 size={15}/> Performance
                    </Link>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex-wrap gap-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.value}
                                type="button"
                                onClick={() => setActiveTab(tab.value)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.value ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {!loading && agents.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
                    <Shield size={48} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-xl font-bold text-slate-900">No {tabLabel(activeTab)} Agents</h3>
                    <p className="text-slate-500">There are currently no agents in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {agents.map((agent) => (
                        <div key={agent.id} className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 flex flex-col md:flex-row gap-6 items-start animate-fade-in group hover:shadow-lg transition-all">
                            <div className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                                {agent.profile_photo ? (
                                    <img src={getImageUrl(agent.profile_photo)} alt={agent.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                        <User size={32} />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">{agent.name}</h3>
                                        <p className="text-sm text-slate-500">{agent.email}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadgeClasses(agent.status)}`}>
                                        {statusLabel(agent.status)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <Phone size={16} className="text-slate-400" />
                                        {agent.phone || 'N/A'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin size={16} className="text-slate-400" />
                                        {agent.territory || 'Unassigned'}
                                    </div>
                                    {agent.residential_letter ? (
                                        <div className="flex items-center gap-2 mt-2">
                                            <a
                                                href={getImageUrl(agent.residential_letter)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                <FileText size={14} /> View Residential Letter
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-slate-500 mt-2">Residential Letter: N/A</div>
                                    )}
                                </div>
                            </div>

                            {(() => {
                                const norm = normalizeStatus(agent.status);
                                const showAccept = norm !== AGENT_STATUS.ACCEPTED;
                                const showReject = norm !== AGENT_STATUS.REJECTED;
                                const showHold = norm !== AGENT_STATUS.HOLD;
                                return (
                                    <div className="flex flex-row flex-wrap md:flex-col gap-2 w-full md:w-auto mt-4 md:mt-0">
                                        <Link
                                            to={`/admin/agents/${agent.id}`}
                                            className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all"
                                        >
                                            <Eye size={15} /> View Details
                                        </Link>
                                        {showAccept && (
                                            <button
                                                type="button"
                                                onClick={() => setAgentStatus(agent.id, AGENT_STATUS.ACCEPTED, { confirmReject: false })}
                                                className="btn-primary py-2 px-4 shadow-none bg-green-500 hover:bg-green-600 text-sm flex items-center justify-center gap-2"
                                            >
                                                <Check size={16} /> Accept
                                            </button>
                                        )}
                                        {showReject && (
                                            <button
                                                type="button"
                                                onClick={() => setAgentStatus(agent.id, AGENT_STATUS.REJECTED)}
                                                className="py-2 px-4 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-xl text-slate-600 font-medium text-sm flex items-center justify-center gap-2 transition-all"
                                            >
                                                <X size={16} /> Reject
                                            </button>
                                        )}
                                        {showHold && (
                                            <button
                                                type="button"
                                                onClick={() => setAgentStatus(agent.id, AGENT_STATUS.HOLD, { confirmReject: false })}
                                                className="py-2 px-4 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all"
                                            >
                                                <Pause size={16} /> Hold
                                            </button>
                                        )}
                                        <Link
                                            to={`/admin/agents/${agent.id}?tab=complaints`}
                                            className="py-2 px-4 border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all"
                                        >
                                            <MessageSquare size={15} /> Complaint & Query
                                        </Link>
                                    </div>
                                );
                            })()}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AgentManagement;
