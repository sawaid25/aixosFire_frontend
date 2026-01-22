import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Calendar, CheckCircle, Clock, FileText, AlertCircle, Wrench } from 'lucide-react';

const ServiceTimeline = ({ status }) => {
    const steps = ['Requested', 'Scheduled', 'In Progress', 'Completed'];
    const currentStepIndex = steps.indexOf(status) === -1 ? 0 : steps.indexOf(status);

    return (
        <div className="flex items-center justify-between w-full mt-4 mb-8 px-2 relative">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 -translate-y-1/2 rounded-full"></div>
            <div
                className="absolute top-1/2 left-0 h-0.5 bg-green-500 -z-10 -translate-y-1/2 transition-all duration-500"
                style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
            ></div>

            {steps.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                    <div key={step} className="flex flex-col items-center gap-2 bg-white px-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'bg-white border-slate-200 text-slate-300'
                            }`}>
                            {isCompleted ? <CheckCircle size={14} /> : <div className="w-2 h-2 rounded-full bg-slate-200" />}
                        </div>
                        <span className={`text-xs font-semibold ${isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>
                            {step}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const History = () => {
    const { user } = useAuth();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('active'); // 'active' or 'past'

    useEffect(() => {
        const fetchHistory = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('services')
                    .select('*')
                    .eq('customer_id', user.id)
                    .order('scheduled_date', { ascending: false });

                if (error) throw error;
                setServices(data || []);
            } catch (err) {
                console.error("Failed to fetch history", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [user]);

    const activeServices = services.filter(s => ['Requested', 'Scheduled', 'In Progress'].includes(s.status));
    const pastServices = services.filter(s => ['Completed', 'Cancelled'].includes(s.status));
    const displayedServices = activeTab === 'active' ? activeServices : pastServices;

    const StatusBadge = ({ status }) => {
        const styles = {
            'Requested': 'bg-blue-50 text-blue-600 border-blue-200',
            'Scheduled': 'bg-purple-50 text-purple-600 border-purple-200',
            'In Progress': 'bg-orange-50 text-orange-600 border-orange-200',
            'Completed': 'bg-green-50 text-green-600 border-green-200',
            'Cancelled': 'bg-red-50 text-red-600 border-red-200',
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status] || styles['Requested']}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Service History</h1>
                <p className="text-slate-500">Track current requests and view past reports.</p>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Active Tracking ({activeServices.length})
                </button>
                <button
                    onClick={() => setActiveTab('past')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'past' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Past History
                </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading records...</div>
                ) : displayedServices.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <FileText size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No {activeTab} services found</h3>
                        <p className="text-slate-500">Book a new service to get started.</p>
                    </div>
                ) : (
                    displayedServices.map(service => (
                        <div key={service.id} className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 transition-all hover:shadow-lg">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Wrench size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 capitalize">{service.service_type} Service</h3>
                                        <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                                            <Calendar size={14} />
                                            Booked for {new Date(service.scheduled_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <StatusBadge status={service.status} />
                            </div>

                            {activeTab === 'active' && <ServiceTimeline status={service.status} />}

                            <div className="flex gap-8 pt-4 border-t border-slate-50">
                                <div>
                                    <span className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">NOTES</span>
                                    <p className="text-sm text-slate-600">{service.notes || 'No additional notes provided.'}</p>
                                </div>
                                {service.amount > 0 && (
                                    <div className="ml-auto text-right">
                                        <span className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">TOTAL</span>
                                        <p className="text-lg font-bold text-slate-900">${service.amount}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default History;
