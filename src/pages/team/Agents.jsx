import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, X, Pause, Eye, Phone, MapPin, Shield, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTeamAgents, updateTeamAgentStatus, teamErrorMessage } from '../../api/team';
import { hasTeamPermission } from '../../constants/teamPermissions';
import { AGENT_STATUS } from '../../constants/agentApprovalStatus';
import AgentAvatar from '../../components/AgentAvatar';
import PageLoader from '../../components/PageLoader';
import useTeamData from './useTeamData';
import { TeamPageHeader, EmptyState, ErrorBanner, FilterTabs } from './TeamUi';
import { normalizeAgentStatus, AGENT_BADGE } from './agentStatusUi';

const TABS = [
    { value: AGENT_STATUS.PENDING, label: 'Pending' },
    { value: AGENT_STATUS.ACCEPTED, label: 'Active' },
    { value: AGENT_STATUS.REJECTED, label: 'Rejected' },
    { value: AGENT_STATUS.HOLD, label: 'Hold' },
];

const CONFIRM = {
    [AGENT_STATUS.HOLD]: 'Are you sure you want to HOLD this agent?',
    [AGENT_STATUS.REJECTED]: 'Are you sure you want to reject this agent?',
};

const TeamAgents = () => {
    const { user } = useAuth();
    const canEdit = hasTeamPermission(user, 'agents', 'edit');
    const [tab, setTab] = useState(AGENT_STATUS.PENDING);
    const [search, setSearch] = useState('');
    const load = useCallback(() => getTeamAgents(tab), [tab]);
    const { data, loading, error, reload } = useTeamData(load);

    const agents = useMemo(() => {
        const q = search.trim().toLowerCase();
        const rows = data || [];
        return q ? rows.filter((a) => `${a.name} ${a.email} ${a.territory}`.toLowerCase().includes(q)) : rows;
    }, [data, search]);

    const changeStatus = async (agent, next) => {
        if (CONFIRM[next] && !window.confirm(CONFIRM[next])) return;
        try {
            const result = await updateTeamAgentStatus(agent.id, next);
            const routed = result?.routed_to_admin || [];
            toast.success(routed.length
                ? `${agent.name} updated. ${routed.length} open ${routed.length === 1 ? 'inquiry was' : 'inquiries were'} sent to Admin for reassignment.`
                : `${agent.name} updated.`);
            reload();
        } catch (err) {
            toast.error(teamErrorMessage(err, 'Failed to update agent.'));
        }
    };

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading agents..." />}
            <TeamPageHeader eyebrow="Agents" title="Agents" subtitle={canEdit ? 'Review agents and manage their status.' : 'Review agents and their activity.'}>
                <FilterTabs tabs={TABS} value={tab} onChange={setTab} />
            </TeamPageHeader>

            <div className="relative max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input className="input-field pl-11" placeholder="Search name, email or territory" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {error && <ErrorBanner message={error} />}

            {!loading && !error && agents.length === 0 ? (
                <EmptyState icon={Shield} title={`No ${TABS.find((t) => t.value === tab)?.label} Agents`} message="There are currently no agents in this category." />
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {agents.map((agent) => {
                        const status = normalizeAgentStatus(agent.status);
                        const [label, badge] = AGENT_BADGE[status];
                        return (
                            <div key={agent.id} className="bg-white rounded-3xl p-5 shadow-soft border border-slate-100 flex flex-col md:flex-row gap-5 md:items-center">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                                    <AgentAvatar src={agent.profile_photo} alt={agent.name} iconSize={24} />
                                </div>
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="text-lg font-bold text-slate-900 truncate">{agent.name}</h3>
                                            <p className="text-sm text-slate-500 truncate">{agent.email}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${badge}`}>{label}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                                        <span className="flex items-center gap-2"><Phone size={15} className="text-slate-400" />{agent.phone || 'N/A'}</span>
                                        <span className="flex items-center gap-2"><MapPin size={15} className="text-slate-400" />{agent.territory || 'Unassigned'}</span>
                                    </div>
                                </div>
                                <div className="flex flex-row flex-wrap md:flex-col gap-2 md:w-40">
                                    <Link to={`/team/agents/${agent.id}`} className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all">
                                        <Eye size={15} /> View Details
                                    </Link>
                                    {canEdit && status !== AGENT_STATUS.ACCEPTED && (
                                        <button type="button" onClick={() => changeStatus(agent, AGENT_STATUS.ACCEPTED)} className="btn-primary py-2 px-4 shadow-none bg-green-600 hover:bg-green-700 text-sm flex items-center justify-center gap-2">
                                            <Check size={16} /> Accept
                                        </button>
                                    )}
                                    {canEdit && status !== AGENT_STATUS.REJECTED && (
                                        <button type="button" onClick={() => changeStatus(agent, AGENT_STATUS.REJECTED)} className="py-2 px-4 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-xl text-slate-600 font-medium text-sm flex items-center justify-center gap-2 transition-all">
                                            <X size={16} /> Reject
                                        </button>
                                    )}
                                    {canEdit && status !== AGENT_STATUS.HOLD && (
                                        <button type="button" onClick={() => changeStatus(agent, AGENT_STATUS.HOLD)} className="py-2 px-4 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all">
                                            <Pause size={16} /> Hold
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TeamAgents;
