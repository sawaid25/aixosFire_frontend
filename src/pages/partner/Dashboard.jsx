import React, { useState, useEffect } from 'react';
import {
    Layout, Clock,
    DollarSign, Users, Filter, ChevronRight, ChevronDown,
    CheckCircle2, Tag, Inbox, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPartnerDashboard, getPartnerStats, getInquiries } from '../../api/partners';
import { repairValidationInquiryStatuses } from '../../api/inquirySupabase';
import { useAuth } from '../../context/AuthContext';
import { fetchPartnerStickerSummary, repairMissingStickerRecords } from '../../api/partnerStickers';

const CLOSED_LIKE_STATUSES = new Set([
    'accepted', 'closed', 'completed', 'approved', 'inquiry closed'
]);

// Validation inquiries are always treated as completed regardless of stored status
const resolveStatus = (inq) => {
    const type = (inq.type || inq.inquiry_type || '').toString().trim().toLowerCase();
    if (type === 'validation') return 'completed';
    return (inq.status ?? '').toString().trim().toLowerCase() || 'pending';
};

const countClosedLikeInquiries = (inquiries) => {
    if (!Array.isArray(inquiries)) return 0;
    return inquiries.filter((inq) => CLOSED_LIKE_STATUSES.has(resolveStatus(inq))).length;
};

// `to` marks a card as actually navigable — only those get the chevron/hover-link
// affordance, so the UI never promises a click that goes nowhere.
const StatCard = ({ icon: Icon, title, value, color, subtitle, to }) => {
    const isLink = Boolean(to);

    const card = (
        <div
            className={`h-full flex flex-col bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-soft transition-all duration-300 group relative overflow-hidden ${isLink ? 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer' : 'hover:shadow-md'
                }`}
        >
            <div
                className={`absolute top-0 right-0 w-28 h-28 ${color} opacity-[0.05] -mr-6 -mt-6 rounded-full transition-transform duration-300 ${isLink ? 'group-hover:scale-125' : ''
                    }`}
            />
            <div className="flex items-start justify-between mb-5 relative z-10">
                <div className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-2xl ${color} shadow-sm transition-transform duration-300 ${isLink ? 'group-hover:scale-105' : ''}`}>
                    <Icon size={20} className="text-white" />
                </div>
                {isLink && (
                    <ChevronRight
                        size={16}
                        className="text-slate-300 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all mt-1.5"
                    />
                )}
            </div>
            <div className="relative z-10 mt-auto">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{title}</p>
                <h3 className="text-2xl sm:text-3xl font-display font-black text-slate-900 tracking-tight leading-none">{value}</h3>
                {subtitle && <p className="text-[11px] font-semibold text-slate-400 mt-2 leading-tight">{subtitle}</p>}
            </div>
        </div>
    );

    if (!isLink) return card;

    return (
        <Link
            to={to}
            className="block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
            {card}
        </Link>
    );
};

const StatCardSkeleton = () => (
    <div className="h-full bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-soft animate-pulse">
        <div className="flex items-start justify-between mb-5">
            <div className="w-11 h-11 rounded-2xl bg-slate-100" />
        </div>
        <div className="h-2.5 w-16 bg-slate-100 rounded-full mb-3" />
        <div className="h-7 w-20 bg-slate-200 rounded-lg mb-3" />
        <div className="h-2 w-24 bg-slate-100 rounded-full" />
    </div>
);

const InquiryCard = ({ inq }) => (
    <Link
        to={`/partner/inquiry/${inq.id}`}
        className="block bg-white rounded-3xl border border-slate-100 p-6 hover:shadow-md transition-all active:scale-[0.985]"
    >
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="font-black text-primary-600 text-lg tracking-tight">{inq.inquiry_no}</p>
                <p className="text-sm text-slate-600 mt-1 line-clamp-1">{inq.customers?.business_name || 'Generic Client'}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${['active', 'completed', 'accepted'].includes(resolveStatus(inq))
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                {resolveStatus(inq) || 'Pending'}
            </span>
        </div>

        <div className="flex items-center justify-between text-sm">
            <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-widest ${(inq.type || inq.inquiry_type) === 'Validation' ? 'bg-blue-50 text-blue-600' :
                    (inq.type || inq.inquiry_type) === 'Refilled' ? 'bg-purple-50 text-purple-600' :
                        (inq.type || inq.inquiry_type) === 'New Unit' ? 'bg-amber-50 text-amber-600' :
                            'bg-emerald-50 text-emerald-600'
                }`}>
                {inq.type || inq.inquiry_type || 'Unknown'}
            </span>

            <div className="text-primary-600 font-medium flex items-center gap-1">
                View Details
                <ChevronRight size={16} />
            </div>
        </div>
    </Link>
);

