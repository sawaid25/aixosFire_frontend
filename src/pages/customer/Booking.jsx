import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import {
    ArrowLeft, Wrench, RefreshCcw, Search, PlusCircle, CheckCircle, Clock, Hash,
    Info, Plus, Trash, FileText, Upload, X, ShieldCheck, Loader2, Package
} from 'lucide-react';
import PageLoader from '../../components/PageLoader';
import ProductDetailsModal from '../../components/products/ProductDetailsModal';
import {
    fetchInquiryFormOptions,
    lookupProductByCode,
    uploadInquiryLicenseDocument,
    uploadInquiryCustomerDocument,
    createCustomerInquiry
} from '../../api/customerPortal';
import { subtypeForMode } from '../../utils/productPartnerEligibility';

/**
 * Customer "New inquiry" page. Offers the same services and sub-types as the Agent Visit
 * Form (src/pages/agent/VisitForm.jsx), adapted to a customer request:
 *   - New Unit / Maintenance: the product is identified by CAT# (catalog number on the
 *     customer's own equipment) or Product# (model number), or picked from the catalog
 *   - Validation / Refill: only the unit details — no equipment pick or product lookup
 *   - every service takes an optional PDF next to the internal reference number
 *   - no Partner selection — every customer request goes to Admin, who assigns an
 *     eligible Partner; the customer's Agent (if any) is referred server-side
 *   - no customer search, site assessment, QR scan, photos, voice notes or pricing
 * The backend (POST /inquiries, customer path) re-applies every rule and ignores any
 * partner/customer id in the request.
 */

const SERVICES = [
    { key: 'Validation', title: 'Validation', desc: 'Sticker validation and compliance verification for installed units.', icon: Search },
    { key: 'Refill', title: 'Refill', desc: 'Cylinder refilling and related logistics.', icon: RefreshCcw },
    { key: 'New Unit', title: 'New Unit', desc: 'New equipment survey, supply, and installation.', icon: PlusCircle },
    { key: 'Maintenance', title: 'Maintenance', desc: 'Scheduled or corrective maintenance of firefighting equipment.', icon: Wrench }
];

const SUBTYPES = ['new', 'followup', 'license-renewal'];
const SUBTYPE_LABELS = {
    Validation: { new: 'New Validation', followup: 'Follow-up', 'license-renewal': 'License Renewal' },
    Refill: { new: 'New Refill', followup: 'Follow-up', 'license-renewal': 'License Renewal' }
};
const SUBTYPE_HINTS = {
    new: 'A new service request for your units.',
    followup: 'Re-check of an already serviced unit.',
    'license-renewal': 'Renew a compliance license.'
};

// Same option lists as the Agent form.
const EXTINGUISHER_TYPES = ['ABC Dry Powder', 'CO2 - Carbon Dioxide', 'Water Type', 'Mechanical Foam', 'Wet Chemical', 'Other'];
const CAPACITIES = ['1kg', '2kg', '4kg', '6kg', '9kg', '25kg'];

const MAX_LICENSE_DOC_BYTES = 5 * 1024 * 1024;
const MAX_CUSTOMER_DOC_BYTES = 5 * 1024 * 1024;

const getDefaultUnit = (name) => (['Pipes', 'Hose Reels', 'Hydrants'].includes(name) ? 'Meter' : 'Pieces');
const productLabel = (p) => (p.model_number ? `${p.model_number} — ${p.name}` : p.name);

const groupByCategory = (products) =>
    products.reduce((acc, p) => {
        const key = p.category || 'Other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
    }, {});

/** A product chosen for the request: the catalog product plus the CAT# it was found by (if any). */
const EMPTY_PRODUCT = { product: null, catalogNo: null };

const EMPTY_UNIT = {
    type: 'ABC Dry Powder',
    customType: '',
    capacity: '6kg',
    quantity: 1,
    expiryDate: '',
    followUpDate: '',
    licenseNumber: '',
    licenseAuthority: '',
    licenseRenewalDate: '',
    licenseNotes: '',
    licenseFile: null
};

