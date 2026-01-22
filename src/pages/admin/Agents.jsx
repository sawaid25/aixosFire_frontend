import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Check, X, User, Phone, MapPin, FileText, Shield } from 'lucide-react';

const AgentManagement = () => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Pending');

    const fetchAgents = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('agents')
                .select('*')
                .eq('status', activeTab)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAgents(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, [activeTab]);

    const handleAction = async (id, action) => {
        const newStatus = action === 'approve' ? 'Active' : 'Suspended';
        if (!window.confirm(`Are you sure you want to ${action} this agent?`)) return;
        try {
            const { error } = await supabase
                .from('agents')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            fetchAgents(); // Refresh list
        } catch (err) {
            alert(`Failed to ${action} agent: ` + err.message);
        }
    };

    const getImageUrl = (filename) => {
        // Since backend is gone, local uploads won't work.
        // In a real app, you'd use Supabase Storage.
        // This is a placeholder for the user to migrate their files to Supabase Storage.
        return filename;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">Agent Management</h1>
                    <p className="text-slate-500">Approve new applications and manage existing agents.</p>
                </div>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {['Pending', 'Active', 'Suspended'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500">Loading agents...</p>
                </div>
            ) : agents.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
                    <Shield size={48} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-xl font-bold text-slate-900">No {activeTab} Agents</h3>
                    <p className="text-slate-500">There are currently no agents in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {agents.map(agent => (
                        <div key={agent.id} className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 flex flex-col md:flex-row gap-6 items-start animate-fade-in group hover:shadow-lg transition-all">
                            {/* Profile Photo */}
                            <div className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                                {agent.profile_photo ? (
                                    <img src={getImageUrl(agent.profile_photo)} alt={agent.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                        <User size={32} />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">{agent.name}</h3>
                                        <p className="text-sm text-slate-500">{agent.email}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${agent.status === 'Active' ? 'bg-green-100 text-green-700' :
                                        agent.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {agent.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <Phone size={16} className="text-slate-400" />
                                        {agent.phone || 'N/A'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin size={16} className="text-slate-400" />
                                        {agent.territory || 'Unassigned'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-slate-400" />
                                        CNIC: {agent.cnic || 'N/A'}
                                    </div>
                                </div>

                                {/* Documents Preview Link */}
                                {agent.cnic_document && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <a
                                            href={getImageUrl(agent.cnic_document)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <FileText size={14} /> View CNIC Document
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            {activeTab === 'Pending' && (
                                <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto mt-4 md:mt-0">
                                    <button
                                        onClick={() => handleAction(agent.id, 'approve')}
                                        className="btn-primary py-2 px-4 shadow-none bg-green-500 hover:bg-green-600 text-sm flex items-center justify-center gap-2"
                                    >
                                        <Check size={16} /> Approve
                                    </button>
                                    <button
                                        onClick={() => handleAction(agent.id, 'reject')}
                                        className="py-2 px-4 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-xl text-slate-600 font-medium text-sm flex items-center justify-center gap-2 transition-all"
                                    >
                                        <X size={16} /> Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AgentManagement;
