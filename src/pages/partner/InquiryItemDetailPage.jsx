import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ChevronLeft,
    MapPin,
    MessageCircle,
    FileText,
    Info,
    Loader2,
    Package,
    User,
    Calendar,
    Hash,
    Link2,
    Image as ImageIcon,
    Mic,
    Edit2,
    X,
    CheckCircle,
    XCircle,
    ExternalLink,
    Download
} from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { getInquiryById, updateInquiryStatus } from '../../api/partners';
import NewUnitDetailModal from './components/NewUnitDetailModal';
import {
    acceptInquiry,
    fetchSiteAssessmentByInquiryId,
    fetchInspectionReportsByInquiryId
} from '../../api/maintenanceApi';

const pdfVfs = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs;
if (pdfVfs && !pdfMake.vfs) {
    pdfMake.vfs = pdfVfs;
}
import ChatModal from '../../components/Chat/ChatModal';
import PartnerPostAcceptCard from './components/PartnerPostAcceptCard';
import ScheduleDateModal from './components/ScheduleDateModal';
import DeliveryScheduleModal from './components/DeliveryScheduleModal';
import InquiryChatBox from '../../components/Chat/InquiryChatBox';
import PartnerInspectionReportModal from './components/PartnerInspectionReportModal';
import PartnerQuotationModal from './components/PartnerQuotationModal';
import { toast } from 'react-hot-toast';
import {
    scheduleMaintenanceVisit,
    fetchQuotationByInquiryId
} from '../../api/maintenanceApi';

const statusBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (s === 'accepted' || s === 'approved') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (s === 'rejected') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
};

const formatVal = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
};

const formatDateTime = (iso) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    } catch {
        return formatVal(iso);
    }
};

const shortId = (uuid) => {
    if (!uuid || typeof uuid !== 'string') return '—';
    return `${uuid.slice(0, 8)}…`;
};

const extinguisherLabel = (item) => {
    if (item?.extinguisher_id != null) return `EXT-${item.extinguisher_id}`;
    if (item?.serial_no != null) return `EXT-${item.serial_no}`;
    return `ITEM-${item?.id ?? '—'}`;
};

const DetailField = ({ label, value, className = '' }) => (
    <div className={`p-4 bg-slate-50 rounded-2xl border border-slate-100 ${className}`}>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
        <p className="text-slate-900 font-semibold text-sm break-words">{value}</p>
    </div>
);

const MediaLink = ({ href, label, icon, isAudio = false }) => {
    if (!href) return null;
    const Icon = icon;
    if (isAudio) {
        return (
            <div className="flex flex-col gap-2 min-w-[200px]">
                <span className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <Icon size={14} className="text-primary-500" />
                    {label}
                </span>
                <audio
                    controls
                    src={href}
                    className="h-8 w-full custom-audio-player"
                >
                    Your browser does not support the audio element.
                </audio>
            </div>
        );
    }
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-bold text-sm underline underline-offset-2"
        >
            <Icon size={16} />
            {label}
        </a>
    );
};

const PartnerActionCard = ({ onAccept, onAcceptWithDelivery, onReject, disabled, isInMaintenance }) => (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-soft-xl p-8 w-full shrink-0 uppercase tracking-widest text-xs font-bold text-slate-500">
        <h4 className="text-center font-bold text-slate-600 mb-6 uppercase tracking-widest text-xs">
            Awaiting partner action
        </h4>
        <div className="flex flex-col gap-4">
            {isInMaintenance ? (
                <button
                    type="button"
                    onClick={onAccept}
                    disabled={disabled}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-emerald-200/80 text-white font-black py-4 rounded-full transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                    <CheckCircle size={22} className="shrink-0" strokeWidth={2.5} />
                    Accept inquiry
                </button>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={onAccept}
                        disabled={disabled}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-emerald-200/80 text-white font-black py-4 rounded-full transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                        <Truck size={22} className="shrink-0" strokeWidth={2.5} />
                        Agent Delivery
                    </button>
                    <button
                        type="button"
                        onClick={onAcceptWithDelivery}
                        disabled={disabled}
                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-slate-200 text-white font-black py-4 rounded-full transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                        <Calendar size={22} className="shrink-0" strokeWidth={2.5} />
                        Partner Delivery
                    </button>
                </>
            )}
            <button
                type="button"
                onClick={onReject}
                disabled={disabled}
                className="w-full bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:pointer-events-none font-black py-4 rounded-full transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
            >
                <XCircle size={22} className="shrink-0" strokeWidth={2} />
                Reject
            </button>
        </div>
    </div>
);