const TableRowSkeleton = () => (
    <tr className="animate-pulse">
        <td className="px-6 md:px-8 py-6"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
        <td className="px-6 md:px-8 py-6"><div className="h-4 w-32 bg-slate-100 rounded" /></td>
        <td className="px-6 md:px-8 py-6"><div className="h-5 w-20 bg-slate-100 rounded-lg" /></td>
        <td className="px-6 md:px-8 py-6"><div className="h-5 w-16 bg-slate-100 rounded-full" /></td>
        <td className="px-6 md:px-8 py-6 text-right"><div className="h-8 w-24 bg-slate-100 rounded-2xl ml-auto" /></td>
    </tr>
);

const CardSkeleton = () => (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 animate-pulse space-y-3">
        <div className="flex justify-between">
            <div className="h-5 w-20 bg-slate-100 rounded" />
            <div className="h-5 w-16 bg-slate-100 rounded-full" />
        </div>
        <div className="h-5 w-24 bg-slate-100 rounded-lg" />
    </div>
);

const EmptyState = ({ label = 'No inquiries yet', hint = 'New inquiries will show up here as soon as they come in.' }) => (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <Inbox size={20} className="text-slate-300" />
        </div>
        <p className="text-slate-600 font-bold text-sm">{label}</p>
        <p className="text-slate-400 text-xs mt-1 max-w-[220px]">{hint}</p>
    </div>
);

