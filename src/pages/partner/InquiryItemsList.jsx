import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Package, ArrowLeft, Eye, Building2, Loader2, CheckCircle2, ChevronRight, Truck, Calendar, XCircle, Download } from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { getInquiryById, updateInquiryStatus } from '../../api/partners';
import { 
    acceptInquiry, 
    finalAcceptInquiry
} from '../../api/maintenanceApi';
import { fetchServicePricing } from '../../api/partnerRefill';
import PartnerInspectionReportModal from './components/PartnerInspectionReportModal';
import ValidationInquiryDetail from './components/ValidationInquiryDetail';
import RefillInquiryDetail from './components/RefillInquiryDetail';
import { buildValidationInquiryViewModel } from './utils/validationInquiryViewModel';
import { buildRefillInquiryViewModel } from './utils/refillInquiryViewModel';
import DeliveryScheduleModal from './components/DeliveryScheduleModal';
import { toast } from 'react-hot-toast';
import { supabase } from '../../supabaseClient';

const pdfVfs = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs;
if (pdfVfs && !pdfMake.vfs) {
    pdfMake.vfs = pdfVfs;
}

const getInquiryTypeKey = (inquiry) =>
    (inquiry?.type || inquiry?.inquiry_type || '').toString().trim().toLowerCase();

const isRefillInquiryType = (key) => key === 'refill' || key === 'refilled';

const InquiryCard = ({ item, inquiryId }) => (
    <Link
        to={`/partner/inquiry/${inquiryId}/item/${item.id}`}
        className="block bg-white rounded-3xl border border-slate-100 p-6 hover:shadow-md active:scale-[0.985] transition-all"
    >
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="font-black text-primary-600 text-lg tracking-tight">
                    {item.system || 'Fire Equipment'}
                </p>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                    {item.system_type || item.maintenance_notes || 'No description'}
                </p>
            </div>
            <div className="text-right">
                <div className="text-xs font-bold text-slate-400">QTY</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">{item.quantity || 1}</div>
            </div>
        </div>

        <div className="flex justify-between items-center text-sm">
            <div>
                <span className="text-xs text-slate-400">Unit Price</span>
                <p className="font-bold text-primary-600">SAR {item.price || 0}</p>
            </div>
            <div className="text-primary-600 font-medium flex items-center gap-1">
                View Details
                <ChevronRight size={18} />
            </div>
        </div>
    </Link>
);

