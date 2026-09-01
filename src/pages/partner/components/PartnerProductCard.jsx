import React from 'react';
import { Link } from 'react-router-dom';
import { Tag, ChevronRight } from 'lucide-react';
import ProductImage from '../../../components/products/ProductImage';

/**
 * View-only product card for the Partner "Manage Products" experience.
 * Mirrors the admin catalog card visually, but has no edit / assign / toggle
 * controls — a Partner can only look.
 */
const PartnerProductCard = ({ product }) => {
    const to = `/partner/products/${product.category_id || 'uncategorized'}/${product.id}`;

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5 duration-300 group">
            <Link to={to} className="h-44 relative block bg-slate-50 overflow-hidden">
                <div className="w-full h-full transition-transform duration-500 group-hover:scale-105">
                    <ProductImage src={product.image_url} alt={product.name} category={product.category} />
                </div>
                <span
                    className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                        product.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
                    }`}
                >
                    {product.is_active ? 'Active' : 'Inactive'}
                </span>
            </Link>

            <div className="p-5 flex-1 flex flex-col gap-2.5">
                <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-1">
                    <Tag size={11} /> {product.category || 'Uncategorized'}
                </p>

                <Link to={to}>
                    <h3 className="font-bold text-slate-900 text-base leading-tight hover:text-primary-600 transition-colors line-clamp-2">
                        {product.name}
                    </h3>
                </Link>

                {product.model_number && (
                    <p className="text-[11px] text-slate-400 font-mono">Model: {product.model_number}</p>
                )}

                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                    {product.description || 'No description provided.'}
                </p>

                <Link
                    to={to}
                    className="mt-auto pt-3 inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl transition-all"
                >
                    View Details <ChevronRight size={13} />
                </Link>
            </div>
        </div>
    );
};

export default PartnerProductCard;
