import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Search, Boxes, Package, CheckCircle2, LayoutGrid, ChevronRight,
    PackageOpen, AlertCircle, RefreshCw, SearchX,
} from 'lucide-react';
import usePartnerProducts from '../../hooks/usePartnerProducts';
import PartnerProductCard from './components/PartnerProductCard';

const CardSkeleton = () => (
    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
        <div className="h-44 bg-slate-100 animate-pulse" />
        <div className="p-5 space-y-3">
            <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
            <div className="h-9 w-full bg-slate-100 rounded-xl animate-pulse mt-2" />
        </div>
    </div>
);

const StatTile = ({ icon, label, value, tint }) => {
    const Icon = icon;
    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5 flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${tint}`}>
                <Icon size={20} />
            </div>
            <div>
                <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
            </div>
        </div>
    );
};

const ManageProducts = () => {
    const { products, loading, error, reload } = usePartnerProducts();
    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState('all');

    // Distinct categories that actually contain products assigned to this partner.
    const categories = useMemo(() => {
        const map = new Map();
        products.forEach((p) => {
            const id = p.category_id || 'uncategorized';
            if (!map.has(id)) map.set(id, { id, name: p.category || 'Uncategorized', count: 0 });
            map.get(id).count += 1;
        });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [products]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return products.filter((p) => {
            const inCategory = categoryId === 'all' || (p.category_id || 'uncategorized') === categoryId;
            if (!inCategory) return false;
            if (!q) return true;
            return (
                (p.name || '').toLowerCase().includes(q) ||
                (p.model_number || '').toLowerCase().includes(q) ||
                (p.category || '').toLowerCase().includes(q)
            );
        });
    }, [products, search, categoryId]);

    // Group the filtered set back into category sections for display.
    const sections = useMemo(() => {
        const map = new Map();
        filtered.forEach((p) => {
            const id = p.category_id || 'uncategorized';
            if (!map.has(id)) map.set(id, { id, name: p.category || 'Uncategorized', items: [] });
            map.get(id).items.push(p);
        });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [filtered]);

    const stats = useMemo(() => ({
        total: products.length,
        categories: categories.length,
        active: products.filter((p) => p.is_active).length,
    }), [products, categories]);

    const header = (
        <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Partner · Catalog</p>
            <h1 className="text-2xl font-display font-bold text-slate-900">Manage Products</h1>
            <p className="text-slate-500 text-sm mt-0.5">
                View the products assigned to your organization by the Admin.
            </p>
        </div>
    );

    // ---- error ----
    if (error && !loading) {
        return (
            <div className="space-y-6">
                {header}
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
                    <AlertCircle size={44} className="mx-auto text-red-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900">Unable to load products</h3>
                    <p className="text-slate-400 text-sm mt-1">Please try again in a moment.</p>
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

    return (
        <div className="space-y-6">
            {header}

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search products, model numbers, categories..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-primary-400 transition-colors"
                    />
                </div>
                <div className="relative sm:w-64">
                    <LayoutGrid size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        disabled={loading || categories.length === 0}
                        className="w-full appearance-none pl-10 pr-9 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 outline-none focus:border-primary-400 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <option value="all">All Categories</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.count})</option>
                        ))}
                    </select>
                    <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Overview */}
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Overview</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatTile icon={Package} label="Total Products" value={loading ? '—' : stats.total} tint="bg-primary-50 text-primary-600" />
                    <StatTile icon={Boxes} label="Categories" value={loading ? '—' : stats.categories} tint="bg-violet-50 text-violet-600" />
                    <StatTile icon={CheckCircle2} label="Active Products" value={loading ? '—' : stats.active} tint="bg-emerald-50 text-emerald-600" />
                </div>
            </div>

            {/* Body */}
            {loading ? (
                <div className="space-y-4">
                    <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
                    </div>
                </div>
            ) : products.length === 0 ? (
                <div className="bg-white rounded-3xl p-14 text-center border border-slate-100 shadow-soft">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <PackageOpen size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No Products Assigned</h3>
                    <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
                        Products assigned to your organization by the Admin will appear here.
                    </p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-3xl p-14 text-center border border-slate-100 shadow-soft">
                    <SearchX size={40} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900">No matching products</h3>
                    <p className="text-slate-400 text-sm mt-1">
                        Nothing matches your search or filter. Try clearing them.
                    </p>
                    <button
                        onClick={() => { setSearch(''); setCategoryId('all'); }}
                        className="mt-5 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all"
                    >
                        Clear filters
                    </button>
                </div>
            ) : (
                <div className="space-y-10">
                    {sections.map((section) => (
                        <section key={section.id}>
                            <div className="flex items-end justify-between gap-3 mb-4">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{section.name}</h2>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                        {section.items.length} Product{section.items.length === 1 ? '' : 's'}
                                    </p>
                                </div>
                                {section.id !== 'uncategorized' && (
                                    <Link
                                        to={`/partner/products/${section.id}`}
                                        className="inline-flex items-center gap-1.5 text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest shrink-0"
                                    >
                                        View Category <ChevronRight size={13} />
                                    </Link>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {section.items.map((p) => (
                                    <PartnerProductCard key={p.id} product={p} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ManageProducts;
