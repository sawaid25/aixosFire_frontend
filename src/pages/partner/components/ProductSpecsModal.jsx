import React from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Info, Factory, Layers, Maximize2 } from 'lucide-react';

const ProductSpecsModal = ({ isOpen, onClose, product }) => {
    if (!isOpen || !product) return null;

    // Rendered via a portal straight into document.body rather than in place.
    // This page's outer wrapper (and others like it) carry `animate-in`
    // classes, and any ancestor with an active CSS transform (which Tailwind's
    // enter animations apply) becomes the containing block for `fixed`
    // descendants — so this modal was positioning itself against that
    // animated ancestor's box instead of the real viewport, making it look
    // like a mispositioned floating popup overlapping the header/sidebar.
    // Portaling to <body> sidesteps that class of bug entirely.
    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-8 pb-4 flex justify-between items-center border-b border-slate-50 shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                            Product <span className="text-primary-500">Specifications.</span>
                        </h3>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                            {product.catalog_no}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-2xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="p-3 bg-white rounded-xl text-primary-500 shadow-sm">
                                <Maximize2 size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Name</p>
                                <p className="font-bold text-slate-900">{product.productName}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</p>
                                <div className="flex items-center gap-2">
                                    <Layers size={14} className="text-indigo-500" />
                                    <p className="font-bold text-slate-900 text-sm">{product.type}</p>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Capacity</p>
                                <div className="flex items-center gap-2 text-sm">
                                    <Info size={14} className="text-amber-500" />
                                    <p className="font-bold text-slate-900">{product.capacity}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Manufacturer</p>
                            <div className="flex items-center gap-2">
                                <Factory size={16} className="text-slate-600" />
                                <p className="font-bold text-slate-900">{product.manufacturer}</p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Safety Certification</p>
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-emerald-500" />
                                <p className="font-bold text-slate-900">{product.specs?.safetyCertification || '--'}</p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cylinder Material</p>
                            <p className="font-bold text-slate-900">{product.specs?.cylinderMaterial || '--'}</p>
                        </div>

                        <div className="p-6 bg-primary-50 rounded-3xl border border-primary-100/50">
                            <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-2">Description</p>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                {product.specs?.description || 'No additional product description provided.'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProductSpecsModal;
