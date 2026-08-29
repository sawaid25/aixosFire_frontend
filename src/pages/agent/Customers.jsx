import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Search, MapPin, Phone, ArrowRight, User, Plus, RefreshCw, Calendar, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageLoader from "../../components/PageLoader";

const formatDateTime = (value) => {
    if (!value) return { date: 'N/A', time: null };
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return { date: 'N/A', time: null };
    return {
        date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    };
};

const initials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
};

/** Two-line date/time cell used by the desktop table's Created At / Last Visit columns. */
const DateTimeCell = ({ Icon, value }) => {
    const { date, time } = formatDateTime(value);
    return (
        <div className="flex items-center gap-2">
            <Icon size={14} className="text-slate-300 shrink-0" />
            <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-700">{date}</p>
                {time && <p className="text-[11px] text-slate-400">{time}</p>}
            </div>
        </div>
    );
};

const statusBadgeClass = (status) => {
    if (status === 'Active') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10';
    if (status === 'Lead') return 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10';
    return 'bg-slate-100 text-slate-600 ring-1 ring-slate-500/10';
};

const statusDotClass = (status) => {
    if (status === 'Active') return 'bg-emerald-500';
    if (status === 'Lead') return 'bg-blue-500';
    return 'bg-slate-400';
};

const getTimeBounds = (period) => {
    const now = new Date();
    if (period === 'today') {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        return { start, end: now };
    }
    if (period === 'week') {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
    }
    if (period === 'month') {
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }
    return null;
};

