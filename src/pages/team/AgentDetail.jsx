import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, MapPin, ClipboardList, Activity } from 'lucide-react';
import { getTeamAgent } from '../../api/team';
import { formatKsaDate, formatKsaDateTime } from '../../utils/dateTime';
import AgentAvatar from '../../components/AgentAvatar';
import InquiryStatusBadge from '../../components/InquiryStatusBadge';
import StatCard from '../../components/admin/StatCard';
import PageLoader from '../../components/PageLoader';
import useTeamData from './useTeamData';
import { TeamPageHeader, ErrorBanner, InfoTile } from './TeamUi';
import { normalizeAgentStatus, AGENT_BADGE } from './agentStatusUi';

const TeamAgentDetail = () => {
    const { id } = useParams();
    const load = useCallback(() => getTeamAgent(id), [id]);
    const { data: agent, loading, error } = useTeamData(load);
    const [label, badge] = AGENT_BADGE[normalizeAgentStatus(agent?.status)];

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading agent..." />}
            <TeamPageHeader eyebrow="Agents" title={agent?.name || 'Agent'} subtitle={agent?.email} back="/team/agents" />
            {error && <ErrorBanner message={error} />}

            {agent && (
                <>
                    <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 flex flex-col md:flex-row gap-6">
                        <div className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                            <AgentAvatar src={agent.profile_photo} alt={agent.name} iconSize={32} />
                        </div>
                        <div className="flex-1 space-y-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${badge}`}>{label}</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <InfoTile label="Phone" value={agent.phone || 'N/A'} />
                                <InfoTile label="Territory" value={agent.territory || 'Unassigned'} />
                                <InfoTile label="Joined" value={formatKsaDate(agent.created_at)} />
                                <InfoTile label="Last active" value={agent.last_active ? formatKsaDateTime(agent.last_active) : 'Never'} />
                            </div>
                            {agent.residential_letter && (
                                <a href={agent.residential_letter} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors">
                                    <FileText size={14} /> View Residential Letter
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <StatCard icon={MapPin} title="Visits logged" value={agent.stats.visits} color="bg-blue-500" />
                        <StatCard icon={ClipboardList} title="Inquiries" value={agent.stats.inquiries} color="bg-amber-500" />
                        <StatCard icon={Activity} title="Open inquiries" value={agent.stats.open_inquiries} color="bg-primary-500" />
                    </div>

                    {Object.keys(agent.stats.inquiries_by_status).length > 0 && (
                        <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100">
                            <h2 className="text-lg font-bold text-slate-900 mb-4">Inquiries by status</h2>
                            <div className="flex flex-wrap gap-3">
                                {Object.entries(agent.stats.inquiries_by_status).map(([status, n]) => (
                                    <div key={status} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                                        <InquiryStatusBadge status={status} />
                                        <span className="text-sm font-bold text-slate-900">{n}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TeamAgentDetail;
