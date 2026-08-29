import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import ProductImage from '../../components/products/ProductImage';
import ProductFormModal from './components/ProductFormModal';
import ManagePartnersModal from './components/ManagePartnersModal';
import { ArrowLeft, Pencil, Users, Power, PackageOpen, Tag } from 'lucide-react';

/** Full product detail — image, description, specs table, assigned partners. */
const AdminProductDetail = () => {
    const { categoryId, productId } = useParams();
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState(null);
    const [product, setProduct] = useState(null);
    const [partners, setPartners] = useState([]);
    const [formOpen, setFormOpen] = useState(false);
    const [partnersModalOpen, setPartnersModalOpen] = useState(false);
    const [toggling, setToggling] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [{ data: catData }, { data: prodData, error: prodErr }] = await Promise.all([
                supabase.from('categories').select('*').eq('id', categoryId).maybeSingle(),
                supabase.from('products').select('*').eq('id', productId).maybeSingle(),
            ]);
            if (prodErr) throw prodErr;
            setCategory(catData);
            setProduct(prodData);

            if (prodData) {
                const { data: assignedData, error: assignedErr } = await supabase
                    .from('partner_products')
                    .select('assigned_at, partners(id, business_name, owner_name)')
                    .eq('product_id', prodData.id)
                    .order('assigned_at', { ascending: false });
                if (assignedErr) {
                    console.error('[AdminProductDetail] assigned partners query failed:', assignedErr);
                } else {
                    setPartners((assignedData || []).filter((r) => r.partners));
                }
            }
        } catch (err) {
            console.error('[AdminProductDetail] load failed:', err);
            toast.error('Failed to load product');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId]);

    const handleToggleActive = async () => {
        if (!product) return;
        setToggling(true);
        try {
            const { error } = await supabase
                .from('products')
                .update({ is_active: !product.is_active })
                .eq('id', product.id);
            if (error) throw error;
            toast.success(product.is_active ? 'Product deactivated' : 'Product activated');
            setProduct((prev) => ({ ...prev, is_active: !prev.is_active }));
        } catch (err) {
            console.error('[AdminProductDetail] toggle active failed:', err);
            toast.error('Could not update product status');
        } finally {
            setToggling(false);
        }
    };

    if (loading) return <PageLoader message="Loading product..." />;

    if (!product) {
        return (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
                <PackageOpen size={48} className="mx-auto text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-900">Product not found</h3>
                <Link to={`/admin/products/${categoryId}`} className="text-primary-600 font-bold mt-4 inline-block underline">
                    Back to {category?.name || 'Category'}
                </Link>
            </div>
        );
    }

    const specEntries = product.specifications && typeof product.specifications === 'object'
        ? Object.entries(product.specifications)
        : [];

    return (
        <div className="space-y-6">
            <Link
                to={`/admin/products/${categoryId}`}
                className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold text-xs uppercase tracking-widest transition-colors"
            >
                <ArrowLeft size={16} /> Back to {category?.name || 'Category'}
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Image + actions */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-soft h-72 relative bg-slate-50">
                        <ProductImage src={product.image_url} alt={product.name} category={category?.name} />

                        <span
                            className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${product.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
                                }`}
                        >
                            {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => setFormOpen(true)}
                            className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl transition-all"
                        >
                            <Pencil size={14} /> Edit Product
                        </button>
                        <button
                            onClick={() => setPartnersModalOpen(true)}
                            className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl transition-all"
                        >
                            <Users size={14} /> Manage Partners
                        </button>
                        <button
                            onClick={handleToggleActive}
                            disabled={toggling}
                            className={`inline-flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl transition-all disabled:opacity-50 ${product.is_active ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                }`}
                        >
                            <Power size={14} /> {product.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    </div>
                </div>

                {/* Details */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6 md:p-8">
                        <p className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <Tag size={12} /> {category?.name || 'Uncategorized'}
                        </p>
                        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">{product.name}</h1>
                        {product.model_number && (
                            <p className="text-sm font-bold text-slate-400 mt-1 font-mono">{product.model_number}</p>
                        )}
                        <p className="text-slate-600 mt-4 leading-relaxed">
                            {product.description || 'No description provided.'}
                        </p>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6 md:p-8">
                        <h2 className="font-bold text-slate-900 mb-4">Specifications</h2>
                        {specEntries.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No specifications recorded for this product yet.</p>
                        ) : (
                            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                                {specEntries.map(([key, value]) => (
                                    <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-5 py-3 bg-slate-50/50 even:bg-white">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide sm:w-1/3 shrink-0">{key}</span>
                                        <span className="text-sm font-semibold text-slate-800">{String(value)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6 md:p-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-slate-900">Assigned Partners ({partners.length})</h2>
                            <button
                                onClick={() => setPartnersModalOpen(true)}
                                className="text-xs font-black text-primary-600 uppercase tracking-widest hover:text-primary-700"
                            >
                                Manage
                            </button>
                        </div>
                        {partners.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Not assigned to any partner yet.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {partners.map((row) => (
                                    <div key={row.partners.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50/50">
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900 text-sm truncate">{row.partners.business_name}</p>
                                            {row.partners.owner_name && (
                                                <p className="text-xs text-slate-400 truncate">{row.partners.owner_name}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ProductFormModal
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                product={product}
                categoryId={categoryId}
                categoryName={category?.name}
                onSaved={load}
            />

            <ManagePartnersModal
                isOpen={partnersModalOpen}
                onClose={() => setPartnersModalOpen(false)}
                product={product}
                onSaved={load}
            />
        </div>
    );
};

export default AdminProductDetail;
