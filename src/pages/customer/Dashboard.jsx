import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { FireExtinguisher, AlertTriangle, CheckCircle, Plus, Calendar, Clock, ArrowRight } from 'lucide-react';

const InventoryCard = ({ item }) => {
    const isExpired = new Date(item.expiry_date) < new Date();
    const isNearExpiry = new Date(item.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    let statusColor = 'bg-green-100 text-green-700 border-green-200';
    let icon = <CheckCircle size={20} />;
    let statusText = 'Valid';

    if (isExpired) {
        statusColor = 'bg-red-100 text-red-700 border-red-200';
        icon = <AlertTriangle size={20} />;
        statusText = 'Expired';
    } else if (isNearExpiry) {
        statusColor = 'bg-yellow-100 text-yellow-700 border-yellow-200';
        icon = <Clock size={20} />;
        statusText = 'Expiring Soon';
    }

    return (
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 hover:shadow-lg transition-all duration-300 group flex flex-col justify-between h-full">
            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-slate-100 transition-colors">
                        <FireExtinguisher size={24} className="text-slate-600" />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusColor}`}>
                        {icon} {statusText}
                    </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1">{item.type}</h3>
                <p className="text-slate-500 text-sm mb-4">{item.capacity} Unit • ID: #{item.id}</p>

                <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Installed</span>
                        <span className="font-medium text-slate-600">{new Date(item.install_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Expires</span>
                        <span className={`font-medium ${isExpired ? 'text-red-500 font-bold' : 'text-slate-600'}`}>
                            {new Date(item.expiry_date).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            <button className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:border-primary-500 hover:text-primary-600 transition-colors">
                View Certificate
            </button>
        </div>
    );
};

const CustomerDashboard = () => {
    const { user } = useAuth();
    const [inventory, setInventory] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch inventory directly from Supabase
                const { data: invData, error: invError } = await supabase
                    .from('extinguishers')
                    .select('*')
                    .eq('customer_id', user.id);

                if (invError) throw invError;

                // Fetch history directly from Supabase
                const { data: histData, error: histError } = await supabase
                    .from('services')
                    .select('*')
                    .eq('customer_id', user.id)
                    .order('scheduled_date', { ascending: false });

                if (histError) throw histError;

                setInventory(invData || []);
                setHistory(histData || []);
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchData();
    }, [user]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
                        Safety Overview
                    </h1>
                    <p className="text-slate-500">Manage your extinguishers and compliance status.</p>
                </div>
                <Link to="/customer/booking" className="btn-primary flex items-center gap-2 group">
                    <Plus size={20} />
                    <span>Book Service</span>
                </Link>
            </div>

            {/* Inventory Grid */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <FireExtinguisher size={22} className="text-primary-500" /> Equipment Status
                    </h2>
                    <div className="flex items-center gap-4">
                        <span className="text-slate-500 text-sm font-medium">{inventory.length} Units Total</span>
                        <Link to="/customer/inventory" className="text-sm text-primary-600 font-semibold hover:underline">View List</Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {inventory.length > 0 ? (
                        inventory.map((item) => (
                            <InventoryCard key={item.id} item={item} />
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <FireExtinguisher size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500">No equipment registered yet.</p>
                        </div>
                    )}

                    {/* Add New Placeholder/Promo */}
                    <Link to="/customer/booking" className="rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-slate-400 hover:text-primary-500 hover:border-primary-300 hover:bg-primary-50/50 transition-all cursor-pointer group h-full min-h-[300px]">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform group-hover:bg-white text-slate-300 group-hover:text-primary-500">
                            <Plus size={32} />
                        </div>
                        <span className="font-bold">Request New Equipment</span>
                    </Link>
                </div>
            </div>

            {/* Quick Actions / Recent Activity */}
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white rounded-3xl p-8 shadow-soft border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Calendar size={20} className="text-blue-500" /> Recent Bookings
                        </h3>
                        <Link to="/customer/history" className="text-sm text-primary-600 font-semibold hover:underline">View All</Link>
                    </div>

                    <div className="space-y-4">
                        {history.length > 0 ? (
                            history.slice(0, 3).map((service) => (
                                <div key={service.id} className="flex items-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-blue-500 border border-slate-100 shadow-sm font-bold">
                                        {service.scheduled_date ? new Date(service.scheduled_date).getDate() : '?'}
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <h4 className="font-bold text-slate-900 capitalize">{service.service_type}</h4>
                                        <p className="text-xs text-slate-500">{service.scheduled_date ? new Date(service.scheduled_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Pending'}</p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-lg font-bold ${service.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {service.status || 'Pending'}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-400 mx-auto mb-4">
                                    <CheckCircle size={32} />
                                </div>
                                <p className="text-slate-900 font-bold">All caught up!</p>
                                <p className="text-slate-500 text-sm">No scheduled maintenance found.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <h3 className="text-lg font-bold mb-4 relative z-10">Need Help?</h3>
                    <p className="text-slate-300 mb-8 relative z-10 leading-relaxed">
                        Our support team is available 24/7 for emergency fire safety consultations.
                    </p>
                    <button className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-100 transition-colors relative z-10">
                        Contact Support <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomerDashboard;
