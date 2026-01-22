import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Wrench, RefreshCcw, Search, PlusCircle, Calendar, CheckCircle, Clock } from 'lucide-react';

const ServiceOption = ({ icon: Icon, title, desc, price, selected, onClick }) => (
    <div
        onClick={onClick}
        className={`relative p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col h-full ${selected ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg'}`}
    >
        {selected && (
            <div className="absolute top-4 right-4 text-primary-500">
                <CheckCircle size={24} className="fill-primary-500 text-white" />
            </div>
        )}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${selected ? 'bg-primary-200 text-primary-700' : 'bg-slate-100 text-slate-600'}`}>
            <Icon size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm mb-4 flex-1">{desc}</p>
        <div className="text-slate-900 font-bold text-lg">{price}</div>
    </div>
);

const Booking = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [serviceType, setServiceType] = useState('inspection');
    const [date, setDate] = useState('');
    const [notes, setNotes] = useState('');
    const [inventory, setInventory] = useState([]);
    const [selectedAssets, setSelectedAssets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingInventory, setFetchingInventory] = useState(false);

    // Fetch inventory when service type changes to Refilling
    React.useEffect(() => {
        if (serviceType === 'refilling' && user) {
            setFetchingInventory(true);
            supabase.from('extinguishers')
                .select('*')
                .eq('customer_id', user.id)
                .then(({ data, error }) => {
                    if (error) throw error;
                    setInventory(data || []);
                })
                .catch(err => console.error(err))
                .finally(() => setFetchingInventory(false));
        }
    }, [serviceType, user]);

    const toggleAsset = (id) => {
        setSelectedAssets(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase
                .from('services')
                .insert([{
                    customer_id: user.id,
                    service_type: serviceType,
                    notes,
                    scheduled_date: date,
                    status: 'Requested'
                }]);

            if (error) throw error;
            // Note: service_items handling would go here if implemented

            navigate('/customer/dashboard');
        } catch (error) {
            console.error(error);
            alert('Booking failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">Book a Service</h1>
                    <p className="text-slate-500">Select a service package to secure your premises.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* 1. Service Selection */}
                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 px-1">1. Choose Service Type</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ServiceOption
                            icon={Search}
                            title="Safety Inspection"
                            desc="Comprehensive audit of all fire safety equipment and hazards."
                            price="$50 / visit"
                            selected={serviceType === 'inspection'}
                            onClick={() => { setServiceType('inspection'); setSelectedAssets([]); }}
                        />
                        <ServiceOption
                            icon={RefreshCcw}
                            title="Refilling & Maintenance"
                            desc="On-site refilling for expired or used extinguishers."
                            price="From $20 / unit"
                            selected={serviceType === 'refilling'}
                            onClick={() => setServiceType('refilling')}
                        />
                        <ServiceOption
                            icon={PlusCircle}
                            title="New Installation"
                            desc="Professional survey and installation of new safety units."
                            price="Custom Quote"
                            selected={serviceType === 'installation'}
                            onClick={() => { setServiceType('installation'); setSelectedAssets([]); }}
                        />
                    </div>
                </div>

                {/* 1.5 Asset Selection (Conditional) */}
                {serviceType === 'refilling' && (
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-300">
                        <h3 className="text-lg font-bold text-slate-900 mb-2 px-1">Select Equipment to Refill</h3>
                        <p className="text-sm text-slate-500 mb-6">Choose the extinguishers that need servicing.</p>

                        {fetchingInventory ? (
                            <div className="text-center py-8">Loading your inventory...</div>
                        ) : inventory.length === 0 ? (
                            <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-300">
                                <p className="text-slate-500">No equipment found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-2">
                                {inventory.map(item => {
                                    const isSelected = selectedAssets.includes(item.id);
                                    const isExpired = new Date(item.expiry_date) < new Date();
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleAsset(item.id)}
                                            className={`p-4 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${isSelected ? 'border-primary-500 bg-white shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-slate-300'}`}>
                                                    {isSelected && <CheckCircle size={14} className="text-white" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm">{item.type} ({item.capacity})</p>
                                                    <p className="text-xs text-slate-500">ID: #{item.id} {isExpired && <span className="text-red-500 font-bold ml-1">• Expired</span>}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <p className="text-right text-xs text-slate-500 mt-4">{selectedAssets.length} items selected</p>
                    </div>
                )}

                {/* 2. Date & Notes */}
                <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 px-1">2. Schedule & Details</h3>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Date</label>
                            <input
                                type="date"
                                required
                                className="input-field"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                <Clock size={12} /> Agent will confirm exact time slot.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Additional Notes</label>
                            <textarea
                                className="input-field h-32 resize-none"
                                placeholder="Any specific requirements or access instructions?"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={loading} className="btn-primary w-full md:w-auto text-lg px-12 py-4">
                        {loading ? 'Confirming...' : 'Confirm Booking'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Booking;
