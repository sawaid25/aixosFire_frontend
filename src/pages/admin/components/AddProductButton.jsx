import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, PackagePlus, Upload } from 'lucide-react';

/**
 * The "Add Product" control on CategoryProducts.jsx — a split button that
 * opens a small menu:
 *   • Add Single Product  → existing ProductFormModal (onAddSingle)
 *   • Bulk Upload (CSV)    → /admin/products/bulk-import
 * Styled to match the existing black pill buttons in the Admin catalog.
 */
const AddProductButton = ({ onAddSingle }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onEsc);
        };
    }, [open]);

    return (
        <div className="relative w-full sm:w-auto" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl shadow-xl shadow-slate-200 transition-all w-full sm:w-auto"
            >
                <Plus size={16} /> Add Product
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 sm:right-0 mt-2 w-full sm:w-72 bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-slate-300/40 overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-150"
                >
                    <p className="px-4 pt-3 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Add Product
                    </p>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setOpen(false); onAddSingle?.(); }}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                        <span className="p-2 rounded-xl bg-orange-100 text-orange-600 shrink-0">
                            <PackagePlus size={16} />
                        </span>
                        <span>
                            <span className="block text-sm font-bold text-slate-900">Add Single Product</span>
                            <span className="block text-xs text-slate-500">Fill in one product manually</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setOpen(false); navigate('/admin/products/bulk-import'); }}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-t border-slate-50"
                    >
                        <span className="p-2 rounded-xl bg-sky-100 text-sky-600 shrink-0">
                            <Upload size={16} />
                        </span>
                        <span>
                            <span className="block text-sm font-bold text-slate-900">Bulk Upload (CSV)</span>
                            <span className="block text-xs text-slate-500">Create / update many products from a file</span>
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default AddProductButton;
