import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import { Link } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    Users, DollarSign, Activity, AlertCircle, CheckCircle,
    UserPlus, Handshake, BarChart2, ArrowRight, ArrowUpRight,
    MessageSquare, FileText, TrendingUp, Eye, Clock, Inbox
} from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import { subtypeOnlyLabel } from '../../utils/productPartnerEligibility';

const SERVICE_PRICING = { inspection: 50, refilling: 65, installation: 150, validation: 45, maintenance: 80 };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PIE_COLORS = ['#ef4444','#f97316','#3b82f6','#10b981','#8b5cf6'];

const getBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (['completed','accepted','closed'].includes(s)) return 'bg-green-100 text-green-700';
    if (['rejected','cancelled'].includes(s)) return 'bg-red-100 text-red-700';
    if (['in progress','scheduled'].includes(s)) return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
};

/* ---------- Enhanced custom stat cards ---------- */

const RevenueCard = ({ revenue, totalInquiries, closedInquiries }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-soft hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-2xl bg-emerald-500">
                <DollarSign size={20} className="text-white" />
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 bg-green-100 text-green-700">
                <TrendingUp size={11} /> 12%
            </span>
        </div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Sales &amp; Revenue</p>
        <h3 className="text-2xl font-bold text-slate-900">SAR {revenue.toLocaleString()}</h3>
        <div className="mt-3 pt-3 border-t border-slate-50 space-y-1.5">
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">Total Inquiries</span>
                <span className="font-bold text-slate-700">{totalInquiries}</span>
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">Closed / Completed</span>
                <span className="font-bold text-emerald-600">{closedInquiries}</span>
            </div>
        </div>
    </div>
);

const TotalInquiriesCard = ({ total, active, closed }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-soft hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
        <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-2xl bg-blue-500">
                <Activity size={20} className="text-white" />
            </div>
        </div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Inquiries</p>
        <h3 className="text-2xl font-bold text-slate-900">{total}</h3>
        <div className="mt-3 pt-3 border-t border-slate-50 space-y-1.5 flex-1">
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">Active</span>
                <span className="font-bold text-blue-600">{active}</span>
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">Closed</span>
                <span className="font-bold text-slate-600">{closed}</span>
            </div>
        </div>
        <Link
            to="/admin/inquiries"
            className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl transition-colors"
        >
            <Eye size={12} /> View Details
        </Link>
    </div>
);

const CompletedCard = ({ completed, total, rate }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-soft hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-2xl bg-teal-500">
                <CheckCircle size={20} className="text-white" />
            </div>
        </div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">All-Time Completions</p>
        <h3 className="text-2xl font-bold text-slate-900">
            {completed} <span className="text-slate-400 font-medium text-lg">/ {total}</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">Completed inquiries</p>
        <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Completion Rate</span>
                <span className="font-bold text-teal-600">{rate}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div
                    className="bg-teal-500 h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${rate}%` }}
                />
            </div>
        </div>
    </div>
);

const PipelineCard = ({ pending, inProgress, scheduled }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-soft hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-2xl bg-amber-500">
                <Clock size={20} className="text-white" />
            </div>
        </div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Active Pipeline</p>
        <h3 className="text-2xl font-bold text-slate-900">{pending + inProgress + scheduled}</h3>
        <p className="text-xs text-slate-400 mt-1">Awaiting action</p>
        <div className="mt-3 pt-3 border-t border-slate-50 space-y-1.5">
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">Pending</span>
                <span className="font-bold text-amber-600">{pending}</span>
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">In Progress</span>
                <span className="font-bold text-blue-600">{inProgress}</span>
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">Scheduled</span>
                <span className="font-bold text-violet-600">{scheduled}</span>
            </div>
        </div>
    </div>
);