const EMPTY_BUILDER = {
    selection: EMPTY_PRODUCT,
    isCustom: false,
    customCategory: '',
    customName: '',
    unit: 'Pieces',
    quantity: 1
};

const LICENSE_FIELDS_CLEARED = {
    licenseNumber: '', licenseAuthority: '', licenseRenewalDate: '', licenseNotes: '', licenseFile: null
};

const ServiceOption = ({ icon: Icon, title, desc, selected, onClick }) => (
    <div
        onClick={onClick}
        className={`relative p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col h-full ${
            selected ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg'
        }`}
    >
        {selected && (
            <div className="absolute top-4 right-4 text-primary-500">
                <CheckCircle size={24} className="fill-primary-500 text-white" />
            </div>
        )}
        <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                selected ? 'bg-primary-200 text-primary-700' : 'bg-slate-100 text-slate-600'
            }`}
        >
            <Icon size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm mb-4 flex-1">{desc}</p>
    </div>
);

const FieldLabel = ({ children, optional = false, htmlFor }) => (
    <label htmlFor={htmlFor} className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
        {children} {optional && <span className="normal-case text-slate-400">(optional)</span>}
    </label>
);

/**
 * Identify a product by CAT# or Product#, or browse the catalog. `value` is
 * { product, catalogNo }; `onChange` receives the same shape.
 */
const ProductIdentifier = ({ products, value, onChange, onViewDetails, optional = false, idPrefix }) => {
    const [code, setCode] = useState('');
    const [searching, setSearching] = useState(false);
    const [matches, setMatches] = useState(null);
    const [error, setError] = useState(null);

    const runLookup = async () => {
        const trimmed = code.trim();
        if (!trimmed) {
            setError('Enter a CAT# or Product#.');
            return;
        }
        setSearching(true);
        setError(null);
        setMatches(null);
        try {
            const found = await lookupProductByCode(trimmed);
            if (!found || found.length === 0) {
                setError(`No product found for “${trimmed}”. Check the code, or browse the catalog below.`);
            } else if (found.length === 1) {
                onChange({ product: found[0].product, catalogNo: found[0].catalog_no || null });
                setCode('');
            } else {
                setMatches(found);
            }
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || 'Lookup failed.');
        } finally {
            setSearching(false);
        }
    };

    const selected = value?.product;

    if (selected) {
        return (
            <div>
                <FieldLabel optional={optional}>Product</FieldLabel>
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-primary-200 bg-primary-50/40 px-4 py-3">
                    <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{selected.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
                            <span>{selected.category || 'Other'}</span>
                            {selected.model_number && <span className="font-mono">Product# {selected.model_number}</span>}
                            {value.catalogNo && <span className="font-mono">CAT# {value.catalogNo}</span>}
                        </p>
                        <button
                            type="button"
                            onClick={() => onViewDetails(selected)}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700"
                        >
                            <Info size={12} /> View Details
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => onChange(EMPTY_PRODUCT)}
                        className="p-1.5 rounded-full text-slate-400 hover:bg-white hover:text-red-600 shrink-0"
                        title="Change product"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div>
                <FieldLabel optional={optional} htmlFor={`${idPrefix}-code`}>CAT# or Product#</FieldLabel>
                <div className="flex gap-2">
                    <input
                        id={`${idPrefix}-code`}
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                runLookup();
                            }
                        }}
                        placeholder="e.g. AIR-0032 or the model number"
                        className="input-field py-2 text-sm font-mono"
                    />
                    <button
                        type="button"
                        onClick={runLookup}
                        disabled={searching}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold px-4"
                    >
                        {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Find
                    </button>
                </div>
                {error && <p className="text-xs text-amber-700 mt-1.5">{error}</p>}
                {matches && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                        <p className="px-3 py-2 text-xs text-slate-500">Several products match — choose one:</p>
                        {matches.map((m) => (
                            <button
                                key={m.product.id}
                                type="button"
                                onClick={() => {
                                    onChange({ product: m.product, catalogNo: m.catalog_no || null });
                                    setMatches(null);
                                    setCode('');
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                            >
                                <span className="font-semibold text-slate-800">{m.product.name}</span>
                                <span className="text-xs text-slate-500 font-mono ml-2">
                                    {m.product.model_number ? `Product# ${m.product.model_number}` : ''}
                                    {m.catalog_no ? ` · CAT# ${m.catalog_no}` : ''}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div>
                <FieldLabel htmlFor={`${idPrefix}-browse`}>Or browse the catalog</FieldLabel>
                <select
                    id={`${idPrefix}-browse`}
                    value=""
                    onChange={(e) => {
                        const p = products.find((x) => String(x.id) === e.target.value);
                        if (p) onChange({ product: p, catalogNo: null });
                    }}
                    className="input-field py-2 text-sm"
                >
                    <option value="">Select a product…</option>
                    {Object.entries(groupByCategory(products)).map(([category, items]) => (
                        <optgroup key={category} label={category}>
                            {items.map((p) => (
                                <option key={p.id} value={p.id}>{productLabel(p)}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>
        </div>
    );
};

const Booking = () => {
    const navigate = useNavigate();

    // Reference data: service availability + the active product catalog.
    const [options, setOptions] = useState(null);
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [optionsError, setOptionsError] = useState(null);
    const [optionsReloadKey, setOptionsReloadKey] = useState(0);

    const [service, setService] = useState('Validation');
    const [subtype, setSubtype] = useState('new');
    const [unit, setUnit] = useState(EMPTY_UNIT);
    const [builder, setBuilder] = useState(EMPTY_BUILDER);
    const [lineItems, setLineItems] = useState([]);
    const [maintenanceNotes, setMaintenanceNotes] = useState('');
    const [maintenanceExpiryDate, setMaintenanceExpiryDate] = useState('');

    const [internalReferenceNumber, setInternalReferenceNumber] = useState('');
    const [preferredDate, setPreferredDate] = useState('');
    const [notes, setNotes] = useState('');
    const [customerDocument, setCustomerDocument] = useState(null); // optional PDF, any service

    const [submitting, setSubmitting] = useState(false);
    const [productModal, setProductModal] = useState({ isOpen: false, product: null });

    useEffect(() => {
        let cancelled = false;
        setLoadingOptions(true);
        setOptionsError(null);
        fetchInquiryFormOptions()
            .then((data) => {
                if (cancelled) return;
                if (!data) throw new Error('No data returned.');
                setOptions(data);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('[Customer Booking] form options:', err);
                setOptionsError(err?.response?.data?.error || err?.message || 'Could not load services.');
            })
            .finally(() => {
                if (!cancelled) setLoadingOptions(false);
            });
        return () => {
            cancelled = true;
        };
    }, [optionsReloadKey]);

    const products = options?.products || [];
    const globalAvailability = options?.globalAvailability || [];
    const hasSubtypes = service === 'Validation' || service === 'Refill';

    // ── Availability (Admin global switch — same rule as the Agent form) ─────
    const isSubmodeAvailable = (mode, sub) =>
        !globalAvailability.some(
            (row) => row.service_type === mode && row.service_subtype === subtypeForMode(mode, sub) && row.is_enabled === false
        );
    const isModeAvailable = (mode) =>
        (['Validation', 'Refill'].includes(mode) ? SUBTYPES : ['default']).some((sub) => isSubmodeAvailable(mode, sub));

    const availableServices = SERVICES.filter((s) => isModeAvailable(s.key));
    const availableSubtypes = SUBTYPES.filter((sub) => isSubmodeAvailable(service, sub));

    // If Admin has switched off the current selection, move to the first one still offered.
    useEffect(() => {
        if (!options) return;
        if (availableServices.length > 0 && !availableServices.some((s) => s.key === service)) {
            selectService(availableServices[0].key);
        } else if (hasSubtypes && availableSubtypes.length > 0 && !availableSubtypes.includes(subtype)) {
            selectSubtype(availableSubtypes[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options, service, subtype]);

    const openProductDetails = (product) => {
        if (product) setProductModal({ isOpen: true, product });
    };

    // ── Selection changes ─────────────────────────────────────────────────────
    function selectService(key) {
        setService(key);
        setSubtype('new');
        setUnit((prev) => ({ ...prev, followUpDate: '', ...LICENSE_FIELDS_CLEARED }));
        setBuilder(EMPTY_BUILDER);
        setLineItems([]);
        setMaintenanceNotes('');
        setMaintenanceExpiryDate('');
    }

    function selectSubtype(sub) {
        setSubtype(sub);
        setUnit((prev) => ({
            ...prev,
            followUpDate: sub === 'followup' ? prev.followUpDate : '',
            ...(sub !== 'license-renewal' ? LICENSE_FIELDS_CLEARED : {})
        }));
    }

    const updateUnit = (field, value) => setUnit((prev) => ({ ...prev, [field]: value }));
    const updateBuilder = (patch) => setBuilder((prev) => ({ ...prev, ...patch }));

    const handleLicenseFile = (e) => {
        const file = e.target.files?.[0] || null;
        e.target.value = '';
        if (!file) return;
        if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) {
            toast.error('Please choose an image or PDF file.');
            return;
        }
        if (file.size > MAX_LICENSE_DOC_BYTES) {
            toast.error('License document must be 5MB or smaller.');
            return;
        }
        updateUnit('licenseFile', file);
    };

    const handleCustomerDocument = (e) => {
        const file = e.target.files?.[0] || null;
        e.target.value = '';
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast.error('Please choose a PDF file.');
            return;
        }
        if (file.size > MAX_CUSTOMER_DOC_BYTES) {
            toast.error('The document must be 5MB or smaller.');
            return;
        }
        setCustomerDocument(file);
    };

    // ── New Unit / Maintenance item builder ─────────────────────────────────
    const builderProblem = () => {
        if (builder.isCustom) {
            if (!builder.customName.trim()) return 'Please describe the item.';
        } else if (!builder.selection.product) {
            return 'Please identify the product by CAT# or Product#, or choose it from the catalog.';
        }
        if (!(Number(builder.quantity) >= 1)) return 'Quantity must be at least 1.';
        return null;
    };

    const resolvedBuilderItem = () => {
        const p = builder.selection.product;
        return {
            category: builder.isCustom ? (builder.customCategory.trim() || 'Other') : (p?.category || null),
            material: builder.isCustom ? builder.customName.trim() : p?.name,
            productId: builder.isCustom ? null : p?.id,
            modelNumber: builder.isCustom ? null : (p?.model_number || null),
            catalogNo: builder.isCustom ? null : builder.selection.catalogNo,
            unit: builder.unit || 'Pieces',
            quantity: Number(builder.quantity) || 1
        };
    };

    const addBuilderItem = () => {
        const problem = builderProblem();
        if (problem) {
            toast.error(problem);
            return;
        }
        setLineItems((prev) => [...prev, resolvedBuilderItem()]);
        setBuilder(EMPTY_BUILDER);
    };

    // ── Section renderers ─────────────────────────────────────────────────────
    const renderExtinguisherFields = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <FieldLabel>Type</FieldLabel>
                <select
                    value={unit.type}
                    onChange={(e) => setUnit((prev) => ({ ...prev, type: e.target.value, customType: e.target.value === 'Other' ? prev.customType : '' }))}
                    className="input-field py-2 text-sm"
                >
                    {EXTINGUISHER_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                {unit.type === 'Other' && (
                    <input
                        type="text"
                        value={unit.customType}
                        onChange={(e) => updateUnit('customType', e.target.value)}
                        placeholder="e.g. Clean Agent, Dry Chemical Special..."
                        className="input-field py-2 text-sm mt-3"
                    />
                )}
            </div>
            <div>
                <FieldLabel>Capacity</FieldLabel>
                <select value={unit.capacity} onChange={(e) => updateUnit('capacity', e.target.value)} className="input-field py-2 text-sm">
                    {CAPACITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
            </div>
            <div>
                <FieldLabel>Quantity</FieldLabel>
                <input
                    type="number"
                    min={1}
                    value={unit.quantity}
                    onChange={(e) => updateUnit('quantity', parseInt(e.target.value, 10) || 1)}
                    className="input-field py-2 text-sm"
                />
            </div>
        </div>
    );

    const renderLicenseRenewalFields = () => (
        <>
            <div>
                <FieldLabel>License Number</FieldLabel>
                <input
                    type="text"
                    value={unit.licenseNumber}
                    onChange={(e) => updateUnit('licenseNumber', e.target.value)}
                    placeholder="e.g. CD-2026-00123"
                    className="input-field py-2 text-sm"
                />
            </div>
            <div>
                <FieldLabel>Issuing Authority</FieldLabel>
                <input
                    type="text"
                    value={unit.licenseAuthority}
                    onChange={(e) => updateUnit('licenseAuthority', e.target.value)}
                    placeholder="e.g. Civil Defense"
                    className="input-field py-2 text-sm"
                />
            </div>
            <div>
                <FieldLabel>Renewal Date</FieldLabel>
                <input
                    type="date"
                    value={unit.licenseRenewalDate}
                    onChange={(e) => updateUnit('licenseRenewalDate', e.target.value)}
                    className="input-field py-2 text-sm"
                />
            </div>
            <div className="md:col-span-2">
                <FieldLabel optional>License Notes</FieldLabel>
                <textarea
                    value={unit.licenseNotes}
                    onChange={(e) => updateUnit('licenseNotes', e.target.value)}
                    rows={2}
                    placeholder="Any additional detail about this renewal..."
                    className="input-field py-2 text-sm resize-none"
                />
            </div>
            <div className="md:col-span-2">
                <FieldLabel optional>License Document</FieldLabel>
                {unit.licenseFile ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <span className="text-sm text-slate-700 flex items-center gap-2 min-w-0">
                            <FileText size={16} className="text-primary-500 shrink-0" />
                            <span className="truncate">{unit.licenseFile.name}</span>
                            <span className="text-xs text-slate-400 shrink-0">{(unit.licenseFile.size / 1024).toFixed(0)} KB</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => updateUnit('licenseFile', null)}
                            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600"
                            title="Remove document"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <label className="relative flex flex-col items-center justify-center w-full min-h-[110px] border-2 border-dashed rounded-2xl bg-white border-slate-300 hover:border-primary-500 cursor-pointer text-center p-4">
                        <input type="file" accept="image/*,application/pdf" onChange={handleLicenseFile} className="sr-only" />
                        <Upload size={22} className="text-slate-400 mb-2" />
                        <span className="text-sm font-bold text-slate-700">Upload license document</span>
                        <span className="text-xs text-slate-500">Image or PDF, up to 5MB</span>
                    </label>
                )}
            </div>
        </>
    );

    const renderValidationRefillDetails = () => (
        <div className="space-y-6">
            {renderExtinguisherFields()}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${service === 'Validation' && subtype === 'new' ? '' : 'pt-6 border-t border-slate-100'}`}>
                {subtype === 'new' && service === 'Refill' && (
                    <div>
                        <FieldLabel optional>Current Expiry Date</FieldLabel>
                        <input
                            type="date"
                            value={unit.expiryDate}
                            onChange={(e) => updateUnit('expiryDate', e.target.value)}
                            className="input-field py-2 text-sm"
                        />
                    </div>
                )}
                {subtype === 'followup' && (
                    <div>
                        <FieldLabel>Follow-up Date</FieldLabel>
                        <input
                            type="date"
                            value={unit.followUpDate}
                            onChange={(e) => updateUnit('followUpDate', e.target.value)}
                            className="input-field py-2 text-sm"
                        />
                    </div>
                )}
                {subtype === 'license-renewal' && renderLicenseRenewalFields()}
            </div>
        </div>
    );

    const renderItemBuilderDetails = () => (
        <div className="space-y-6">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                {builder.isCustom ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <FieldLabel htmlFor="custom-category" optional>System Category</FieldLabel>
                            <input
                                id="custom-category"
                                type="text"
                                value={builder.customCategory}
                                onChange={(e) => updateBuilder({ customCategory: e.target.value })}
                                placeholder="e.g. Fire Alarm System"
                                className="input-field py-2 text-sm"
                            />
                        </div>
                        <div>
                            <FieldLabel htmlFor="custom-name">Item Description</FieldLabel>
                            <input
                                id="custom-name"
                                type="text"
                                value={builder.customName}
                                onChange={(e) => updateBuilder({ customName: e.target.value, unit: getDefaultUnit(e.target.value) })}
                                placeholder="e.g. Fire Blanket, Fire Curtain"
                                className="input-field py-2 text-sm"
                            />
                        </div>
                    </div>
                ) : (
                    <ProductIdentifier
                        idPrefix="builder-product"
                        products={products}
                        value={builder.selection}
                        onChange={(selection) => updateBuilder({ selection, unit: getDefaultUnit(selection.product?.name) })}
                        onViewDetails={openProductDetails}
                    />
                )}
                <button
                    type="button"
                    onClick={() => updateBuilder({ isCustom: !builder.isCustom, selection: EMPTY_PRODUCT, customName: '', customCategory: '' })}
                    className="text-xs font-bold text-primary-600 hover:underline"
                >
                    {builder.isCustom ? 'Identify a catalog product instead' : 'My product isn’t listed'}
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-3 items-end gap-4">
                    <div>
                        <FieldLabel htmlFor="builder-unit">Unit</FieldLabel>
                        <select id="builder-unit" value={builder.unit} onChange={(e) => updateBuilder({ unit: e.target.value })} className="input-field py-2 text-sm">
                            <option value="Meter">Meter</option>
                            <option value="Pieces">Pieces</option>
                        </select>
                    </div>
                    <div>
                        <FieldLabel htmlFor="builder-qty">Quantity</FieldLabel>
                        <input
                            id="builder-qty"
                            type="number"
                            min="1"
                            value={builder.quantity}
                            onChange={(e) => updateBuilder({ quantity: Number(e.target.value) || 1 })}
                            className="input-field py-2 text-sm"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={addBuilderItem}
                        disabled={Boolean(builderProblem())}
                        className="w-full h-[46px] rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors bg-primary-600 hover:bg-primary-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                        <Plus size={18} /> Add This Item
                    </button>
                </div>
            </div>

            {lineItems.length > 0 && (
                <div>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">Added Items</h4>
                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                        {lineItems.map((li, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-800 truncate">{li.material}</p>
                                    <p className="text-xs text-slate-500">
                                        {li.category} · {li.quantity} {li.unit}
                                        {li.modelNumber && <span className="font-mono"> · Product# {li.modelNumber}</span>}
                                        {li.catalogNo && <span className="font-mono"> · CAT# {li.catalogNo}</span>}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setLineItems((prev) => prev.filter((_, idx) => idx !== i))}
                                    className="p-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                                    title="Remove this item"
                                >
                                    <Trash size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {service === 'Maintenance' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <FieldLabel optional>Maintenance Notes</FieldLabel>
                        <textarea
                            value={maintenanceNotes}
                            onChange={(e) => setMaintenanceNotes(e.target.value)}
                            rows={3}
                            placeholder="Describe the issue, symptoms or the work you need done..."
                            className="input-field py-2 text-sm resize-none"
                        />
                    </div>
                    <div>
                        <FieldLabel optional>Current Expiry Date</FieldLabel>
                        <input
                            type="date"
                            value={maintenanceExpiryDate}
                            onChange={(e) => setMaintenanceExpiryDate(e.target.value)}
                            className="input-field py-2 text-sm"
                        />
                    </div>
                </div>
            )}
        </div>
    );

    // ── Submit ────────────────────────────────────────────────────────────────
    const validationRefillProblem = () => {
        if (unit.type === 'Other' && !unit.customType.trim()) return 'Please specify the extinguisher type.';
        if (!(Number(unit.quantity) >= 1)) return 'Quantity must be at least 1.';
        if (subtype === 'followup' && !unit.followUpDate) return 'Please select a follow-up date.';
        if (subtype === 'license-renewal' && (!unit.licenseNumber.trim() || !unit.licenseAuthority.trim() || !unit.licenseRenewalDate)) {
            return 'License number, issuing authority and renewal date are required.';
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!internalReferenceNumber.trim()) {
            toast.error('Please enter your internal reference number.');
            return;
        }

        let items;
        if (hasSubtypes) {
            const problem = validationRefillProblem();
            if (problem) {
                toast.error(problem);
                return;
            }
        } else {
            // A fully filled-in row that wasn't "added" yet is still included.
            const builderTouched = builder.isCustom || Boolean(builder.selection.product);
            const pending = builderTouched ? builderProblem() : 'empty';
            const all = pending ? lineItems : [...lineItems, resolvedBuilderItem()];
            if (all.length === 0) {
                toast.error(pending && pending !== 'empty' ? pending : 'Add at least one item to the inquiry.');
                return;
            }
            items = all.map((li) => ({
                system: li.category || null,
                system_type: li.material || null,
                product_id: li.productId || null,
                catalog_no: li.catalogNo || null,
                unit: li.unit,
                quantity: li.quantity,
                is_sub_unit: true,
                validation_mode: 'new',
                maintenance_notes: service === 'Maintenance' ? (maintenanceNotes.trim() || null) : null,
                expiry_date: service === 'Maintenance' ? (maintenanceExpiryDate || null) : null
            }));
        }

        setSubmitting(true);
        try {
            if (hasSubtypes) {
                const isRenewal = subtype === 'license-renewal';
                let licenseDocumentUrl = null;
                if (isRenewal && unit.licenseFile) {
                    licenseDocumentUrl = await uploadInquiryLicenseDocument(unit.licenseFile);
                }
                items = [{
                    type: unit.type === 'Other' ? unit.customType.trim() : unit.type,
                    capacity: unit.capacity,
                    quantity: Number(unit.quantity) || 1,
                    unit: 'Pieces',
                    // Validation / Refill take no equipment link or product (no inputs for them).
                    product_id: null,
                    catalog_no: null,
                    extinguisher_id: null,
                    expiry_date: service === 'Refill' && subtype === 'new' ? (unit.expiryDate || null) : null,
                    validation_mode: subtype,
                    follow_up_date_validation: subtype === 'followup' ? unit.followUpDate : null,
                    license_number: isRenewal ? unit.licenseNumber.trim() : null,
                    license_authority: isRenewal ? unit.licenseAuthority.trim() : null,
                    license_renewal_date: isRenewal ? unit.licenseRenewalDate : null,
                    license_notes: isRenewal ? (unit.licenseNotes.trim() || null) : null,
                    license_document_url: isRenewal ? licenseDocumentUrl : null
                }];
            }

            // No partner / customer id is sent — the backend takes the customer from the
            // login token and routes every customer request to Admin.
            const inquiryData = {
                type: service,
                internal_reference_number: internalReferenceNumber.trim(),
                notes: notes.trim() || null,
                preferred_date: preferredDate || null
            };
            if (customerDocument) {
                const doc = await uploadInquiryCustomerDocument(customerDocument);
                inquiryData.customer_document_url = doc?.url || null;
                inquiryData.customer_document_name = doc?.name || customerDocument.name;
            }

            const result = await createCustomerInquiry(inquiryData, items);
            const newId = result?.inquiry?.id;
            navigate(newId ? `/customer/inquiries/${newId}` : '/customer/dashboard');
        } catch (error) {
            console.error('[Customer Booking] create inquiry:', error);
            const message = error?.response?.data?.error || error?.message || 'Unknown error';
            toast.error(`Could not submit inquiry: ${message.replace(/^Failed to create inquiry:\s*/i, '')}`, { duration: 8000 });
        } finally {
            setSubmitting(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="relative min-h-[400px] max-w-4xl mx-auto">
            <Toaster position="top-center" />
            {submitting && <PageLoader message="Submitting your inquiry..." />}
            <ProductDetailsModal
                isOpen={productModal.isOpen}
                product={productModal.product}
                onClose={() => setProductModal({ isOpen: false, product: null })}
            />

            <div className="flex items-center gap-4 mb-8">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">Create inquiry</h1>
                    <p className="text-slate-500">Same services as field visits — tracked with your internal reference.</p>
                </div>
            </div>

            {loadingOptions ? (
                <div className="bg-white p-10 rounded-3xl border border-slate-100 text-center text-slate-500">Loading services...</div>
            ) : optionsError ? (
                <div className="bg-red-50 p-8 rounded-3xl border border-red-100 text-center">
                    <p className="text-red-700 font-bold mb-1">Services could not be loaded.</p>
                    <p className="text-sm text-red-600 mb-4">{optionsError}</p>
                    <button type="button" onClick={() => setOptionsReloadKey((k) => k + 1)} className="btn-primary px-6 py-2">
                        Try again
                    </button>
                </div>
            ) : availableServices.length === 0 ? (
                <div className="bg-amber-50 p-8 rounded-3xl border border-amber-100 text-center text-amber-800 font-medium">
                    No services are currently available. Please try again later.
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-4 px-1">1. Service</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {availableServices.map(({ key, title, desc, icon }) => (
                                <ServiceOption
                                    key={key}
                                    icon={icon}
                                    title={title}
                                    desc={desc}
                                    selected={service === key}
                                    onClick={() => service !== key && selectService(key)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-900 mb-6 px-1 flex items-center gap-2">
                            <Package size={20} className="text-primary-500" /> 2. {service} details
                        </h3>

                        {hasSubtypes && (
                            <div className="mb-6">
                                <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl w-fit gap-1">
                                    {availableSubtypes.map((sub) => (
                                        <button
                                            key={sub}
                                            type="button"
                                            onClick={() => subtype !== sub && selectSubtype(sub)}
                                            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                                                subtype === sub ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            {SUBTYPE_LABELS[service][sub]}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-2 px-1">{SUBTYPE_HINTS[subtype]}</p>
                            </div>
                        )}

                        {hasSubtypes ? renderValidationRefillDetails() : renderItemBuilderDetails()}

                        <p className="mt-6 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-start gap-2">
                            <ShieldCheck size={16} className="text-primary-500 shrink-0 mt-px" />
                            Our Admin team reviews every request and assigns a suitable service partner. If you have an assigned
                            agent, they will be kept informed. You can follow progress under My Inquiries.
                        </p>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-900 mb-6 px-1 flex items-center gap-2">
                            <Hash size={20} className="text-primary-500" /> Internal reference number
                        </h3>
                        <p className="text-sm text-slate-500 mb-4 px-1">
                            Your organization&apos;s approval / PO reference. Stored with the system-generated inquiry ID.
                        </p>
                        <input
                            type="text"
                            required
                            className="input-field"
                            placeholder="e.g. PO-2025-0042"
                            value={internalReferenceNumber}
                            onChange={(e) => setInternalReferenceNumber(e.target.value)}
                        />
                        <div className="mt-6">
                            <FieldLabel optional>Inquiry document (PDF)</FieldLabel>
                            {customerDocument ? (
                                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <span className="text-sm text-slate-700 flex items-center gap-2 min-w-0">
                                        <FileText size={16} className="text-primary-500 shrink-0" />
                                        <span className="truncate">{customerDocument.name}</span>
                                        <span className="text-xs text-slate-400 shrink-0">{(customerDocument.size / 1024).toFixed(0)} KB</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCustomerDocument(null)}
                                        className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600"
                                        title="Remove document"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <label className="relative flex flex-col items-center justify-center w-full min-h-[110px] border-2 border-dashed rounded-2xl bg-white border-slate-300 hover:border-primary-500 cursor-pointer text-center p-4">
                                    <input type="file" accept="application/pdf" onChange={handleCustomerDocument} className="sr-only" />
                                    <Upload size={22} className="text-slate-400 mb-2" />
                                    <span className="text-sm font-bold text-slate-700">Attach your inquiry document</span>
                                    <span className="text-xs text-slate-500">PDF, up to 5MB</span>
                                </label>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-900 mb-6 px-1">Submission Details</h3>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Submission date (optional)</label>
                                <input type="date" className="input-field" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
                                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                    <Clock size={12} /> The assigned partner will confirm the slot.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Additional notes (optional)</label>
                                <textarea
                                    className="input-field h-32 resize-none"
                                    placeholder="Access instructions, site contact, or safety notes."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={submitting} className="btn-primary w-full md:w-auto text-lg px-12 py-4">
                            {submitting ? 'Submitting...' : 'Submit inquiry'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default Booking;
