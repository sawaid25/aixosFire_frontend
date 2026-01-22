import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Search, MapPin, Phone, Calendar, ArrowRight, User, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const Customers = () => {
    const { user } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                // Fetch visits for this agent, including customer details
                const { data, error } = await supabase
                    .from('visits')
                    .select(`
                        customer_id,
                        visit_date,
                        customers (*)
                    `)
                    .eq('agent_id', user.id)
                    .order('visit_date', { ascending: false });

                if (error) throw error;

                // Deduplicate by customer_id to only show unique customers with their latest visit
                const uniqueCustomers = [];
                const seen = new Set();

                data.forEach(v => {
                    if (v.customers && !seen.has(v.customer_id)) {
                        seen.add(v.customer_id);
                        uniqueCustomers.push({
                            ...v.customers,
                            last_visit: v.visit_date
                        });
                    }
                });

                setCustomers(uniqueCustomers);
            } catch (err) {
                console.error("Failed to fetch customers", err);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchCustomers();
    }, [user]);

    const filteredCustomers = customers.filter(c =>
        c.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">My Customers</h1>
                    <p className="text-slate-500">Manage your relationships and follow-ups.</p>
                </div>
                <div className="flex w-full md:w-auto gap-2">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search business..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading Customers...</div>
            ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <User size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No Customers Found</h3>
                    <p className="text-slate-500 mb-6">You haven't logged any visits yet.</p>
                    <Link to="/agent/visit" className="btn-primary inline-flex items-center gap-2">
                        <Plus size={20} /> Log First Visit
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                                    <th className="px-6 py-4">Business</th>
                                    <th className="px-6 py-4">Location</th>
                                    <th className="px-6 py-4">Last Visit</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{customer.business_name}</div>
                                            <div className="text-xs text-slate-400 flex items-center gap-1">
                                                <Phone size={12} /> {customer.phone}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600 flex items-center gap-1">
                                                <MapPin size={14} className="text-slate-400" />
                                                {customer.address || "N/A"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${customer.status === 'Active' ? 'bg-green-100 text-green-700' :
                                                customer.status === 'Lead' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                {customer.status || 'Lead'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                to={`/agent/visit?customerId=${customer.id}`}
                                                className="inline-flex items-center justify-center p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                title="Log New Visit"
                                            >
                                                <ArrowRight size={20} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;
