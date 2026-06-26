import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import StatCard from '../../components/admin/StatCard';
import {
    ArrowLeft, Building, Mail, Phone, MapPin, Calendar,
    Activity, CheckCircle, MessageSquare, QrCode, Clock,
    FileText, XCircle, Eye, ChevronRight, Tag, AlertTriangle
} from 'lucide-react';

/* ── helpers ──────────────────────────────────────────── */
const getBadgeClass = (s) => {
    const v = (s || '').toLowerCase();
    if (['completed', 'accepted', 'closed'].includes(v)) return 'bg-green-100 text-green-700';
    if (['rejected', 'cancelled'].includes(v))           return 'bg-red-100 text-red-700';
    if (['in progress', 'scheduled'].includes(v))        return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
};

const fmtSAR = (n) => `SAR ${Number(n || 0).toLocaleString()}`;

const InfoRow = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
        <div className="p-2 rounded-xl bg-slate-50 flex-shrink-0 mt-0.5">
            <Icon size={14} className="text-slate-400" />
        </div>
        <div className="min-w-0">
            <p className="text-xs text-slate-400 font-semibold">{label}</p>
            <p className="text-sm text-slate-900 font-medium break-words">{value || '—'}</p>
        </div>
    </div>
);

/* ── flat select — NO nested FK joins to avoid partners_N aliasing ── */
const INQ_FLAT = 'id, inquiry_no, type, status, priority, created_at, follow_up_date, qr_code_value, agent_id, partner_id';

/* ── try integer id first, then string, then user_id UUID ── */
async function loadInquiries(id, userIdFallback) {
    const attempts = [
        () => supabase.from('inquiries').select(INQ_FLAT).eq('customer_id', Number(id)).order('created_at', { ascending: false }),
        () => supabase.from('inquiries').select(INQ_FLAT).eq('customer_id', String(id)).order('created_at', { ascending: false }),
        ...(userIdFallback
            ? [() => supabase.from('inquiries').select(INQ_FLAT).eq('customer_id', userIdFallback).order('created_at', { ascending: false })]
            : []),
    ];

    for (const attempt of attempts) {
        const { data, error } = await attempt();
        if (!error && data && data.length > 0) return data;
    }
    return [];
}

