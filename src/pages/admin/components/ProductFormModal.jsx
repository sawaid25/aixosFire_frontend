import React, { useEffect, useState } from 'react';
import { Package, X, CheckCircle2, ImagePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../supabaseClient';
import ProductImageFallback from '../../../components/products/ProductImageFallback';

const CATEGORIES = ['Fire Fighting System', 'Fire Alarm System', 'Fire Pumps', 'Tanks', 'Other'];

const EMPTY_FORM = { name: '', description: '', category: 'Fire Fighting System', is_active: true };

const uploadProductImage = async (file) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `catalog/${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const { error } = await supabase.storage.from('products').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('products').getPublicUrl(filePath);
    return data?.publicUrl || null;
};

/** Add/Edit modal for the master product catalog. `product` null = create mode. */
const ProductFormModal = ({ isOpen, onClose, product, onSaved }) => {
    const [form, setForm] = useState(EMPTY_FORM);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (product) {
            setForm({
                name: product.name || '',
                description: product.description || '',
                category: product.category || 'Fire Fighting System',
                is_active: product.is_active !== false,
            });
            setImagePreview(product.image_url || null);
        } else {
            setForm(EMPTY_FORM);
            setImagePreview(null);
        }
        setImageFile(null);
    }, [isOpen, product]);

    if (!isOpen) return null;

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Please choose an image file');
            return;
        }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error('Product name is required');
            return;
        }

        setSaving(true);
        try {
            let imageUrl = product?.image_url || null;
            if (imageFile) {
                try {
                    imageUrl = await uploadProductImage(imageFile);
                } catch (uploadErr) {
                    console.error('[ProductFormModal] image upload failed:', uploadErr);
                    toast.error('Image upload failed — saving product without changing the image.');
                }
            }

            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                category: form.category,
                is_active: form.is_active,
                image_url: imageUrl,
            };

            if (product?.id) {
                const { error } = await supabase.from('products').update(payload).eq('id', product.id);
                if (error) throw error;
                toast.success('Product updated');
            } else {
                const { error } = await supabase.from('products').insert([payload]);
                if (error) throw error;
                toast.success('Product created');
            }

            onSaved?.();
            onClose();
        } catch (err) {
            console.error('[ProductFormModal] save failed:', err);
            toast.error(err?.message || 'Could not save product');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                            <Package size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                {product ? 'Edit Product' : 'Add Product'}
                            </h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Product Catalog</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-all shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Image</label>
                        <label className="relative block w-full h-36 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 hover:border-primary-400 transition-all cursor-pointer group">
                            {imagePreview ? (
                                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <ProductImageFallback category={form.category} />
                            )}
                            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <span className="flex items-center gap-2 text-white text-xs font-black uppercase tracking-widest">
                                    <ImagePlus size={16} /> Change Image
                                </span>
                            </div>
                            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Name</label>
                        <input
                            required
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Fire Fighting System"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all"
                        >
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Short description shown on the product card..."
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-semibold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all placeholder:text-slate-300 resize-none text-sm"
                        />
                    </div>

                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer">
                        <span className="text-sm font-bold text-slate-700">Active</span>
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                            className="w-5 h-5 accent-primary-500"
                        />
                    </label>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <CheckCircle2 size={18} />
                            )}
                            {product ? 'Save Changes' : 'Create Product'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductFormModal;
