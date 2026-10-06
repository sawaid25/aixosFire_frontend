import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, Clock, FileText, Wrench, Loader2, Hash, RefreshCw } from 'lucide-react';
import PageLoader from '../../components/PageLoader';
import InquiryStatusBadge from '../../components/InquiryStatusBadge';
import { fetchCustomerInquiries } from '../../api/customerPortal';
import { formatDateSafe, buildHistoryRowsFromInquiry, inquiryProductSummary, assignedPartnerInfo } from './dashboardUtils';

const ServiceTimeline = ({ status }) => {
    const steps = ['Requested', 'Scheduled', 'In Progress', 'Completed'];
    const currentStepIndex = steps.indexOf(status) === -1 ? 0 : steps.indexOf(status);

    return (
        <div className="flex items-center justify-between w-full mt-4 mb-8 px-2 relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 -translate-y-1/2 rounded-full"></div>
            <div
                className="absolute top-1/2 left-0 h-0.5 bg-green-500 -z-10 -translate-y-1/2 transition-all duration-500"
                style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
            ></div>

            {steps.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                    <div key={step} className="flex flex-col items-center gap-2 bg-white px-2">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                                isCompleted ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-300'
                            }`}
                        >
                            {isCompleted ? <CheckCircle size={14} /> : <div className="w-2 h-2 rounded-full bg-slate-200" />}
                        </div>
                        <span className={`text-xs font-semibold ${isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>{step}</span>
                    </div>
                );
            })}
        </div>
    );
};

