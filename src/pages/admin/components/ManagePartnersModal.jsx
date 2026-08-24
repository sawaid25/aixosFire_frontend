import React, { useEffect, useMemo, useState } from 'react';
import { Users, X, Search, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../context/AuthContext';

/** Assign/unassign a single product across Partners — checkbox list, diffed on Save. */
const ManagePartnersModal = ({ isOpen, onClose, product, onSaved }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [partners, setPartners] = useState([]);
    const [initiallyAssigned, setInitiallyAssigned] = useState(new Set());
    const [checked, setChecked] = useState(new Set());
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!isOpen || !product?.id) return;
        const load = async () => {
            setLoading(true);
            try {
                const [{ data: pData, error: pErr }, { data: apData, error: apErr }] = await Promise.all([
                    supabase.from('partners').select('id, business_name, owner_name, email').order('business_name'),
                    supabase.from('partner_products').select('partner_id').eq('product_id', product.id),
                ]);
                if (pErr) throw pErr;
                if (apErr) throw apErr;

                setPartners(pData || []);
                const assignedIds = new Set((apData || []).map((r) => r.partner_id));
                setInitiallyAssigned(assignedIds);
                setChecked(new Set(assignedIds));
            } catch (err) {
                console.error('[ManagePartnersModal] load failed:', err);
                toast.error('Could not load partners');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isOpen, product?.id]);

    const filteredPartners = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return partners;
        return partners.filter(
            (p) => (p.business_name || '').toLowerCase().includes(q) || (p.owner_name || '').toLowerCase().includes(q)
        );
    }, [partners, search]);

    if (!isOpen) return null;

    const toggle = (partnerId) => {
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(partnerId)) next.delete(partnerId);
            else next.add(partnerId);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const toAdd = [...checked].filter((id) => !initiallyAssigned.has(id));
            const toRemove = [...initiallyAssigned].filter((id) => !checked.has(id));

            if (toAdd.length > 0) {
                const rows = toAdd.map((partnerId) => ({
                    partner_id: partnerId,
                    product_id: product.id,
                    assigned_by: user?.id ? String(user.id) : null,
                }));
                const { error } = await supabase.from('partner_products').insert(rows);
                if (error) throw error;
            }

            if (toRemove.length > 0) {
                const { error } = await supabase
                    .from('partner_products')
                    .delete()
                    .eq('product_id', product.id)
                    .in('partner_id', toRemove);
                if (error) throw error;
            }

            // Notify only newly-added partners — re-saving with no changes to a
            // partner's assignment shouldn't spam them again.
            if (toAdd.length > 0) {
                const notifRows = toAdd.map((partnerId) => ({
                    recipient_id: partnerId,
                    recipient_role: 'partner',
                    sender_id: user?.id ? String(user.id) : null,
                    sender_role: 'admin',
                    message: `${product.name} has been assigned to your account by Admin.`,
                    inquiry_id: null,
                    notification_type: 'product_assigned',
                    type: 'product_assigned',
                    is_read: false,
                }));
                const { error: notifErr } = await supabase.from('notifications').insert(notifRows);
                if (notifErr) {
                    console.error('[ManagePartnersModal] notification insert failed:', notifErr);
                    toast.error('Assignments saved, but partner notifications failed to send.');
                }
            }

            toast.success(
                `Saved — ${toAdd.length} added, ${toRemove.length} removed.`
            );
            onSaved?.();
            onClose();
        } catch (err) {
            console.error('[ManagePartnersModal] save failed:', err);
            toast.error(err?.message || 'Could not save partner assignments');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-violet-100 text-violet-600 rounded-2xl">
                            <Users size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Manage Partners</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">{product?.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-all shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 border-b border-slate-50 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search partners..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                        </div>
                    ) : filteredPartners.length === 0 ? (
                        <p className="text-center text-sm text-slate-400 py-10">No partners found.</p>
                    ) : (
                        filteredPartners.map((p) => (
                            <label
                                key={p.id}
                                className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${checked.has(p.id) ? 'bg-primary-50 border-primary-200' : 'bg-white border-slate-100 hover:bg-slate-50'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked.has(p.id)}
                                    onChange={() => toggle(p.id)}
                                    className="w-5 h-5 accent-primary-500 shrink-0"
                                />
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 text-sm truncate">{p.business_name || `Partner #${p.id?.slice(-6)}`}</p>
                                    {p.owner_name && <p className="text-xs text-slate-400 truncate">{p.owner_name}</p>}
                                </div>
                            </label>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-slate-50 shrink-0 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-4 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <CheckCircle2 size={18} />
                        )}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManagePartnersModal;
