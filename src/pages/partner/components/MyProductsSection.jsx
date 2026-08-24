import React, { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { getMyProducts } from '../../../api/partners';
import ProductImageFallback from '../../../components/products/ProductImageFallback';

/**
 * Read-only view of the products Admin has assigned to this Partner. Partners
 * can never assign products to themselves or others — this only ever shows
 * what GET /partners/products (JWT-scoped to the logged-in partner) returns.
 */
const MyProductsSection = () => {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const data = await getMyProducts();
                if (!cancelled) setProducts(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('[MyProductsSection] load failed:', err);
                if (!cancelled) setError('Could not load your assigned products.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft-xl overflow-hidden mt-6">
            <div className="p-6 md:p-8 border-b border-slate-100">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">
                    My <span className="text-primary-500">Products.</span>
                </h2>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Made available to you by Admin
                </p>
            </div>

            <div className="p-6 md:p-8">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-52 rounded-2xl bg-slate-100 animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <p className="text-sm text-red-600 font-medium text-center py-8">{error}</p>
                ) : products.length === 0 ? (
                    <div className="text-center py-10">
                        <Boxes size={40} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-slate-500 font-bold">No products assigned yet</p>
                        <p className="text-slate-400 text-sm mt-1">Admin hasn't assigned any products to your account.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {products.map((p) => (
                            <div key={p.id} className="rounded-2xl border border-slate-100 overflow-hidden">
                                <div className="h-28 relative">
                                    {p.image_url ? (
                                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <ProductImageFallback category={p.category} />
                                    )}
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
                                    <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description || 'No description provided.'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyProductsSection;