const QuotationCard = ({ totalValue, totalQuotations, wonCount }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-soft hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
        <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-2xl bg-purple-600">
                <FileText size={20} className="text-white" />
            </div>
        </div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Quotations</p>
        <h3 className="text-2xl font-bold text-slate-900">SAR {totalValue.toLocaleString()}</h3>
        <div className="mt-3 pt-3 border-t border-slate-50 space-y-1.5 flex-1">
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">Total Inquiries</span>
                <span className="font-bold text-slate-700">{totalQuotations}</span>
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">Closed / Completed</span>
                <span className="font-bold text-emerald-600">{wonCount}</span>
            </div>
        </div>
        <Link
            to="/admin/quotations"
            className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl transition-colors"
        >
            <Eye size={12} /> View Details
        </Link>
    </div>
);

/* ------------------------------------------------ */

/** "Validation - Follow-up" style label from the first item's sub-type. */
const requestTypeLabel = (inq) => {
    const sub = subtypeOnlyLabel(inq.type, inq.inquiry_items?.[0]?.validation_mode);
    return sub ? `${inq.type} - ${sub}` : inq.type || '—';
};

/**
 * Customer requests awaiting Partner assignment — every customer-created inquiry lands
 * here first (Admin-first workflow). "Assign" opens the inquiry, where Admin picks an
 * eligible Partner.
 */
