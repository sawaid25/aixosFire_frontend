import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
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
    Loader2,
    RefreshCw,
    FileText
} from 'lucide-react';
import PageLoader from '../../components/PageLoader';
import { fetchCustomerInquiries, fetchCustomerQuotations, approveQuotation } from '../../api/customerPortal';
import { approveMaintenanceSchedule } from '../../api/maintenanceApi';
import {
    buildHistoryRowsFromInquiry,
    buildHistoryRowsFromService,
    formatDateSafe,
    normalizeCustomerInquiries,
    buildInquiryTimeline
} from './dashboardUtils';
import { toast } from 'react-hot-toast';
import InquiryChatBox from '../../components/Chat/InquiryChatBox';

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
    const [history, setHistory] = useState([]);
    const [inquiries, setInquiries] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [maintenanceQuotations, setMaintenanceQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [inquiriesApiUnavailable, setInquiriesApiUnavailable] = useState(false);
    const [quotesApiUnavailable, setQuotesApiUnavailable] = useState(false);
    const [quotationActionId, setQuotationActionId] = useState(null);

    // Customer location is synced via useLocationTracker in Layout (customers.location_lat / location_lng).

    useEffect(() => {
        if (!user) return;

        const load = async () => {
            setLoading(true);
            setApiError('');
            try {
                const [invRes, histRes, inqRes, quoRes, maintQuoRes] = await Promise.all([
                    // Equipment source for customer dashboard = inquiry_items (predictable, holds capacity/expiry/etc).
                    supabase
                        .from('inquiry_items')
                        .select('*')
                        .eq('customer_id', user.id)
                        .order('updated_at', { ascending: false }),
                    supabase.from('services').select('*').eq('customer_id', user.id).order('scheduled_date', { ascending: false }),
                    fetchCustomerInquiries().catch((e) => {
                        console.warn('[CustomerDashboard] inquiries API:', e?.message || e);
                        setInquiriesApiUnavailable(true);
                        return [];
                    }),
                    fetchCustomerQuotations().catch((e) => {
                        console.warn('[CustomerDashboard] quotations API:', e?.message || e);
                        setQuotesApiUnavailable(true);
                        return [];
                    }),
                    supabase
                        .from('quotations')
                        .select('*, inquiries(type)')
                        .eq('customer_id', user.id)
                        .order('created_at', { ascending: false })
                ]);

                if (invRes.error) throw invRes.error;
                if (histRes.error) throw histRes.error;
                if (maintQuoRes.error) throw maintQuoRes.error;

                setInventory(invRes.data || []);
                setHistory(histRes.data || []);
                setInquiriesApiUnavailable(false);
                setQuotesApiUnavailable(false);

                const inqList = Array.isArray(inqRes) ? inqRes : [];
                const quoList = Array.isArray(quoRes) ? quoRes : [];

                setInquiries(normalizeCustomerInquiries(inqList));
                setQuotations(quoList);
                // This panel is specifically labeled "Maintenance Quotation" below — without
                // this filter it duplicated every quotation regardless of type (Renewal's
                // included, mislabeled as Maintenance).
                setMaintenanceQuotations(
                    (maintQuoRes.data || []).filter(
                        (q) => String(q.inquiries?.type || '').trim().toLowerCase() === 'maintenance'
                    )
                );

                if (import.meta.env.DEV) {
                    console.debug('[CustomerDashboard] loaded', {
                        inventory: (invRes.data || []).length,
                        services: (histRes.data || []).length,
                        inquiries: (Array.isArray(inqRes) ? inqRes : []).length,
                        quotations: (Array.isArray(quoRes) ? quoRes : []).length
                    });
                }
            } catch (err) {
                console.error('CustomerDashboard load error', err);
                setApiError('Some data could not be loaded. Try refreshing.');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [user]);

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
        () =>
            inquiries.filter((q) => {
                const s = (q.status || '').toLowerCase();
                return ['pending', 'active', 'in progress', 'quoted'].includes(s);
            }).length,
        [inquiries]
    );

    const serviceHistoryRows = useMemo(() => {
        const rows = [
            ...inquiries.map(buildHistoryRowsFromInquiry),
            ...history.map(buildHistoryRowsFromService)
        ];
        rows.sort((a, b) => {
            const da = new Date(a.serviceDate || 0).getTime();
            const db = new Date(b.serviceDate || 0).getTime();
            return db - da;
        });
        return rows;
    }, [inquiries, history]);

    const handleApproveQuote = async (q) => {
        const id = q.id;
        if (!id) return;
        setQuotationActionId(id);
        try {
            await approveQuotation(id);
            toast.success('Quotation approved');
            setQuotations((prev) =>
                prev.map((x) => (x.id === id ? { ...x, status: 'approved' } : x))
            );
        } catch (e) {
            toast.error(e?.response?.data?.error || 'Could not approve quotation');
        } finally {
            setQuotationActionId(null);
        }
    };

    const handleScheduleAction = async (inquiryId, status) => {
        try {
            await approveMaintenanceSchedule(inquiryId, status);
            toast.success(`Schedule ${status} successfully`);
            window.location.reload();
        } catch (e) {
            toast.error(e?.response?.data?.error || `Could not update schedule`);
        }
    };

    return (
        <div className="relative min-h-[400px] space-y-8">
            {loading && <PageLoader message="Loading your dashboard..." />}

            {apiError && (
                <div className="bg-amber-50 border border-amber-100 text-amber-900 text-sm font-medium px-4 py-3 rounded-2xl flex items-center justify-between gap-4">
                    {apiError}
                    <button type="button" onClick={() => window.location.reload()} className="text-primary-600 font-bold flex items-center gap-1">
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
                    <p className="text-3xl font-black text-slate-900">{activeInquiriesCount}</p>
                    <p className="text-xs text-slate-500 mt-2">Open or in progress</p>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Expiring soon</p>
                    <p className="text-3xl font-black text-amber-600">{expiringSoonCount}</p>
                    <p className="text-xs text-slate-500 mt-2">Within {EXPIRY_ALERT_DAYS} days</p>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total inquiries</p>
                    <p className="text-3xl font-black text-primary-600">{inquiries.length}</p>
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
                        View all
                    </Link>
                </div>
                <div className="p-6">
                    {inquiries.length === 0 ? (
                        <div className="space-y-2">
                            <p className="text-slate-500 text-sm">No inquiries yet. Create one from “New Inquiry”.</p>
                            {inquiriesApiUnavailable && (
                                <p className="text-xs text-amber-700 font-semibold">
                                    Inquiries are currently unavailable from the API.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {inquiries.slice(0, 6).map((inq) => {
                                const key = inq?.id ? `id:${inq.id}` : `no:${inq.inquiry_no}`;
                                const isOpen = expandedInquiryIds.has(key);
                                const type = (inq.type || inq.inquiry_type || '—').toString();
                                const status = inq.status || '—';
                                const internalRef =
                                    inq.internal_reference_number || inq.internal_ref || '—';

                                // Find associated maintenance quotation
                                const associatedQuote = maintenanceQuotations.find(
                                    (mq) => mq.inquiry_id === inq.id
                                );

                                const ext = Array.isArray(inq.inquiry_extensions)
                                    ? inq.inquiry_extensions
                                    : Array.isArray(inq.extensions)
                                        ? inq.extensions
                                        : [];
                                const items = Array.isArray(inq.inquiry_items) ? inq.inquiry_items : [];
                                const services = Array.isArray(inq.inquiry_item_services) ? inq.inquiry_item_services : [];

                                const activityCount =
                                    ext.length +
                                    (Array.isArray(inq.inspection_reports) ? inq.inspection_reports.length : 0) +
                                    (Array.isArray(inq.site_assessments) ? inq.site_assessments.length : 0) +
                                    services.length;

                                const timeline = buildInquiryTimeline({
                                    inquiry: inq,
                                    quotations,
                                    services: history
                                });

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
                                                {/* Only show the visit row when a visit is actually scheduled — `approval_status`
                                                    alone defaults to 'pending' on every inquiry (a Maintenance-only concept),
                                                    so gating on it showed a meaningless "Visit: Not set · PENDING" on
                                                    Validation/Refill/Renewal inquiries that never have a site visit. */}
                                                {inq.scheduled_date && (
                                                    <div className="mt-2 text-xs flex flex-col items-start gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={14} className="text-primary-500" />
                                                            <span className="font-bold text-primary-700">
                                                                Visit: {inq.scheduled_date ? new Date(inq.scheduled_date).toLocaleString('en-PK', {
                                                                    timeZone: 'Asia/Karachi',
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                    hour12: true
                                                                }) : 'Not set'}
                                                            </span>
                                                            {inq.approval_status && (
                                                                <span className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] ${inq.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                                        inq.approval_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                                            'bg-amber-100 text-amber-700'
                                                                    }`}>
                                                                    {inq.approval_status}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {inq.approval_status === 'pending' && inq.scheduled_date && (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleScheduleAction(inq.id, 'approved'); }}
                                                                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-700 transition"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleScheduleAction(inq.id, 'rejected'); }}
                                                                    className="px-3 py-1.5 bg-red-500 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-red-600 transition"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-black uppercase text-slate-700">
                                                    {status}
                                                </span>
                                                <span className="text-xs font-bold text-slate-500">
                                                    {activityCount} updates
                                                </span>
                                                <span className="text-primary-600 font-bold text-xs">
                                                    {isOpen ? 'Hide' : 'Details'}
                                                </span>
                                            </div>
                                        </button>

                                        {isOpen && (
                                            <div className="px-4 pb-4">
                                                <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                            Activity timeline
                                                        </p>
                                                        {timeline.length === 0 ? (
                                                            <p className="text-sm text-slate-500 italic">No activity yet.</p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {timeline.slice(0, 8).map((ev, idx) => (
                                                                    <div key={ev.key || idx} className="flex items-start gap-3">
                                                                        <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-primary-500 shrink-0" />
                                                                        <div className="flex-1 flex items-center justify-between gap-4">
                                                                            <span className="text-sm font-semibold text-slate-800">
                                                                                {ev.label}
                                                                            </span>
                                                                            <span className="text-xs text-slate-500">
                                                                                {formatDateSafe(ev.ts)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {items.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                                Items
                                                            </p>
                                                            <div className="space-y-2">
                                                                {items.slice(0, 5).map((it) => (
                                                                    <div key={it.id || `${it.type}-${it.serial_no}`} className="flex justify-between gap-4 text-sm">
                                                                        <span className="font-semibold text-slate-800">
                                                                            {it.system_type || it.type || 'Item'}
                                                                        </span>
                                                                        <span className="text-slate-500">
                                                                            Qty: {it.quantity ?? '—'} {it.unit || ''}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
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
                                                        <InquiryChatBox
                                                            inquiryId={inq.id}
                                                            recipientId={inq.partner_id}
                                                            recipientRole="Partner"
                                                            title={`Chat with Partner regarding ${inq.inquiry_no || 'Inquiry'}`}
                                                        />
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
                        <p className="text-slate-500 text-sm">No quotations yet. When a partner sends a quote, it will appear here.</p>
                    ) : (
                        <div className="space-y-4">
                            {/* General Quotations */}
                            {quotations.map((q) => {
                                const pending =
                                    (q.status || '').toLowerCase() === 'pending' ||
                                    (q.status || '').toLowerCase() === 'submitted' ||
                                    (q.status || '').toLowerCase() === 'sent';
                                return (
                                    <div
                                        key={q.id}
                                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100"
                                    >
                                        <div>
                                            <p className="font-bold text-slate-900">
                                                {q.quote_reference || q.reference || `Quotation #${q.id}`}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Inquiry: {q.inquiry_no || q.inquiry_id || '—'} · Amount:{' '}
                                                {(q.estimated_cost ?? q.amount) != null
                                                    ? `SAR ${Number(q.estimated_cost ?? q.amount).toLocaleString()}`
                                                    : '—'}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1 capitalize">Status: {q.status || '—'}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {q.pdf_url && (
                                                <a
                                                    href={q.pdf_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50"
                                                >
                                                    View PDF
                                                </a>
                                            )}
                                            {pending && (
                                                <button
                                                    type="button"
                                                    disabled={quotationActionId === q.id}
                                                    onClick={() => handleApproveQuote(q)}
                                                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    {quotationActionId === q.id ? (
                                                        <Loader2 className="animate-spin inline" size={16} />
                                                    ) : (
                                                        'Approve'
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

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
                                                For Inquiry: <span className="font-bold text-slate-700">#{mq.inquiry_id?.slice(0, 8)}…</span> ·
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

            {/* Service history (all types) */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList size={22} className="text-primary-500" /> Service & inquiry history
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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {serviceHistoryRows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium">
                                        No history yet. Create an inquiry or book a service.
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
                                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {row.inquiryNo !== '—' && <span className="block">{row.inquiryNo}</span>}
                                            {row.internalRef !== '—' && <span className="block">Ref: {row.internalRef}</span>}
                                            {row.inquiryNo === '—' && row.internalRef === '—' && '—'}
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

            {/* Recent bookings */}
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white rounded-3xl p-8 shadow-soft border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Calendar size={20} className="text-blue-500" /> Recent bookings
                        </h3>
                        <Link to="/customer/history" className="text-sm text-primary-600 font-semibold hover:underline">
                            View all
                        </Link>
                    </div>

                    <div className="space-y-4">
                        {history.length > 0 ? (
                            history.slice(0, 3).map((service) => (
                                <div key={service.id} className="flex items-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-blue-500 border border-slate-100 shadow-sm font-bold">
                                        {service.scheduled_date ? new Date(service.scheduled_date).getDate() : '?'}
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <h4 className="font-bold text-slate-900 capitalize">{service.service_type}</h4>
                                        <p className="text-xs text-slate-500">
                                            {service.scheduled_date
                                                ? new Date(service.scheduled_date).toLocaleDateString(undefined, {
                                                    month: 'long',
                                                    year: 'numeric'
                                                })
                                                : 'Pending'}
                                        </p>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-1 rounded-lg font-bold ${service.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                            }`}
                                    >
                                        {service.status || 'Pending'}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-400 mx-auto mb-4">
                                    <CheckCircle size={32} />
                                </div>
                                <p className="text-slate-900 font-bold">All caught up</p>
                                <p className="text-slate-500 text-sm">No scheduled maintenance in the system.</p>
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