const InquiryItemDetailPage = () => {
    const { id: inquiryId, itemId } = useParams();
    const [inquiry, setInquiry] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [siteAssessment, setSiteAssessment] = useState(null);
    const [inspectionReports, setInspectionReports] = useState([]);
    const [quotation, setQuotation] = useState(null);
    const [docsLoading, setDocsLoading] = useState(false);
    const [docsError, setDocsError] = useState('');
    const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
    const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
    const [isNewUnitModalOpen, setIsNewUnitModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

    const loadInquiry = useCallback(async ({ showPageLoader = true } = {}) => {
        if (showPageLoader) setLoading(true);
        try {
            const data = await getInquiryById(inquiryId);
            setInquiry(data);
            setError('');
        } catch (e) {
            console.error(e);
            setError('Failed to load inquiry');
            toast.error('Failed to load inquiry');
        } finally {
            if (showPageLoader) setLoading(false);
        }
    }, [inquiryId]);

    useEffect(() => {
        loadInquiry({ showPageLoader: true });
    }, [loadInquiry]);

    useEffect(() => {
        if (!inquiryId || !inquiry) {
            setSiteAssessment(null);
            setInspectionReports([]);
            setQuotation(null);
            return;
        }
        const isMaint = (inquiry.type || inquiry.inquiry_type || '').toString().trim().toLowerCase() === 'maintenance';
        const acc = (inquiry.status || '').toLowerCase() === 'accepted';
        if (!isMaint || !acc) {
            setSiteAssessment(null);
            setInspectionReports([]);
            setQuotation(null);
            return;
        }
        let cancelled = false;
        (async () => {
            setDocsLoading(true);
            setDocsError('');
            try {
                const [a, r, q] = await Promise.all([
                    fetchSiteAssessmentByInquiryId(inquiryId),
                    fetchInspectionReportsByInquiryId(inquiryId),
                    fetchQuotationByInquiryId(inquiryId)
                ]);
                if (cancelled) return;
                setSiteAssessment(a);
                setInspectionReports(Array.isArray(r) ? r : []);
                setQuotation(q);
            } catch (e) {
                console.error(e);
                if (!cancelled) {
                    setDocsError(
                        'Could not load technical documentation. Check that the API is running.'
                    );
                    setSiteAssessment(null);
                    setInspectionReports([]);
                    setQuotation(null);
                }
            } finally {
                if (!cancelled) setDocsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [inquiryId, inquiry]);

    const item = inquiry?.inquiry_items?.find((row) => String(row.id) === String(itemId));

    const chatExtinguisherId = item?.extinguisher_id != null ? String(item.extinguisher_id) : null;

    const openChat = () => {
        if (!chatExtinguisherId) {
            toast.error('No extinguisher linked to this line item for chat.');
            return;
        }
        setIsChatOpen(true);
    };

    const handleStatusUpdate = async (newStatus, payload = {}) => {
        setActionLoading(true);
        try {
            if (newStatus === 'accepted') {
                const finalPayload = {
                    delivery_mode: payload.delivery_mode || 'agent',
                    pickup_date: payload.pickup_date || null,
                    delivery_date: payload.delivery_date || null
                };
                await acceptInquiry(inquiryId, finalPayload);
            } else {
                await updateInquiryStatus(inquiryId, newStatus);
            }
            toast.success(`Inquiry ${newStatus} successfully`);
            await loadInquiry({ showPageLoader: false });
        } catch {
            toast.error(`Failed to ${newStatus} inquiry`);
        } finally {
            setActionLoading(false);
            setIsDeliveryModalOpen(false);
        }
    };

    const handleDeliveryScheduleSubmit = async (dates) => {
        await handleStatusUpdate('accepted', {
            delivery_mode: 'partner',
            ...dates
        });
    };

    const handleScheduleDateSubmit = async (date) => {
        try {
            await scheduleMaintenanceVisit(inquiryId, date);
            toast.success('Site visit scheduled successfully. Awaiting customer approval.');
            await loadInquiry({ showPageLoader: false });
        } catch (error) {
            toast.error('Failed to schedule visit');
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary-500" size={40} />
            </div>
        );
    }

    if (error || !inquiry) {
        return (
            <div className="p-12 text-center space-y-4">
                <p className="text-slate-600 font-bold">{error || 'Inquiry not found'}</p>
                <Link to={`/partner/inquiry/${inquiryId}`} className="text-primary-600 font-bold underline">
                    Back to inquiry items
                </Link>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="p-12 text-center space-y-4">
                <p className="text-slate-600 font-bold">Line item not found</p>
                <Link to={`/partner/inquiry/${inquiryId}`} className="text-primary-600 font-bold underline">
                    Back to inquiry items
                </Link>
            </div>
        );
    }

    const customer = inquiry.customers || {};
    const businessName = customer.business_name || 'Client';
    const address = customer.address || '—';
    const inquiryType = (inquiry.inquiry_type || inquiry.type || '—').toString().replace(/_/g, ' ');
    const priorityRaw = inquiry.priority || 'Medium';
    const priority = typeof priorityRaw === 'string' ? priorityRaw : String(priorityRaw);
    const displayStatus = inquiry.status || 'Pending';

    const issueParts = [
        item.maintenance_notes,
        item.system_type && `Component: ${item.system_type}`,
        item.system && `System: ${item.system}`
    ].filter(Boolean);
    const issueText =
        inquiry.description ||
        inquiry.notes ||
        (issueParts.length ? issueParts.join(' · ') : null) ||
        'No issue notes for this line item.';

    const isInquiryPending = (inquiry.status || '').toLowerCase() === 'pending';
    const inquiryTypeKey = (inquiry.type || inquiry.inquiry_type || '').toString().trim().toLowerCase();
    const isMaintenanceInquiry = inquiryTypeKey === 'maintenance';
    const isRefilledInquiry = inquiryTypeKey === 'refill' || inquiryTypeKey === 'refilled';
    const isInquiryAccepted = (inquiry.status || '').toLowerCase() === 'accepted';
    const canGenerateServiceReport =
        (inquiry.status || '').toLowerCase() === 'completed' || inquiry.service_confirmed === true;

    const formatCurrency = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 'SAR 0.00';
        return `SAR ${numeric.toFixed(2)}`;
    };

    const generateServiceReport = () => {
        if (!canGenerateServiceReport) return;

        try {
            const inquiryItems = Array.isArray(inquiry.inquiry_items) ? inquiry.inquiry_items : [];
            const itemRows = inquiryItems.length
                ? inquiryItems.map((row) => ([
                    formatVal(row.type || row.system || 'Service Item'),
                    formatVal(row.capacity || row.unit || '—'),
                    formatVal(row.quantity ?? 1),
                    formatCurrency(row.price)
                ]))
                : [['No items', '—', '—', '—']];

            const content = [
                {
                    text: 'Service Report',
                    style: 'reportTitle',
                    margin: [0, 0, 0, 18]
                },
                {
                    text: 'Inquiry Details',
                    style: 'sectionHeading'
                },
                {
                    columns: [
                        [
                            { text: `Inquiry ID: ${formatVal(inquiry.id || inquiryId)}`, style: 'metaText' },
                            { text: `Inquiry Type: ${formatVal(inquiryType)}`, style: 'metaText' }
                        ],
                        [
                            { text: `Date: ${formatDateTime(inquiry.created_at)}`, style: 'metaText' },
                            { text: `Status: ${formatVal(displayStatus)}`, style: 'metaText' }
                        ]
                    ],
                    columnGap: 20,
                    margin: [0, 0, 0, 14]
                },
                {
                    text: 'Customer Details',
                    style: 'sectionHeading'
                },
                {
                    columns: [
                        [
                            { text: `Name: ${formatVal(customer.owner_name || businessName)}`, style: 'metaText' },
                            { text: `Email: ${formatVal(customer.email)}`, style: 'metaText' }
                        ],
                        [
                            { text: `Phone: ${formatVal(customer.phone)}`, style: 'metaText' },
                            { text: `Address: ${formatVal(customer.address)}`, style: 'metaText' }
                        ]
                    ],
                    columnGap: 20,
                    margin: [0, 0, 0, 14]
                },
                {
                    text: 'Service Details',
                    style: 'sectionHeading'
                },
                {
                    columns: [
                        [
                            { text: `Service Type: ${formatVal(inquiryType)}`, style: 'metaText' },
                            { text: `Priority: ${formatVal(priority)}`, style: 'metaText' }
                        ],
                        [
                            { text: `Line Item: ${formatVal(extinguisherLabel(item))}`, style: 'metaText' },
                            { text: `Notes / Issue: ${formatVal(issueText)}`, style: 'metaText' }
                        ]
                    ],
                    columnGap: 20,
                    margin: [0, 0, 0, 16]
                },
                {
                    text: 'Line Items',
                    style: 'sectionHeading'
                },
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
                    layout: {
                        fillColor: (rowIndex) => (rowIndex === 0 ? '#F8FAFC' : null),
                        hLineColor: () => '#CBD5E1',
                        vLineColor: () => '#CBD5E1',
                        hLineWidth: () => 1,
                        vLineWidth: () => 1,
                        paddingLeft: () => 8,
                        paddingRight: () => 8,
                        paddingTop: () => 6,
                        paddingBottom: () => 6
                    },
                    margin: [0, 0, 0, 26]
                },
                {
                    text: 'Services marketed by Aixos',
                    alignment: 'center',
                    color: '#DC2626',
                    bold: true,
                    fontSize: 12,
                    margin: [0, 20, 0, 0]
                }
            ];

            const docDefinition = {
                pageSize: 'A4',
                pageMargins: [32, 36, 32, 36],
                content,
                defaultStyle: {
                    fontSize: 10,
                    color: '#0F172A'
                },
                styles: {
                    reportTitle: {
                        fontSize: 22,
                        bold: true,
                        color: '#0F172A'
                    },
                    sectionHeading: {
                        fontSize: 12,
                        bold: true,
                        color: '#1E293B',
                        margin: [0, 8, 0, 8]
                    },
                    metaText: {
                        fontSize: 10,
                        lineHeight: 1.4,
                        margin: [0, 2, 0, 2]
                    },
                    tableHeader: {
                        bold: true,
                        color: '#0F172A',
                        fontSize: 10
                    }
                }
            };

            pdfMake.createPdf(docDefinition).download(`service-report-${inquiryId}.pdf`);
        } catch (err) {
            console.error('Failed generating service report:', err);
            toast.error('Could not generate service report');
        }
    };

    return (
        <div className="min-h-screen pb-20 animate-in fade-in duration-500">
            <Link
                to={`/partner/inquiry/${inquiryId}`}
                className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm mb-8 transition-colors"
            >
                <ChevronLeft size={20} />
                Back to Inquiry Items
            </Link>

            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

                {/* Main Content Area */}
                <div className="flex-1 min-w-0 w-full bg-white rounded-3xl border border-slate-100 shadow-soft-xl p-5 md:p-8 lg:p-10 space-y-10">

                    {/* Top: Badges + Extinguisher Info */}
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                        <div className="space-y-3 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-700 border border-slate-200">
                                    {inquiry.inquiry_no || `INQ-${inquiryId}`}
                                </span>
                                <span className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border ${statusBadgeClass(displayStatus)}`}>
                                    {displayStatus}
                                </span>
                                <span className="px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest bg-slate-900 text-white border border-slate-800">
                                    Line #{item.id}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                                <Hash size={12} />
                                Inquiry ID {shortId(inquiry.id)} · Visit #{formatVal(inquiry.visit_id)} · Agent #{formatVal(inquiry.agent_id)}
                            </p>
                        </div>

                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 lg:min-w-[240px] shrink-0">
                            <div className="p-3 rounded-xl bg-primary-100 text-primary-600">
                                <FileText size={24} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Extinguisher ID</p>
                                <p className="text-lg font-black text-slate-900 tracking-tight break-words">{extinguisherLabel(item)}</p>
                                <p className="text-[10px] text-slate-500 mt-1 font-mono">DB id {item.extinguisher_id ?? '—'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Customer Header */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-3xl md:text-4xl font-display font-black text-slate-900 tracking-tight mb-3 break-words">
                                {businessName}
                            </h1>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <p className="text-slate-600 flex items-center gap-2">
                                    <MapPin size={18} className="text-slate-400 shrink-0" />
                                    {address}
                                </p>
                                {canGenerateServiceReport && (
                                    <button
                                        type="button"
                                        onClick={generateServiceReport}
                                        className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold px-6 py-3 rounded-2xl shadow-lg transition-all w-full sm:w-auto"
                                    >
                                        <Download size={18} />
                                        Generate Service Report
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={openChat}
                                    className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-6 py-3 rounded-2xl shadow-lg transition-all disabled:opacity-50 w-full sm:w-auto"
                                    disabled={!chatExtinguisherId}
                                >
                                    <MessageCircle size={18} />
                                    Message Customer
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Customer Contact */}
                    <div>
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <User size={16} /> Customer Contact
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <DetailField label="Owner" value={formatVal(customer.owner_name)} />
                            <DetailField
                                label="Email"
                                value={
                                    customer.email ? (
                                        <a href={`mailto:${customer.email}`} className="text-primary-600 hover:underline break-all">
                                            {customer.email}
                                        </a>
                                    ) : '—'
                                }
                            />
                            <DetailField
                                label="Phone"
                                value={customer.phone ? (
                                    <a href={`tel:${customer.phone}`} className="text-primary-600 hover:underline">
                                        {customer.phone}
                                    </a>
                                ) : '—'}
                            />
                            <DetailField label="Customer ID" value={formatVal(customer.id ?? inquiry.customer_id)} />
                            <DetailField
                                label="Location"
                                className="sm:col-span-2"
                                value={(() => {
                                    const hasCoords = customer.location_lat != null && customer.location_lng != null;
                                    const hasAddr = customer.address && customer.address.trim();
                                    const mapUrl = hasCoords
                                        ? `https://www.google.com/maps?q=${customer.location_lat},${customer.location_lng}`
                                        : hasAddr
                                            ? `https://www.google.com/maps?q=${encodeURIComponent(customer.address)}`
                                            : null;
                                    return (
                                        <span className="flex items-center gap-3 flex-wrap">
                                            <span>{hasAddr ? customer.address : hasCoords ? `${customer.location_lat}, ${customer.location_lng}` : '—'}</span>
                                            {mapUrl && (
                                                <a
                                                    href={mapUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg text-xs font-bold transition-colors shrink-0"
                                                >
                                                    <ExternalLink size={12} />
                                                    Open in Maps
                                                </a>
                                            )}
                                        </span>
                                    );
                                })()}
                            />
                        </div>
                    </div>

                    {/* Inquiry Metadata */}
                    <div className="border-t border-slate-100 pt-10">
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Calendar size={16} /> Inquiry Metadata
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <DetailField label="Inquiry type" value={inquiryType} />
                            <DetailField label="Priority" value={
                                <span className={priority.toLowerCase() === 'high' ? 'text-red-500 font-black uppercase' : 'font-bold capitalize'}>
                                    {priority}
                                </span>
                            } />
                            <DetailField label="Partner ID" value={formatVal(inquiry.partner_id)} />
                            <DetailField label="Created" value={formatDateTime(inquiry.created_at)} />
                            <DetailField label="Last updated" value={formatDateTime(inquiry.updated_at)} />
                        </div>
                    </div>

                    {/* Inquiry Information (Summary) */}
                    <div className="border-t border-slate-100 pt-10">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                            <Info size={22} className="text-primary-500" /> Inquiry Information
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Service Type</p>
                                <p className="text-slate-900 font-bold text-lg capitalize">{inquiryType}</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Priority</p>
                                <p className={`font-black text-lg uppercase ${priority.toLowerCase() === 'high' ? 'text-red-500' : 'text-slate-900'}`}>
                                    {priority}
                                </p>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Issue / Notes</p>
                            <p className="text-slate-700 italic leading-relaxed">"{issueText}"</p>
                        </div>
                    </div>

                    {/* Line Item — Product & Pricing */}
                    <div className="border-t border-slate-100 pt-10">
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Package size={16} /> Line Item — Product & Pricing
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <DetailField label="Product type" value={formatVal(item.type)} />
                            <DetailField label="Brand" value={formatVal(item.brand)} />
                            <DetailField label="Capacity" value={formatVal(item.capacity)} />
                            <DetailField label="Unit" value={formatVal(item.unit)} />
                            <DetailField label="Quantity" value={formatVal(item.quantity)} />
                            <DetailField label="Unit price" value={item.price != null ? `SAR ${item.price}` : '—'} />
                            <DetailField label="Condition" value={formatVal(item.condition)} />
                            <DetailField label="Item status" value={formatVal(item.status)} />
                            <DetailField label="Seller" value={formatVal(item.seller)} />
                            <DetailField label="Partner (line)" value={formatVal(item.partner)} />
                        </div>
                    </div>

                    {/* Identification & Systems */}
                    <div className="border-t border-slate-100 pt-10">
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Hash size={16} /> Identification & Systems
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsNewUnitModalOpen((prev) => !prev)}
                                className="p-3 bg-slate-900 hover:bg-primary-500 text-white rounded-2xl shadow-lg transition-all active:scale-95"
                                title={isNewUnitModalOpen ? 'Collapse editor' : 'Edit identification details'}
                            >
                                {isNewUnitModalOpen ? <X size={16} /> : <Edit2 size={16} />}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <DetailField label="Serial no." value={formatVal(item.serial_no)} />
                            <DetailField label="Catalog no." value={formatVal(item.catalog_no)} />
                            <DetailField label="Sub-unit" value={formatVal(item.is_sub_unit)} />
                            <DetailField label="Query status" value={formatVal(item.query_status)} />
                            <DetailField label="System" value={formatVal(item.system)} />
                            <DetailField label="System type" value={formatVal(item.system_type)} />
                        </div>

                        {isNewUnitModalOpen && (
                            <div className="mt-6">
                                <NewUnitDetailModal
                                    isOpen={isNewUnitModalOpen}
                                    onClose={() => setIsNewUnitModalOpen(false)}
                                    inquiry={{ ...inquiry, selectedItem: item }}
                                    onUpdate={async () => {
                                        await loadInquiry({ showPageLoader: false });
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Dates */}
                    <div className="border-t border-slate-100 pt-10">
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Calendar size={16} />
                            Dates
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <DetailField label="Install date" value={formatDateTime(item.install_date)} />
                            <DetailField label="Expiry date" value={formatDateTime(item.expiry_date)} />
                            {item.status === "Refilled" && (
                                <DetailField label="Last refill" value={formatDateTime(item.last_refill_date)} />
                            )}
                            <DetailField label="Item created" value={formatDateTime(item.created_at)} />
                            <DetailField label="Item updated" value={formatDateTime(item.updated_at)} />
                        </div>
                    </div>

                    {/* Media & Attachments */}
                    <div className="border-t border-slate-100 pt-10">
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ImageIcon size={16} /> Media & Attachments
                        </h2>
                        <div className="flex flex-wrap gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                            <MediaLink href={item.certificate_photo} label="Certificate" icon={ImageIcon} />
                            <MediaLink href={item.extinguisher_photo} label="Extinguisher" icon={ImageIcon} />
                            <MediaLink href={item.maintenance_unit_photo_url} label="Maintenance Photo" icon={ImageIcon} />
                            <MediaLink href={item.maintenance_voice_url} label="Voice Note" icon={Mic} isAudio={true} />
                            {!item.certificate_photo && !item.extinguisher_photo &&
                                !item.maintenance_unit_photo_url && !item.maintenance_voice_url && (
                                    <p className="text-sm text-slate-500 italic py-4">No media uploaded for this line item.</p>
                                )}
                        </div>
                    </div>

                    {/* Technical Documentation (Maintenance) */}
                    {isMaintenanceInquiry && isInquiryAccepted && (
                        <div className="border-t border-slate-100 pt-10">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FileText size={16} />
                                Technical documentation
                            </h2>
                            {docsError && <p className="text-sm text-red-600 font-medium mb-4">{docsError}</p>}
                            {docsLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="animate-spin text-primary-500" size={32} />
                                </div>
                            ) : (
                                <div className="space-y-10">
                                    {/* Site Assessment */}
                                    <div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
                                            Site assessment
                                        </h3>
                                        {siteAssessment ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                                        Observations
                                                    </p>
                                                    <p className="text-slate-800 text-sm whitespace-pre-wrap">
                                                        {siteAssessment.observations || '—'}
                                                    </p>
                                                </div>
                                                <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                                        Required services
                                                    </p>
                                                    <p className="text-slate-800 text-sm whitespace-pre-wrap">
                                                        {siteAssessment.required_services || '—'}
                                                    </p>
                                                </div>
                                                <DetailField
                                                    label="Additional notes"
                                                    value={formatVal(siteAssessment.additional_notes)}
                                                />
                                                <DetailField
                                                    label="Assessment updated"
                                                    value={formatDateTime(siteAssessment.updated_at)}
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                No site assessment on file yet. Use <strong>Start site assessment</strong> in the
                                                panel to add one.
                                            </p>
                                        )}
                                    </div>

                                    {/* Inspection Reports */}
                                    <div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
                                            Inspection reports
                                        </h3>
                                        {inspectionReports.length === 0 ? (
                                            <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                No inspection reports submitted yet. Use <strong>Upload inspection report</strong>{' '}
                                                to attach a PDF or Excel file.
                                            </p>
                                        ) : (
                                            <div className="rounded-2xl border border-slate-100 overflow-hidden">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        <tr>
                                                            <th className="px-4 py-3">Title</th>
                                                            <th className="px-4 py-3">Inspection date</th>
                                                            <th className="px-4 py-3">File</th>
                                                            <th className="px-4 py-3">Submitted</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {inspectionReports.map((rep) => (
                                                            <tr key={rep.id}>
                                                                <td className="px-4 py-3 font-semibold text-slate-900">
                                                                    {rep.report_title}
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-600">
                                                                    {rep.inspection_date
                                                                        ? new Date(rep.inspection_date).toLocaleDateString()
                                                                        : '—'}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {rep.file_url ? (
                                                                        <a
                                                                            href={rep.file_url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-primary-600 font-bold text-xs uppercase tracking-wide hover:underline"
                                                                        >
                                                                            Open
                                                                        </a>
                                                                    ) : (
                                                                        '—'
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-500 text-xs">
                                                                    {formatDateTime(rep.created_at)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quotation Section */}
                                    <div className="pt-6 border-t border-slate-100">
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
                                            Pro-forma Quotation
                                        </h3>
                                        {quotation ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <DetailField
                                                    label="Quotation Cost (SAR)"
                                                    value={quotation.estimated_cost ? `SAR ${quotation.estimated_cost}` : '—'}
                                                />
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                                            Quotation File
                                                        </p>
                                                        <p className="text-slate-900 font-semibold text-sm">PDF Document</p>
                                                    </div>
                                                    {quotation.pdf_url && (
                                                        <a
                                                            href={quotation.pdf_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg transition-all"
                                                        >
                                                            View PDF
                                                        </a>
                                                    )}
                                                </div>
                                                <DetailField
                                                    label="Submitted on"
                                                    value={formatDateTime(quotation.created_at)}
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                No quotation has been submitted for this inquiry yet.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {isInquiryPending && (isRefilledInquiry || isMaintenanceInquiry) && (
                    <div className="lg:sticky lg:top-8 self-start w-full lg:w-[360px]">
                        <PartnerActionCard
                            onAccept={() => handleStatusUpdate('accepted', { delivery_mode: 'agent' })}
                            onAcceptWithDelivery={() => setIsDeliveryModalOpen(true)}
                            onReject={() => handleStatusUpdate('rejected')}
                            disabled={actionLoading}
                            isInMaintenance={isMaintenanceInquiry}
                        />
                    </div>
                )}
                {isMaintenanceInquiry && isInquiryAccepted && (
                    <div className="lg:sticky lg:top-8 self-start flex flex-col gap-6 w-full lg:w-[360px]">
                        <PartnerPostAcceptCard
                            inquiryId={inquiryId}
                            itemId={itemId}
                            onUploadReport={() => setInspectionModalOpen(true)}
                            onScheduleDate={() => setIsScheduleModalOpen(true)}
                            onSubmitQuotation={() => setIsQuotationModalOpen(true)}
                            approvalStatus={inquiry.approval_status}
                            scheduledDate={inquiry.scheduled_date}
                        />
                        <InquiryChatBox
                            inquiryId={inquiryId}
                            recipientId={inquiry.customer_id}
                            recipientRole="Customer"
                            title="Chat with Customer"
                        />
                    </div>
                )}
                {!isMaintenanceInquiry && isInquiryAccepted && (
                    <div className="lg:sticky lg:top-8 self-start w-full lg:w-[360px]">
                        <InquiryChatBox
                            inquiryId={inquiryId}
                            recipientId={inquiry.customer_id}
                            recipientRole="Customer"
                            title="Chat with Customer"
                        />
                    </div>
                )}
            </div>

            {chatExtinguisherId && (
                <ChatModal
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    queryId={chatExtinguisherId}
                />
            )}

            <PartnerInspectionReportModal
                isOpen={inspectionModalOpen}
                onClose={() => setInspectionModalOpen(false)}
                inquiryId={inquiryId}
                inquiryNo={inquiry.inquiry_no}
                onSuccess={async () => {
                    if (!isMaintenanceInquiry || !isInquiryAccepted) return;
                    try {
                        const r = await fetchInspectionReportsByInquiryId(inquiryId);
                        setInspectionReports(Array.isArray(r) ? r : []);
                    } catch (e) {
                        console.error(e);
                    }
                }}
            />

            <PartnerQuotationModal
                isOpen={isQuotationModalOpen}
                onClose={() => setIsQuotationModalOpen(false)}
                inquiryId={inquiryId}
                customerId={inquiry.customer_id}
                partnerId={inquiry.partner_id}
                onSuccess={async () => {
                    try {
                        const q = await fetchQuotationByInquiryId(inquiryId);
                        setQuotation(q);
                    } catch (e) {
                        console.error(e);
                    }
                }}
            />

            <ScheduleDateModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                onSchedule={handleScheduleDateSubmit}
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

export default InquiryItemDetailPage;