/* ═══════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════ */
const CustomerProfile = () => {
    const { id } = useParams();

    const [loading, setLoading]           = useState(true);
    const [customer, setCustomer]         = useState(null);
    const [inquiries, setInquiries]       = useState([]);
    const [complaints, setComplaints]     = useState([]);
    const [qrHistory, setQrHistory]       = useState([]);
    const [qrTableReady, setQrTableReady] = useState(true);
    const [activeTab, setActiveTab]       = useState('overview');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                /* 1 – customer row */
                const { data: cData, error: cErr } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle();
                if (cErr) console.error('[CustomerProfile] customer:', cErr);
                setCustomer(cData || null);

                /* 2 – flat inquiries (no nested FK joins) */
                const rawInq = await loadInquiries(id, cData?.user_id);

                /* 3 – enrich agents + partners + quotations via separate .in() queries */
                let enriched = rawInq;
                if (rawInq.length > 0) {
                    const agentIds   = [...new Set(rawInq.map(i => i.agent_id).filter(Boolean))];
                    const partnerIds = [...new Set(rawInq.map(i => i.partner_id).filter(Boolean))];
                    const inqIds     = rawInq.map(i => i.id);

                    const [agRes, prRes, qRes] = await Promise.allSettled([
                        agentIds.length   > 0
                            ? supabase.from('agents').select('id, name').in('id', agentIds)
                            : Promise.resolve({ data: [] }),
                        partnerIds.length > 0
                            ? supabase.from('partners').select('id, business_name').in('id', partnerIds)
                            : Promise.resolve({ data: [] }),
                        supabase.from('quotations')
                            .select('id, inquiry_id, estimated_cost, status, created_at')
                            .in('inquiry_id', inqIds),
                    ]);

                    const agMap = {};
                    (agRes.value?.data || []).forEach(a => { agMap[a.id] = a; });
                    const prMap = {};
                    (prRes.value?.data || []).forEach(p => { prMap[p.id] = { ...p, name: p.business_name }; });
                    const qMap  = {};
                    (qRes.value?.data  || []).forEach(q => {
                        if (!qMap[q.inquiry_id]) qMap[q.inquiry_id] = [];
                        qMap[q.inquiry_id].push(q);
                    });

                    enriched = rawInq.map(inq => ({
                        ...inq,
                        agents:     agMap[inq.agent_id]   || null,
                        partners:   prMap[inq.partner_id] || null,
                        quotations: qMap[inq.id]          || [],
                    }));
                }
                setInquiries(enriched);

                /* 4 – complaints */
                const { data: compData } = await supabase
                    .from('complaints')
                    .select('id, message, is_admin, is_bot, is_read, created_at, status')
                    .eq('user_id', id)
                    .order('created_at', { ascending: false })
                    .limit(50);
                setComplaints(compData || []);

                /* 5 – QR history (table may not exist yet — handle gracefully) */
                const { data: qrData, error: qrErr } = await supabase
                    .from('customer_qr_history')
                    .select('*')
                    .eq('customer_id', id)
                    .order('generated_at', { ascending: false });

                if (qrErr?.code === 'PGRST205') {
                    setQrTableReady(false);
                } else {
                    setQrHistory(qrData || []);
                }

            } catch (err) {
                console.error('[CustomerProfile] load error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    /* ── metrics ──────────────────────────────────────── */
    const metrics = useMemo(() => {
        const total    = inquiries.length;
        const completed = inquiries.filter(i => ['completed', 'accepted', 'closed'].includes((i.status || '').toLowerCase())).length;
        const active    = inquiries.filter(i => ['pending', 'in progress', 'scheduled', 'quoted'].includes((i.status || '').toLowerCase())).length;
        const cancelled = inquiries.filter(i => ['rejected', 'cancelled'].includes((i.status || '').toLowerCase())).length;

        const allQ             = inquiries.flatMap(inq => inq.quotations || []);
        const totalQuotations  = allQ.length;
        const wonQuotations    = allQ.filter(q => ['completed', 'accepted', 'closed'].includes((q.status || '').toLowerCase())).length;
        const totalQuotedValue = allQ.reduce((s, q) => s + (Number(q.estimated_cost) || 0), 0);
        const unreadComplaints = complaints.filter(c => !c.is_admin && !c.is_read).length;

        return { total, completed, active, cancelled, totalQuotations, wonQuotations, totalQuotedValue, unreadComplaints };
    }, [inquiries, complaints]);

    /* ── guards ───────────────────────────────────────── */
    if (loading) return <PageLoader message="Loading customer profile..." />;

    if (!customer) return (
        <div className="text-center py-20">
            <Building size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500">Customer not found.</p>
            <Link to="/admin/customers" className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:underline text-sm">
                <ArrowLeft size={14} /> Back to Customers
            </Link>
        </div>
    );

    const TABS = [
        { id: 'overview',   label: 'Overview' },
        { id: 'services',   label: `Service History (${inquiries.length})` },
        { id: 'qr',         label: `QR History (${qrHistory.length})` },
        { id: 'complaints', label: `Complaints (${complaints.length})` },
    ];

    return (
        <div className="space-y-6">
            <Link to="/admin/customers"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
                <ArrowLeft size={16} /> Back to Customers
            </Link>

            {/* Profile card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                    <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {customer.image_url
                            ? <img src={customer.image_url} alt="" className="w-full h-full object-cover" />
                            : <Building size={28} className="text-sky-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-display font-bold text-slate-900">{customer.business_name}</h2>
                                <p className="text-sm text-slate-500 mt-0.5 capitalize">{customer.business_type || 'Business'}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                customer.status === 'Active' ? 'bg-green-100 text-green-700' :
                                customer.status === 'Lead'   ? 'bg-amber-100 text-amber-700' :
                                                               'bg-slate-100 text-slate-600'
                            }`}>{customer.status || 'Unknown'}</span>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
                            {customer.email   && <span className="flex items-center gap-1.5"><Mail   size={13} />{customer.email}</span>}
                            {customer.phone   && <span className="flex items-center gap-1.5"><Phone  size={13} />{customer.phone}</span>}
                            {customer.address && <span className="flex items-center gap-1.5"><MapPin size={13} />{customer.address}</span>}
                            <span className="flex items-center gap-1.5">
                                <Calendar size={13} />Registered {new Date(customer.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI row 1 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard icon={Activity}    title="Total Services" value={metrics.total}     color="bg-blue-500"    />
                <StatCard icon={CheckCircle} title="Completed"      value={metrics.completed} color="bg-emerald-500" />
                <StatCard icon={Clock}       title="Active"         value={metrics.active}    color="bg-amber-500"   />
                <StatCard icon={XCircle}     title="Cancelled"      value={metrics.cancelled} color="bg-red-500"     />
            </div>

            {/* KPI row 2 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 text-center">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total Quotations</p>
                    <p className="text-2xl font-bold text-slate-900">{metrics.totalQuotations}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 text-center">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Won</p>
                    <p className="text-2xl font-bold text-emerald-700">{metrics.wonQuotations}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 text-center">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Quoted Value</p>
                    <p className="text-xl font-bold text-violet-700">{fmtSAR(metrics.totalQuotedValue)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 text-center">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Win Rate</p>
                    <p className="text-2xl font-bold text-slate-900">
                        {metrics.total > 0 ? `${Math.round((metrics.completed / metrics.total) * 100)}%` : '—'}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 bg-white border border-slate-200 rounded-2xl p-1 w-fit shadow-sm">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === t.id ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'
                        }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW ─────────────────────────────── */}
            {activeTab === 'overview' && (
                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <h3 className="font-bold text-slate-900 mb-4">Customer Details</h3>
                        <InfoRow icon={Building}  label="Business Name" value={customer.business_name} />
                        <InfoRow icon={Tag}        label="Business Type" value={customer.business_type} />
                        <InfoRow icon={Mail}       label="Email"         value={customer.email} />
                        <InfoRow icon={Phone}      label="Phone"         value={customer.phone} />
                        <InfoRow icon={MapPin}     label="Address"       value={customer.address} />
                        {customer.owner_name && <InfoRow icon={FileText} label="Owner Name" value={customer.owner_name} />}
                        <InfoRow icon={Calendar}   label="Member Since"  value={new Date(customer.created_at).toLocaleDateString()} />
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-900">Recent Services</h3>
                            {inquiries.length > 5 && (
                                <button onClick={() => setActiveTab('services')}
                                    className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                                    View all <ChevronRight size={12} />
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {inquiries.slice(0, 7).map(inq => {
                                const qVal = (inq.quotations || []).reduce((s, q) => s + (Number(q.estimated_cost) || 0), 0);
                                return (
                                    <div key={inq.id}
                                        className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-slate-900 truncate">
                                                {inq.inquiry_no || `#${String(inq.id).slice(-6)}`}
                                            </p>
                                            <p className="text-xs text-slate-400 capitalize">
                                                {inq.type || '—'} · {inq.agents?.name || 'Unassigned'}
                                                {qVal > 0 && <span className="text-violet-600 font-semibold"> · {fmtSAR(qVal)}</span>}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getBadgeClass(inq.status)}`}>
                                                {inq.status || 'Pending'}
                                            </span>
                                            <Link to={`/admin/inquiries/${inq.id}`}
                                                className="text-slate-300 group-hover:text-primary-600 transition-colors">
                                                <Eye size={14} />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                            {inquiries.length === 0 && (
                                <div className="text-center py-10">
                                    <Activity size={32} className="mx-auto text-slate-200 mb-2" />
                                    <p className="text-sm text-slate-400">No services yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── SERVICE HISTORY ──────────────────────── */}
            {activeTab === 'services' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="font-bold text-slate-900">Complete Service History</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{inquiries.length} total inquiries</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/80 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                                    <th className="px-6 py-3">Inquiry No</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Agent</th>
                                    <th className="px-6 py-3">Partner</th>
                                    <th className="px-6 py-3">Quoted Value</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {inquiries.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center">
                                            <FileText size={32} className="mx-auto text-slate-200 mb-2" />
                                            <p className="text-slate-400 text-sm">No service history found.</p>
                                        </td>
                                    </tr>
                                )}
                                {inquiries.map(inq => {
                                    const qVal = (inq.quotations || []).reduce((s, q) => s + (Number(q.estimated_cost) || 0), 0);
                                    return (
                                        <tr key={inq.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                                                {inq.inquiry_no || `#${String(inq.id).slice(-6)}`}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 capitalize">{inq.type || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{inq.agents?.name   || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{inq.partners?.name || '—'}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                                                {qVal > 0 ? fmtSAR(qVal) : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getBadgeClass(inq.status)}`}>
                                                    {inq.status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-400">
                                                {new Date(inq.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link to={`/admin/inquiries/${inq.id}`}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-800">
                                                    <Eye size={12} /> View
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── QR HISTORY ───────────────────────────── */}
            {activeTab === 'qr' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-slate-900">QR Code History</h3>
                            <p className="text-xs text-slate-400 mt-1">Complete audit trail of every QR generated for this customer</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                            {qrHistory.length} version{qrHistory.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Table not set up */}
                    {!qrTableReady && (
                        <div className="p-10 text-center">
                            <AlertTriangle size={36} className="mx-auto text-amber-400 mb-3" />
                            <p className="text-sm font-bold text-slate-700 mb-1">QR History table not set up</p>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                                Run this SQL in your Supabase SQL editor to enable this feature:
                            </p>
                            <pre className="text-left text-xs bg-slate-50 rounded-xl p-4 max-w-xl mx-auto text-slate-600 overflow-x-auto">{`create table if not exists customer_qr_history (
  id           bigserial primary key,
  customer_id  bigint references customers(id) on delete cascade,
  version      int,
  qr_data_url  text,
  qr_url_value text,
  qr_payload   jsonb,
  generated_at timestamptz not null default now(),
  generated_by text,
  reason       text default 'Initial Customer Creation'
);
create index if not exists idx_cqr_customer
  on customer_qr_history(customer_id);`}</pre>
                        </div>
                    )}

                    {/* Empty */}
                    {qrTableReady && qrHistory.length === 0 && (
                        <div className="p-14 text-center">
                            <QrCode size={40} className="mx-auto text-slate-200 mb-3" />
                            <p className="text-sm font-semibold text-slate-500">No QR history yet</p>
                            <p className="text-xs text-slate-400 mt-1">Records will appear here each time a QR code is generated.</p>
                        </div>
                    )}

                    {/* Timeline */}
                    {qrTableReady && qrHistory.length > 0 && (
                        <div className="relative">
                            {/* Vertical connector line */}
                            <div className="absolute left-[2.85rem] top-0 bottom-0 w-px bg-slate-100 z-0" />

                            {qrHistory.map((rec, i) => {
                                const versionNum  = rec.version ?? (qrHistory.length - i);
                                const isLatest    = i === 0;
                                const snap        = rec.qr_payload || {};
                                const isCreation  = (rec.reason || '').toLowerCase().includes('creation');

                                const fmtDate = (d) => {
                                    if (!d) return '—';
                                    const dt = new Date(d);
                                    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                        + ', ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                                };

                                const payloadFields = [
                                    { label: 'Customer ID', value: snap.customer_id },
                                    { label: 'Business Name', value: snap.business_name },
                                    { label: 'Owner Name', value: snap.owner_name },
                                    { label: 'Phone', value: snap.phone },
                                    { label: 'Email', value: snap.email },
                                    { label: 'Address', value: snap.address },
                                    { label: 'Business Type', value: snap.business_type },
                                ].filter(f => f.value);

                                return (
                                    <div key={rec.id} className="relative flex gap-5 px-6 py-7">
                                        {/* Timeline dot */}
                                        <div className="flex-shrink-0 z-10 flex flex-col items-center">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 shadow-sm ${
                                                isLatest
                                                    ? 'bg-violet-600 border-violet-600 text-white'
                                                    : 'bg-white border-slate-200 text-slate-400'
                                            }`}>
                                                {versionNum}
                                            </div>
                                        </div>

                                        {/* Card */}
                                        <div className={`flex-1 rounded-2xl border p-5 ${isLatest ? 'border-violet-200 bg-violet-50/40' : 'border-slate-100 bg-white'}`}>
                                            {/* Header row */}
                                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                        isLatest ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        Version {versionNum}
                                                    </span>
                                                    {isLatest && (
                                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold">
                                                            Latest
                                                        </span>
                                                    )}
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                        isCreation
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {rec.reason || 'Initial Customer Creation'}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-semibold text-slate-500">{fmtDate(rec.generated_at)}</p>
                                                    {rec.generated_by && (
                                                        <p className="text-xs text-slate-400 mt-0.5">by {rec.generated_by}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Body: QR Preview + Data Snapshot side by side */}
                                            <div className="flex flex-col sm:flex-row gap-5">
                                                {/* QR Preview */}
                                                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                                    {rec.qr_data_url
                                                        ? <img
                                                            src={rec.qr_data_url}
                                                            alt={`QR Version ${versionNum}`}
                                                            className="w-28 h-28 rounded-2xl border border-slate-200 bg-white object-contain shadow-sm"
                                                          />
                                                        : <div className="w-28 h-28 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col items-center justify-center gap-1">
                                                            <QrCode size={28} className="text-slate-300" />
                                                            <span className="text-xs text-slate-300">No preview</span>
                                                          </div>
                                                    }
                                                    <span className="text-xs text-slate-400 font-medium">QR Preview</span>
                                                </div>

                                                {/* Data snapshot */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">QR Data Snapshot</p>
                                                    {payloadFields.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                                            {payloadFields.map(f => (
                                                                <div key={f.label} className="flex gap-2 min-w-0">
                                                                    <span className="text-xs text-slate-400 font-semibold flex-shrink-0 w-24">{f.label}</span>
                                                                    <span className="text-xs text-slate-700 font-medium break-words min-w-0">{String(f.value)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic">
                                                            Snapshot not available — generated before audit trail was enabled.
                                                        </p>
                                                    )}
                                                    {rec.qr_url_value && (
                                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                                            <span className="text-xs text-slate-400 font-semibold">Encoded URL: </span>
                                                            <span className="text-xs text-slate-500 break-all">{rec.qr_url_value}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── COMPLAINTS ───────────────────────────── */}
            {activeTab === 'complaints' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-slate-900">Complaint History</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {complaints.filter(c => !c.is_admin).length} from customer ·{' '}
                                {complaints.filter(c => c.is_admin).length} replies
                            </p>
                        </div>
                        <Link to="/admin/complaints"
                            className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                            Open in Complaint Center →
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                        {complaints.length === 0 && (
                            <div className="p-12 text-center">
                                <MessageSquare size={40} className="mx-auto text-slate-200 mb-3" />
                                <p className="text-sm text-slate-400">No complaints on record.</p>
                            </div>
                        )}
                        {complaints.map(c => (
                            <div key={c.id} className={`p-4 flex gap-3 ${c.is_admin ? 'bg-slate-50' : 'bg-white'}`}>
                                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                                    c.is_admin
                                        ? c.is_bot ? 'bg-blue-100 text-blue-700' : 'bg-slate-800 text-white'
                                        : 'bg-primary-100 text-primary-700'
                                }`}>
                                    {c.is_admin ? (c.is_bot ? '🤖' : 'A') : 'C'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-700">
                                            {c.is_admin ? (c.is_bot ? 'AI Bot' : 'Admin') : 'Customer'}
                                        </span>
                                        <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed">{c.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerProfile;
