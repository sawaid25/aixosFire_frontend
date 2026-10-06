import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    FireExtinguisher,
    AlertTriangle,
    CheckCircle,
    Plus,
    Calendar,
    Clock,
    ArrowRight,
    ClipboardList,
    FileCheck,
    RefreshCw,
    FileText,
    Eye,
    Loader2
} from 'lucide-react';
import PageLoader from '../../components/PageLoader';
import InquiryStatusBadge from '../../components/InquiryStatusBadge';
import InquiryTimeline from '../../components/InquiryTimeline';
import { fetchCustomerInquiries, fetchCustomerQuotations, fetchCustomerItems } from '../../api/customerPortal';
import { isOpenInquiryStatus } from '../../constants/inquiryStatus';
import {
    buildHistoryRowsFromInquiry,
    formatDateSafe,
    normalizeCustomerInquiries,
    buildInquiryTimeline,
    inquiryTypeDisplay,
    inquiryProductSummary
} from './dashboardUtils';
import {
    PartnerInfoLine,
    RejectionReasonNote,
    VisitScheduleRow,
    InquiryItemsList,
    InquiryMessages
} from './components/InquiryParts';
import QuotationCard from './components/QuotationCard';

const EXPIRY_ALERT_DAYS = 10;

const InventoryCard = ({ item }) => {
    const isExpired = item.expiry_date && new Date(item.expiry_date) < new Date();
    const isNearExpiry =
        item.expiry_date &&
        new Date(item.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    let statusColor = 'bg-green-100 text-green-700 border-green-200';
    let icon = <CheckCircle size={20} />;
    let statusText = 'Valid';

    if (isExpired) {
        statusColor = 'bg-red-100 text-red-700 border-red-200';
        icon = <AlertTriangle size={20} />;
        statusText = 'Expired';
    } else if (isNearExpiry) {
        statusColor = 'bg-yellow-100 text-yellow-700 border-yellow-200';
        icon = <Clock size={20} />;
        statusText = 'Expiring Soon';
    }

    return (
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 hover:shadow-lg transition-all duration-300 group flex flex-col justify-between h-full">
            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-slate-100 transition-colors">
                        <FireExtinguisher size={24} className="text-slate-600" />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusColor}`}>
                        {icon} {statusText}
                    </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1">{item.type}</h3>
                <p className="text-slate-500 text-sm mb-4">
                    {item.capacity ? `${item.capacity} Unit` : '—'} • ID: #{item.extinguisher_id ?? item.id}
                </p>

                <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Installed</span>
                        <span className="font-medium text-slate-600">
                            {item.install_date ? new Date(item.install_date).toLocaleDateString() : '—'}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Expires</span>
                        <span className={`font-medium ${isExpired ? 'text-red-500 font-bold' : 'text-slate-600'}`}>
                            {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '—'}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Status</span>
                        <span className="font-medium text-slate-600 capitalize">{item.status || item.condition || '—'}</span>
                    </div>
                </div>
            </div>

            <Link
                to="/customer/certificates"
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:border-primary-500 hover:text-primary-600 transition-colors text-center"
            >
                View Certificate
            </Link>
        </div>
    );
};

const CustomerDashboard = () => {
    const { user } = useAuth();
    const [inventory, setInventory] = useState([]);
    const [inquiries, setInquiries] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [maintenanceQuotations, setMaintenanceQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [inquiriesApiUnavailable, setInquiriesApiUnavailable] = useState(false);
    // True once the inquiries list has loaded successfully at least once.
    const [inquiriesLoaded, setInquiriesLoaded] = useState(false);
    const [quotesApiUnavailable, setQuotesApiUnavailable] = useState(false);

    // Customer location is synced via useLocationTracker in Layout (customers.location_lat / location_lng).

    // Bumped by "Try again" / after an action to re-fetch everything.
    const [reloadKey, setReloadKey] = useState(0);
    const reload = useCallback(() => setReloadKey((k) => k + 1), []);
    const userId = user?.id;

    useEffect(() => {
        if (!userId) return undefined;
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setApiError('');
            setInquiriesApiUnavailable(false);
            setQuotesApiUnavailable(false);
            try {
                // All reads go through the authenticated, customer-scoped API (no anon-key table reads).
                // Each source fails independently — a failed equipment or quotation call must not
                // hide the customer's inquiries (and vice versa).
                const [invRes, inqRes, quoRes] = await Promise.all([
                    // Equipment source for customer dashboard = inquiry_items (predictable, holds capacity/expiry/etc).
                    fetchCustomerItems().catch((e) => {
                        console.warn('[CustomerDashboard] equipment API:', e?.message || e);
                        if (!cancelled) setApiError('Your equipment could not be loaded. Try refreshing.');
                        return [];
                    }),
                    fetchCustomerInquiries().catch((e) => {
                        console.warn('[CustomerDashboard] inquiries API:', e?.message || e);
                        if (!cancelled) setInquiriesApiUnavailable(true);
                        return null;
                    }),
                    fetchCustomerQuotations().catch((e) => {
                        console.warn('[CustomerDashboard] quotations API:', e?.message || e);
                        if (!cancelled) setQuotesApiUnavailable(true);
                        return [];
                    })
                ]);
                if (cancelled) return;

                const invList = Array.isArray(invRes) ? invRes : [];
                // null = the inquiries request failed — keep whatever was shown before rather
                // than replacing it with an empty list that reads as "no inquiries".
                const inqList = Array.isArray(inqRes) ? inqRes : null;
                const quoList = Array.isArray(quoRes) ? quoRes : [];

                setInventory(invList);
                if (inqList) {
                    // Newest request first, so a just-created inquiry is always at the top.
                    const normalized = normalizeCustomerInquiries(inqList);
                    normalized.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                    setInquiries(normalized);
                    setInquiriesLoaded(true);
                }
                setQuotations(quoList);
                // This panel is specifically labeled "Maintenance Quotation" below — without
                // this filter it duplicated every quotation regardless of type (Renewal's
                // included, mislabeled as Maintenance).
                setMaintenanceQuotations(
                    quoList.filter(
                        (q) => String(q.inquiries?.type || '').trim().toLowerCase() === 'maintenance'
                    )
                );

                if (import.meta.env.DEV) {
                    console.debug('[CustomerDashboard] loaded', {
                        inventory: invList.length,
                        inquiries: inqList ? inqList.length : 'failed',
                        quotations: quoList.length
                    });
                }
            } catch (err) {
                console.error('CustomerDashboard load error', err);
                if (!cancelled) setApiError('Some data could not be loaded. Try refreshing.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
        // Keyed on the user's id (not the user object, which AuthContext re-creates) so the
        // dashboard loads once per visit instead of several overlapping times.
    }, [userId, reloadKey]);

    const [expandedInquiryIds, setExpandedInquiryIds] = useState(() => new Set());

    const toggleInquiry = (key) => {
        setExpandedInquiryIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const expiringSoonCount = useMemo(() => {
        if (!inventory.length) return 0;
        const limit = Date.now() + EXPIRY_ALERT_DAYS * 24 * 60 * 60 * 1000;
        return inventory.filter((item) => {
            if (!item.expiry_date) return false;
            const exp = new Date(item.expiry_date).getTime();
            return exp >= Date.now() && exp <= limit;
        }).length;
    }, [inventory]);

    const activeInquiriesCount = useMemo(
        () => inquiries.filter((q) => isOpenInquiryStatus(q.status)).length,
        [inquiries]
    );

    const serviceHistoryRows = useMemo(() => {
        const rows = inquiries.map(buildHistoryRowsFromInquiry);
        rows.sort((a, b) => {
            const da = new Date(a.serviceDate || 0).getTime();
            const db = new Date(b.serviceDate || 0).getTime();
            return db - da;
        });
        return rows;
    }, [inquiries]);

    const openInquiries = useMemo(
        () => inquiries.filter((q) => isOpenInquiryStatus(q.status)),
        [inquiries]
    );

    const handleQuotationUpdated = (updated) => {
        setQuotations((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    };

    return (
        <div className="relative min-h-[400px] space-y-8">
            {loading && <PageLoader message="Loading your dashboard..." />}

            {apiError && (
                <div className="bg-amber-50 border border-amber-100 text-amber-900 text-sm font-medium px-4 py-3 rounded-2xl flex items-center justify-between gap-4">
                    {apiError}
                    <button type="button" onClick={reload} className="text-primary-600 font-bold flex items-center gap-1">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Safety Overview</h1>
                    <p className="text-slate-500">Services, inquiries, and equipment in one place.</p>
                </div>
                <Link to="/customer/booking" className="btn-primary flex items-center gap-2 group">
                    <Plus size={20} />
                    <span>New Inquiry</span>
                </Link>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Active inquiries</p>
                    <p className="text-3xl font-black text-slate-900">{inquiriesLoaded ? activeInquiriesCount : '—'}</p>
                    <p className="text-xs text-slate-500 mt-2">Open or in progress</p>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Expiring soon</p>
                    <p className="text-3xl font-black text-amber-600">{expiringSoonCount}</p>
                    <p className="text-xs text-slate-500 mt-2">Within {EXPIRY_ALERT_DAYS} days</p>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total inquiries</p>
                    <p className="text-3xl font-black text-primary-600">{inquiriesLoaded ? inquiries.length : '—'}</p>
                    <p className="text-xs text-slate-500 mt-2">From your account</p>
                </div>
            </div>

            {/* Inquiries (grouped) */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList size={22} className="text-primary-500" /> Inquiries
                    </h2>
                    <Link to="/customer/history" className="text-sm text-primary-600 font-semibold hover:underline">
                        View all inquiries
                    </Link>
                </div>
                <div className="p-6">
                    {inquiriesApiUnavailable && (
                        <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <span>
                                Your inquiries could not be loaded right now.
                                {inquiriesLoaded && ' Showing the last loaded list.'}
                            </span>
                            <button type="button" onClick={reload} disabled={loading} className="text-primary-600 font-bold flex items-center gap-1 shrink-0 disabled:opacity-50">
                                <RefreshCw size={14} /> Try again
                            </button>
                        </div>
                    )}
                    {!inquiriesLoaded ? (
                        !inquiriesApiUnavailable && (
                            <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                                <Loader2 className="animate-spin" size={18} /> Loading your inquiries...
                            </div>
                        )
                    ) : inquiries.length === 0 ? (
                        <p className="text-slate-500 text-sm">No inquiries yet. Create one from “New Inquiry”.</p>
                    ) : (
                        <div className="space-y-3">
                            {inquiries.slice(0, 6).map((inq) => {
                                const key = inq?.id ? `id:${inq.id}` : `no:${inq.inquiry_no}`;
                                const isOpen = expandedInquiryIds.has(key);
                                const type = inquiryTypeDisplay(inq);
                                const internalRef =
                                    inq.internal_reference_number || inq.internal_ref || '—';

                                const ext = Array.isArray(inq.inquiry_extensions)
                                    ? inq.inquiry_extensions
                                    : Array.isArray(inq.extensions)
                                        ? inq.extensions
                                        : [];
                                const items = Array.isArray(inq.inquiry_items) ? inq.inquiry_items : [];

                                const product = inquiryProductSummary(inq);
                                const timeline = buildInquiryTimeline({ inquiry: inq, quotations });
                                // Every timeline event after "Inquiry Created" counts as an update.
                                const activityCount = timeline.filter((ev) => ev.key !== 'created').length;

                                return (
                                    <div key={key} className="rounded-2xl border border-slate-100 bg-slate-50">
                                        <button
                                            type="button"
                                            onClick={() => toggleInquiry(key)}
                                            className="w-full p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left"
                                        >
                                            <div>
                                                <p className="font-bold text-slate-900">
                                                    {inq.inquiry_no || 'Inquiry'}{' '}
                                                    <span className="text-slate-500 font-medium">· {type}</span>
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Created: {formatDateSafe(inq.created_at)} · Internal ref: {internalRef}
                                                </p>
                                                {product && (
                                                    <p className="text-xs text-slate-600 mt-1">
                                                        {[
                                                            product.name,
                                                            product.productNo ? `Product# ${product.productNo}` : null,
                                                            product.catNo ? `CAT# ${product.catNo}` : null,
                                                            product.more > 0 ? `+${product.more} more` : null
                                                        ].filter(Boolean).join(' · ')}
                                                    </p>
                                                )}
                                                <PartnerInfoLine inquiry={inq} />
                                                <RejectionReasonNote inquiry={inq} />
                                                <VisitScheduleRow inquiry={inq} onDone={reload} />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <InquiryStatusBadge status={inq.status} />
                                                <span className="text-xs font-bold text-slate-500">
                                                    {activityCount} updates
                                                </span>
                                                <span className="text-primary-600 font-bold text-xs">
                                                    {isOpen ? 'Hide' : 'Details'}
                                                </span>
                                            </div>
                                        </button>
                                        <div className="px-4 pb-3 -mt-1 flex justify-end">
                                            <Link
                                                to={`/customer/inquiries/${inq.id}`}
                                                className="text-xs font-bold text-primary-600 hover:underline"
                                            >
                                                Open inquiry →
                                            </Link>
                                        </div>

                                        {isOpen && (
                                            <div className="px-4 pb-4">
                                                <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                            Activity timeline
                                                        </p>
                                                        <InquiryTimeline
                                                            inquiryId={inq.id}
                                                            createdAt={inq.created_at}
                                                            fallbackEvents={timeline.slice(0, 8)}
                                                        />
                                                    </div>

                                                    {items.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                                Items
                                                            </p>
                                                            <InquiryItemsList items={items} limit={5} />
                                                        </div>
                                                    )}

                                                    {ext.length > 0 && (
                                                        import.meta.env.DEV && (
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                                    Raw extension records (dev)
                                                                </p>
                                                                <div className="space-y-2">
                                                                    {ext
                                                                        .slice()
                                                                        .sort(
                                                                            (a, b) =>
                                                                                new Date(b.updated_at || b.created_at || 0) -
                                                                                new Date(a.updated_at || a.created_at || 0)
                                                                        )
                                                                        .slice(0, 6)
                                                                        .map((e, idx) => (
                                                                            <div
                                                                                key={e.id || e.extension_id || idx}
                                                                                className="flex justify-between gap-4 text-sm"
                                                                            >
                                                                                <span className="text-slate-800">
                                                                                    {e.action_type ||
                                                                                        e.extension_type ||
                                                                                        e.status ||
                                                                                        'Update'}
                                                                                </span>
                                                                                <span className="text-slate-500">
                                                                                    {formatDateSafe(e.updated_at || e.created_at)}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            </div>
                                                        )
                                                    )}

                                                    {items.length === 0 && ext.length === 0 && activityCount === 0 && (
                                                        <p className="text-sm text-slate-500 italic">
                                                            No child updates found for this inquiry yet.
                                                        </p>
                                                    )}

                                                    {/* NEW: Chat / Discussion Box for Customer */}
                                                    <div className="pt-6 border-t border-slate-100">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                                                            Messages / Support
                                                        </p>
                                                        <InquiryMessages inquiry={inq} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Quotations */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FileCheck size={22} className="text-primary-500" /> Partner quotations
                    </h2>
                </div>
                <div className="p-6">
                    {quotations.length === 0 && maintenanceQuotations.length === 0 ? (
                        <div className="space-y-2">
                            <p className="text-slate-500 text-sm">No quotations yet. When a partner sends a quote, it will appear here.</p>
                            {quotesApiUnavailable && (
                                <p className="text-xs text-amber-700 font-semibold">
                                    Quotations are currently unavailable from the API.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* General Quotations */}
                            {quotations.map((q) => (
                                <QuotationCard key={q.id} quotation={q} onUpdated={handleQuotationUpdated} />
                            ))}

                            {/* Maintenance Quotations */}
                            {maintenanceQuotations.map((mq) => (
                                <div
                                    key={mq.id}
                                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-primary-200 transition-all group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-primary-50 text-primary-600 rounded-xl group-hover:bg-primary-100 transition-colors">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-900">Maintenance Quotation</p>
                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-md tracking-wider">New</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                For Inquiry: <span className="font-bold text-slate-700">{mq.inquiries?.inquiry_no || '—'}</span> ·
                                                Estimated Cost: <span className="font-bold text-emerald-600">SAR {mq.estimated_cost}</span>
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1">Submitted: {new Date(mq.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {mq.pdf_url && (
                                            <a
                                                href={mq.pdf_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center gap-2"
                                            >
                                                Download PDF
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Inquiry history */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList size={22} className="text-primary-500" /> Inquiry history
                    </h2>
                    <Link to="/customer/history" className="text-sm text-primary-600 font-semibold hover:underline">
                        View all
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/80">
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Service date</th>
                                <th className="px-4 py-3">Expiry</th>
                                <th className="px-4 py-3">Performed by</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Inquiry / Ref</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {serviceHistoryRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                                        {inquiriesLoaded
                                            ? 'No history yet. Create an inquiry to get started.'
                                            : inquiriesApiUnavailable ? 'History is unavailable right now.' : 'Loading...'}
                                    </td>
                                </tr>
                            ) : (
                                serviceHistoryRows.slice(0, 12).map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50/80">
                                        <td className="px-4 py-3 font-semibold text-slate-800 capitalize">{row.serviceType}</td>
                                        <td className="px-4 py-3 text-slate-600">{formatDateSafe(row.serviceDate)}</td>
                                        <td className="px-4 py-3 text-slate-600">{formatDateSafe(row.expiryDate)}</td>
                                        <td className="px-4 py-3 text-slate-600">{row.performedBy}</td>
                                        <td className="px-4 py-3">
                                            <InquiryStatusBadge status={row.status} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {row.inquiryNo !== '—' && <span className="block">{row.inquiryNo}</span>}
                                            {row.internalRef !== '—' && <span className="block">Ref: {row.internalRef}</span>}
                                            {row.inquiryNo === '—' && row.internalRef === '—' && '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {row.inquiryId && (
                                                <Link
                                                    to={`/customer/inquiries/${row.inquiryId}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors whitespace-nowrap"
                                                >
                                                    <Eye size={14} /> View details
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Equipment grid */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <FireExtinguisher size={22} className="text-primary-500" /> Equipment status
                    </h2>
                    <div className="flex items-center gap-4">
                        <span className="text-slate-500 text-sm font-medium">{inventory.length} units</span>
                        <Link to="/customer/inventory" className="text-sm text-primary-600 font-semibold hover:underline">
                            View list
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {inventory.length > 0 ? (
                        inventory.map((item) => <InventoryCard key={item.id} item={item} />)
                    ) : (
                        <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <FireExtinguisher size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500">No equipment registered yet.</p>
                        </div>
                    )}

                    <Link
                        to="/customer/booking"
                        className="rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-slate-400 hover:text-primary-500 hover:border-primary-300 hover:bg-primary-50/50 transition-all cursor-pointer group h-full min-h-[300px]"
                    >
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform group-hover:bg-white text-slate-300 group-hover:text-primary-500">
                            <Plus size={32} />
                        </div>
                        <span className="font-bold">Request service / inquiry</span>
                    </Link>
                </div>
            </div>

            {/* Open inquiries (replaces the legacy `services`-based "Recent bookings") */}
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white rounded-3xl p-8 shadow-soft border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Calendar size={20} className="text-blue-500" /> Open inquiries
                        </h3>
                        <Link to="/customer/history" className="text-sm text-primary-600 font-semibold hover:underline">
                            View all
                        </Link>
                    </div>

                    <div className="space-y-4">
                        {openInquiries.length > 0 ? (
                            openInquiries.slice(0, 3).map((inq) => (
                                <Link
                                    key={inq.id}
                                    to={`/customer/inquiries/${inq.id}`}
                                    className="flex items-center p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary-200 transition-colors"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-blue-500 border border-slate-100 shadow-sm font-bold">
                                        {inq.created_at ? new Date(inq.created_at).getDate() : '?'}
                                    </div>
                                    <div className="ml-4 flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-900 truncate">{inquiryTypeDisplay(inq)}</h4>
                                        <p className="text-xs text-slate-500">
                                            {inq.inquiry_no || 'Inquiry'} · {formatDateSafe(inq.created_at)}
                                        </p>
                                    </div>
                                    <InquiryStatusBadge status={inq.status} />
                                </Link>
                            ))
                        ) : !inquiriesLoaded ? (
                            <p className="text-sm text-slate-500 py-8 text-center">
                                {inquiriesApiUnavailable ? 'Open inquiries are unavailable right now.' : 'Loading...'}
                            </p>
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-400 mx-auto mb-4">
                                    <CheckCircle size={32} />
                                </div>
                                <p className="text-slate-900 font-bold">All caught up</p>
                                <p className="text-slate-500 text-sm">You have no open inquiries.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <h3 className="text-lg font-bold mb-4 relative z-10">Need help?</h3>
                    <p className="text-slate-300 mb-8 relative z-10 leading-relaxed">
                        Our support team is available for emergency fire safety consultations.
                    </p>
                    <Link
                        to="/customer/history"
                        className="inline-flex bg-white text-slate-900 px-6 py-3 rounded-xl font-bold items-center gap-2 hover:bg-slate-100 transition-colors relative z-10"
                    >
                        Track services <ArrowRight size={18} />
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default CustomerDashboard;
