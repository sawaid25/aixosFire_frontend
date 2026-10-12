import React, { useState } from 'react';
import { Calendar, Clock, X, CheckCircle2, Truck } from 'lucide-react';
import { ksaInputToIso, KSA_TIME_LABEL } from '../../../utils/dateTime';

const DeliveryScheduleModal = ({ isOpen, onClose, onSchedule, loading }) => {
    const [pickupDate, setPickupDate] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // The fields are Saudi time (AST) — convert to a UTC ISO string
        const toUTC = (localStr) => ksaInputToIso(localStr);

        onSchedule({ 
            pickup_date: toUTC(pickupDate), 
            delivery_date: toUTC(deliveryDate) 
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary-100 text-primary-600 rounded-2xl">
                            <Truck size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Propose Delivery Schedule</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Partner Logistics</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-all shadow-sm"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Clock size={12} className="text-primary-500" />
                                Proposed Pickup Date ({KSA_TIME_LABEL})
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={pickupDate}
                                onChange={(e) => setPickupDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all placeholder:text-slate-300"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Calendar size={12} className="text-primary-500" />
                                Expected Delivery Date ({KSA_TIME_LABEL})
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                        <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                            Note: The agent must confirm these dates. Delivery pricing will be based on your established service rates.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <CheckCircle2 size={18} />
                            )}
                            Propose Schedule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeliveryScheduleModal;
