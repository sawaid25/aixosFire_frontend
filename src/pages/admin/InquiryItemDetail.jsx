import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import {
    ArrowLeft, FileText, Package, Tag, Hash, Calendar,
    CheckCircle, Clock, XCircle, Activity, MapPin,
    QrCode, DollarSign, AlertTriangle, TrendingUp, TrendingDown,
    Target, Timer, ChevronRight, User, Handshake
} from 'lucide-react';
import { formatKsaDateTime, formatKsaTime } from '../../utils/dateTime';

/* ─── Benchmark Configuration ───────────────────────── */
const BENCHMARK = {
    validation:   { hours: 24,  label: '24 hours', color: '#8b5cf6' },
    refilling:    { hours: 72,  label: '3 days',   color: '#3b82f6' },
    maintenance:  { hours: 504, label: '3 weeks',  color: '#f97316' },
    installation: { hours: 504, label: '3 weeks',  color: '#f97316' },
    inspection:   { hours: 24,  label: '24 hours', color: '#06b6d4' },
};
const DEFAULT_BENCHMARK = { hours: 72, label: '3 days', color: '#94a3b8' };

const getBenchmark = (type) => BENCHMARK[(type || '').toLowerCase()] || DEFAULT_BENCHMARK;

const calcBenchmark = (inq) => {
    const start        = new Date(inq.created_at);
    const bm           = getBenchmark(inq.type);
    const benchmarkEnd = new Date(start.getTime() + bm.hours * 3_600_000);

    const isCompleted = ['completed', 'accepted', 'closed', 'valid'].includes((inq.status || '').toLowerCase());
    const isRejected  = ['rejected', 'cancelled', 'invalid', 'expired'].includes((inq.status || '').toLowerCase());

    let closingDate = null;
    if (isCompleted || isRejected) {
        if (inq.updated_at)          closingDate = new Date(inq.updated_at);
        else if (inq.follow_up_date) closingDate = new Date(inq.follow_up_date);
    }

    let benchmarkStatus = 'pending';
    let withinBenchmark = null;

    if (isCompleted && closingDate) {
        withinBenchmark = closingDate <= benchmarkEnd;
        benchmarkStatus = withinBenchmark ? 'within' : 'missed';
    } else if (!isCompleted && !isRejected) {
        benchmarkStatus = new Date() > benchmarkEnd ? 'at_risk' : 'on_track';
    } else if (isRejected) {
        benchmarkStatus = 'rejected';
    }

    const durationMs    = closingDate ? Math.max(0, closingDate - start) : null;
    const durationHours = durationMs !== null ? Math.round(durationMs / 3_600_000) : null;
    const durationDays  = durationHours !== null ? (durationHours / 24).toFixed(1) : null;
    const elapsedHours  = durationHours ?? Math.round((new Date() - start) / 3_600_000);
    const barFillPct    = Math.min(200, Math.round((elapsedHours / bm.hours) * 100));

    return { start, benchmarkEnd, closingDate, benchmarkStatus, withinBenchmark, durationHours, durationDays, barFillPct };
};

const fmt     = (d) => d ? new Date(d).toLocaleDateString()  : '—';
const fmtFull = (d) => d ? formatKsaDateTime(d)              : '—';
const fmtTime = (d) => d ? formatKsaTime(d) : '';

/* ─── Shared helpers ─────────────────────────────────── */
const getBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (['completed', 'accepted', 'closed', 'valid'].includes(s))   return 'bg-green-100 text-green-700';
    if (['rejected', 'cancelled', 'invalid', 'expired'].includes(s)) return 'bg-red-100 text-red-700';
    if (['in progress', 'scheduled'].includes(s))                     return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
};

