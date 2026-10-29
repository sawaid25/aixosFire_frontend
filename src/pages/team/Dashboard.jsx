import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTeamSummary } from '../../api/team';
import { permittedTeamModules, TEAM_ACTION_LABELS } from '../../constants/teamPermissions';
import StatCard from '../../components/admin/StatCard';
import PageLoader from '../../components/PageLoader';
import useTeamData from './useTeamData';
import { TeamPageHeader, EmptyState, ErrorBanner } from './TeamUi';

const MODULE_COLORS = {
    agents: 'bg-primary-500',
    customers: 'bg-blue-500',
    partners: 'bg-indigo-500',
    products: 'bg-emerald-500',
    inquiries: 'bg-amber-500',
    complaints: 'bg-orange-500',
};

/** Headline number + sub line for a module's summary block. */
const statFor = (key, s) => {
    if (!s) return { value: '—' };
    switch (key) {
        case 'agents': return { value: s.total, subtext: `${s.pending} pending approval` };
        case 'inquiries': return { value: s.total, subtext: `${s.open} open` };
        case 'complaints': return { value: s.threads, subtext: `${s.unread} unread message${s.unread === 1 ? '' : 's'}` };
        default: return { value: s.total };
    }
};

const TeamDashboard = () => {
    const { user } = useAuth();
    const modules = permittedTeamModules(user);
    const load = useCallback(() => getTeamSummary(), []);
    const { data: summary, loading, error } = useTeamData(load);

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading your dashboard..." />}
            <TeamPageHeader
                eyebrow="Dashboard"
                title={`Welcome, ${user?.name || 'team member'}`}
                subtitle={user?.designation ? `${user.designation} — your pages are listed below.` : 'Your pages are listed below.'}
            />

            {error && <ErrorBanner message={error} />}

            {modules.length === 0 ? (
                <EmptyState icon={Lock} title="No pages assigned yet" message="An Admin hasn't given you access to any pages. Contact them to get started." />
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {modules.map((m) => {
                            const { value, subtext } = statFor(m.key, summary?.[m.key]);
                            return (
                                <Link key={m.key} to={m.to} className="block">
                                    <StatCard icon={m.icon} title={m.label} value={value} subtext={subtext} color={MODULE_COLORS[m.key]} />
                                </Link>
                            );
                        })}
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Your access</h2>
                        <div className="divide-y divide-slate-100">
                            {modules.map((m) => (
                                <Link key={m.key} to={m.to} className="flex items-center justify-between gap-4 py-3 group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <m.icon size={18} className="text-slate-400 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900">{m.label}</p>
                                            <p className="text-xs text-slate-500 truncate">{m.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {(user.permissions[m.key] || []).map((a) => (
                                            <span key={a} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold">{TEAM_ACTION_LABELS[a] || a}</span>
                                        ))}
                                        <ArrowRight size={16} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TeamDashboard;
