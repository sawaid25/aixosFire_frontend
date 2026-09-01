import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft, Search, PackageOpen, AlertCircle, RefreshCw, SearchX,
} from 'lucide-react';
import usePartnerProducts from '../../hooks/usePartnerProducts';
import PartnerProductCard from './components/PartnerProductCard';

const CardSkeleton = () => (
    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
        <div className="h-44 bg-slate-100 animate-pulse" />
        <div className="p-5 space-y-3">
            <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
            <div className="h-9 w-full bg-slate-100 rounded-xl animate-pulse mt-2" />
        </div>
    </div>
);

/** All of a Partner's assigned products inside one category. */
const PartnerCategoryProducts = () => {
    const { categoryId } = useParams();
    const { products, loading, error, reload } = usePartnerProducts();
    const [search, setSearch] = useState('');

    const inCategory = useMemo(
        () => products.filter((p) => (p.category_id || 'uncategorized') === categoryId),
        [products, categoryId],
    );

    const categoryName = inCategory[0]?.category
        || (categoryId === 'uncategorized' ? 'Uncategorized' : null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return inCategory;
        return inCategory.filter(
            (p) =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.model_number || '').toLowerCase().includes(q),
        );
    }, [inCategory, search]);

    const backLink = (
        <Link
            to="/partner/products"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold text-xs uppercase tracking-widest transition-colors"
        >
            <ArrowLeft size={16} /> Back to Manage Products
        </Link>
    );

    if (loading) {
        return (
            <div className="space-y-6">
                {backLink}
                <div className="h-8 w-56 bg-slate-100 rounded animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                {backLink}
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
                    <AlertCircle size={44} className="mx-auto text-red-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900">Unable to load products</h3>
                    <button
                        onClick={reload}
                        className="mt-5 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-2xl transition-all"
                    >
                        <RefreshCw size={14} /> Retry
                    </button>
                </div>
            </div>
        );
    }

    // Category has nothing assigned to this partner (or bad/foreign id in the URL).
    if (inCategory.length === 0) {
        return (
            <div className="space-y-6">
                {backLink}
                <div className="bg-white rounded-3xl p-14 text-center border border-slate-100 shadow-soft">
                    <PackageOpen size={40} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900">No products in this category</h3>
                    <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
                        Your organization has no products assigned under this category. It may have been
                        unassigned by the Admin.
                    </p>
                    <Link
                        to="/partner/products"
                        className="mt-5 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-2xl transition-all"
                    >
                        Back to Manage Products
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {backLink}

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Partner · Category</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900">{categoryName}</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {inCategory.length} product{inCategory.length === 1 ? '' : 's'} assigned to your organization.
                    </p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search in this category..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-primary-400 transition-colors"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white rounded-3xl p-14 text-center border border-slate-100 shadow-soft">
                    <SearchX size={40} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900">No matching products</h3>
                    <p className="text-slate-400 text-sm mt-1">Nothing in this category matches “{search}”.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filtered.map((p) => <PartnerProductCard key={p.id} product={p} />)}
                </div>
            )}
        </div>
    );
};

export default PartnerCategoryProducts;
