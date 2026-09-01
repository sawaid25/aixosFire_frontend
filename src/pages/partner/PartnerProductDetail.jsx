import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft, Tag, PackageOpen, AlertCircle, RefreshCw, ShieldCheck,
    Calendar, Hash, Boxes, CircleDot,
} from 'lucide-react';
import usePartnerProducts from '../../hooks/usePartnerProducts';
import ProductImage from '../../components/products/ProductImage';

const InfoRow = ({ icon, label, children }) => {
    const Icon = icon;
    return (
        <div className="flex items-start gap-3 px-5 py-3.5 bg-slate-50/60 even:bg-white">
            <Icon size={15} className="text-slate-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                <div className="text-sm font-semibold text-slate-800 mt-0.5 break-words">{children}</div>
            </div>
        </div>
    );
};

const PartnerProductDetail = () => {
    const { categoryId, productId } = useParams();
    const { products, loading, error, reload } = usePartnerProducts();

    const product = useMemo(
        () => products.find((p) => String(p.id) === String(productId)) || null,
        [products, productId],
    );

    const backTo = categoryId ? `/partner/products/${categoryId}` : '/partner/products';
    const backLabel = product?.category || 'Manage Products';

    const backLink = (
        <Link
            to={backTo}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold text-xs uppercase tracking-widest transition-colors"
        >
            <ArrowLeft size={16} /> Back to {backLabel}
        </Link>
    );

    if (loading) {
        return (
            <div className="space-y-6">
                {backLink}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 h-80 bg-slate-100 rounded-3xl animate-pulse" />
                    <div className="lg:col-span-7 space-y-4">
                        <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
                        <div className="h-56 bg-slate-100 rounded-3xl animate-pulse" />
                    </div>
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
                    <h3 className="text-lg font-bold text-slate-900">Unable to load this product</h3>
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

    // Not in the partner's assigned set → could be unassigned, deactivated-off-list,
    // or a guessed/foreign id. Same neutral message either way — no data leak.
    if (!product) {
        return (
            <div className="space-y-6">
                {backLink}
                <div className="bg-white rounded-3xl p-14 text-center border border-slate-100 shadow-soft">
                    <PackageOpen size={40} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900">Product not available</h3>
                    <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
                        This product isn’t assigned to your organization, or the assignment was removed by the Admin.
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

    const specEntries = product.specifications && typeof product.specifications === 'object'
        ? Object.entries(product.specifications)
        : [];

    const assignedOn = product.assigned_at
        ? new Date(product.assigned_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : null;

    return (
        <div className="space-y-6">
            {backLink}

            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Product Details</p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Image */}
                <div className="lg:col-span-5">
                    <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-soft relative bg-slate-50 aspect-[4/3] lg:aspect-auto lg:h-96">
                        <ProductImage src={product.image_url} alt={product.name} category={product.category} />
                        <span
                            className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                product.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
                            }`}
                        >
                            {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>

                {/* Summary + info */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6 md:p-8">
                        <p className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <Tag size={12} /> {product.category || 'Uncategorized'}
                        </p>
                        {product.model_number && (
                            <p className="text-sm font-bold text-slate-400 font-mono">{product.model_number}</p>
                        )}
                        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 mt-1">{product.name}</h1>
                        <p className="text-slate-600 mt-4 leading-relaxed">
                            {product.description || 'No description provided.'}
                        </p>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                        <h2 className="font-bold text-slate-900 px-6 md:px-8 pt-6 pb-3">Product Information</h2>
                        <div className="divide-y divide-slate-100 border-t border-slate-100">
                            <InfoRow icon={Boxes} label="Category">{product.category || 'Uncategorized'}</InfoRow>
                            <InfoRow icon={Hash} label="Model Number">
                                {product.model_number || <span className="text-slate-400 italic font-normal">Not specified</span>}
                            </InfoRow>
                            <InfoRow icon={CircleDot} label="Status">
                                <span className={product.is_active ? 'text-emerald-600' : 'text-slate-500'}>
                                    {product.is_active ? 'Active — available' : 'Inactive — not available for new usage'}
                                </span>
                            </InfoRow>
                            <InfoRow icon={ShieldCheck} label="Availability">Assigned to your organization by Admin</InfoRow>
                            {assignedOn && (
                                <InfoRow icon={Calendar} label="Assigned On">{assignedOn}</InfoRow>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Specifications */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6 md:p-8">
                <h2 className="font-bold text-slate-900 mb-4">Technical Specifications</h2>
                {specEntries.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No specifications recorded for this product.</p>
                ) : (
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                        {specEntries.map(([key, value]) => (
                            <div
                                key={key}
                                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-5 py-3 bg-slate-50/50 even:bg-white"
                            >
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide sm:w-1/3 shrink-0">{key}</span>
                                <span className="text-sm font-semibold text-slate-800">{String(value)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PartnerProductDetail;
