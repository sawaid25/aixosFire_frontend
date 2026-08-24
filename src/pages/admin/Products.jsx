import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import ProductImageFallback from '../../components/products/ProductImageFallback';
import ProductFormModal from './components/ProductFormModal';
import ManagePartnersModal from './components/ManagePartnersModal';
import {
    Search, Plus, Pencil, Users, Power, PackageOpen,
} from 'lucide-react';

const CATEGORY_FILTERS = ['All', 'Fire Fighting System', 'Fire Alarm System', 'Fire Pumps', 'Tanks', 'Other'];

const Products = () => {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [assignedCounts, setAssignedCounts] = useState({});
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');

    const [formOpen, setFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [partnersModalProduct, setPartnersModalProduct] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [{ data: pData, error: pErr }, { data: apData, error: apErr }] = await Promise.all([
                supabase.from('products').select('*').order('created_at', { ascending: true }),
                supabase.from('partner_products').select('product_id'),
            ]);
            if (pErr) throw pErr;
            if (apErr) console.error('[Products] partner_products count query failed:', apErr);

            setProducts(pData || []);
            const counts = {};
            (apData || []).forEach((row) => {
                counts[row.product_id] = (counts[row.product_id] || 0) + 1;
            });
            setAssignedCounts(counts);
        } catch (err) {
            console.error('[Products] load failed:', err);
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        return products.filter((p) => {
            const matchesSearch =
                (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.description || '').toLowerCase().includes(search.toLowerCase());
            const matchesCategory = category === 'All' || p.category === category;
            const matchesStatus =
                statusFilter === 'All' ||
                (statusFilter === 'Active' && p.is_active) ||
                (statusFilter === 'Inactive' && !p.is_active);
            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [products, search, category, statusFilter]);

    const handleToggleActive = async (product) => {
        setTogglingId(product.id);
        try {
            const { error } = await supabase
                .from('products')
                .update({ is_active: !product.is_active })
                .eq('id', product.id);
            if (error) throw error;
            toast.success(product.is_active ? 'Product deactivated' : 'Product activated');
            setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_active: !p.is_active } : p)));
        } catch (err) {
            console.error('[Products] toggle active failed:', err);
            toast.error('Could not update product status');
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
                    <p className="text-slate-500 text-sm mt-0.5">Manage the products available across your Partner network.</p>
                </div>
                <button
                    onClick={() => { setEditingProduct(null); setFormOpen(true); }}
                    className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl shadow-xl shadow-slate-200 transition-all w-full sm:w-auto"
                >
                    <Plus size={16} /> Add Product
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search products..."
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

            <div className="flex gap-2 flex-wrap">
                {CATEGORY_FILTERS.map((c) => (
                    <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${category === c
                                ? 'bg-primary-500 text-white border-primary-500 shadow'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        {c}
                    </button>
                ))}
            </div>

            <div className="relative min-h-[300px]">
                {loading ? (
                    <PageLoader message="Loading products..." />
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
                        <PackageOpen size={48} className="mx-auto text-slate-200 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900">No Products Found</h3>
                        <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter, or add a new product.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filtered.map((product) => (
                            <div
                                key={product.id}
                                className={`bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden flex flex-col transition-all hover:shadow-md ${!product.is_active ? 'opacity-70' : ''
                                    }`}
                            >
                                <div className="h-40 relative">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <ProductImageFallback category={product.category} />
                                    )}
                                    <span
                                        className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${product.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
                                            }`}
                                    >
                                        {product.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <div className="p-5 flex-1 flex flex-col gap-3">
                                    <div>
                                        <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">
                                            {product.category || 'Uncategorized'}
                                        </p>
                                        <h3 className="font-bold text-slate-900 text-lg leading-tight">{product.name}</h3>
                                        <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">
                                            {product.description || 'No description provided.'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                                        <Users size={14} />
                                        {assignedCounts[product.id] || 0} Partner{(assignedCounts[product.id] || 0) === 1 ? '' : 's'}
                                    </div>

                                    <div className="mt-auto pt-3 flex gap-2">
                                        <button
                                            onClick={() => setPartnersModalProduct(product)}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2.5 rounded-xl transition-all"
                                        >
                                            <Users size={13} /> Manage Partners
                                        </button>
                                        <button
                                            onClick={() => { setEditingProduct(product); setFormOpen(true); }}
                                            title="Edit"
                                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(product)}
                                            disabled={togglingId === product.id}
                                            title={product.is_active ? 'Deactivate' : 'Activate'}
                                            className={`p-2.5 rounded-xl transition-all disabled:opacity-50 ${product.is_active ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
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

            <ProductFormModal
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                product={editingProduct}
                onSaved={load}
            />

            <ManagePartnersModal
                isOpen={Boolean(partnersModalProduct)}
                onClose={() => setPartnersModalProduct(null)}
                product={partnersModalProduct}
                onSaved={load}
            />
        </div>
    );
};

export default Products;
