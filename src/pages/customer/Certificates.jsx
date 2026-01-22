import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Download, FileText, CheckCircle, Printer } from 'lucide-react';

const CertificateCard = ({ item }) => {
    return (
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 items-start flex flex-col h-full relative overflow-hidden group hover:shadow-lg transition-all">
            {/* Watermark/Background Decoration */}
            <div className="absolute -right-8 -bottom-8 opacity-5 transform rotate-[-15deg] pointer-events-none">
                <ShieldCheck size={180} />
            </div>

            <div className="flex justify-between w-full items-start mb-6 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center border border-green-100">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 leading-tight">Safety Compliance</h3>
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">CERTIFIED</p>
                    </div>
                </div>
                <div className="bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase">
                    VALID
                </div>
            </div>

            <div className="space-y-4 w-full z-10 flex-1">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="grid grid-cols-2 gap-y-4 text-sm">
                        <div>
                            <span className="block text-xs text-slate-400 font-semibold uppercase">Asset ID</span>
                            <span className="font-mono font-bold text-slate-700">#{item.id}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-slate-400 font-semibold uppercase">Type</span>
                            <span className="font-bold text-slate-700">{item.type}</span>
                        </div>
                        <div className="col-span-2">
                            <span className="block text-xs text-slate-400 font-semibold uppercase">Inspection Date</span>
                            <span className="font-bold text-slate-700">{new Date(item.install_date).toLocaleDateString()}</span>
                        </div>
                        <div className="col-span-2">
                            <span className="block text-xs text-slate-400 font-semibold uppercase">Valid Until</span>
                            <span className="font-bold text-green-600">{new Date(item.expiry_date).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full mt-6 pt-6 border-t border-slate-100 z-10 flex gap-2">
                <button
                    onClick={() => alert(`Downloading Certificate #${item.id}...`)}
                    className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                >
                    <Download size={16} /> PDF
                </button>
                <button className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all">
                    <Printer size={18} />
                </button>
            </div>
        </div>
    );
};

const Certificates = () => {
    const { user } = useAuth();
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const { data, error } = await supabase
                    .from('extinguishers')
                    .select('*')
                    .eq('customer_id', user.id);

                if (error) throw error;
                // Only showing Valid items
                const validItems = (data || []).filter(item => new Date(item.expiry_date) > new Date());
                setInventory(validItems);
            } catch (err) {
                console.error("Failed to fetch Inventory", err);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchInventory();
    }, [user]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">Digital Certificates</h1>
                    <p className="text-slate-500">Official compliance documents for your valid equipment.</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400">Loading certificates...</div>
            ) : inventory.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <FileText size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No Valid Certificates Found</h3>
                    <p className="text-slate-500 max-w-md mx-auto mt-2">
                        Certificates are only generated for equipment with a valid unexpired status.
                        Please book an inspection if your equipment is expired.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {inventory.map((item) => (
                        <CertificateCard key={item.id} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Certificates;
