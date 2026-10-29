import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTeamInquiries } from '../../api/team';
import { normalizeInquiryStatus, inquiryStatusMeta } from '../../constants/inquiryStatus';
import { formatKsaDate } from '../../utils/dateTime';
import InquiryStatusBadge from '../../components/InquiryStatusBadge';
import PageLoader from '../../components/PageLoader';
import useTeamData from './useTeamData';
import { TeamPageHeader, EmptyState, ErrorBanner } from './TeamUi';
import { needsAgent } from './inquiryUi';

const PAGE_SIZE = 25;
const ALL = 'All';

const TeamInquiries = () => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState(ALL);
    const [type, setType] = useState(ALL);
    const [needsAgentOnly, setNeedsAgentOnly] = useState(false);
    const [page, setPage] = useState(0);
    const load = useCallback(() => getTeamInquiries(), []);
    const { data, loading, error } = useTeamData(load);

    const rows = useMemo(() => data || [], [data]);
    const statuses = useMemo(() => [...new Set(rows.map((r) => normalizeInquiryStatus(r.status)).filter(Boolean))].sort(), [rows]);
    const types = useMemo(() => [...new Set(rows.map((r) => r.type).filter(Boolean))].sort(), [rows]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) =>
            (status === ALL || normalizeInquiryStatus(r.status) === status)
            && (type === ALL || r.type === type)
            && (!needsAgentOnly || needsAgent(r))
            && (!q || `${r.inquiry_no} ${r.customers?.business_name} ${r.partners?.business_name}`.toLowerCase().includes(q)));
    }, [rows, search, status, type, needsAgentOnly]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pageCount - 1);
    const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
    const setFilter = (setter) => (e) => { setter(e.target.value); setPage(0); };

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading inquiries..." />}
            <TeamPageHeader eyebrow="Inquiries" title="Inquiries" subtitle={`${filtered.length} of ${rows.length} inquiries`} />

            <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div className="relative flex-1 max-w-md">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input className="input-field pl-11" placeholder="Search inquiry no, customer or partner" value={search} onChange={setFilter(setSearch)} />
                </div>
                <select className="input-field md:w-44" value={status} onChange={setFilter(setStatus)}>
                    <option value={ALL}>All statuses</option>
                    {statuses.map((s) => <option key={s} value={s}>{inquiryStatusMeta(s).label}</option>)}
                </select>
                <select className="input-field md:w-44" value={type} onChange={setFilter(setType)}>
                    <option value={ALL}>All types</option>
                    {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 whitespace-nowrap">
                    <input type="checkbox" checked={needsAgentOnly} onChange={(e) => { setNeedsAgentOnly(e.target.checked); setPage(0); }} className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                    Needs Agent
                </label>
            </div>

            {error && <ErrorBanner message={error} />}

            {!loading && !error && filtered.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No inquiries found" message="Try different filters." />
            ) : (
                <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left">
                                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="px-5 py-3">Inquiry</th>
                                    <th className="px-5 py-3">Customer</th>
                                    <th className="px-5 py-3">Agent</th>
                                    <th className="px-5 py-3">Partner</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {visible.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/60">
                                        <td className="px-5 py-3">
                                            <Link to={`/team/inquiries/${r.id}`} className="font-bold text-slate-900 hover:text-primary-600">{r.inquiry_no || 'Inquiry'}</Link>
                                            <p className="text-xs text-slate-500">{r.type}{r.is_general_inquiry ? ' · General' : ''}</p>
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">{r.customers?.business_name || '—'}</td>
                                        <td className="px-5 py-3 text-slate-600">
                                            {r.agents?.name || '—'}
                                            {needsAgent(r) && <span className="ml-2 px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[11px] font-bold">Needs Agent</span>}
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">{r.partners?.business_name || '—'}</td>
                                        <td className="px-5 py-3"><InquiryStatusBadge status={r.status} /></td>
                                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{formatKsaDate(r.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {pageCount > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
                            <span>Page {current + 1} of {pageCount}</span>
                            <div className="flex gap-2">
                                <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50" aria-label="Previous page"><ChevronLeft size={16} /></button>
                                <button type="button" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50" aria-label="Next page"><ChevronRight size={16} /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TeamInquiries;