const History = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [services, setServices] = useState([]);
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inqLoading, setInqLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('active');

    useEffect(() => {
        const fetchHistory = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('services')
                    .select('*')
                    .eq('customer_id', user.id)
                    .order('scheduled_date', { ascending: false });

                if (error) throw error;
                setServices(data || []);
            } catch (err) {
                console.error('Failed to fetch history', err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [user]);

    const userId = user?.id;
    const [inqError, setInqError] = useState(null);
    const [inqReloadKey, setInqReloadKey] = useState(0);

    useEffect(() => {
        if (!userId) return undefined;
        let cancelled = false;
        setInqLoading(true);
        setInqError(null);
        (async () => {
            try {
                const data = await fetchCustomerInquiries();
                if (cancelled) return;
                // Every inquiry of this customer, newest first — no type/status/partner filter,
                // so requests still pending with Admin are listed too.
                const list = Array.isArray(data) ? [...data] : [];
                list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                setInquiries(list);
                if (import.meta.env.DEV) {
                    console.debug('[Customer History] inquiries', data);
                }
            } catch (e) {
                if (cancelled) return;
                console.warn('[Customer History] inquiries unavailable', e);
                // Keep any previously loaded list; surface the failure instead of an empty list.
                setInqError(e?.response?.data?.error || e?.message || 'Your inquiries could not be loaded.');
            } finally {
                if (!cancelled) setInqLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId, inqReloadKey]);

    const activeServices = services.filter((s) => ['Requested', 'Scheduled', 'In Progress'].includes(s.status));
    const pastServices = services.filter((s) => ['Completed', 'Cancelled'].includes(s.status));
    const displayedServices = activeTab === 'active' ? activeServices : pastServices;

    const StatusBadge = ({ status }) => {
        const styles = {
            Requested: 'bg-blue-50 text-blue-600 border-blue-200',
            Scheduled: 'bg-purple-50 text-purple-600 border-purple-200',
            'In Progress': 'bg-orange-50 text-orange-600 border-orange-200',
            Completed: 'bg-green-50 text-green-600 border-green-200',
            Cancelled: 'bg-red-50 text-red-600 border-red-200'
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status] || styles['Requested']}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="relative min-h-[400px] max-w-4xl mx-auto space-y-8">
            {loading && <PageLoader message="Loading service record..." />}

            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Service & inquiry history</h1>
                <p className="text-slate-500">Track bookings, inquiries, and past work.</p>
            </div>

            {/* Inquiries from API */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-primary-500" /> Inquiries
                </h2>
                {inqError && (
                    <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <span>Your inquiries could not be loaded right now.</span>
                        <button
                            type="button"
                            onClick={() => setInqReloadKey((k) => k + 1)}
                            disabled={inqLoading}
                            className="text-primary-600 font-bold flex items-center gap-1 shrink-0 disabled:opacity-50"
                        >
                            <RefreshCw size={14} /> Try again
                        </button>
                    </div>
                )}
                {inqLoading && inquiries.length === 0 ? (
                    <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
                        <Loader2 className="animate-spin" size={18} /> Loading inquiries...
                    </div>
                ) : inquiries.length === 0 ? (
                    !inqError && (
                        <p className="text-slate-500 text-sm">
                            No inquiries yet.{' '}
                            <Link to="/customer/booking" className="text-primary-600 font-semibold hover:underline">Create an inquiry</Link>
                        </p>
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <th className="py-3 pr-4">Inquiry</th>
                                    <th className="py-3 pr-4">Type</th>
                                    <th className="py-3 pr-4">Product</th>
                                    <th className="py-3 pr-4">Created</th>
                                    <th className="py-3 pr-4">Partner</th>
                                    <th className="py-3 pr-4">Internal ref</th>
                                    <th className="py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {inquiries.map((inq) => {
                                    const row = buildHistoryRowsFromInquiry(inq);
                                    const product = inquiryProductSummary(inq);
                                    const partner = assignedPartnerInfo(inq);
                                    return (
                                        <tr
                                            key={inq.id}
                                            onClick={() => navigate(`/customer/inquiries/${inq.id}`)}
                                            className="cursor-pointer hover:bg-slate-50"
                                        >
                                            <td className="py-3 pr-4 font-bold text-primary-600">
                                                <Link
                                                    to={`/customer/inquiries/${inq.id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="hover:underline"
                                                >
                                                    {row.inquiryNo}
                                                </Link>
                                            </td>
                                            <td className="py-3 pr-4 capitalize">{row.serviceType}</td>
                                            <td className="py-3 pr-4 text-slate-600">
                                                {product ? (
                                                    <>
                                                        <span className="block text-slate-800">{product.name || '—'}</span>
                                                        <span className="block text-xs text-slate-500 font-mono">
                                                            {[
                                                                product.productNo ? `Product# ${product.productNo}` : null,
                                                                product.catNo ? `CAT# ${product.catNo}` : null,
                                                                product.more > 0 ? `+${product.more} more` : null
                                                            ].filter(Boolean).join(' · ')}
                                                        </span>
                                                    </>
                                                ) : '—'}
                                            </td>
                                            <td className="py-3 pr-4 text-slate-600">{row.serviceDate ? formatDateSafe(row.serviceDate) : '—'}</td>
                                            <td className="py-3 pr-4 text-slate-600">
                                                {partner.pendingLabel ? <span className="italic text-slate-500">{partner.pendingLabel}</span> : partner.name}
                                            </td>
                                            <td className="py-3 pr-4 text-slate-600">
                                                <span className="flex items-center gap-1"><Hash size={12} /> {row.internalRef}</span>
                                            </td>
                                            <td className="py-3">
                                                <InquiryStatusBadge status={inq.status} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Active tracking ({activeServices.length})
                </button>
                <button
                    onClick={() => setActiveTab('past')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'past' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Past history
                </button>
            </div>

            <div className="space-y-4">
                {!loading && displayedServices.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <FileText size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No {activeTab} services</h3>
                        <p className="text-slate-500">Legacy service bookings will appear here.</p>
                    </div>
                ) : (
                    displayedServices.map((service) => (
                        <div key={service.id} className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 transition-all hover:shadow-lg">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Wrench size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 capitalize">{service.service_type} service</h3>
                                        <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                                            <Calendar size={14} />
                                            Booked for{' '}
                                            {service.scheduled_date
                                                ? new Date(service.scheduled_date).toLocaleDateString(undefined, {
                                                      weekday: 'long',
                                                      year: 'numeric',
                                                      month: 'long',
                                                      day: 'numeric'
                                                  })
                                                : 'Pending'}
                                        </p>
                                    </div>
                                </div>
                                <StatusBadge status={service.status} />
                            </div>

                            {activeTab === 'active' && <ServiceTimeline status={service.status} />}

                            <div className="flex gap-8 pt-4 border-t border-slate-50">
                                <div>
                                    <span className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Notes</span>
                                    <p className="text-sm text-slate-600">{service.notes || 'No additional notes.'}</p>
                                </div>
                                {service.amount > 0 && (
                                    <div className="ml-auto text-right">
                                        <span className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total</span>
                                        <p className="text-lg font-bold text-slate-900">SAR {service.amount}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default History;
