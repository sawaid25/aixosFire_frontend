import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import ProductImageFallback from '../../components/products/ProductImageFallback';
import CategoryFormModal from './components/CategoryFormModal';
import {
    Search, Plus, Pencil, Power, PackageOpen, ChevronRight, Boxes, Upload,
} from 'lucide-react';

/** Admin catalog root: Category cards. Opening one drills into CategoryProducts.jsx. */
const Products = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [productCounts, setProductCounts] = useState({});
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const [formOpen, setFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [{ data: cData, error: cErr }, { data: pData, error: pErr }] = await Promise.all([
                supabase.from('categories').select('*').order('created_at', { ascending: true }),
                supabase.from('products').select('id, category_id'),
            ]);
            if (cErr) throw cErr;
            if (pErr) console.error('[Products] product count query failed:', pErr);

            setCategories(cData || []);
            const counts = {};
            (pData || []).forEach((row) => {
                if (!row.category_id) return;
                counts[row.category_id] = (counts[row.category_id] || 0) + 1;
            });
            setProductCounts(counts);
        } catch (err) {
            console.error('[Products] load failed:', err);
            toast.error('Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        return categories.filter((c) => {
            const matchesSearch =
                (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (c.description || '').toLowerCase().includes(search.toLowerCase());
            const matchesStatus =
                statusFilter === 'All' ||
                (statusFilter === 'Active' && c.is_active) ||
                (statusFilter === 'Inactive' && !c.is_active);
            return matchesSearch && matchesStatus;
        });
    }, [categories, search, statusFilter]);

    const handleToggleActive = async (category) => {
        setTogglingId(category.id);
        try {
            const { error } = await supabase
                .from('categories')
                .update({ is_active: !category.is_active })
                .eq('id', category.id);
            if (error) throw error;
            toast.success(category.is_active ? 'Category deactivated' : 'Category activated');
            setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, is_active: !c.is_active } : c)));
        } catch (err) {
            console.error('[Products] toggle active failed:', err);
            toast.error('Could not update category status');
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin · Catalog</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Products</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Manage the product categories available across your Partner network.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => navigate('/admin/products/bulk-import')}
                        className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl shadow-sm transition-all w-full sm:w-auto"
                    >
                        <Upload size={15} /> Bulk Import
                    </button>
                    <button
                        onClick={() => { setEditingCategory(null); setFormOpen(true); }}
                        className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl shadow-xl shadow-slate-200 transition-all w-full sm:w-auto"
                    >
                        <Plus size={16} /> Add Category
                    </button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search categories..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-primary-400 transition-colors"
                    />
                </div>
                <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm overflow-x-auto">
                    {['All', 'Active', 'Inactive'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${statusFilter === f ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative min-h-[300px]">
                {loading ? (
                    <PageLoader message="Loading categories..." />
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
                        <PackageOpen size={48} className="mx-auto text-slate-200 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900">No Categories Found</h3>
                        <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter, or add a new category.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filtered.map((category) => (
                            <div
                                key={category.id}
                                className={`bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden flex flex-col transition-all hover:shadow-md ${!category.is_active ? 'opacity-70' : ''
                                    }`}
                            >
                                <Link to={`/admin/products/${category.id}`} className="h-40 relative block">
                                    {category.image_url ? (
                                        <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <ProductImageFallback category={category.name} />
                                    )}
                                    <span
                                        className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${category.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
                                            }`}
                                    >
                                        {category.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </Link>

                                <div className="p-5 flex-1 flex flex-col gap-3">
                                    <div>
                                        <Link to={`/admin/products/${category.id}`}>
                                            <h3 className="font-bold text-slate-900 text-lg leading-tight hover:text-primary-600 transition-colors">
                                                {category.name}
                                            </h3>
                                        </Link>
                                        <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">
                                            {category.description || 'No description provided.'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                                        <Boxes size={14} />
                                        {productCounts[category.id] || 0} Product{(productCounts[category.id] || 0) === 1 ? '' : 's'}
                                    </div>

                                    <div className="mt-auto pt-3 flex gap-2">
                                        <Link
                                            to={`/admin/products/${category.id}`}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2.5 rounded-xl transition-all"
                                        >
                                            View Products <ChevronRight size={13} />
                                        </Link>
                                        <button
                                            onClick={() => { setEditingCategory(category); setFormOpen(true); }}
                                            title="Edit"
                                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(category)}
                                            disabled={togglingId === category.id}
                                            title={category.is_active ? 'Deactivate' : 'Activate'}
                                            className={`p-2.5 rounded-xl transition-all disabled:opacity-50 ${category.is_active ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                                }`}
                                        >
                                            <Power size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <CategoryFormModal
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                category={editingCategory}
                onSaved={load}
            />
        </div>
    );
};

export default Products;
