import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Search, Filter, Calendar, User, MapPin, Briefcase } from 'lucide-react';

const AdminServices = () => {
    const [services, setServices] = useState([]);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('All');
    const [assigningId, setAssigningId] = useState(null); // ID of service being assigned

    const fetchData = async () => {
        try {
            // Fetch services with customer and agent details
            let query = supabase
                .from('services')
                .select(`
                    *,
                    customers (business_name, address),
                    agents (name)
                `);

            if (statusFilter !== 'All') {
                query = query.eq('status', statusFilter);
            }

            const { data: servicesData, error: sError } = await query.order('scheduled_date', { ascending: false });
            if (sError) throw sError;

            // Fetch active agents for assignment
            const { data: agentsData, error: aError } = await supabase
                .from('agents')
                .select('id, name, territory')
                .eq('status', 'Active');

            if (aError) throw aError;

            // Map data to match component expectations
            const formattedServices = (servicesData || []).map(s => ({
                ...s,
                customer_name: s.customers?.business_name,
                customer_address: s.customers?.address,
                agent_name: s.agents?.name
            }));

            setServices(formattedServices);
            setAgents(agentsData || []);
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [statusFilter]);

    const handleAssign = async (serviceId, agentId) => {
        if (!agentId) return;
        try {
            const { error } = await supabase
                .from('services')
                .update({ agent_id: agentId, status: 'Scheduled' })
                .eq('id', serviceId);

            if (error) throw error;
            setAssigningId(null);
            fetchData(); // Refresh list
        } catch (err) {
            alert('Assignment failed: ' + err.message);
        }
    };

    const StatusBadge = ({ status }) => {
        const styles = {
            'Requested': 'bg-blue-100 text-blue-700',
            'Scheduled': 'bg-purple-100 text-purple-700',
            'In Progress': 'bg-orange-100 text-orange-700',
            'Completed': 'bg-green-100 text-green-700',
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">Service Queue</h1>
                    <p className="text-slate-500">Manage incoming requests and assign agents.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 pb-4">
                {['All', 'Requested', 'Scheduled', 'In Progress', 'Completed'].map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${statusFilter === status
                            ? 'bg-slate-900 text-white shadow-lg'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Service Details</th>
                            <th className="px-6 py-4">Assigned Agent</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                        ) : services.length === 0 ? (
                            <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">No services found.</td></tr>
                        ) : (
                            services.map(service => (
                                <tr key={service.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{service.customer_name}</div>
                                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                            <MapPin size={10} /> {service.customer_address || 'No Address'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-700 capitalize">{service.service_type}</div>
                                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                            <Calendar size={10} /> {new Date(service.scheduled_date || service.request_date).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {assigningId === service.id ? (
                                            <select
                                                className="input-field text-sm py-1 px-2"
                                                onChange={(e) => handleAssign(service.id, e.target.value)}
                                                defaultValue=""
                                                autoFocus
                                                onBlur={() => setAssigningId(null)}
                                            >
                                                <option value="" disabled>Select Agent</option>
                                                {agents.map(a => (
                                                    <option key={a.id} value={a.id}>{a.name} ({a.territory})</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div
                                                className={`flex items-center gap-2 ${!service.agent_name ? 'text-orange-500 cursor-pointer hover:underline' : 'text-slate-700'}`}
                                                onClick={() => !service.agent_name && setAssigningId(service.id)}
                                            >
                                                <Briefcase size={14} />
                                                <span className="text-sm font-medium">{service.agent_name || 'Unassigned'}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={service.status} />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {service.status === 'Requested' && !assigningId && (
                                            <button
                                                onClick={() => setAssigningId(service.id)}
                                                className="text-xs font-bold text-white bg-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-800"
                                            >
                                                Assign
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminServices;
