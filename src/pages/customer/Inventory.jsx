import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Search, Filter, QrCode, AlertTriangle, CheckCircle, FireExtinguisher, Calendar, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Inventory = () => {
    const { user } = useAuth();
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const { data, error } = await supabase
                    .from('extinguishers')
                    .select('*')
                    .eq('customer_id', user.id);

                if (error) throw error;
                setInventory(data || []);
            } catch (err) {
                console.error("Failed to fetch inventory", err);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchInventory();
    }, [user]);

    const filteredInventory = inventory.filter(item => {
        const matchesSearch = item.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.id?.toString().includes(searchTerm);

        if (filterStatus === 'all') return matchesSearch;

        const isExpired = new Date(item.expiry_date) < new Date();
        if (filterStatus === 'expired') return matchesSearch && isExpired;
        if (filterStatus === 'valid') return matchesSearch && !isExpired;

        return matchesSearch;
    });

    const getStatusBadge = (expiryDate) => {
        const isExpired = new Date(expiryDate) < new Date();
        const isNear = new Date(expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        if (isExpired) return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><AlertTriangle size={12} /> Expired</span>;
        if (isNear) return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"><Calendar size={12} /> Renew Soon</span>;
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><CheckCircle size={12} /> Valid</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">Asset Inventory</h1>
                    <p className="text-slate-500">Track and manage your fire safety equipment.</p>
                </div>
                <div className="flex w-full md:w-auto gap-3">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by ID or Type..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none bg-white border border-slate-200 text-slate-700 py-3 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="valid">Valid Only</option>
                            <option value="expired">Expired Only</option>
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500">Loading assets...</div>
                ) : filteredInventory.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <FireExtinguisher size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No Assets Found</h3>
                        <p className="text-slate-500">Try adjusting your search filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                                    <th className="px-6 py-4">Asset ID</th>
                                    <th className="px-6 py-4">Type / Capacity</th>
                                    <th className="px-6 py-4">Installed</th>
                                    <th className="px-6 py-4">Expiry Date</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredInventory.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-sm text-slate-600">#{item.id}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                                                    <FireExtinguisher size={16} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{item.type}</div>
                                                    <div className="text-xs text-slate-500">{item.capacity}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {new Date(item.install_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            {new Date(item.expiry_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(item.expiry_date)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-slate-400 hover:text-slate-900 p-2 transition-colors" title="View QR Code">
                                                <QrCode size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inventory;
