import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import { assignInquiryPartner } from '../../api/admin';
import {
    ArrowLeft, FileText, User, Briefcase, Handshake,
    Calendar, CheckCircle, Clock, XCircle, Activity,
    MapPin, Mail, Phone, DollarSign, Tag, AlertCircle,
    QrCode, Package, ChevronRight, Hash,
    AlertTriangle, TrendingUp, TrendingDown, Target, Timer, Eye, X, Loader2, Inbox
} from 'lucide-react';

const SERVICE_PRICING = {
    inspection: 50, refilling: 65, installation: 150,
    validation: 45, maintenance: 80,
};

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

    const isCompleted = ['completed', 'accepted', 'closed'].includes((inq.status || '').toLowerCase());
    const isRejected  = ['rejected', 'cancelled'].includes((inq.status || '').toLowerCase());

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
    const barFillPct    = durationHours !== null
        ? Math.min(200, Math.round((durationHours / bm.hours) * 100))
        : null;

    return { start, benchmarkEnd, closingDate, benchmarkStatus, withinBenchmark, durationHours, durationDays, barFillPct, bmHours: bm.hours, bmLabel: bm.label };
};

const fmt     = (d) => d ? new Date(d).toLocaleDateString()  : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

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
    if (barFillPct === null || status === 'rejected') return null;
    const isPending  = ['on_track', 'at_risk', 'pending'].includes(status);
    const clampedPct = Math.min(100, barFillPct);
    return (
        <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Start</span>
                <span className="font-semibold text-slate-500">Benchmark ▾</span>
                <span>{isPending ? 'Now' : 'Closed'}</span>
            </div>
            <div className="relative w-full bg-slate-100 rounded-full h-3 overflow-visible">
                <div className="absolute right-0 top-0 h-3 w-0.5 bg-slate-400 z-10 rounded-full" />
                <div
                    className={`h-3 rounded-full transition-all duration-700 ${
                        isPending ? 'bg-blue-400' : withinBenchmark ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
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
        </div>
    );
};

const getBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (['completed','accepted','closed'].includes(s)) return 'bg-green-100 text-green-700';
    if (['rejected','cancelled'].includes(s)) return 'bg-red-100 text-red-700';
    if (['in progress','scheduled'].includes(s)) return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
};

const getPriorityClass = (priority) => {
    if (priority === 'High')   return 'bg-red-100 text-red-700';
    if (priority === 'Medium') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
};

const InfoRow = ({ icon: Icon, label, value, valueClass = 'text-slate-900' }) => (
    <div className="flex items-start gap-3 py-2.5">
        <div className="p-2 rounded-xl bg-slate-50 flex-shrink-0 mt-0.5">
            <Icon size={14} className="text-slate-400" />
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400 font-semibold">{label}</p>
            <p className={`text-sm font-medium mt-0.5 break-words ${valueClass}`}>{value || '—'}</p>
        </div>
    </div>
);

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
            {date && (
                <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(date).toLocaleString()}
                </p>
            )}
        </div>
    </div>
);

/* ─── Item Detail Slide-Over Panel ──────────────────── */
const ItemDetailPanel = ({ item, onClose }) => {
    if (!item) return null;

    const photoUrl = item.photo_url || item.image_url || item.photos;
    const notes    = item.notes || item.remarks || item.comment || item.comments;

    const fields = [
        (item.description || item.name) && {
            label: 'Description / Name',
            value: item.description || item.name,
            icon: FileText,
        },
        (item.type || item.item_type) && {
            label: 'Service Type',
            value: item.type || item.item_type,
            icon: Tag,
            cap: true,
        },
        item.quantity !== undefined && item.quantity !== null && {
            label: 'Quantity',
            value: item.quantity,
            icon: Package,
        },
        item.serial_number && { label: 'Serial Number',   value: item.serial_number,   icon: Hash },
        item.unit_no       && { label: 'Unit Number',      value: item.unit_no,          icon: Hash },
        item.capacity      && { label: 'Capacity',         value: item.capacity,         icon: Package },
        item.size          && { label: 'Size',             value: item.size,             icon: Package },
        item.location      && { label: 'Location',         value: item.location,         icon: MapPin },
        item.sticker_number && { label: 'Sticker No.',    value: item.sticker_number,   icon: QrCode },
        item.manufacturing_date && {
            label: 'Manufacturing Date',
            value: new Date(item.manufacturing_date).toLocaleDateString(),
            icon: Calendar,
        },
        item.expiry_date && {
            label: 'Expiry Date',
            value: new Date(item.expiry_date).toLocaleDateString(),
            icon: Calendar,
        },
        item.last_service_date && {
            label: 'Last Service Date',
            value: new Date(item.last_service_date).toLocaleDateString(),
            icon: Calendar,
        },
        { label: 'Created',       value: new Date(item.created_at).toLocaleString(),  icon: Calendar },
        item.updated_at && {
            label: 'Last Updated',
            value: new Date(item.updated_at).toLocaleString(),
            icon: Clock,
        },
    ].filter(Boolean);

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-blue-50">
                            <Package size={18} className="text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Item Details</h3>
                            <p className="text-xs text-slate-400 capitalize mt-0.5">
                                {item.type || item.item_type || 'Inquiry Item'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Status badge */}
                    {item.status && (
                        <div>
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-bold ${getBadgeClass(item.status)}`}>
                                {item.status}
                            </span>
                        </div>
                    )}

                    {/* Fields list */}
                    <div className="bg-slate-50/70 rounded-2xl overflow-hidden divide-y divide-slate-100/80">
                        {fields.map((field, i) => (
                            <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                                <div className="p-1.5 rounded-lg bg-white border border-slate-100 flex-shrink-0 mt-0.5">
                                    <field.icon size={12} className="text-slate-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-slate-400">{field.label}</p>
                                    <p className={`text-sm font-medium text-slate-800 mt-0.5 ${field.cap ? 'capitalize' : ''}`}>
                                        {field.value}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Photo */}
                    {photoUrl && (
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                                Photos / Documents
                            </p>
                            {Array.isArray(photoUrl) ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {photoUrl.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noreferrer">
                                            <img src={url} alt={`Item ${i + 1}`} className="w-full rounded-xl border border-slate-100 object-cover h-28" />
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <a href={photoUrl} target="_blank" rel="noreferrer" className="block">
                                    <img src={photoUrl} alt="Item" className="w-full rounded-2xl border border-slate-100 object-cover max-h-52" />
                                </a>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    {notes && (
                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
                                Notes / Remarks
                            </p>
                            <p className="text-sm text-amber-900 leading-relaxed">{notes}</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const InquiryDetail = () => {
    const { id } = useParams();
    const [loading, setLoading]       = useState(true);
    const [inquiry, setInquiry]       = useState(null);
    const [items, setItems]           = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    // General Inquiry manual assignment — Partners eligible for this inquiry's product(s)
    // + service, computed the same way the Agent form does (see productPartnerEligibility).
    const [assignOptions, setAssignOptions] = useState({ loading: false, partners: [], selected: '', saving: false });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Fetch base inquiry first
                const { data: inqData, error: inqErr } = await supabase
                    .from('inquiries')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle();

                if (inqErr) throw inqErr;
                if (!inqData) { setLoading(false); return; }

                // Fetch related records in parallel using IDs from the inquiry
                const [customerRes, agentRes, partnerRes, itemsRes] = await Promise.allSettled([
                    inqData.customer_id
                        ? supabase.from('customers').select('*').eq('id', inqData.customer_id).maybeSingle()
                        : Promise.resolve({ data: null }),
                    inqData.agent_id
                        ? supabase.from('agents').select('*').eq('id', inqData.agent_id).maybeSingle()
                        : Promise.resolve({ data: null }),
                    inqData.partner_id
                        ? supabase.from('partners').select('*').eq('id', inqData.partner_id).maybeSingle()
                        : Promise.resolve({ data: null }),
                    supabase.from('inquiry_items').select('*').eq('inquiry_id', id).order('created_at', { ascending: true }),
                ]);

                const enriched = {
                    ...inqData,
                    customers: customerRes.status === 'fulfilled' ? customerRes.value?.data ?? null : null,
                    agents:    agentRes.status    === 'fulfilled' ? agentRes.value?.data    ?? null : null,
                    partners:  partnerRes.status  === 'fulfilled' ? partnerRes.value?.data  ?? null : null,
                };

                setInquiry(enriched);
                setItems(itemsRes.status === 'fulfilled' ? itemsRes.value?.data || [] : []);
            } catch (err) {
                console.error('InquiryDetail load error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    // Only relevant for an unassigned General Inquiry. This is a manual Admin routing
    // decision, not the Agent's automatic product/service matching — so every Active
    // Partner is offered here, not just ones that already carry the requested product.
    // Inactive/deleted Partners are still excluded (status filter below); the backend
    // (PUT /admin/inquiries/:id/assign-partner) re-enforces the Active check and
    // admin-only authorization regardless of what this list shows.
    useEffect(() => {
        if (!inquiry?.is_general_inquiry || inquiry?.partner_id) return;
        let cancelled = false;

        const loadPartners = async () => {
            setAssignOptions((s) => ({ ...s, loading: true }));
            try {
                const { data: partners, error } = await supabase
                    .from('partners')
                    .select('id, business_name')
                    .eq('status', 'Active')
                    .order('business_name', { ascending: true });
                if (error) throw error;

                if (!cancelled) setAssignOptions({ loading: false, partners: partners || [], selected: '', saving: false });
            } catch (err) {
                console.error('[InquiryDetail] load partners failed:', err);
                if (!cancelled) setAssignOptions((s) => ({ ...s, loading: false }));
            }
        };

        loadPartners();
        return () => { cancelled = true; };
    }, [inquiry?.is_general_inquiry, inquiry?.partner_id]);

    const handleAssignPartner = async () => {
        if (!assignOptions.selected) return;
        setAssignOptions((s) => ({ ...s, saving: true }));
        try {
            await assignInquiryPartner(inquiry.id, assignOptions.selected);
            const { data: partnerData } = await supabase.from('partners').select('*').eq('id', assignOptions.selected).maybeSingle();
            setInquiry((prev) => ({ ...prev, partner_id: assignOptions.selected, partners: partnerData || null }));
            toast.success('Partner assigned to this inquiry.');
        } catch (err) {
            console.error('[InquiryDetail] assign partner failed:', err);
            toast.error(err?.response?.data?.error || err.message || 'Failed to assign partner.');
        } finally {
            setAssignOptions((s) => ({ ...s, saving: false }));
        }
    };

    const estimatedRevenue = useMemo(() => {
        if (!inquiry) return 0;
        return SERVICE_PRICING[(inquiry.type || '').toLowerCase()] || 50;
    }, [inquiry]);

    if (loading) return <PageLoader message="Loading inquiry details…" />;

    if (!inquiry) return (
        <div className="text-center py-20">
            <FileText size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500">Inquiry not found.</p>
            <Link to="/admin/inquiries" className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:underline text-sm">
                <ArrowLeft size={14} /> Back to Inquiries
            </Link>
        </div>
    );

    const isCompleted = ['completed','accepted','closed'].includes((inquiry.status||'').toLowerCase());

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Back */}
            <Link
                to="/admin/inquiries"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
                <ArrowLeft size={16} /> Back to Inquiries
            </Link>

            {/* Header card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex-shrink-0">
                            <FileText size={28} className="text-blue-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h2 className="text-xl font-display font-bold text-slate-900">
                                    {inquiry.inquiry_no || `#${inquiry.id?.toString().slice(-8)}`}
                                </h2>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getBadgeClass(inquiry.status)}`}>
                                    {inquiry.status || 'Pending'}
                                </span>
                                {inquiry.priority && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPriorityClass(inquiry.priority)}`}>
                                        {inquiry.priority} Priority
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                                <span className="flex items-center gap-1.5 capitalize">
                                    <Tag size={13} /> {inquiry.type || '—'} service
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={13} /> Created {new Date(inquiry.created_at).toLocaleDateString()}
                                </span>
                                {inquiry.inquiry_no && (
                                    <span className="flex items-center gap-1.5 font-mono text-xs">
                                        <Hash size={13} /> {inquiry.id?.toString().slice(-8)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Revenue badge */}
                    <div className="flex-shrink-0 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-right">
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Est. Revenue</p>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">
                            SAR {isCompleted ? estimatedRevenue.toLocaleString() : '—'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {isCompleted ? 'Earned' : `SAR ${estimatedRevenue} on completion`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main 3-col info grid */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* Customer */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-xl bg-sky-50">
                            <User size={16} className="text-sky-600" />
                        </div>
                        <h3 className="font-bold text-slate-900">Customer</h3>
                        {inquiry.customers?.id && (
                            <Link
                                to={`/admin/customers/${inquiry.customers.id}`}
                                className="ml-auto text-xs font-bold text-sky-600 hover:underline flex items-center gap-1"
                            >
                                Profile <ChevronRight size={12} />
                            </Link>
                        )}
                    </div>
                    {inquiry.customers ? (
                        <div className="divide-y divide-slate-50">
                            <InfoRow icon={User}    label="Business Name"  value={inquiry.customers.business_name} />
                            <InfoRow icon={Tag}     label="Business Type"  value={inquiry.customers.business_type} />
                            <InfoRow icon={Mail}    label="Email"          value={inquiry.customers.email} />
                            <InfoRow icon={Phone}   label="Phone"          value={inquiry.customers.phone} />
                            <InfoRow icon={MapPin}  label="Address"        value={inquiry.customers.address} />
                            <InfoRow icon={CheckCircle} label="Status" value={inquiry.customers.status}
                                valueClass={inquiry.customers.status === 'Active' ? 'text-emerald-600' : 'text-slate-500'}
                            />
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 py-4 text-center">No customer data.</p>
                    )}
                </div>

                {/* Agent */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-xl bg-violet-50">
                            <Briefcase size={16} className="text-violet-600" />
                        </div>
                        <h3 className="font-bold text-slate-900">Agent</h3>
                        {inquiry.agents?.id && (
                            <Link
                                to={`/admin/agents/${inquiry.agents.id}`}
                                className="ml-auto text-xs font-bold text-violet-600 hover:underline flex items-center gap-1"
                            >
                                Profile <ChevronRight size={12} />
                            </Link>
                        )}
                    </div>
                    {inquiry.agents ? (
                        <div className="divide-y divide-slate-50">
                            <InfoRow icon={User}     label="Agent Name"   value={inquiry.agents.name} />
                            <InfoRow icon={Mail}     label="Email"        value={inquiry.agents.email} />
                            <InfoRow icon={Phone}    label="Phone"        value={inquiry.agents.phone} />
                            <InfoRow icon={MapPin}   label="Territory"    value={inquiry.agents.territory} />
                            <InfoRow icon={CheckCircle} label="Status"   value={inquiry.agents.status}
                                valueClass={['accepted','active'].includes((inquiry.agents.status||'').toLowerCase()) ? 'text-emerald-600' : 'text-amber-600'}
                            />
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 py-4 text-center">No agent assigned.</p>
                    )}
                </div>

                {/* Partner */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-xl bg-orange-50">
                            <Handshake size={16} className="text-orange-600" />
                        </div>
                        <h3 className="font-bold text-slate-900">Partner</h3>
                        {inquiry.partners?.id && (
                            <Link
                                to={`/admin/partners/${inquiry.partners.id}`}
                                className="ml-auto text-xs font-bold text-orange-600 hover:underline flex items-center gap-1"
                            >
                                Profile <ChevronRight size={12} />
                            </Link>
                        )}
                    </div>
                    {inquiry.partners ? (
                        <div className="divide-y divide-slate-50">
                            <InfoRow icon={Handshake} label="Partner Name" value={inquiry.partners.name} />
                            <InfoRow icon={Mail}      label="Email"        value={inquiry.partners.email} />
                            <InfoRow icon={Phone}     label="Phone"        value={inquiry.partners.phone} />
                        </div>
                    ) : inquiry.is_general_inquiry ? (
                        <div className="py-2">
                            <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 mb-4">
                                <Inbox size={16} className="text-amber-600 shrink-0" />
                                <p className="text-xs font-bold text-amber-800">
                                    General Inquiry — no Partner offered this product/service. Needs assignment.
                                </p>
                            </div>
                            {assignOptions.loading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 size={18} className="animate-spin text-slate-400" />
                                </div>
                            ) : assignOptions.partners.length === 0 ? (
                                <p className="text-sm text-slate-400 py-4 text-center">
                                    No Active Partners are available to assign.
                                </p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <select
                                        value={assignOptions.selected}
                                        onChange={(e) => setAssignOptions((s) => ({ ...s, selected: e.target.value }))}
                                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
                                        disabled={assignOptions.saving}
                                    >
                                        <option value="">Select a Partner…</option>
                                        {assignOptions.partners.map((p) => (
                                            <option key={p.id} value={p.id}>{p.business_name}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleAssignPartner}
                                        disabled={!assignOptions.selected || assignOptions.saving}
                                        className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                                    >
                                        {assignOptions.saving ? <Loader2 size={15} className="animate-spin" /> : <Handshake size={15} />}
                                        Assign Partner
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                            <Handshake size={28} className="mb-2" />
                            <p className="text-sm text-slate-400">No partner assigned.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Inquiry details + Timeline side by side */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Inquiry Details */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <h3 className="font-bold text-slate-900 mb-4">Inquiry Details</h3>
                    <div className="divide-y divide-slate-50">
                        <InfoRow icon={Hash}         label="Inquiry ID"       value={inquiry.id} valueClass="font-mono text-xs text-slate-600" />
                        <InfoRow icon={Tag}          label="Inquiry Type"     value={inquiry.type} valueClass="capitalize" />
                        <InfoRow icon={Activity}     label="Status"           value={inquiry.status} />
                        <InfoRow icon={AlertCircle}  label="Priority"         value={inquiry.priority} />
                        <InfoRow icon={Calendar}     label="Created Date"     value={inquiry.created_at ? new Date(inquiry.created_at).toLocaleString() : null} />
                        <InfoRow icon={Clock}        label="Follow-up Date"   value={inquiry.follow_up_date ? new Date(inquiry.follow_up_date).toLocaleString() : null} />
                        {inquiry.updated_at && (
                            <InfoRow icon={CheckCircle} label="Last Updated"  value={new Date(inquiry.updated_at).toLocaleString()} />
                        )}
                    </div>
                </div>

                {/* Revenue + QR + Timeline */}
                <div className="space-y-6">
                    {/* Revenue / Pricing */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-emerald-50">
                                <DollarSign size={16} className="text-emerald-600" />
                            </div>
                            <h3 className="font-bold text-slate-900">Revenue &amp; Pricing</h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            <InfoRow icon={Tag}        label="Service Type"        value={inquiry.type} valueClass="capitalize" />
                            <InfoRow icon={DollarSign} label="Estimated Price"     value={`SAR ${estimatedRevenue}`} valueClass="font-bold text-emerald-700" />
                            <InfoRow icon={CheckCircle} label="Revenue Realized"   value={isCompleted ? `SAR ${estimatedRevenue}` : 'Pending completion'} valueClass={isCompleted ? 'text-emerald-600 font-bold' : 'text-amber-600'} />
                        </div>
                    </div>

                    {/* QR Code */}
                    {inquiry.qr_code_value && (
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-xl bg-violet-50">
                                    <QrCode size={16} className="text-violet-600" />
                                </div>
                                <h3 className="font-bold text-slate-900">QR Information</h3>
                            </div>
                            <p className="text-xs text-slate-400 font-semibold mb-1">QR Code Value</p>
                            <p className="text-sm font-mono text-slate-700 bg-slate-50 rounded-xl px-3 py-2 break-all">
                                {inquiry.qr_code_value}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Inquiry Items */}
            {items.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-50">
                            <Package size={16} className="text-slate-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Inquiry Items</h3>
                            <p className="text-xs text-slate-400 mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/70 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                                    <th className="px-6 py-3">#</th>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Quantity</th>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-6 py-4 text-sm font-bold text-slate-400">{idx + 1}</td>
                                        <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                                            {item.description || item.name || item.item_type || '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 capitalize">
                                            {item.type || item.item_type || '—'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.status ? (
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getBadgeClass(item.status)}`}>
                                                    {item.status}
                                                </span>
                                            ) : <span className="text-xs text-slate-300">—</span>}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {item.quantity ?? '—'}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400">
                                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                to={`/admin/inquiries/${id}/items/${item.id}`}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                <Eye size={12} /> View Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Progress indicator */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <h3 className="font-bold text-slate-900 mb-4">Current Progress</h3>
                <div className="flex items-center gap-3">
                    {[
                        { label: 'Created',     done: true },
                        { label: 'Assigned',    done: !!inquiry.agents },
                        { label: 'In Progress', done: ['in progress','scheduled','completed','accepted','closed'].includes((inquiry.status||'').toLowerCase()) },
                        { label: 'Completed',   done: ['completed','accepted','closed'].includes((inquiry.status||'').toLowerCase()) },
                    ].map((step, i, arr) => (
                        <React.Fragment key={step.label}>
                            <div className="flex flex-col items-center gap-1.5 flex-1">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    step.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                                }`}>
                                    {step.done ? <CheckCircle size={16} /> : i + 1}
                                </div>
                                <p className={`text-xs font-semibold text-center leading-tight ${step.done ? 'text-emerald-700' : 'text-slate-400'}`}>
                                    {step.label}
                                </p>
                            </div>
                            {i < arr.length - 1 && (
                                <div className={`h-0.5 flex-1 rounded-full mb-5 transition-all ${step.done ? 'bg-emerald-300' : 'bg-slate-100'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Item Detail Slide-Over */}
            <ItemDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
        </div>
    );
};

export default InquiryDetail;