const Customers = () => {
    const { user } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [timePeriod, setTimePeriod] = useState('all');

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const { data, error } = await supabase
                    .from('visits')
                    .select(`
                        customer_id,
                        visit_date,
                        customers (*)
                    `)
                    .eq('agent_id', user.id)
                    .order('visit_date', { ascending: false });

                if (error) throw error;

                // Deduplicate customers (show latest visit)
                const uniqueCustomers = [];
                const seen = new Set();

                data.forEach(v => {
                    if (v.customers && !seen.has(v.customer_id)) {
                        seen.add(v.customer_id);
                        uniqueCustomers.push({
                            ...v.customers,
                            last_visit: v.visit_date
                        });
                    }
                });

                // Mark customers who have a pending follow-up validation item
                const customerIds = uniqueCustomers.map(c => c.id);
                if (customerIds.length > 0) {
                    const { data: followUps, error: followUpErr } = await supabase
                        .from('inquiry_items')
                        .select('customer_id')
                        .in('customer_id', customerIds)
                        .eq('validation_mode', 'followup');

                    if (followUpErr) throw followUpErr;

                    const followUpIds = new Set((followUps || []).map(f => f.customer_id));
                    uniqueCustomers.forEach(c => {
                        c.hasFollowUp = followUpIds.has(c.id);
                    });
                }

                setCustomers(uniqueCustomers);
            } catch (err) {
                console.error("Failed to fetch customers", err);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchCustomers();
    }, [user]);

    const filteredCustomers = customers.filter(c => {
        const matchesSearch =
            c.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone?.includes(searchTerm) ||
            c.owner_name?.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        const bounds = getTimeBounds(timePeriod);
        if (bounds) {
            if (!c.last_visit) return false;
            const visitDate = new Date(c.last_visit);
            if (visitDate < bounds.start || visitDate > bounds.end) return false;
        }

        return true;
    });

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading Customers..." />}

            {/* Header + Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">My Customers</h1>
                    <p className="text-slate-500">Manage your relationships and follow-ups.</p>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by business or phone..."
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Time Period Filters */}
            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'all', label: 'All Time' },
                    { key: 'today', label: 'Today' },
                    { key: 'week', label: 'This Week' },
                    { key: 'month', label: 'This Month' },
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setTimePeriod(key)}
                        className={`text-xs px-4 py-2 rounded-xl font-semibold transition-colors ${timePeriod === key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Empty State */}
            {!loading && filteredCustomers.length === 0 && (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <User size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No Customers Found</h3>
                    {customers.length === 0 ? (
                        <>
                            <p className="text-slate-500 mb-6">You haven't logged any visits yet.</p>
                            <Link to="/agent/visit" className="btn-primary inline-flex items-center gap-2">
                                <Plus size={20} /> Log First Visit
                            </Link>
                        </>
                    ) : (
                        <p className="text-slate-500">No customers match the selected filter or search.</p>
                    )}
                </div>
            )}

            {/* Main Content */}
            {!loading && filteredCustomers.length > 0 && (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[980px]">
                                <thead>
                                    <tr className="bg-slate-50/60 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                                        <th className="px-6 py-4">#</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Location</th>
                                        <th className="px-6 py-4">Created At</th>
                                        <th className="px-6 py-4">Last Visit</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredCustomers.map((customer) => (
                                        <tr key={customer.id} className="hover:bg-slate-50/70 transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold font-mono">
                                                    {customer.id}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-black text-xs shrink-0">
                                                        {initials(customer.business_name || customer.owner_name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-slate-900">{customer.business_name}</span>
                                                            {customer.hasFollowUp && (
                                                                <span
                                                                    title="Pending follow-up validation"
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"
                                                                >
                                                                    <RefreshCw size={10} /> Follow-up
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-0.5">{customer.owner_name || 'N/A'}</p>
                                                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                                            <Phone size={12} /> {customer.phone || "N/A"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-[220px]">
                                                <div className="text-sm text-slate-600 flex items-start gap-1.5" title={customer.address || ''}>
                                                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2">{customer.address || "N/A"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <DateTimeCell Icon={Calendar} value={customer.created_at} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <DateTimeCell Icon={History} value={customer.last_visit} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusBadgeClass(customer.status)}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(customer.status)}`} />
                                                    {customer.status || 'Lead'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    to={`/agent/customer/${customer.id}`}
                                                    className="inline-flex items-center justify-center w-11 h-11 text-slate-400 group-hover:text-primary-600 group-hover:bg-primary-50 rounded-2xl transition-colors"
                                                    title="View Customer"
                                                >
                                                    <ArrowRight size={20} />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="block md:hidden space-y-4">
                        {filteredCustomers.map((customer) => {
                            const created = formatDateTime(customer.created_at);
                            const lastVisit = formatDateTime(customer.last_visit);
                            return (
                                <div
                                    key={customer.id}
                                    className="bg-white rounded-3xl shadow-soft border border-slate-100 p-6 hover:shadow-md transition-all"
                                >
                                    <div className="flex justify-between items-start gap-3 mb-4">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-black text-sm shrink-0">
                                                {initials(customer.business_name || customer.owner_name)}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID #{customer.id}</span>
                                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                                    <div className="font-bold text-lg text-slate-900 truncate">
                                                        {customer.business_name}
                                                    </div>
                                                    {customer.hasFollowUp && (
                                                        <span
                                                            title="Pending follow-up validation"
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 shrink-0"
                                                        >
                                                            <RefreshCw size={10} /> Follow-up
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-slate-500 mt-0.5">
                                                    {customer.owner_name || "N/A"}
                                                </div>
                                            </div>
                                        </div>

                                        <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusBadgeClass(customer.status)}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(customer.status)}`} />
                                            {customer.status || 'Lead'}
                                        </span>
                                    </div>

                                    {/* Contact & Location */}
                                    <div className="space-y-3 text-sm border-t border-slate-50 pt-4">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Phone size={16} className="text-slate-400 shrink-0" />
                                            <span>{customer.phone || "No phone"}</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-slate-600">
                                            <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                            <span>{customer.address || "No address provided"}</span>
                                        </div>
                                    </div>

                                    {/* Created At / Last Visit */}
                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div className="bg-slate-50 rounded-2xl p-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                                <Calendar size={11} /> Created
                                            </p>
                                            <p className="text-sm font-semibold text-slate-800">{created.date}</p>
                                            {created.time && <p className="text-[11px] text-slate-400">{created.time}</p>}
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                                <History size={11} /> Last Visit
                                            </p>
                                            <p className="text-sm font-semibold text-slate-800">{lastVisit.date}</p>
                                            {lastVisit.time && <p className="text-[11px] text-slate-400">{lastVisit.time}</p>}
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <Link
                                        to={`/agent/customer/${customer.id}`}
                                        className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-2xl font-bold text-sm transition-colors"
                                    >
                                        View Details
                                        <ArrowRight size={18} />
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export default Customers;