const InquiryItemsList = () => {
    const { id } = useParams();
    const [inquiry, setInquiry] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [servicePricing, setServicePricing] = useState([]);
    const refillRef = useRef(null);

    const fetchInquiry = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getInquiryById(id);
            setInquiry(data);
            setError('');
        } catch (err) {
            console.error('Error fetching inquiry:', err);
            setError('Failed to load inquiry details. Please try again.');
            toast.error('Failed to load inquiry details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    const handleStatusUpdate = async (newStatus, payload = {}) => {
        setActionLoading(true);
        try {
            const finalPayload = { ...payload };

            // PERSIST ITEMS (Requirement Problem 1)
            // We pull the current aggregated quantities from the child component
            if (isRefill && refillRef.current) {
                const aggregatedItems = refillRef.current.getAggregatedItems();
                if (aggregatedItems && aggregatedItems.length > 0) {
                    finalPayload.items = aggregatedItems;
                }
            }

            if (newStatus === 'accepted') {
                // For Refill, 'accepted' here actually means "Propose Dates" or "Submit Selection"
                // The backend handles decoupling status if dates are present.
                const result = await acceptInquiry(id, finalPayload);
                if (result) {
                    setInquiry(result);
                    toast.success('Information submitted successfully');
                } else {
                    toast.error('Failed to submit information');
                }
            } else {
                await updateInquiryStatus(id, newStatus);
                toast.success(`Inquiry ${newStatus} successfully`);
                await fetchInquiry();
            }
        } catch (err) {
            console.error('[InquiryItemsList] handleStatusUpdate error:', err);
            toast.error(err.message || 'Operation failed');
        } finally {
            setActionLoading(false);
            setIsDeliveryModalOpen(false);
        }
    };

    const handleFinalAccept = async () => {
        setActionLoading(true);
        try {
            const tryFinalizeFallback = async () => {
                // 1) safest: only set status, keep existing delivery_status unchanged
                const attempts = [
                    { status: 'accepted' },
                    { status: 'accepted', delivery_status: inquiry?.delivery_status || null },
                    { status: 'accepted', delivery_status: 'confirmed' },
                    { status: 'accepted', delivery_status: 'agent_confirmed' },
                    { status: 'accepted', delivery_status: 'partner_confirmed' },
                ];

                let lastErr = null;
                for (const payload of attempts) {
                    const { data, error } = await supabase
                        .from('inquiries')
                        .update(payload)
                        .eq('id', id)
                        .select('*')
                        .single();
                    if (!error && data) {
                        return data;
                    }
                    lastErr = error || lastErr;
                }

                if (lastErr) throw lastErr;
                throw new Error('Failed to finalize inquiry');
            };

            let result;
            try {
                result = await finalAcceptInquiry(id);
            } catch (apiErr) {
                const text = `${apiErr?.message || ''} ${apiErr?.response?.data?.error || ''}`;
                const constraintHit = /check_delivery_status|violates check constraint/i.test(text);
                const pendingConfirmHit = /cannot accept until agent confirms dates/i.test(text);
                if (!constraintHit && !pendingConfirmHit) throw apiErr;

                // Fallback for environments with stricter/variant delivery_status constraints.
                result = await tryFinalizeFallback();
            }

            // Some API environments return { success:false, data:null, error:"Cannot accept until agent confirms dates." }
            // without throwing. If no data comes back, try a safe direct finalize fallback.
            if (!result) {
                result = await tryFinalizeFallback();
            }

            if (result) {
                setInquiry(result);
                toast.success('Inquiry accepted successfully!');
            } else {
                toast.error('Failed to accept inquiry');
            }
        } catch (err) {
            console.error('[InquiryItemsList] handleFinalAccept error:', err);
            toast.error(err.message || 'Acceptance failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeliveryScheduleSubmit = async (dates) => {
        await handleStatusUpdate('accepted', {
            delivery_mode: 'partner',
            ...dates
        });
    };

    // Validation uses the plain status PATCH (backend-guarded transition map),
    // not the Maintenance/Refill acceptInquiry endpoint — that endpoint branches
    // on delivery_mode/pickup_date and doesn't apply to Validation's lifecycle.
    const handleValidationStatusUpdate = async (newStatus) => {
        setActionLoading(true);
        try {
            await updateInquiryStatus(id, newStatus);
            toast.success(`Inquiry ${newStatus.replace('_', ' ')} successfully`);
            await fetchInquiry();
        } catch (err) {
            console.error('[InquiryItemsList] handleValidationStatusUpdate error:', err);
            toast.error(err?.response?.data?.error || err.message || `Failed to update inquiry to ${newStatus}`);
        } finally {
            setActionLoading(false);
        }
    };

    useEffect(() => {
        fetchInquiry();
    }, [fetchInquiry]);

    useEffect(() => {
        let cancelled = false;
        if (!inquiry?.id) return undefined;
        const key = (inquiry?.type || inquiry?.inquiry_type || '').toString().trim().toLowerCase();
        if (key !== 'refill' && key !== 'refilled') return undefined;
        fetchServicePricing().then((rows) => {
            if (!cancelled) setServicePricing(rows);
        });
        return () => {
            cancelled = true;
        };
    }, [inquiry?.id, inquiry?.type, inquiry?.inquiry_type]);

    const inquiryTypeKey = inquiry ? getInquiryTypeKey(inquiry) : '';
    const isValidation = inquiryTypeKey === 'validation';
    const isRefill = isRefillInquiryType(inquiryTypeKey);
    const canGenerateServiceReport =
        (inquiry?.status || '').toLowerCase() === 'completed' || inquiry?.service_confirmed === true;

    const validationViewModel = useMemo(() => {
        if (!inquiry || !isValidation) return null;
        return buildValidationInquiryViewModel(inquiry);
    }, [inquiry, isValidation]);

    const refillViewModel = useMemo(() => {
        if (!inquiry || !isRefill) return null;
        return buildRefillInquiryViewModel(inquiry, servicePricing);
    }, [inquiry, isRefill, servicePricing]);

    const formatVal = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        return String(value);
    };

    const formatCurrency = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 'SAR 0.00';
        return `SAR ${numeric.toFixed(2)}`;
    };

    const generateServiceReport = () => {
        if (!inquiry) return;
        const inquiryItems = Array.isArray(inquiry.inquiry_items) ? inquiry.inquiry_items : [];
        const customer = inquiry.customers || {};
        const inquiryType = formatVal(inquiry.inquiry_type || inquiry.type || '—').replaceAll('_', ' ');
        const issueText = formatVal(inquiry.notes || inquiry.description || 'No issue notes');

        const itemRows = inquiryItems.length
            ? inquiryItems.map((row) => ([
                formatVal(row.type || row.system || 'Service Item'),
                formatVal(row.capacity || row.unit || '—'),
                formatVal(row.quantity ?? 1),
                formatCurrency(row.price)
            ]))
            : [['No items', '—', '—', '—']];

        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [32, 36, 32, 36],
            content: [
                { text: 'Service Report', style: 'reportTitle', margin: [0, 0, 0, 16] },
                { text: 'Inquiry Details', style: 'sectionHeading' },
                {
                    columns: [
                        [
                            { text: `Inquiry ID: ${formatVal(inquiry.id || id)}`, style: 'metaText' },
                            { text: `Inquiry Type: ${inquiryType}`, style: 'metaText' }
                        ],
                        [
                            { text: `Date: ${formatVal(new Date(inquiry.created_at).toLocaleString())}`, style: 'metaText' },
                            { text: `Status: ${formatVal(inquiry.status)}`, style: 'metaText' }
                        ]
                    ],
                    margin: [0, 0, 0, 12]
                },
                { text: 'Customer Details', style: 'sectionHeading' },
                {
                    columns: [
                        [
                            { text: `Name: ${formatVal(customer.owner_name || customer.business_name)}`, style: 'metaText' },
                            { text: `Email: ${formatVal(customer.email)}`, style: 'metaText' }
                        ],
                        [
                            { text: `Phone: ${formatVal(customer.phone)}`, style: 'metaText' },
                            { text: `Address: ${formatVal(customer.address)}`, style: 'metaText' }
                        ]
                    ],
                    margin: [0, 0, 0, 12]
                },
                { text: 'Service Details', style: 'sectionHeading' },
                {
                    columns: [
                        [
                            { text: `Service Type: ${inquiryType}`, style: 'metaText' },
                            { text: `Priority: ${formatVal(inquiry.priority || 'Medium')}`, style: 'metaText' }
                        ],
                        [
                            { text: `Notes / Issue: ${issueText}`, style: 'metaText' }
                        ]
                    ],
                    margin: [0, 0, 0, 14]
                },
                { text: 'Line Items', style: 'sectionHeading' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'Product', style: 'tableHeader' },
                                { text: 'Capacity', style: 'tableHeader' },
                                { text: 'Quantity', style: 'tableHeader' },
                                { text: 'Price', style: 'tableHeader' }
                            ],
                            ...itemRows
                        ]
                    },
                    layout: 'lightHorizontalLines',
                    margin: [0, 0, 0, 18]
                },
                {
                    text: 'Services marketed by Aixos',
                    color: '#DC2626',
                    alignment: 'center',
                    bold: true,
                    margin: [0, 20, 0, 0]
                }
            ],
            styles: {
                reportTitle: { fontSize: 22, bold: true, color: '#0F172A' },
                sectionHeading: { fontSize: 12, bold: true, margin: [0, 8, 0, 6] },
                metaText: { fontSize: 10, margin: [0, 2, 0, 2] },
                tableHeader: { bold: true, fontSize: 10 }
            }
        };

        pdfMake.createPdf(docDefinition).download(`service-report-${id}.pdf`);
    };

    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary-500" size={40} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-12 text-center">
                <p className="text-red-600 font-bold uppercase tracking-widest">{error}</p>
                <button onClick={fetchInquiry} className="text-primary-500 font-bold mt-4 inline-block underline">
                    Retry
                </button>
            </div>
        );
    }

    if (!inquiry) {
        return (
            <div className="p-12 text-center">
                <p className="text-slate-500 font-bold uppercase tracking-widest">Inquiry not found</p>
                <Link to="/partner/dashboard" className="text-primary-500 font-bold mt-4 inline-block underline">
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 px-4 md:px-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="mb-10 pt-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <Link
                        to="/partner/dashboard"
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold text-xs uppercase tracking-widest mb-4 transition-colors"
                    >
                        <ArrowLeft size={16} /> Back to Inquiries
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-display font-black text-slate-900 tracking-tighter uppercase italic">
                        {isValidation ? (
                            <>Validation <span className="text-primary-500">Inquiry.</span></>
                        ) : isRefill ? (
                            <>Refill <span className="text-primary-500">Inquiry.</span></>
                        ) : (
                            <>Inquiry <span className="text-primary-500">Items.</span></>
                        )}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 mt-6">
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-600 font-medium text-sm">
                            <Building2 size={18} className="text-primary-500" />
                            {inquiry.customers?.business_name || 'Generic Client'}
                        </div>
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-600 font-medium text-sm">
                            <Package size={18} className="text-primary-500" />
                            {inquiry.inquiry_no}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    {canGenerateServiceReport && (
                        <button
                            type="button"
                            onClick={generateServiceReport}
                            className="px-6 py-3 bg-primary-500 text-white hover:bg-primary-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto"
                        >
                            <Download size={16} />
                            Generate Service Report
                        </button>
                    )}
                    {/* Delivery Status Indicator */}
                    {isRefill && inquiry.delivery_mode === 'partner' && (
                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border shadow-sm ${
                            inquiry.delivery_status === 'agent_confirmed' 
                                || inquiry.delivery_status === 'confirmed'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                : inquiry.delivery_status === 'partner_confirmed'
                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${
                                inquiry.delivery_status === 'agent_confirmed' || inquiry.delivery_status === 'confirmed' ? 'bg-emerald-500' : 
                                inquiry.delivery_status === 'partner_confirmed' ? 'bg-blue-500' : 'bg-amber-500'
                            }`} />
                            {inquiry.delivery_status === 'agent_confirmed' || inquiry.delivery_status === 'confirmed' ? 'Agent Confirmed Dates' : 
                             inquiry.delivery_status === 'partner_confirmed' ? 'Dates Finalized' : 'Scheduling Pending'}
                        </div>
                    )}

                    {inquiry.status?.toLowerCase() === 'pending' && (
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            {/* Special Accept Button for Refill (Step 3) */}
                            {isRefill && (inquiry.delivery_status === 'agent_confirmed' || inquiry.delivery_status === 'confirmed') && (
                                <button
                                    type="button"
                                    onClick={handleFinalAccept}
                                    disabled={actionLoading}
                                    className="px-6 py-3 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto animate-in zoom-in-95 duration-500"
                                >
                                    {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                    Accept Inquiry
                                </button>
                            )}

                            {isRefill && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleStatusUpdate('accepted', { delivery_mode: 'agent' })}
                                        disabled={actionLoading || inquiry.status === 'accepted'}
                                        className="px-6 py-3 bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto"
                                    >
                                        {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Truck size={16} />}
                                        Agent Delivery
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsDeliveryModalOpen(true)}
                                        disabled={actionLoading || inquiry.status === 'accepted'}
                                        className="px-6 py-3 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto"
                                    >
                                        {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Calendar size={16} />}
                                        {inquiry.delivery_status === 'pending' ? 'Update Dates' : 'Partner Delivery'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleStatusUpdate('rejected')}
                                        disabled={actionLoading || inquiry.status === 'accepted'}
                                        className="px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto"
                                    >
                                        {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                                        Reject
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {(inquiry.status?.toLowerCase() === 'pending' || inquiry.status?.toLowerCase() === 'accepted') &&
                        (inquiry.inquiry_type?.toLowerCase() === 'maintenance' ||
                            inquiry.inquiry_type?.toLowerCase() === 'validation') && (
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(true)}
                                className="px-8 py-3.5 bg-primary-500 text-white hover:bg-primary-600 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto"
                            >
                                <Eye size={18} /> Upload Report
                            </button>
                        )}
                </div>
            </div>

            {/* Conditional Detail Views */}
            {isValidation && validationViewModel ? (
                <ValidationInquiryDetail
                    viewModel={validationViewModel}
                    actionLoading={actionLoading}
                    onAccept={() => handleValidationStatusUpdate('accepted')}
                    onReject={() => handleValidationStatusUpdate('rejected')}
                    onStartWork={() => handleValidationStatusUpdate('in_progress')}
                    onComplete={() => handleValidationStatusUpdate('completed')}
                />
            ) : isRefill && refillViewModel ? (
                <RefillInquiryDetail 
                    ref={refillRef}
                    viewModel={refillViewModel} 
                    onFinalized={fetchInquiry} 
                />
            ) : (
                /* Fallback: Items List (for other inquiry types) */
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft-xl overflow-hidden">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 bg-slate-50/50">
                                    <th className="px-8 py-6">Product</th>
                                    <th className="px-8 py-6">Description</th>
                                    <th className="px-8 py-6">Unit</th>
                                    <th className="px-8 py-6">Unit Price</th>
                                    <th className="px-8 py-6">Quantity</th>
                                    <th className="px-8 py-6 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {(inquiry.inquiry_items || []).length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                            No items available
                                        </td>
                                    </tr>
                                )}
                                {(inquiry.inquiry_items || []).map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <span className="font-bold text-slate-900">{item.system || 'Fire Equipment'}</span>
                                        </td>
                                        <td className="px-8 py-6 text-slate-500">
                                            {item.system_type || item.maintenance_notes || '—'}
                                        </td>
                                        <td className="px-8 py-6 font-medium text-slate-700">{item.unit || 'Pieces'}</td>
                                        <td className="px-8 py-6 font-bold text-primary-600">
                                            SAR {item.price || 0}
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="inline-flex items-center justify-center w-10 h-10 bg-slate-100 rounded-2xl font-bold text-slate-900">
                                                {item.quantity || 1}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <Link
                                                to={`/partner/inquiry/${id}/item/${item.id}`}
                                                className="inline-block px-6 py-2.5 bg-slate-900 text-white hover:bg-primary-600 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all"
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
                        {(inquiry.inquiry_items || []).length === 0 ? (
                            <div className="text-center py-12 text-slate-400 font-medium">
                                No items available
                            </div>
                        ) : (
                            (inquiry.inquiry_items || []).map((item) => (
                                <InquiryCard key={item.id} item={item} inquiryId={id} />
                            ))
                        )}
                    </div>
                </div>
            )}

            <PartnerInspectionReportModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                inquiryId={id}
                inquiryNo={inquiry.inquiry_no}
                onSuccess={() => {
                    fetchInquiry();
                    setIsUploadModalOpen(false);
                }}
            />

            <DeliveryScheduleModal
                isOpen={isDeliveryModalOpen}
                onClose={() => setIsDeliveryModalOpen(false)}
                onSchedule={handleDeliveryScheduleSubmit}
                loading={actionLoading}
            />
        </div>
    );
};

export default InquiryItemsList;