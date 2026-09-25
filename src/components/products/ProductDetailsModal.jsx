import React from 'react';
import { X, Tag, Info } from 'lucide-react';
import ProductImage from './ProductImage';

/**
 * Read-only "View Details" popup for a Product the Agent has selected while building
 * an inquiry (src/pages/agent/VisitForm.jsx). Shows exactly the fields the Admin
 * Product system stores — name, category, model number, description, specifications,
 * image (see src/pages/admin/AdminProductDetail.jsx, the equivalent Admin-side view) —
 * nothing invented or hardcoded. Purely informational: closing it never changes
 * whatever product is currently selected in the form.
 */
const ProductDetailsModal = ({ isOpen, onClose, product }) => {
    if (!isOpen || !product) return null;

    const specEntries = product.specifications && typeof product.specifications === 'object'
        ? Object.entries(product.specifications)
        : [];

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 md:p-8 border-b border-slate-50 flex items-start justify-between gap-4 bg-slate-50/50 shrink-0">
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <Tag size={12} /> {product.category || 'Uncategorized'}
                        </p>
                        <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 truncate">{product.name}</h3>
                        {product.model_number && (
                            <p className="text-xs font-bold text-slate-400 mt-1 font-mono">{product.model_number}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-all shadow-sm shrink-0"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 md:p-8 overflow-y-auto space-y-6">
                    <div className="rounded-3xl overflow-hidden border border-slate-100 h-56 md:h-64 bg-slate-50">
                        <ProductImage src={product.image_url} alt={product.name} category={product.category} />
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-2">Description</h4>
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                            {product.description || 'No description provided.'}
                        </p>
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                            <Info size={14} className="text-slate-400" /> Specifications
                        </h4>
                        {specEntries.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No specifications recorded for this product yet.</p>
                        ) : (
                            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                                {specEntries.map(([key, value]) => (
                                    <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 bg-slate-50/50 even:bg-white">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide sm:w-1/3 shrink-0">{key}</span>
                                        <span className="text-sm font-semibold text-slate-800 break-words">{String(value)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t border-slate-50 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3 rounded-2xl transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetailsModal;