const CustomerRequestsPanel = ({ requests }) => {
    const shown = requests.slice(0, 6);
    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
            <div className="flex items-center justify-between mb-5 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-sky-50">
                        <Inbox size={18} className="text-sky-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            Customer Requests
                            {requests.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-sky-600 text-white text-[11px] font-bold">{requests.length}</span>
                            )}
                        </h3>
                        <p className="text-xs text-slate-400">Awaiting partner assignment</p>
                    </div>
                </div>
                <Link to="/admin/general-inquiries?source=customer" className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1 shrink-0">
                    Manage all <ArrowRight size={12} />
                </Link>
            </div>
            {shown.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No customer requests are waiting for assignment.</p>
            ) : (
                <div className="space-y-1">
                    {shown.map((inq) => {
                        const product = (inq.inquiry_items || []).find((it) => it.products || it.catalog_no);
                        return (
                            <div key={inq.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-900 truncate">
                                        {inq.inquiry_no || `#${inq.id?.toString().slice(-6)}`}
                                        <span className="ml-2 font-medium text-slate-500">{requestTypeLabel(inq)}</span>
                                    </p>
                                    <p className="text-xs text-slate-400 truncate">
                                        {inq.customers?.business_name || 'Customer'}
                                        {' · '}
                                        {inq.agents?.name ? `Agent: ${inq.agents.name}` : 'Needs agent assignment'}
                                        {product && (
                                            <>
                                                {' · '}
                                                {[product.products?.name, product.products?.model_number ? `Product# ${product.products.model_number}` : null, product.catalog_no ? `CAT# ${product.catalog_no}` : null].filter(Boolean).join(' · ')}
                                            </>
                                        )}
                                        {' · '}
                                        {new Date(inq.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <Link
                                    to={`/admin/inquiries/${inq.id}`}
                                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <Handshake size={12} /> Assign
                                </Link>
                            </div>
                        );
                    })}
                    {requests.length > shown.length && (
                        <Link to="/admin/general-inquiries?source=customer" className="block text-center text-xs font-bold text-primary-600 hover:underline pt-2">
                            +{requests.length - shown.length} more
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
};

const AdminDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [
                    { count: totalAgents },
                    { count: activeAgents },
                    { count: totalCustomers },
                    { count: totalPartners },
                    { count: openComplaints },
                    { data: inquiries },
                    { data: recentInquiries },
                    { data: agentsData },
                    { data: quotationsData },
                    { data: customerRequests },
                ] = await Promise.all([
                    supabase.from('agents').select('*', { count: 'exact', head: true }),
                    supabase.from('agents').select('*', { count: 'exact', head: true }).or('status.ilike.accepted,status.ilike.active'),
                    supabase.from('customers').select('*', { count: 'exact', head: true }),
                    supabase.from('partners').select('*', { count: 'exact', head: true }),
                    supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('is_admin', false).eq('is_read', false),
                    supabase.from('inquiries').select('id,type,status,created_at,agent_id').order('created_at', { ascending: false }),
                    supabase.from('inquiries')
                        .select('id,inquiry_no,type,status,created_at,customer_id,agent_id,customers(business_name),agents(name)')
                        .order('created_at', { ascending: false })
                        .limit(6),
                    supabase.from('agents').select('id,name').or('status.ilike.accepted,status.ilike.active'),
                    supabase.from('quotations').select('estimated_cost, inquiries(status)'),
                    // Customer requests waiting for Admin to assign a Partner (Admin-first workflow).
                    supabase.from('inquiries')
                        .select('id,inquiry_no,type,status,created_at,customer_id,agent_id,customers(business_name),agents(name),inquiry_items(validation_mode,catalog_no,products(name,model_number))')
                        .eq('performed_by', 'Customer')
                        .eq('is_general_inquiry', true)
                        .is('partner_id', null)
                        .order('created_at', { ascending: false }),
                ]);

                const list = inquiries || [];

                // Revenue estimate
                let totalRevenue = 0;
                const monthlyMap = {};
                list.forEach(i => {
                    const price = SERVICE_PRICING[(i.type||'').toLowerCase()] || 50;
                    if (['completed','accepted','closed'].includes((i.status||'').toLowerCase())) {
                        totalRevenue += price;
                    }
                    const d = new Date(i.created_at);
                    const key = MONTHS[d.getMonth()];
                    if (!monthlyMap[key]) monthlyMap[key] = { name: key, inquiries: 0, revenue: 0, month: d.getMonth() };
                    monthlyMap[key].inquiries += 1;
                    if (['completed','accepted','closed'].includes((i.status||'').toLowerCase())) {
                        monthlyMap[key].revenue += price;
                    }
                });
                const revenueChart = MONTHS
                    .map(m => monthlyMap[m] || null)
                    .filter(Boolean)
                    .slice(-6);

                // Inquiry by type
                const typeMap = {};
                list.forEach(i => {
                    const t = i.type || 'Unknown';
                    typeMap[t] = (typeMap[t] || 0) + 1;
                });
                const typeBreakdown = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

                // Completion metrics
                const completed = list.filter(i => ['completed','accepted','closed'].includes((i.status||'').toLowerCase())).length;
                const completionRate = list.length ? Math.round((completed / list.length) * 100) : 0;
                const closedInquiries = list.filter(i => ['completed','accepted','closed','rejected','cancelled'].includes((i.status||'').toLowerCase())).length;
                const activeInquiries = list.length - closedInquiries;

                // Pipeline breakdown
                const pendingCount   = list.filter(i => (i.status||'').toLowerCase() === 'pending').length;
                const inProgressCount = list.filter(i => (i.status||'').toLowerCase() === 'in progress').length;
                const scheduledCount = list.filter(i => (i.status||'').toLowerCase() === 'scheduled').length;

                // Quotation metrics
                const quotationsList = quotationsData || [];
                const totalQuotedValue = quotationsList.reduce((sum, q) => sum + (Number(q.estimated_cost) || 0), 0);
                const wonQuotationsCount = quotationsList.filter(q =>
                    ['completed','accepted','closed'].includes((q.inquiries?.status || '').toLowerCase())
                ).length;

                // Top agents by inquiry count
                const agentInquiryMap = {};
                list.forEach(i => {
                    if (i.agent_id) agentInquiryMap[i.agent_id] = (agentInquiryMap[i.agent_id] || 0) + 1;
                });
                const agentMap = {};
                (agentsData || []).forEach(a => { agentMap[a.id] = a.name; });
                const topAgents = Object.entries(agentInquiryMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([id, count]) => ({ name: agentMap[id] || 'Unknown', count, id }));

                setData({
                    totalAgents: totalAgents || 0,
                    activeAgents: activeAgents || 0,
                    totalCustomers: totalCustomers || 0,
                    totalPartners: totalPartners || 0,
                    openComplaints: openComplaints || 0,
                    totalInquiries: list.length,
                    completedInquiries: completed,
                    closedInquiries,
                    activeInquiries,
                    pendingInquiries: list.filter(i => !['completed','accepted','closed','rejected'].includes((i.status||'').toLowerCase())).length,
                    pendingCount,
                    inProgressCount,
                    scheduledCount,
                    totalRevenue,
                    completionRate,
                    revenueChart,
                    typeBreakdown,
                    topAgents,
                    recentInquiries: recentInquiries || [],
                    totalQuotedValue,
                    totalQuotations: quotationsList.length,
                    wonQuotationsCount,
                    customerRequests: customerRequests || [],
                });
            } catch (err) {
                console.error('Dashboard load error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <PageLoader message="Loading dashboard..." />;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin Panel</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Business Overview</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Real-time platform performance and operational metrics.</p>
                </div>
                <div className="flex gap-3">
                    <Link to="/admin/analytics" className="btn-outline text-sm py-2 px-4 flex items-center gap-2">
                        <BarChart2 size={16} /> Analytics
                    </Link>
                    <Link to="/admin/reports" className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
                        <FileText size={16} /> Reports
                    </Link>
                </div>
            </div>

            <CustomerRequestsPanel requests={data?.customerRequests || []} />

            {/* KPI Row 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <RevenueCard
                    revenue={data?.totalRevenue || 0}
                    totalInquiries={data?.totalInquiries || 0}
                    closedInquiries={data?.closedInquiries || 0}
                />
                <StatCard icon={Handshake}   title="Total Partners"  value={data?.totalPartners||0}   color="bg-orange-500" subtext="Service partners" />
                <StatCard icon={Users}       title="Active Agents"   value={data?.activeAgents||0}    color="bg-violet-500"  subtext={`${data?.totalAgents||0} total registered`} />
                <StatCard icon={AlertCircle} title="Open Complaints" value={data?.openComplaints||0}  color="bg-red-500"     subtext="Unread threads" />
            </div>

            {/* KPI Row 2 */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={UserPlus} title="Total Customers" value={data?.totalCustomers||0} color="bg-sky-500" trend={5} subtext="Registered businesses" />
                <TotalInquiriesCard
                    total={data?.totalInquiries || 0}
                    active={data?.activeInquiries || 0}
                    closed={data?.closedInquiries || 0}
                />
                <CompletedCard
                    completed={data?.completedInquiries || 0}
                    total={data?.totalInquiries || 0}
                    rate={data?.completionRate || 0}
                />
                <PipelineCard
                    pending={data?.pendingCount || 0}
                    inProgress={data?.inProgressCount || 0}
                    scheduled={data?.scheduledCount || 0}
                />
                <QuotationCard
                    totalValue={data?.totalQuotedValue || 0}
                    totalQuotations={data?.totalQuotations || 0}
                    wonCount={data?.wonQuotationsCount || 0}
                />
            </div>

            {/* Charts Row */}
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-slate-900">Revenue &amp; Inquiry Trends</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Last 6 months overview</p>
                        </div>
                        <Link to="/admin/analytics" className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                            Full Analytics <ArrowUpRight size={13} />
                        </Link>
                    </div>
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.revenueChart || []}>
                                <defs>
                                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="gInq" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:12 }}/>
                                <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:12 }}/>
                                <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                                <Area type="monotone" dataKey="revenue" name="Revenue (SAR)" stroke="#10b981" strokeWidth={2.5} fill="url(#gRev)"/>
                                <Area type="monotone" dataKey="inquiries" name="Inquiries" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gInq)"/>
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <h3 className="font-bold text-slate-900 mb-1">Service Breakdown</h3>
                    <p className="text-xs text-slate-400 mb-4">Inquiries by type</p>
                    {(data?.typeBreakdown||[]).length > 0 ? (
                        <>
                            <div className="h-[170px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={data?.typeBreakdown||[]} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                                            {(data?.typeBreakdown||[]).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius:'10px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-2 mt-3">
                                {(data?.typeBreakdown||[]).slice(0,4).map((item, i) => (
                                    <div key={item.name} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}/>
                                            <span className="text-slate-600 capitalize text-xs">{item.name}</span>
                                        </div>
                                        <span className="font-bold text-slate-900 text-sm">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[200px] text-slate-300">
                            <Activity size={32} className="mb-2"/>
                            <p className="text-sm">No data yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Row: Top Agents + Recent Inquiries */}
            <div className="grid lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-slate-900">Top Agents</h3>
                        <Link to="/admin/analytics" className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                            Full Leaderboard <ArrowRight size={12}/>
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {(data?.topAgents||[]).length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-6">No agent data available.</p>
                        )}
                        {(data?.topAgents||[]).map((agent, i) => (
                            <Link key={agent.id} to={`/admin/agents/${agent.id}`} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors group">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                    i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{agent.name}</p>
                                    <p className="text-xs text-slate-400">{agent.count} inquiries</p>
                                </div>
                                <ArrowRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors"/>
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-slate-900">Recent Inquiries</h3>
                        <Link to="/admin/inquiries" className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                            View all <ArrowRight size={12}/>
                        </Link>
                    </div>
                    <div className="space-y-1">
                        {(data?.recentInquiries||[]).map(inq => (
                            <div key={inq.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors">
                                <div className="min-w-0 flex-1">
                                    <Link
                                        to={`/admin/inquiries/${inq.id}`}
                                        className="text-sm font-bold text-slate-900 hover:text-primary-600 truncate block"
                                    >
                                        {inq.inquiry_no || `#${inq.id?.toString().slice(-6)}`}
                                    </Link>
                                    <p className="text-xs text-slate-400 flex items-center gap-1 flex-wrap">
                                        {inq.customer_id ? (
                                            <Link
                                                to={`/admin/customers/${inq.customer_id}`}
                                                className="hover:text-sky-600 hover:underline font-medium"
                                            >
                                                {inq.customers?.business_name || '—'}
                                            </Link>
                                        ) : (
                                            <span>{inq.customers?.business_name || '—'}</span>
                                        )}
                                        <span>·</span>
                                        {inq.agent_id ? (
                                            <Link
                                                to={`/admin/agents/${inq.agent_id}`}
                                                className="hover:text-violet-600 hover:underline font-medium"
                                            >
                                                {inq.agents?.name || 'Unassigned'}
                                            </Link>
                                        ) : (
                                            <span>{inq.agents?.name || 'Unassigned'}</span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                    <span className="text-xs font-semibold text-slate-400 capitalize hidden sm:block">{inq.type||'—'}</span>
                                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getBadgeClass(inq.status)}`}>{inq.status||'Pending'}</span>
                                </div>
                            </div>
                        ))}
                        {(!data?.recentInquiries?.length) && (
                            <p className="text-sm text-slate-400 text-center py-6">No inquiries found.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Nav */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {[
                    { label:'Analytics',   to:'/admin/analytics',  icon:BarChart2,     bg:'bg-blue-50',    text:'text-blue-600' },
                    { label:'Agents',      to:'/admin/agents',     icon:Users,         bg:'bg-violet-50',  text:'text-violet-600' },
                    { label:'Partners',    to:'/admin/partners',   icon:Handshake,     bg:'bg-orange-50',  text:'text-orange-600' },
                    { label:'Customers',   to:'/admin/customers',  icon:UserPlus,      bg:'bg-sky-50',     text:'text-sky-600' },
                    { label:'Operations',  to:'/admin/operations', icon:Activity,      bg:'bg-teal-50',    text:'text-teal-600' },
                    { label:'Complaints',  to:'/admin/complaints', icon:MessageSquare, bg:'bg-red-50',     text:'text-red-600' },
                ].map(({ label, to, icon: Icon, bg, text }) => (
                    <Link key={to} to={to} className={`${bg} rounded-2xl p-4 flex flex-col items-center gap-2 hover:shadow-sm transition-all`}>
                        <Icon size={20} className={text} />
                        <p className={`text-xs font-bold ${text}`}>{label}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default AdminDashboard;