/* ─── Benchmark Status Pill ─────────────────────────── */
const BmPill = ({ status }) => {
    const map = {
        within:   { cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle,   label: 'Within Benchmark' },
        missed:   { cls: 'bg-red-100 text-red-700',         icon: AlertTriangle, label: 'Benchmark Missed' },
        on_track: { cls: 'bg-blue-100 text-blue-700',       icon: Target,        label: 'On Track' },
        at_risk:  { cls: 'bg-amber-100 text-amber-700',     icon: Timer,         label: 'At Risk' },
        pending:  { cls: 'bg-slate-100 text-slate-500',     icon: Clock,         label: 'Pending' },
        rejected: { cls: 'bg-slate-100 text-slate-400',     icon: XCircle,       label: 'Rejected' },
    };
    const { cls, icon: Icon, label } = map[status] || map.pending;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${cls}`}>
            <Icon size={11} /> {label}
        </span>
    );
};

/* ─── Visual Benchmark Bar ──────────────────────────── */
const BmBar = ({ barFillPct, withinBenchmark, status }) => {
    if (status === 'rejected') return null;
    const isPending  = ['on_track', 'at_risk', 'pending'].includes(status);
    const isWithin   = status === 'within';
    const clampedPct = Math.min(100, barFillPct);
    const fillColor  = isPending ? 'bg-blue-400' : isWithin ? 'bg-emerald-500' : 'bg-red-500';
    const labelColor = isPending ? 'text-slate-400' : isWithin ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold';
    const trackBg    = isWithin ? 'bg-emerald-100' : 'bg-slate-100';
    return (
        <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
                <span className={labelColor}>Start</span>
                <span className={`font-semibold ${isPending ? 'text-slate-500' : isWithin ? 'text-emerald-600' : 'text-red-500'}`}>
                    Benchmark ▾
                </span>
                <span className={labelColor}>{isPending ? 'Now' : 'Closed'}</span>
            </div>
            <div className={`relative w-full ${trackBg} rounded-full h-3 overflow-visible`}>
                <div className={`absolute right-0 top-0 h-3 w-0.5 z-10 rounded-full ${isWithin ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                <div
                    className={`h-3 rounded-full transition-all duration-700 ${fillColor}`}
                    style={{ width: `${clampedPct}%` }}
                />
                {!isPending && !withinBenchmark && barFillPct > 100 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-500 border-2 border-white flex items-center justify-center z-20">
                        <span className="text-white" style={{ fontSize: 7 }}>!</span>
                    </div>
                )}
            </div>
            {barFillPct > 100 && !isPending && (
                <p className="text-xs text-red-500 font-semibold mt-1">
                    {Math.round(barFillPct - 100)}% over benchmark
                </p>
            )}
            {isWithin && (
                <p className="text-xs text-emerald-600 font-semibold mt-1">
                    Completed within the SLA benchmark ✓
                </p>
            )}
        </div>
    );
};

/* ─── InfoRow ────────────────────────────────────────── */
const InfoRow = ({ icon: Icon, label, value, valueClass = 'text-slate-900', cap = false }) => (
    <div className="flex items-start gap-3 py-3 px-4">
        <div className="p-1.5 rounded-lg bg-white border border-slate-100 flex-shrink-0 mt-0.5">
            <Icon size={13} className="text-slate-400" />
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-400">{label}</p>
            <p className={`text-sm font-medium mt-0.5 break-words ${valueClass} ${cap ? 'capitalize' : ''}`}>{value || '—'}</p>
        </div>
    </div>
);

