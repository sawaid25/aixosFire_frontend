import React from 'react';
import { Link } from 'react-router-dom';
import { Boxes, ChevronRight, AlertCircle } from 'lucide-react';
import usePartnerProducts from '../../../hooks/usePartnerProducts';
import ProductImage from '../../../components/products/ProductImage';

const PREVIEW_LIMIT = 6;

/**
 * Compact dashboard preview of the products Admin has assigned to this Partner.
 * Read-only. Full experience lives at /partner/products (Manage Products) — this
 * shares the same JWT-scoped data source (usePartnerProducts → GET
 * /api/partners/products) so it never double-fetches.
 */
const MyProductsSection = () => {
    const { products, loading, error } = usePartnerProducts();
    const preview = products.slice(0, PREVIEW_LIMIT);

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft-xl overflow-hidden mt-6">
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">
                        My <span className="text-primary-500">Products.</span>
                    </h2>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Made available to you by Admin
                    </p>
                </div>
                <Link
                    to="/partner/products"
                    className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest"
                >
                    Manage All <ChevronRight size={13} />
                </Link>
            </div>

            <div className="p-6 md:p-8">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-52 rounded-2xl bg-slate-100 animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <p className="text-sm text-red-600 font-medium text-center py-8 flex items-center justify-center gap-2">
                        <AlertCircle size={16} /> Unable to load products. Please try again.
                    </p>
                ) : products.length === 0 ? (
                    <div className="text-center py-10">
                        <Boxes size={40} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-slate-500 font-bold">No products assigned yet</p>
                        <p className="text-slate-400 text-sm mt-1">Admin hasn't assigned any products to your account.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {preview.map((p) => (
                                <Link
                                    key={p.id}
                                    to={`/partner/products/${p.category_id || 'uncategorized'}/${p.id}`}
                                    className="rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-all group"
                                >
                                    <div className="h-28 relative bg-slate-50 overflow-hidden">
                                        <div className="w-full h-full transition-transform duration-500 group-hover:scale-105">
                                            <ProductImage src={p.image_url} alt={p.name} category={p.category} />
                                        </div>
                                        {!p.is_active && (
                                            <span className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-500 text-white shadow-sm">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">
                                            {p.category || 'Uncategorized'}
                                        </p>
                                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-primary-600 transition-colors">{p.name}</h3>
                                        {p.model_number && (
                                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.model_number}</p>
                                        )}
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description || 'No description provided.'}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                        {products.length > PREVIEW_LIMIT && (
                            <div className="mt-6 text-center">
                                <Link
                                    to="/partner/products"
                                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl transition-all"
                                >
                                    View all {products.length} products <ChevronRight size={14} />
                                </Link>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default MyProductsSection;
