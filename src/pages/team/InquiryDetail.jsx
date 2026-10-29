import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTeamInquiry, assignTeamInquiryAgent, teamErrorMessage } from '../../api/team';
import { hasTeamPermission } from '../../constants/teamPermissions';
import { formatKsaDate, formatKsaDateTime } from '../../utils/dateTime';
import InquiryStatusBadge from '../../components/InquiryStatusBadge';
import PageLoader from '../../components/PageLoader';
import useTeamData from './useTeamData';
import { TeamPageHeader, ErrorBanner, InfoTile } from './TeamUi';
import { needsAgent } from './inquiryUi';

const eventLabel = (type) => String(type || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const TeamInquiryDetail = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const canAssign = hasTeamPermission(user, 'inquiries', 'assign');
    const load = useCallback(() => getTeamInquiry(id), [id]);
    const { data: inquiry, loading, error, reload } = useTeamData(load);
    const [agentId, setAgentId] = useState('');
    const [assigning, setAssigning] = useState(false);

    const assign = async () => {
        if (!agentId) return;
        setAssigning(true);
        try {
            await assignTeamInquiryAgent(id, agentId);
            toast.success('Agent assigned.');
            setAgentId('');
            reload();
        } catch (err) {
            toast.error(teamErrorMessage(err, 'Failed to assign agent.'));
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading inquiry..." />}
            <TeamPageHeader eyebrow="Inquiries" title={inquiry?.inquiry_no || 'Inquiry'} subtitle={inquiry ? `${inquiry.type}${inquiry.is_general_inquiry ? ' · General Inquiry' : ''}` : ''} back="/team/inquiries">
                {inquiry && <InquiryStatusBadge status={inquiry.status} className="text-sm" />}
            </TeamPageHeader>
            {error && <ErrorBanner message={error} />}

            {inquiry && (
                <>
                    <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <InfoTile label="Customer" value={inquiry.customers?.business_name || '—'} />
                        <InfoTile label="Agent" value={inquiry.agents?.name || 'Unassigned'} />
                        <InfoTile label="Partner" value={inquiry.partners?.business_name || 'Unassigned'} />
                        <InfoTile label="Created by" value={inquiry.performed_by || '—'} />
                        <InfoTile label="Created" value={formatKsaDateTime(inquiry.created_at)} />
                        <InfoTile label="Priority" value={inquiry.priority || '—'} />
                        <InfoTile label="Scheduled" value={inquiry.scheduled_date ? formatKsaDate(inquiry.scheduled_date) : '—'} />
                        <InfoTile label="Follow-up" value={inquiry.follow_up_date ? formatKsaDate(inquiry.follow_up_date) : '—'} />
                        {inquiry.notes && <div className="sm:col-span-2 lg:col-span-4"><InfoTile label="Notes" value={inquiry.notes} /></div>}
                        {inquiry.rejection_reason && <div className="sm:col-span-2 lg:col-span-4"><InfoTile label="Rejection reason" value={inquiry.rejection_reason} /></div>}
                    </div>

                    {canAssign && needsAgent(inquiry) && (
                        <div className="bg-orange-50 border border-orange-200 rounded-3xl p-6 space-y-3">
                            <div className="flex items-center gap-2">
                                <UserPlus size={18} className="text-orange-700" />
                                <h2 className="text-base font-bold text-slate-900">This inquiry needs an Agent</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <select className="input-field sm:max-w-xs" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                                    <option value="">Select an active agent</option>
                                    {(inquiry.assignable_agents || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                <button type="button" onClick={assign} disabled={!agentId || assigning} className="btn-secondary py-2.5 disabled:opacity-50">
                                    {assigning ? 'Assigning...' : 'Assign Agent'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                        <h2 className="text-lg font-bold text-slate-900 p-6 pb-3">Items ({inquiry.items.length})</h2>
                        {inquiry.items.length === 0 ? (
                            <p className="px-6 pb-6 text-sm text-slate-500">No items on this inquiry.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-left">
                                        <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="px-5 py-3">Item</th>
                                            <th className="px-5 py-3">CAT#</th>
                                            <th className="px-5 py-3">Capacity</th>
                                            <th className="px-5 py-3">Qty</th>
                                            <th className="px-5 py-3">Expiry</th>
                                            <th className="px-5 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {inquiry.items.map((it) => (
                                            <tr key={it.id}>
                                                <td className="px-5 py-3">
                                                    <p className="font-bold text-slate-900">{it.products?.name || it.type || it.system_type || it.system || 'Item'}</p>
                                                    <p className="text-xs text-slate-500">{[it.brand, it.serial_no && `S/N ${it.serial_no}`].filter(Boolean).join(' · ')}</p>
                                                </td>
                                                <td className="px-5 py-3 text-slate-600">{it.catalog_no || '—'}</td>
                                                <td className="px-5 py-3 text-slate-600">{it.capacity ? `${it.capacity}${it.unit ? ` ${it.unit}` : ''}` : '—'}</td>
                                                <td className="px-5 py-3 text-slate-600">{it.quantity ?? '—'}</td>
                                                <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{it.expiry_date ? formatKsaDate(it.expiry_date) : '—'}</td>
                                                <td className="px-5 py-3">{it.status ? <InquiryStatusBadge status={it.status} /> : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {inquiry.events.length > 0 && (
                        <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100">
                            <h2 className="text-lg font-bold text-slate-900 mb-4">Timeline</h2>
                            <ol className="space-y-3 border-l-2 border-slate-100 pl-5">
                                {inquiry.events.map((ev) => (
                                    <li key={ev.id} className="relative">
                                        <span className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-primary-500 border-2 border-white" />
                                        <p className="text-sm font-bold text-slate-900">
                                            {eventLabel(ev.event_type)}
                                            {ev.to_status && <span className="font-normal text-slate-500"> → {ev.to_status}</span>}
                                        </p>
                                        <p className="text-xs text-slate-500">{formatKsaDateTime(ev.created_at)}{ev.actor_role ? ` · ${ev.actor_role.replace(/_/g, ' ')}` : ''}</p>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TeamInquiryDetail;
