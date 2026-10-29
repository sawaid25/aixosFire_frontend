import React, { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClipboardList, FireExtinguisher } from 'lucide-react';
import { getTeamCustomer } from '../../api/team';
import { formatKsaDate } from '../../utils/dateTime';
import InquiryStatusBadge from '../../components/InquiryStatusBadge';
import StatCard from '../../components/admin/StatCard';
import PageLoader from '../../components/PageLoader';
import useTeamData from './useTeamData';
import { TeamPageHeader, ErrorBanner, InfoTile } from './TeamUi';

const TeamCustomerDetail = () => {
    const { id } = useParams();
    const load = useCallback(() => getTeamCustomer(id), [id]);
    const { data: customer, loading, error } = useTeamData(load);

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading customer..." />}
            <TeamPageHeader eyebrow="Customers" title={customer?.business_name || 'Customer'} subtitle={customer?.owner_name} back="/team/customers" />
            {error && <ErrorBanner message={error} />}

            {customer && (
                <>
                    <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <InfoTile label="Email" value={customer.email || 'N/A'} />
                        <InfoTile label="Phone" value={customer.phone || 'N/A'} />
                        <InfoTile label="Business type" value={customer.business_type} />
                        <InfoTile label="Address" value={customer.address || 'N/A'} />
                        <InfoTile label="Status" value={customer.status || 'Active'} />
                        <InfoTile label="Joined" value={formatKsaDate(customer.created_at)} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <StatCard icon={ClipboardList} title="Inquiries" value={customer.stats.inquiries} color="bg-amber-500" />
                        <StatCard icon={FireExtinguisher} title="Units on record" value={customer.stats.units} color="bg-primary-500" />
                    </div>

                    {/* Present only when the member can also open Inquiries (backend decides). */}
                    {Array.isArray(customer.inquiries) && (
                        <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                            <h2 className="text-lg font-bold text-slate-900 p-6 pb-3">Inquiries</h2>
                            {customer.inquiries.length === 0 ? (
                                <p className="px-6 pb-6 text-sm text-slate-500">No inquiries yet.</p>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {customer.inquiries.map((inq) => (
                                        <Link key={inq.id} to={`/team/inquiries/${inq.id}`} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-slate-50">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{inq.inquiry_no || inq.id}</p>
                                                <p className="text-xs text-slate-500">{inq.type} · {formatKsaDate(inq.created_at)}</p>
                                            </div>
                                            <InquiryStatusBadge status={inq.status} />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TeamCustomerDetail;
