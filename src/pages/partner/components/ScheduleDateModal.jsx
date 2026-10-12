import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { ksaInputToIso, KSA_TIME_LABEL } from '../../../utils/dateTime';

const ScheduleDateModal = ({ isOpen, onClose, onSchedule }) => {
    const [date, setDate] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const isoDate = ksaInputToIso(date); // the field is Saudi time (AST)
            await onSchedule(isoDate);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                    <h2 className="text-xl font-display font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Calendar size={22} className="text-primary-500" />
                        Schedule Visit
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 bg-white hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 border border-slate-200 transition-colors"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
                    <div className="mb-6">
                        <label htmlFor="scheduled_date" className="block text-sm font-bold text-slate-700 mb-2">
                            Select Date & Time ({KSA_TIME_LABEL}) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="datetime-local"
                            id="scheduled_date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium"
                        />
                    </div>
                    
                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 bg-white hover:bg-slate-50 text-slate-600 font-bold py-3 rounded-xl border border-slate-200 transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !date}
                            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-black py-3 rounded-xl shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    Scheduling...
                                </>
                            ) : (
                                'Schedule'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ScheduleDateModal;