/* ─── Timeline Event ─────────────────────────────────── */
const TimelineEvent = ({ icon: Icon, color, label, date, last }) => (
    <div className="flex gap-4">
        <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={16} className="text-white" />
            </div>
            {!last && <div className="w-0.5 bg-slate-100 flex-1 mt-1" />}
        </div>
        <div className="pb-6 flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">{label}</p>
            {date && <p className="text-xs text-slate-400 mt-0.5">{fmtFull(date)}</p>}
        </div>
    </div>
);

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
const InquiryItemDetail = () => {
    const { id: inquiryId, itemId } = useParams();
    const [loading, setLoading]   = useState(true);
    const [item, setItem]         = useState(null);
    const [inquiry, setInquiry]   = useState(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [itemRes, inqRes] = await Promise.allSettled([
                    supabase.from('inquiry_items').select('*').eq('id', itemId).maybeSingle(),
                    supabase
                        .from('inquiries')
                        .select('*, customers(id, business_name), agents(id, name), partners(id, business_name)')
                        .eq('id', inquiryId)
                        .maybeSingle(),
                ]);
                setItem(itemRes.status  === 'fulfilled' ? itemRes.value?.data  ?? null : null);
                setInquiry(inqRes.status === 'fulfilled' ? inqRes.value?.data ?? null : null);
            } catch (err) {
                console.error('InquiryItemDetail load error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [itemId, inquiryId]);

    const bmResult = useMemo(() => {
        if (!item) return null;
        const effectiveStatus    = item.status || inquiry?.status;
        const effectiveUpdatedAt = item.updated_at || inquiry?.updated_at;
        return calcBenchmark({
            created_at:     item.created_at,
            type:           item.type || item.item_type,
            status:         effectiveStatus,
            updated_at:     effectiveUpdatedAt,
            follow_up_date: null,
        });
    }, [item, inquiry]);

    const bmConfig = useMemo(() => getBenchmark(item?.type || item?.item_type), [item]);

    /* Build item-level timeline events */
    const timeline = useMemo(() => {
        if (!item) return [];
        const events = [];

        events.push({
            icon: Package,
            color: 'bg-blue-500',
            label: 'Item Added to Inquiry',
            date: item.created_at,
        });

        const s = (item.status || '').toLowerCase();
        if (['in progress', 'scheduled'].includes(s)) {
            events.push({
                icon: Activity,
                color: 'bg-amber-500',
                label: 'Work In Progress',
                date: item.updated_at || null,
            });
        } else if (['completed', 'accepted', 'closed', 'valid'].includes(s)) {
            events.push({
                icon: CheckCircle,
                color: 'bg-emerald-500',
                label: 'Item Completed / Validated',
                date: item.updated_at || item.created_at,
            });
        } else if (['rejected', 'cancelled', 'invalid', 'expired'].includes(s)) {
            events.push({
                icon: XCircle,
                color: 'bg-red-500',
                label: `Item ${s.charAt(0).toUpperCase() + s.slice(1)}`,
                date: item.updated_at || item.created_at,
            });
        }

        return events;
    }, [item]);

    /* Build info rows from whatever fields exist on the item */
    const infoFields = useMemo(() => {
        if (!item) return [];
        return [
            (item.description || item.name) && { label: 'Description / Name', value: item.description || item.name, icon: FileText },
            (item.type || item.item_type)   && { label: 'Service / Item Type', value: item.type || item.item_type, icon: Tag, cap: true },
            item.quantity !== undefined && item.quantity !== null && { label: 'Quantity', value: item.quantity, icon: Package },
            item.serial_number   && { label: 'Serial Number',        value: item.serial_number,   icon: Hash },
            item.unit_no         && { label: 'Unit Number',           value: item.unit_no,          icon: Hash },
            item.capacity        && { label: 'Capacity',              value: item.capacity,         icon: Package },
            item.size            && { label: 'Size',                  value: item.size,             icon: Package },
            item.location        && { label: 'Location',              value: item.location,         icon: MapPin },
            item.sticker_number  && { label: 'Sticker Number',        value: item.sticker_number,   icon: QrCode },
            item.manufacturing_date && { label: 'Manufacturing Date', value: fmt(item.manufacturing_date), icon: Calendar },
            item.expiry_date        && { label: 'Expiry Date',        value: fmt(item.expiry_date),        icon: Calendar },
            item.last_service_date  && { label: 'Last Service Date',  value: fmt(item.last_service_date),  icon: Calendar },
            { label: 'Date Added', value: fmtFull(item.created_at), icon: Calendar },
            item.updated_at && { label: 'Last Updated', value: fmtFull(item.updated_at), icon: Clock },
        ].filter(Boolean);
    }, [item]);

    if (loading) return <PageLoader message="Loading item details…" />;

    if (!item) return (
        <div className="text-center py-20">
            <Package size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500">Item not found.</p>
            <Link to={`/admin/inquiries/${inquiryId}`} className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:underline text-sm">
                <ArrowLeft size={14} /> Back to Inquiry
            </Link>
        </div>
    );

    const photoUrl = item.photo_url || item.image_url || item.photos;
    const notes    = item.notes || item.remarks || item.comment || item.comments;

    return (
        <div className="space-y-6 max-w-5xl">

            {/* Breadcrumb back */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <Link to="/admin/inquiries" className="hover:text-slate-900 transition-colors">Inquiries</Link>
                <ChevronRight size={14} className="text-slate-300" />
                <Link to={`/admin/inquiries/${inquiryId}`} className="hover:text-slate-900 transition-colors">
                    {inquiry?.inquiry_no || `#${inquiryId?.toString().slice(-8)}`}
                </Link>
                <ChevronRight size={14} className="text-slate-300" />
                <span className="text-slate-900 font-medium capitalize">
                    {item.type || item.item_type || 'Item Details'}
                </span>
            </div>

            {/* Header card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex-shrink-0">
                            <Package size={28} className="text-blue-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h2 className="text-xl font-display font-bold text-slate-900 capitalize">
                                    {item.type || item.item_type || 'Inquiry Item'}
                                </h2>
                                {item.status && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getBadgeClass(item.status)}`}>
                                        {item.status}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                                {item.quantity !== undefined && item.quantity !== null && (
                                    <span className="flex items-center gap-1.5">
                                        <Package size={13} /> Quantity: {item.quantity}
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={13} /> Added {fmt(item.created_at)}
                                </span>
                                {item.serial_number && (
                                    <span className="flex items-center gap-1.5 font-mono text-xs">
                                        <Hash size={13} /> {item.serial_number}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick link back to inquiry */}
                    <Link
                        to={`/admin/inquiries/${inquiryId}`}
                        className="flex-shrink-0 inline-flex items-center gap-2 text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl transition-colors"
                    >
                        <ArrowLeft size={13} /> Back to Inquiry
                    </Link>
                </div>
            </div>

            {/* Two-column: Item Info + Parent Inquiry */}
            <div className="grid lg:grid-cols-2 gap-6">

                {/* Item Information */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
                        <div className="p-2 rounded-xl bg-blue-50">
                            <Package size={16} className="text-blue-600" />
                        </div>
                        <h3 className="font-bold text-slate-900">Item Information</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {infoFields.map((field, i) => (
                            <InfoRow
                                key={i}
                                icon={field.icon}
                                label={field.label}
                                value={field.value}
                                cap={field.cap}
                            />
                        ))}
                        {infoFields.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-8">No item details available.</p>
                        )}
                    </div>
                </div>

                {/* Parent Inquiry */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
                        <div className="p-2 rounded-xl bg-violet-50">
                            <FileText size={16} className="text-violet-600" />
                        </div>
                        <h3 className="font-bold text-slate-900">Parent Inquiry</h3>
                        {inquiry && (
                            <Link
                                to={`/admin/inquiries/${inquiryId}`}
                                className="ml-auto text-xs font-bold text-violet-600 hover:underline flex items-center gap-1"
                            >
                                View Inquiry <ChevronRight size={12} />
                            </Link>
                        )}
                    </div>
                    {inquiry ? (
                        <div className="divide-y divide-slate-50">
                            <InfoRow icon={Hash}         label="Inquiry No."   value={inquiry.inquiry_no || `#${inquiry.id?.toString().slice(-8)}`} />
                            <InfoRow icon={Tag}          label="Service Type"  value={inquiry.type}    cap />
                            <InfoRow icon={Activity}     label="Status"        value={inquiry.status} />
                            <InfoRow icon={Calendar}     label="Created"       value={fmtFull(inquiry.created_at)} />
                            {inquiry.customers && (
                                <InfoRow icon={User}     label="Customer"      value={inquiry.customers.business_name} />
                            )}
                            {inquiry.agents && (
                                <InfoRow icon={User}     label="Agent"         value={inquiry.agents.name} />
                            )}
                            {inquiry.partners && (
                                <InfoRow icon={Handshake} label="Partner"      value={inquiry.partners.business_name} />
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 text-center py-8">Parent inquiry not found.</p>
                    )}
                </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">

                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                    <div>
                        <h3 className="font-bold text-slate-900">Activity Timeline</h3>
                        <p className="text-xs text-slate-400 mt-0.5 capitalize">
                            {item.type || item.item_type || inquiry?.type || '—'} service · SLA benchmark: {bmConfig.label}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {bmResult && <BmPill status={bmResult.benchmarkStatus} />}
                        {item.status && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getBadgeClass(item.status)}`}>
                                {item.status}
                            </span>
                        )}
                    </div>
                </div>

                {/* 3 date boxes */}
                {bmResult && (
                    <div className="grid grid-cols-3 gap-3 mb-5">

                        {/* Start */}
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Start Date</p>
                            <p className="text-sm font-bold text-slate-700">{fmt(item.created_at)}</p>
                            <p className="text-xs text-slate-400 mt-1">{fmtTime(item.created_at)}</p>
                        </div>

                        {/* Benchmark */}
                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Benchmark Date</p>
                            <p className="text-sm font-bold text-amber-800">{fmt(bmResult.benchmarkEnd)}</p>
                            <p className="text-xs text-amber-700 mt-1">{bmConfig.label} limit</p>
                        </div>

                        {/* Closing */}
                        <div className={`rounded-2xl p-4 border ${
                            bmResult.closingDate
                                ? bmResult.withinBenchmark
                                    ? 'bg-emerald-50 border-emerald-100'
                                    : 'bg-red-50 border-red-100'
                                : 'bg-slate-50 border-slate-100'
                        }`}>
                            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                                bmResult.closingDate
                                    ? bmResult.withinBenchmark ? 'text-emerald-600' : 'text-red-600'
                                    : 'text-slate-400'
                            }`}>Closing Date</p>
                            <p className={`text-sm font-bold ${
                                bmResult.closingDate
                                    ? bmResult.withinBenchmark ? 'text-emerald-800' : 'text-red-700'
                                    : 'text-slate-400'
                            }`}>
                                {bmResult.closingDate ? fmt(bmResult.closingDate) : 'Not closed yet'}
                            </p>
                            {bmResult.durationDays && (
                                <p className={`text-xs mt-1 ${bmResult.withinBenchmark ? 'text-emerald-600' : 'text-red-400'}`}>
                                    {bmResult.durationDays}d to complete
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Benchmark bar */}
                {bmResult && (
                    <div className="mb-5">
                        <BmBar
                            barFillPct={bmResult.barFillPct}
                            withinBenchmark={bmResult.withinBenchmark}
                            status={bmResult.benchmarkStatus}
                        />
                    </div>
                )}

                {/* Duration summary */}
                {bmResult?.durationHours !== null && bmResult?.durationHours !== undefined && (
                    <div className={`flex items-center gap-2 mb-5 px-4 py-3 rounded-xl ${
                        bmResult.withinBenchmark
                            ? 'bg-emerald-50 border border-emerald-100'
                            : 'bg-red-50 border border-red-100'
                    }`}>
                        {bmResult.withinBenchmark
                            ? <TrendingUp  size={14} className="text-emerald-600 flex-shrink-0" />
                            : <TrendingDown size={14} className="text-red-600 flex-shrink-0" />
                        }
                        <p className="text-xs text-slate-600">
                            Completed in{' '}
                            <span className={`font-bold ${bmResult.withinBenchmark ? 'text-emerald-700' : 'text-red-600'}`}>
                                {bmResult.durationHours < 24 ? `${bmResult.durationHours}h` : `${bmResult.durationDays} days`}
                            </span>
                            {' · '}Benchmark: {bmConfig.label}
                        </p>
                    </div>
                )}

                {/* At-risk warning */}
                {bmResult?.benchmarkStatus === 'at_risk' && (
                    <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
                        <AlertTriangle size={14} className="text-amber-700 flex-shrink-0" />
                        <p className="text-xs text-amber-700 font-medium">
                            Benchmark deadline has passed — this inquiry is overdue.
                        </p>
                    </div>
                )}

                {/* Divider */}
                <div className="border-t border-slate-100 my-5" />

                {/* Timeline events */}
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Status History</p>
                <div className="space-y-0">
                    {timeline.map((ev, i) => (
                        <TimelineEvent
                            key={i}
                            icon={ev.icon}
                            color={ev.color}
                            label={ev.label}
                            date={ev.date}
                            last={i === timeline.length - 1}
                        />
                    ))}
                    {timeline.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No timeline events recorded.</p>
                    )}
                </div>
            </div>

            {/* Photos */}
            {photoUrl && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <h3 className="font-bold text-slate-900 mb-4">Photos / Documents</h3>
                    {Array.isArray(photoUrl) ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {photoUrl.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                    <img src={url} alt={`Item ${i + 1}`} className="w-full h-36 object-cover rounded-2xl border border-slate-100 hover:opacity-90 transition-opacity" />
                                </a>
                            ))}
                        </div>
                    ) : (
                        <a href={photoUrl} target="_blank" rel="noreferrer">
                            <img src={photoUrl} alt="Item" className="w-full max-h-72 object-cover rounded-2xl border border-slate-100 hover:opacity-90 transition-opacity" />
                        </a>
                    )}
                </div>
            )}

            {/* Notes */}
            {notes && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <h3 className="font-bold text-slate-900 mb-3">Notes / Remarks</h3>
                    <p className="text-sm text-slate-700 leading-relaxed bg-amber-50 rounded-2xl p-4 border border-amber-100">
                        {notes}
                    </p>
                </div>
            )}
        </div>
    );
};

export default InquiryItemDetail;
