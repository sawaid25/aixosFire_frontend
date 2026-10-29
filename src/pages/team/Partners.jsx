import React, { useCallback, useMemo, useState } from 'react';
import { Handshake, Search, Phone, Mail, MapPin } from 'lucide-react';
import { getTeamPartners } from '../../api/team';
import PageLoader from '../../components/PageLoader';
import useTeamData from './useTeamData';
import { TeamPageHeader, EmptyState, ErrorBanner } from './TeamUi';

const TeamPartners = () => {
    const [search, setSearch] = useState('');
    const load = useCallback(() => getTeamPartners(), []);
    const { data, loading, error } = useTeamData(load);

    const partners = useMemo(() => {
        const q = search.trim().toLowerCase();
        const rows = data || [];
        return q ? rows.filter((p) => `${p.business_name} ${p.owner_name} ${p.email}`.toLowerCase().includes(q)) : rows;
    }, [data, search]);

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading partners..." />}
            <TeamPageHeader eyebrow="Partners" title="Partners" subtitle="Service partners and their inquiry workload." />

            <div className="relative max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input className="input-field pl-11" placeholder="Search business, owner or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {error && <ErrorBanner message={error} />}

            {!loading && !error && partners.length === 0 ? (
                <EmptyState icon={Handshake} title="No partners found" message={search ? 'Try a different search.' : 'There are no partners yet.'} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {partners.map((p) => (
                        <div key={p.id} className="bg-white rounded-3xl p-5 shadow-soft border border-slate-100 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    {/* partners has no `name` column — business_name / owner_name. */}
                                    <h3 className="text-lg font-bold text-slate-900 truncate">{p.business_name || 'Partner'}</h3>
                                    <p className="text-sm text-slate-500 truncate">{p.owner_name}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${p.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{p.status || '—'}</span>
                            </div>
                            <div className="space-y-1 text-sm text-slate-600">
                                {p.email && <p className="flex items-center gap-2"><Mail size={14} className="text-slate-400" />{p.email}</p>}
                                {p.phone && <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400" />{p.phone}</p>}
                                {p.address && <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" />{p.address}</p>}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                {[['Inquiries', p.stats.inquiries], ['Open', p.stats.open], ['Completed', p.stats.completed]].map(([label, n]) => (
                                    <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl py-2">
                                        <p className="text-lg font-bold text-slate-900">{n}</p>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TeamPartners;
