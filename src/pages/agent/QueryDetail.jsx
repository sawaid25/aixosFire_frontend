import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import {
    ArrowLeft,
    Calendar,
    User,
    Mail,
    FireExtinguisher,
    Scale,
    Box,
    Activity,
    DollarSign,
    Info,
    ChevronRight,
    ShieldCheck,
    FileText,
    ArrowRight,
    Building2
} from 'lucide-react';
import PageLoader from '../../components/PageLoader';
import {
    confirmDeliverySchedule,
    rejectDeliverySchedule,
    switchPartner
} from '../../api/maintenanceApi';
import SwitchPartnerModal from './components/SwitchPartnerModal';
import InquiryChatBox from '../../components/Chat/InquiryChatBox';
import { toast } from 'react-hot-toast';
import { Truck, Clock, CheckCircle, AlertCircle, UserPlus, MessageCircle, X } from 'lucide-react';

const QueryDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [query, setQuery] = useState(null);
    const [customer, setCustomer] = useState(null);
    const [quotation, setQuotation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);

    useEffect(() => {
        fetchQueryDetail();
    }, [id]);

    const fetchQueryDetail = async () => {
        setLoading(true);
        try {
            const { data: inquiryData, inquiryError } = await supabase
                .from('inquiries')
                .select(`
                    *,
                    visits (
                        visit_date,
                        agent_id
                    ),
                    partners (
                        business_name,
                        email
                    )
                `)
                .eq('id', id)
                .single();

            if (inquiryError) throw inquiryError;

            let itemsRes = await supabase
                .from('inquiry_items')
                .select('*, follow_up_history(*)')
                .eq('inquiry_id', id)
                .order('created_at', { foreignTable: 'follow_up_history', ascending: false });

            if (itemsRes.error) {
                const errText = `${itemsRes.error?.message || ''} ${itemsRes.error?.details || ''}`;
                const followUpMissing = /follow_up_history|PGRST204|schema cache|column/i.test(errText);
                if (followUpMissing) {
                    itemsRes = await supabase
                        .from('inquiry_items')
                        .select('*')
                        .eq('inquiry_id', id);
                }
            }

            const { data: itemsData, error: itemsError } = itemsRes;
            if (itemsError) throw itemsError;

            const { data: quotationData } = await supabase
                .from('quotations')
                .select('estimated_cost, created_at')
                .eq('inquiry_id', id)
                .single();

            setQuotation(quotationData);

            const allItems = (itemsData || []).map((item) => ({
                ...item,
                follow_up_history: Array.isArray(item.follow_up_history) ? item.follow_up_history : [],
            }));
            const sortedItems = [...allItems].sort((a, b) => (a.serial_no || 0) - (b.serial_no || 0));

            const primaryQuery = {
                ...inquiryData,
                inquiry_items: sortedItems
            };

            setQuery(primaryQuery);

            if (inquiryData.customer_id) {
                const { data: customerData } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('id', inquiryData.customer_id)
                    .single();

                if (customerData) setCustomer(customerData);
            }

            if (inquiryData?.agent_id) {
                const { data: agentData } = await supabase
                    .from('agents')
                    .select('name, email')
                    .eq('id', inquiryData.agent_id)
                    .single();

                if (agentData) {
                    primaryQuery.agent = agentData;
                    setQuery({ ...primaryQuery });
                }
            }

        } catch (err) {
            console.error('Error fetching query detail:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date) =>
        date ? new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'N/A';

    const formatDateOnly = (date) =>
        date ? new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'N/A';

    const handleConfirmDelivery = async () => {
        setActionLoading(true);
        try {
            try {
                await confirmDeliverySchedule(id);
            } catch (apiErr) {
                const text = `${apiErr?.message || ''} ${apiErr?.response?.data?.error || ''}`;
                const constraintHit = /check_delivery_status|violates check constraint/i.test(text);
                if (!constraintHit) throw apiErr;
                // Fallback for environments where API sends legacy/invalid enum values.
                const { error: fallbackErr } = await supabase
                    .from('inquiries')
                    .update({ delivery_status: 'confirmed' })
                    .eq('id', id);
                if (fallbackErr) throw fallbackErr;
            }
            toast.success('Delivery schedule confirmed.');
            await fetchQueryDetail();
        } catch {
            toast.error('Failed to confirm delivery schedule.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectDelivery = async () => {
        setActionLoading(true);
        try {
            try {
                await rejectDeliverySchedule(id);
            } catch (apiErr) {
                const text = `${apiErr?.message || ''} ${apiErr?.response?.data?.error || ''}`;
                const constraintHit = /check_delivery_status|violates check constraint/i.test(text);
                if (!constraintHit) throw apiErr;
                const { error: fallbackErr } = await supabase
                    .from('inquiries')
                    .update({ delivery_status: 'rejected' })
                    .eq('id', id);
                if (fallbackErr) throw fallbackErr;
            }
            toast.success('Delivery schedule rejected.');
            await fetchQueryDetail();
        } catch {
            toast.error('Failed to reject delivery schedule.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSwitchPartner = async (payload) => {
        setActionLoading(true);
        try {
            await switchPartner(id, payload);
            toast.success('Partner switched successfully.');
            setIsSwitchModalOpen(false);
            await fetchQueryDetail();
        } catch {
            toast.error('Failed to switch partner.');
        } finally {
            setActionLoading(false);
        }
    };

    const primaryItem = query?.inquiry_items?.[0] || null;

    if (loading) return <PageLoader message="Loading query details..." />;
    if (!query) return (
        <div className="p-10 text-center">
            <p className="text-slate-500 mb-4">Query not found</p>
            <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">Go Back</button>
        </div>
    );

    return (
        <div className="mx-auto p-4 md:p-6 space-y-8 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                            {query.inquiry_no || query.type || 'Query Details'}
                        </h1>
                        <p className="text-sm text-slate-500">
                            ID: #{query.id}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <span className={`px-4 py-1.5 rounded-2xl text-xs font-bold uppercase tracking-wider ${(query.status || '').toLowerCase() === 'completed' || (query.status || '').toLowerCase() === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {query.status || 'Pending'}
                    </span>
                    <span className={`px-4 py-1.5 rounded-2xl text-xs font-bold uppercase tracking-wider ${(primaryItem?.query_status || 'Active') === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {primaryItem?.query_status || 'Active'}
                    </span>
                </div>
            </div>

            {query.last_updated_follow_up_date && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-blue-500 uppercase font-bold tracking-widest">Latest Follow-up Scheduled</p>
                        <p className="font-semibold text-blue-900">{formatDate(query.last_updated_follow_up_date)}</p>
                    </div>
                </div>
            )}

            {query.delivery_mode === 'partner' && (
                <div className={`rounded-2xl border p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 ${query.delivery_status === 'pending' ? 'bg-amber-50 border-amber-200' : query.delivery_status === 'confirmed' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    <div className="flex items-start gap-4">
                        <div className={`p-4 rounded-2xl ${query.delivery_status === 'pending' ? 'bg-amber-100 text-amber-600' : query.delivery_status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            <Truck size={24} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                Partner Proposes Logistics
                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-black ${query.delivery_status === 'pending' ? 'bg-amber-200 text-amber-800' : query.delivery_status === 'confirmed' ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'}`}>
                                    {query.delivery_status}
                                </span>
                            </h3>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 font-medium">
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-slate-400" />
                                    Pickup: <span className="text-slate-900 font-bold">{formatDate(query.pickup_date)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} className="text-slate-400" />
                                    Delivery: <span className="text-slate-900 font-bold">{formatDate(query.delivery_date)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {query.delivery_status === 'pending' && (
                        <div className="flex gap-3">
                            <button
                                onClick={handleRejectDelivery}
                                disabled={actionLoading}
                                className="px-6 py-3 bg-white border border-rose-200 text-rose-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-rose-50 transition-all flex items-center gap-2"
                            >
                                <AlertCircle size={16} />
                                Reject
                            </button>
                            <button
                                onClick={handleConfirmDelivery}
                                disabled={actionLoading}
                                className="px-6 py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all flex items-center gap-2"
                            >
                                <CheckCircle size={16} />
                                Confirm Schedule
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Inquiry Items */}
                    <div className="space-y-5">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            Inquiry Items ({query.inquiry_items?.length || 0})
                        </h2>

                        {/* Desktop: Cards (already good) */}
                        <div className="space-y-6 hidden md:block">
                            {query.inquiry_items?.map((item) => (
                                <section key={item.id} className="bg-white rounded-3xl border p-6 space-y-6">
                                    <div className="flex items-center justify-between border-b pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold">
                                                {item.serial_no}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-slate-900">{item.system_type || item.type || 'Equipment'}</h3>
                                                {item.system_type && <p className="text-xs text-slate-500">{item.type}</p>}
                                            </div>
                                        </div>
                                        <span className={`px-4 py-1 rounded-2xl text-xs font-bold ${item.status === 'New' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {item.status || 'N/A'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                        <DetailItem icon={<Scale />} label="Capacity" value={item.capacity} />
                                        <DetailItem icon={<Box />} label="Quantity" value={`${item.quantity} ${item.unit || 'pcs'}`} />
                                        <DetailItem icon={<DollarSign />} label="Price" value={item.price ? `SAR ${item.price}` : 'N/A'} />
                                        <DetailItem icon={<ShieldCheck />} label="Catalog No" value={item.catalog_no} />
                                        <DetailItem icon={<Activity />} label="Condition" value={item.condition} />
                                        <DetailItem icon={<FileText />} label="System" value={item.system} />
                                    </div>

                                    {item.validation_mode === 'license-renewal' && (
                                        <div className="p-5 bg-blue-50/50 rounded-2xl border-l-4 border-blue-300 space-y-5">
                                            <p className="text-xs uppercase font-bold text-blue-500 flex items-center gap-2">
                                                <ShieldCheck size={14} /> License Renewal
                                            </p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                                <DetailItem icon={<FileText />} label="License Number" value={item.license_number} />
                                                <DetailItem icon={<Building2 />} label="Issuing Authority" value={item.license_authority} />
                                                <DetailItem icon={<Calendar />} label="Renewal Date" value={formatDateOnly(item.license_renewal_date)} />
                                            </div>
                                            {item.license_notes && (
                                                <div>
                                                    <p className="text-xs uppercase font-bold text-slate-400 mb-1">Notes</p>
                                                    <p className="text-slate-600 text-sm">{item.license_notes}</p>
                                                </div>
                                            )}
                                            {item.license_document_url && (
                                                <div>
                                                    <p className="text-xs uppercase font-bold text-slate-400 mb-2">License Document</p>
                                                    <a href={item.license_document_url} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={item.license_document_url}
                                                            alt="License document"
                                                            className="h-24 w-24 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity"
                                                        />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {item.maintenance_notes && (
                                        <div className="p-5 bg-slate-50 rounded-2xl border-l-4 border-slate-300">
                                            <p className="text-xs uppercase font-bold text-slate-400 mb-2">Maintenance Notes</p>
                                            <p className="text-slate-600">{item.maintenance_notes}</p>
                                        </div>
                                    )}

                                    {item.follow_up_history?.length > 0 && (
                                        <div className="p-5 bg-blue-50/50 rounded-2xl border-l-4 border-blue-300">
                                            <p className="text-xs uppercase font-bold text-blue-400 mb-3 flex items-center gap-2">
                                                <Calendar size={14} /> Follow-up History
                                            </p>
                                            <div className="space-y-2">
                                                {item.follow_up_history.map((hist, hIdx) => (
                                                    <div key={hIdx} className="flex items-center justify-between text-sm">
                                                        <span className="text-slate-600 font-medium">{formatDate(hist.follow_up_date)}</span>
                                                        <span className="text-[10px] bg-white border border-blue-100 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold">Locked</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* {(item.maintenance_unit_photo_url || item.maintenance_voice_url) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                                            {item.maintenance_unit_photo_url && <MediaItem title="Item Photo" url={item.maintenance_unit_photo_url} type="image" />}
                                            {item.maintenance_voice_url && <MediaItem title="Voice Note" url={item.maintenance_voice_url} type="audio" />}
                                        </div>
                                    )} */}
                                </section>
                            ))}
                        </div>

                        {/* Mobile: Compact Cards */}
                        <div className="block md:hidden space-y-5">
                            {query.inquiry_items?.map((item) => (
                                <div key={item.id} className="bg-white rounded-3xl border p-6 space-y-5">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-sm">
                                                {item.serial_no}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900">{item.system_type || item.type}</p>
                                                <p className="text-xs text-slate-500">{item.status}</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-2xl">
                                            {item.quantity} {item.unit || 'pcs'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-5 text-sm">
                                        <DetailItem icon={<Scale />} label="Capacity" value={item.capacity} />
                                        <DetailItem icon={<DollarSign />} label="Price" value={item.price ? `SAR ${item.price}` : 'N/A'} />
                                        <DetailItem icon={<Activity />} label="Condition" value={item.condition} />
                                        <DetailItem icon={<ShieldCheck />} label="Catalog" value={item.catalog_no} />
                                    </div>

                                    {item.validation_mode === 'license-renewal' && (
                                        <div className="pt-4 border-t space-y-4">
                                            <p className="text-xs uppercase font-bold text-blue-500 flex items-center gap-2">
                                                <ShieldCheck size={14} /> License Renewal
                                            </p>
                                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                                <DetailItem icon={<FileText />} label="License No" value={item.license_number} />
                                                <DetailItem icon={<Building2 />} label="Authority" value={item.license_authority} />
                                                <DetailItem icon={<Calendar />} label="Renewal Date" value={formatDateOnly(item.license_renewal_date)} />
                                            </div>
                                            {item.license_notes && (
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 mb-1">NOTES</p>
                                                    <p className="text-sm text-slate-600">{item.license_notes}</p>
                                                </div>
                                            )}
                                            {item.license_document_url && (
                                                <a href={item.license_document_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                                                    <img
                                                        src={item.license_document_url}
                                                        alt="License document"
                                                        className="h-20 w-20 object-cover rounded-xl border border-slate-200"
                                                    />
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {item.maintenance_notes && (
                                        <div className="pt-4 border-t">
                                            <p className="text-xs font-bold text-slate-400 mb-1">NOTES</p>
                                            <p className="text-sm text-slate-600">{item.maintenance_notes}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Maintenance & Media Sections (keep as is, they are already responsive) */}
                    {query.status === "Valid" && (
                        <section className="bg-white rounded-3xl border p-6 space-y-6">
                            <h2 className="font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="text-purple-600" size={20} /> Maintenance Details
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <DetailItem label="System" value={primaryItem?.system} />
                                <DetailItem label="Install Date" value={formatDate(primaryItem?.install_date)} />
                                <DetailItem label="Last Refill" value={formatDate(primaryItem?.last_refill_date)} />
                                <DetailItem label="Expiry Date" value={formatDate(primaryItem?.expiry_date)} />
                            </div>
                        </section>
                    )}

                    {/* Attached Media */}
                    {(primaryItem?.extinguisher_photo || primaryItem?.maintenance_unit_photo_url || primaryItem?.maintenance_voice_url) && (
                        <section className="bg-white rounded-3xl border p-6 space-y-6">
                            <h2 className="font-bold text-slate-900">Attached Media</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {primaryItem?.extinguisher_photo && <MediaItem title="Equipment Photo" url={primaryItem.extinguisher_photo} type="image" />}
                                {primaryItem?.maintenance_unit_photo_url && <MediaItem title="Maintenance Photo" url={primaryItem.maintenance_unit_photo_url} type="image" />}
                                {primaryItem?.maintenance_voice_url && <MediaItem title="Voice Note" url={primaryItem.maintenance_voice_url} type="audio" />}
                            </div>
                        </section>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                    {/* Customer Info */}
                    <section className="bg-white rounded-3xl border p-6 space-y-6">
                        <div className="flex items-center gap-2 border-b pb-4">
                            <Building2 className="text-blue-500" size={20} />
                            <h2 className="font-bold">Customer Information</h2>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <p className="text-xs text-slate-500">Customer Name</p>
                                <p className="font-semibold text-lg">{customer?.business_name || 'N/A'}</p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-500">Email</p>
                                <button
                                    onClick={() => navigate(`/agent/customer/${query.customer_id}`)}
                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                >
                                    <Mail size={16} />
                                    {customer?.email || 'N/A'}
                                </button>
                            </div>

                            {query.visits?.visit_date && (
                                <div>
                                    <p className="text-xs text-slate-500">Visit Date</p>
                                    <p className="font-medium">{formatDate(query.visits.visit_date)}</p>
                                </div>
                            )}

                            {primaryItem?.follow_up_date && (
                                <div className="pt-2 border-t border-slate-50">
                                    <p className="text-xs text-slate-500">Follow-up Date</p>
                                    <p className="font-bold">
                                        {new Date(primaryItem.follow_up_date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Quotation */}
                    {quotation && (
                        <section className="bg-white rounded-3xl border p-6 space-y-6">
                            <div className="flex items-center gap-2">
                                <DollarSign className="text-emerald-500" size={20} />
                                <h2 className="font-bold">Partner Quotation</h2>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Quotations Cost</p>
                                <p className="text-3xl font-bold text-slate-900">
                                    {quotation.estimated_cost ? `SAR ${quotation.estimated_cost}` : '—'}
                                </p>
                            </div>

                        </section>
                    )}

                    {/* Partner Management */}
                    <section className="bg-white rounded-3xl border p-6 space-y-4">
                        <div className="flex items-center gap-2 border-b pb-4">
                            <UserPlus className="text-blue-500" size={20} />
                            <h2 className="font-bold">Partner Management</h2>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned Partner</p>
                            <p className="font-black text-slate-900">{query.partners?.business_name || 'Unassigned'}</p>
                            <p className="text-xs text-slate-500">{query.partners?.email}</p>
                        </div>

                        {query.delivery_mode && (
                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-2">
                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Logistics Details</p>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500">Delivery Mode: <span className="text-slate-900 font-bold uppercase">{query.delivery_mode}</span></p>
                                    {query.pickup_date && (
                                        <p className="text-xs text-slate-500">Pickup Date: <span className="text-slate-900 font-bold">{formatDate(query.pickup_date)}</span></p>
                                    )}
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => setIsSwitchModalOpen(true)}
                            className="w-full py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                            <UserPlus size={16} />
                            Switch Partner
                        </button>
                    </section>

                    {/* Quick Actions */}
                    <section className="bg-white rounded-3xl border p-6 text-center space-y-4">
                        <h3 className="font-bold">Need Help?</h3>
                        {query.partner_id && (
                            <button
                                onClick={() => setIsChatOpen(true)}
                                className="w-full py-3.5 bg-primary-500 text-white rounded-2xl font-bold text-sm hover:bg-primary-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                            >
                                <MessageCircle size={18} />
                                Message Partner
                            </button>
                        )}
                        <button
                            onClick={() => navigate(`/agent/customer/${query.customer_id}`)}
                            className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-medium hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                        >
                            Back to Customer Profile
                            <ArrowRight size={18} />
                        </button>
                    </section>
                </div>
            </div>

            <SwitchPartnerModal
                isOpen={isSwitchModalOpen}
                onClose={() => setIsSwitchModalOpen(false)}
                onSwitch={handleSwitchPartner}
                loading={actionLoading}
                currentPartnerId={query.partner_id}
            />

            {/* Chat Modal */}
            {isChatOpen && query.partner_id && (
                <div
                    className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 bg-black/50 backdrop-blur-sm"
                    onClick={() => setIsChatOpen(false)}
                >
                    <div
                        className="w-full sm:max-w-md h-[70vh] sm:h-[500px] sm:rounded-2xl overflow-hidden shadow-2xl bg-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <InquiryChatBox
                            inquiryId={id}
                            recipientId={query.partner_id}
                            recipientRole="partner"
                            title={query.partners?.business_name || 'Partner'}
                            onClose={() => setIsChatOpen(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

/* Reusable Components */
const DetailItem = ({ icon, label, value }) => (
    <div className="flex gap-3">
        {icon && <div className="text-slate-400 mt-0.5">{icon}</div>}
        <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
            <p className="font-semibold text-slate-800">{value || 'N/A'}</p>
        </div>
    </div>
);

const MediaItem = ({ title, url, type }) => (
    <div className="space-y-2">
        <p className="text-xs uppercase font-bold text-slate-500 tracking-wider">{title}</p>
        {type === 'image' ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-2xl overflow-hidden border aspect-video">
                <img src={url} alt={title} className="w-full h-full object-cover hover:scale-105 transition-transform" />
            </a>
        ) : (
            <audio controls className="w-full rounded-2xl">
                <source src={url} type="audio/mpeg" />
            </audio>
        )}
    </div>
);

export default QueryDetail;