import React, { useState, useEffect } from 'react';
import { X, Package, CheckCircle, AlertCircle, Search, Maximize2, Loader2 } from 'lucide-react';
import ProductSpecsModal from './ProductSpecsModal';
import { updateInquiryItem } from '../../../api/partners';
import { toast } from 'react-hot-toast';

// Renders inline, directly inside the "Identification & Systems" section of
// InquiryItemDetailPage — not as a fixed/backdrop overlay. This page is built
// entirely out of stacked bordered sections, so an edit panel for one of them
// belongs in that same flow rather than as an interruptive popup.
const NewUnitDetailModal = ({ isOpen, onClose, inquiry, onUpdate }) => {
    const [selectedProductName, setSelectedProductName] = useState('');
    const [selectedCatalogNo, setSelectedCatalogNo] = useState('');
    const [productInfo, setProductInfo] = useState(null);
    const [confirmedQuantity, setConfirmedQuantity] = useState(0);
    const [pricePerUnit, setPricePerUnit] = useState(0);
    const [remarks, setRemarks] = useState('');
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [allCatalogs, setAllCatalogs] = useState([]);
    const [availableCatalogs, setAvailableCatalogs] = useState([]);

    const estimatedPrice = pricePerUnit * confirmedQuantity;
    const requestedQuantity = inquiry?.quantity || 0;
    const isRemarksRequired = confirmedQuantity < requestedQuantity;

    useEffect(() => {
        if (inquiry && isOpen) {
            const preselected = inquiry.selectedItem || {};
            const baseProductName = preselected.type || preselected.system || '';
            const options = Array.isArray(preselected.catalog_options) ? preselected.catalog_options : [];

            const normalizedCatalogs = options
                .filter((option) => option?.catalog_no)
                .map((option) => ({ ...option, productName: option.productName || baseProductName }));

            const fallbackCatalogNo = preselected.catalog_no ||
                preselected.catalog_number ||
                preselected.catalogNo ||
                (preselected.id ? `ITEM-${preselected.id}` : '');

            const fallbackCatalogs = fallbackCatalogNo
                ? [{ catalog_no: fallbackCatalogNo, productName: baseProductName }]
                : [];

            const products = [baseProductName, ...normalizedCatalogs.map(item => item.productName)]
                .filter(Boolean)
                .filter((item, idx, arr) => arr.indexOf(item) === idx);

            const catalogsToUse = normalizedCatalogs.length > 0 ? normalizedCatalogs : fallbackCatalogs;

            setAvailableProducts(products);
            setAllCatalogs(catalogsToUse);
            setAvailableCatalogs(catalogsToUse);
            setSelectedProductName(baseProductName);
            setSelectedCatalogNo(fallbackCatalogNo);
            setPricePerUnit(preselected.price || 0);
            setConfirmedQuantity(preselected.quantity || inquiry.quantity || 0);
            setRemarks(preselected.maintenance_notes || '');
        }
    }, [inquiry, isOpen]);

    useEffect(() => {
        if (!selectedCatalogNo) {
            setProductInfo(null);
            return;
        }

        const currentItem = inquiry?.selectedItem || {};
        const selectedCatalog = availableCatalogs.find(item => item.catalog_no === selectedCatalogNo);

        setProductInfo({
            productName: selectedProductName || currentItem.type || currentItem.system || 'Fire Equipment',
            catalog_no: selectedCatalogNo,
            capacity: selectedCatalog?.capacity || currentItem.capacity || '--',
            type: selectedCatalog?.type || currentItem.type || '--',
            manufacturer: selectedCatalog?.manufacturer || currentItem.manufacturer || '--',
            specs: {
                safetyCertification: selectedCatalog?.safetyCertification || currentItem.safetyCertification || '--',
                cylinderMaterial: selectedCatalog?.cylinderMaterial || currentItem.cylinderMaterial || '--',
                description: selectedCatalog?.description || currentItem.system_type || currentItem.maintenance_notes || 'No additional product description provided.'
            }
        });
    }, [selectedCatalogNo, selectedProductName, availableCatalogs, inquiry]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (!selectedCatalogNo) {
            toast.error('Please select a catalog number');
            return;
        }
        if (isRemarksRequired && !remarks.trim()) {
            toast.error('Please add remarks since confirmed quantity is less than requested.');
            return;
        }

        setIsLoading(true);
        try {
            await updateInquiryItem(inquiry.selectedItem.id, {
                catalog_no: selectedCatalogNo,
                quantity: confirmedQuantity,
                price: pricePerUnit,
                maintenance_notes: remarks,
                brand: productInfo.manufacturer !== '--' ? productInfo.manufacturer : undefined,
                system: productInfo.productName !== '--' ? productInfo.productName : undefined,
                system_type: productInfo.specs.description !== '--' ? productInfo.specs.description : undefined,
                type: productInfo.type !== '--' ? productInfo.type : undefined,
                capacity: productInfo.capacity !== '--' ? productInfo.capacity : undefined,
            });

            setIsSuccess(true);
            toast.success('Item updated successfully');

            setTimeout(() => {
                setIsSuccess(false);
                onClose();
                onUpdate && onUpdate();
            }, 1200);
        } catch (err) {
            console.error('Update error:', err);
            toast.error('Failed to update item details');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="bg-slate-50 rounded-3xl border border-slate-100 p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">

                {/* Header */}
                <div className="flex items-center justify-between gap-4 pb-6 border-b border-slate-200">
                    <div className="min-w-0">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                            Edit Unit <span className="text-primary-500">Details</span>
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                            {inquiry?.customers?.business_name || inquiry?.business_name || 'Client'} — {inquiry?.inquiry_no}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-slate-400 hover:text-slate-600 hover:bg-white rounded-2xl transition-all shrink-0"
                        title="Collapse"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Content */}
                {!isSuccess ? (
                    <div className="space-y-8">
                        {/* Product & Catalog Selection */}
                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Product</label>
                                <div className="relative">
                                    <select
                                        value={selectedProductName}
                                        onChange={(e) => {
                                            setSelectedProductName(e.target.value);
                                            setSelectedCatalogNo('');
                                            const filtered = allCatalogs.filter(item =>
                                                (item.productName || e.target.value) === e.target.value
                                            );
                                            setAvailableCatalogs(filtered.length > 0 ? filtered : allCatalogs);
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-5 text-sm font-medium focus:border-primary-500 outline-none"
                                    >
                                        <option value="">Choose Product</option>
                                        {availableProducts.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Catalog Number</label>
                                <div className="relative">
                                    <select
                                        value={selectedCatalogNo}
                                        onChange={(e) => setSelectedCatalogNo(e.target.value)}
                                        disabled={!selectedProductName}
                                        className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-5 text-sm font-medium focus:border-primary-500 outline-none disabled:opacity-50"
                                    >
                                        <option value="">
                                            {selectedProductName ? 'Choose Catalog No' : 'Select Product First'}
                                        </option>
                                        {availableCatalogs.map(item => (
                                            <option key={item.catalog_no} value={item.catalog_no}>
                                                {item.catalog_no}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Product Info & Pricing */}
                        {productInfo && (
                            <div className="space-y-8">
                                {/* Product Overview */}
                                <div className="bg-slate-900 p-6 rounded-3xl text-white flex flex-col sm:flex-row items-start sm:items-center gap-5">
                                    <div className="p-4 bg-white/10 rounded-2xl shrink-0">
                                        <Package size={28} className="text-primary-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-300">Selected Product</p>
                                        <h4 className="text-xl text-white tracking-tight mt-1 break-words">
                                            {productInfo.productName}
                                        </h4>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                            <span>Catalog: {productInfo.catalog_no}</span>
                                            <span>•</span>
                                            <span>{productInfo.capacity}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsProductModalOpen(true)}
                                        className="p-3 hover:bg-white/10 rounded-2xl transition-all shrink-0"
                                    >
                                        <Maximize2 size={22} />
                                    </button>
                                </div>

                                {/* Pricing & Quantity */}
                                <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h5 className="font-black text-slate-900 uppercase tracking-widest text-sm">Partner Response</h5>
                                        <span className="px-4 py-1 bg-primary-50 text-primary-600 text-xs font-black rounded-2xl">
                                            Requested: {requestedQuantity}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Price per Unit (SAR)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={pricePerUnit}
                                                onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-2xl font-black focus:border-primary-500 outline-none"
                                                placeholder="0.00"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Confirmed Quantity</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={confirmedQuantity}
                                                onChange={(e) => setConfirmedQuantity(parseInt(e.target.value) || 0)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-2xl font-black focus:border-primary-500 outline-none"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-primary-500 uppercase tracking-widest">Estimated Total</label>
                                            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-2xl font-black text-slate-400">
                                                SAR {estimatedPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>

                                    {isRemarksRequired && (
                                        <div className="pt-4 border-t">
                                            <label className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                                                <AlertCircle size={16} /> Remarks Required
                                            </label>
                                            <textarea
                                                value={remarks}
                                                onChange={(e) => setRemarks(e.target.value)}
                                                placeholder="Reason for confirming lower quantity..."
                                                className="w-full h-28 bg-rose-50 border border-rose-100 rounded-2xl p-4 text-sm focus:border-rose-300 outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={handleConfirm}
                                    disabled={isLoading || !selectedCatalogNo}
                                    className="w-full py-5 bg-slate-900 hover:bg-black text-white font-black rounded-3xl text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isLoading ? (
                                        <Loader2 className="animate-spin" size={22} />
                                    ) : (
                                        'Confirm Availability & Update Item'
                                    )}
                                </button>
                            </div>
                        )}

                        {!productInfo && (
                            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                                <Search size={48} className="mx-auto text-slate-300 mb-4" />
                                <p className="text-slate-400 font-medium">Please select a product and catalog number</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Success State */
                    <div className="py-20 text-center">
                        <div className="w-24 h-24 bg-emerald-100 mx-auto rounded-full flex items-center justify-center mb-8">
                            <CheckCircle size={56} className="text-emerald-600" />
                        </div>
                        <h4 className="text-3xl font-black text-slate-900 tracking-tight">Update Successful!</h4>
                        <p className="text-slate-500 mt-3 max-w-xs mx-auto">
                            The item has been successfully updated with the selected catalog and quantity.
                        </p>
                    </div>
                )}
            </div>

            <ProductSpecsModal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                product={productInfo}
            />
        </>
    );
};

export default NewUnitDetailModal;