const PartnerDashboard = () => {
    const { user } = useAuth();
    const [filterType, setFilterType] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inquiries, setInquiries] = useState([]);
    const [stickerSummary, setStickerSummary] = useState({ used: 0, total: 0 });
    const [stats, setStats] = useState({
        activeInquiries: 0,
        pendingInquiries: 0,
        closedInquiries: 0,
        totalSales: 0,
        totalAgents: 0
    });

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            // Run repairs in parallel before fetching display data
            await Promise.all([
                repairValidationInquiryStatuses(),
                repairMissingStickerRecords(user?.id),
            ]);
            try {
                const query = { type: filterType !== 'All' ? filterType : undefined };
                const [dashboardData, statsData, inquiriesData, stickers] = await Promise.all([
                    getPartnerDashboard(),
                    getPartnerStats(),
                    getInquiries(query),
                    fetchPartnerStickerSummary(user?.id)
                ]);
                setStickerSummary({
                    used: stickers.stickersUsed ?? 0,
                    total: stickers.stickersAllocated ?? (stickers.stickersUsed ?? 0) + (stickers.stickersRemaining ?? 0)
                });

                const allInquiriesForStats = filterType === 'All' ? inquiriesData : await getInquiries({});
                const dashboardStats = dashboardData?.stats || {};
                const resolvedStats = { ...dashboardStats, ...statsData };

                const list = Array.isArray(allInquiriesForStats) ? allInquiriesForStats : [];
                const closedFromList = countClosedLikeInquiries(list);
                const apiClosed = Number(resolvedStats.closed_inquiries || 0) + Number(resolvedStats.accepted_inquiries || 0);
                const closedInquiries = list.length > 0 ? closedFromList : apiClosed;

                setStats({
                    activeInquiries: resolvedStats.active_inquiries || 0,
                    pendingInquiries: resolvedStats.pending_inquiries || 0,
                    closedInquiries,
                    totalSales: resolvedStats.total_sales || 0,
                    totalAgents: resolvedStats.total_agents || 0
                });

                setInquiries(Array.isArray(inquiriesData) ? inquiriesData : []);
                setError(null);
            } catch (err) {
                console.error('Dashboard fetch error:', err);
                setError('Failed to load dashboard data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [filterType, user?.id]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-8">
                <div className="bg-red-50 border border-red-100 rounded-3xl p-12 text-center max-w-lg">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={22} className="text-red-500" />
                    </div>
                    <h3 className="text-red-900 text-xl font-black mb-2 tracking-tight">Data Sync Error</h3>
                    <p className="text-red-600 text-sm font-medium mb-6">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-8 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all"
                    >
                        Retry Sync
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 px-4 md:px-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 mb-12">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
                ) : (
                    <>
                        <StatCard icon={Layout} title="Total Active" value={stats.activeInquiries} color="bg-primary-500" subtitle="Inquiries" />
                        <StatCard icon={Clock} title="Total Pending" value={stats.pendingInquiries} color="bg-amber-500" subtitle="Awaiting Action" />
                        <StatCard icon={CheckCircle2} title="Total Closed" value={stats.closedInquiries} color="bg-emerald-500" subtitle="Past 30 Days" />
                        <StatCard icon={DollarSign} title="Total Sales" value={`SAR ${(stats.totalSales || 0).toLocaleString()}`} color="bg-indigo-500" subtitle="Gross Profit" />
                        <StatCard icon={Users} title="Total Agents" value={stats.totalAgents || 0} color="bg-pink-500" subtitle="Active Field Teams" />
                        <StatCard
                            to="/partner/stickers"
                            icon={Tag}
                            title="Stickers usage"
                            value={`${stickerSummary.used} / ${stickerSummary.total}`}
                            color="bg-teal-500"
                            subtitle="Used / total"
                        />
                    </>
                )}
            </div>

            {/* Main Inquiries Section */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft-xl overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">
                            All <span className="text-primary-500">Inquiries.</span>
                        </h2>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {loading ? 'Loading results…' : `Showing ${inquiries.length} results`}
                        </p>
                    </div>

                    <div className="relative w-full md:w-72">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            disabled={loading}
                            className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <option value="All">All Types</option>
                            <option value="Validation">Validation</option>
                            <option value="Refilled">Refilled</option>
                            <option value="New Unit">New Unit</option>
                            <option value="Maintenance">Maintenance</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[720px]">
                        <thead>
                            <tr className="text-[11px] font-black text-slate-500 uppercase tracking-[0.12em] border-b border-slate-100 bg-slate-50/70">
                                <th className="px-6 md:px-8 py-5">Inquiry No</th>
                                <th className="px-6 md:px-8 py-5">Client Name</th>
                                <th className="px-6 md:px-8 py-5">Inquiry Type</th>
                                <th className="px-6 md:px-8 py-5">Status</th>
                                <th className="px-6 md:px-8 py-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)}
                            {!loading && inquiries.length === 0 && (
                                <tr>
                                    <td colSpan={5}>
                                        <EmptyState />
                                    </td>
                                </tr>
                            )}
                            {!loading && inquiries.map((inq) => (
                                <tr key={inq.id} className="hover:bg-slate-50/70 transition-colors group">
                                    <td className="px-6 md:px-8 py-6 font-black text-primary-600 text-sm tracking-tighter">
                                        {inq.inquiry_no}
                                    </td>
                                    <td className="px-6 md:px-8 py-6">
                                        <p className="font-bold text-slate-900">{inq.customers?.business_name || 'Generic Client'}</p>
                                    </td>
                                    <td className="px-6 md:px-8 py-6">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${(inq.type || inq.inquiry_type) === 'Validation' ? 'bg-blue-50 text-blue-600' :
                                                (inq.type || inq.inquiry_type) === 'Refilled' ? 'bg-purple-50 text-purple-600' :
                                                    (inq.type || inq.inquiry_type) === 'New Unit' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                            }`}>
                                            {inq.type || inq.inquiry_type || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-6 md:px-8 py-6">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${['active', 'completed', 'accepted'].includes(resolveStatus(inq)) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {resolveStatus(inq)}
                                        </span>
                                    </td>
                                    <td className="px-6 md:px-8 py-6 text-right">
                                        <Link
                                            to={`/partner/inquiry/${inq.id}`}
                                            className="px-5 py-2.5 bg-slate-900 text-white hover:bg-primary-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all inline-block"
                                        >
                                            View Details
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="block md:hidden p-6 space-y-4">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
                    ) : inquiries.length === 0 ? (
                        <EmptyState />
                    ) : (
                        inquiries.map((inq) => <InquiryCard key={inq.id} inq={inq} />)
                    )}
                </div>
            </div>
        </div>
    );
};

export default PartnerDashboard;