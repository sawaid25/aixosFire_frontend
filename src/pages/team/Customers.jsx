import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Phone, Mail, Eye } from 'lucide-react';
import { getTeamCustomers } from '../../api/team';
import { formatKsaDate } from '../../utils/dateTime';
import PageLoader from '../../components/PageLoader';
import useTeamData from './useTeamData';
import { TeamPageHeader, EmptyState, ErrorBanner } from './TeamUi';

const TeamCustomers = () => {
    const [search, setSearch] = useState('');
    const load = useCallback(() => getTeamCustomers(), []);
    const { data, loading, error } = useTeamData(load);

    const customers = useMemo(() => {
        const q = search.trim().toLowerCase();
        const rows = data || [];
        return q ? rows.filter((c) => `${c.business_name} ${c.owner_name} ${c.email} ${c.phone}`.toLowerCase().includes(q)) : rows;
    }, [data, search]);

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading customers..." />}
            <TeamPageHeader eyebrow="Customers" title="Customers" subtitle={data ? `${data.length} customer accounts` : 'Customer accounts'} />

            <div className="relative max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input className="input-field pl-11" placeholder="Search business, owner, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {error && <ErrorBanner message={error} />}

            {!loading && !error && customers.length === 0 ? (
                <EmptyState icon={Users} title="No customers found" message={search ? 'Try a different search.' : 'There are no customers yet.'} />
            ) : (
                <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left">
                                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="px-5 py-3">Business</th>
                                    <th className="px-5 py-3">Contact</th>
                                    <th className="px-5 py-3">Type</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Joined</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {customers.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-50/60">
                                        <td className="px-5 py-3">
                                            <p className="font-bold text-slate-900">{c.business_name || '—'}</p>
                                            <p className="text-xs text-slate-500">{c.owner_name}</p>
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">
                                            {c.email && <p className="flex items-center gap-1.5"><Mail size={13} className="text-slate-400" />{c.email}</p>}
                                            {c.phone && <p className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" />{c.phone}</p>}
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">{c.business_type || '—'}</td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${c.status === 'Lead' ? 'bg-amber-100 text-amber-700' : c.status === 'Inactive' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}`}>{c.status || 'Active'}</span>
                                        </td>
                                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{formatKsaDate(c.created_at)}</td>
                                        <td className="px-5 py-3 text-right">
                                            <Link to={`/team/customers/${c.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700">
                                                <Eye size={14} /> View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamCustomers;
