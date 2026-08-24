import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Link } from 'react-router-dom';
import PageLoader from '../../components/PageLoader';
import {
    Search, Handshake, ArrowRight, Tag, Activity,
    CheckCircle, XCircle, Clock, TrendingUp, ChevronRight
} from 'lucide-react';
import PerformanceBadge from '../../components/admin/PerformanceBadge';

const getBadgeClass = (s) => {
    const v = (s||'').toLowerCase();
    if (['active','accepted'].includes(v)) return 'bg-green-100 text-green-700';
    if (['inactive','suspended','rejected'].includes(v)) return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-600';
};

const Partners = () => {
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState([]);
    const [inquiries, setInquiries] = useState([]);
    const [stickerData, setStickerData] = useState([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [
                    { data: pData, error: pErr },
                    { data: iData },
                    { data: sData },
                ] = await Promise.all([
                    supabase.from('partners').select('*').order('business_name'),
                    supabase.from('inquiries').select('id,status,type,partner_id,created_at'),
                    supabase.from('sticker_usage_history').select('id,partner_id,quantity,used_for,created_at'),
                ]);
                if (pErr) console.error('Failed to load partners:', pErr);
                setPartners(pData || []);
                setInquiries(iData || []);
                setStickerData(sData || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const enriched = useMemo(() => {
        return partners.map(p => {
            const pInq = inquiries.filter(i => i.partner_id === p.id);
            const total = pInq.length;
            const accepted = pInq.filter(i => ['completed','accepted','closed'].includes((i.status||'').toLowerCase())).length;
            const rejected = pInq.filter(i => ['rejected','cancelled'].includes((i.status||'').toLowerCase())).length;
            const pending = total - accepted - rejected;
            const score = total ? Math.round((accepted / total) * 100) : 0;
            const stickersUsed = stickerData.filter(s => s.partner_id === p.id).reduce((sum, s) => sum + (s.quantity||0), 0);
            return { ...p, total, accepted, rejected, pending, score, stickersUsed };
        });
    }, [partners, inquiries, stickerData]);

    const filtered = useMemo(() => {
        return enriched.filter(p => {
            const matchesSearch = (p.business_name||'').toLowerCase().includes(search.toLowerCase()) ||
                                  (p.owner_name||'').toLowerCase().includes(search.toLowerCase()) ||
                                  (p.email||'').toLowerCase().includes(search.toLowerCase());
            if (filter === 'All') return matchesSearch;
            if (filter === 'Active') return matchesSearch && ['active','accepted'].includes((p.status||'').toLowerCase());
            if (filter === 'Inactive') return matchesSearch && !['active','accepted'].includes((p.status||'').toLowerCase());
            if (filter === 'Top') return matchesSearch && p.score >= 70;
            return matchesSearch;
        });
    }, [enriched, search, filter]);

    const totalInquiries = inquiries.length;
    const activeCount = enriched.filter(p => ['active','accepted'].includes((p.status||'').toLowerCase())).length;
    const totalStickers = stickerData.reduce((s, r) => s + (r.quantity||0), 0);

    if (loading) return <PageLoader message="Loading partners..." />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin · Management</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Partner Management</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Track partner performance, sticker usage & delivery analytics.</p>
                </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: Handshake,    label: 'Total Partners', value: partners.length,  color: 'bg-orange-50 text-orange-600' },
                    { icon: CheckCircle,  label: 'Active',         value: activeCount,       color: 'bg-green-50 text-green-600' },
                    { icon: Activity,     label: 'Total Inquiries',value: totalInquiries,    color: 'bg-blue-50 text-blue-600' },
                    { icon: Tag,          label: 'Stickers Used',  value: totalStickers,     color: 'bg-violet-50 text-violet-600' },
                ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5 flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${color.split(' ')[0]}`}>
                            <Icon size={20} className={color.split(' ')[1]}/>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-semibold">{label}</p>
                            <p className="text-xl font-bold text-slate-900">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search partner name or email..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-primary-400 transition-colors"
                    />
                </div>
                <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm">
                    {['All','Active','Inactive','Top'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === f ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Partners Grid */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
                    <Handshake size={48} className="mx-auto text-slate-200 mb-4"/>
                    <h3 className="text-lg font-bold text-slate-900">No Partners Found</h3>
                    <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filtered.map(partner => (
                        <Link
                            key={partner.id}
                            to={`/admin/partners/${partner.id}`}
                            className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                        >
                            <div className="flex flex-col sm:flex-row gap-5 items-start">
                                {/* Avatar */}
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                                    <Handshake size={24} className="text-orange-500"/>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                        <div>
                                            <p className="font-bold text-slate-900">{partner.business_name || `Partner #${partner.id?.toString().slice(-6)}`}</p>
                                            {partner.owner_name && <p className="text-xs text-slate-500 mt-0.5">{partner.owner_name}</p>}
                                            {partner.email && <p className="text-xs text-slate-400 mt-0.5">{partner.email}</p>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getBadgeClass(partner.status)}`}>{partner.status || 'Unknown'}</span>
                                            <PerformanceBadge score={partner.score}/>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                                        {[
                                            { label: 'Total', value: partner.total, color: 'text-slate-900' },
                                            { label: 'Accepted', value: partner.accepted, color: 'text-emerald-600' },
                                            { label: 'Rejected', value: partner.rejected, color: 'text-red-600' },
                                            { label: 'Pending', value: partner.pending, color: 'text-amber-600' },
                                            { label: 'Stickers Used', value: partner.stickersUsed, color: 'text-violet-600' },
                                        ].map(({ label, value, color }) => (
                                            <div key={label} className="bg-slate-50 rounded-xl p-2.5">
                                                <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                                                <p className={`text-base font-bold ${color}`}>{value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mt-3 flex items-center gap-3">
                                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${partner.score}%` }}/>
                                        </div>
                                        <span className="text-xs font-bold text-slate-600">{partner.score}% acceptance</span>
                                    </div>
                                </div>

                                <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-600 transition-colors flex-shrink-0 hidden sm:block mt-1"/>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Partners;
