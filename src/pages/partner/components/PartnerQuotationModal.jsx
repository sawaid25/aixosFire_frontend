import React, { useState } from 'react';
import { X, FileText, DollarSign, Upload, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { createQuotation } from '../../../api/maintenanceApi';
import { toast } from 'react-hot-toast';

const PartnerQuotationModal = ({ isOpen, onClose, inquiryId, customerId, partnerId, onSuccess }) => {
    const [estimatedCost, setEstimatedCost] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            toast.error('Please upload a PDF quotation');
            return;
        }
        if (!estimatedCost) {
            toast.error('Please enter an estimated cost');
            return;
        }

        setLoading(true);
        try {
            await createQuotation({
                inquiryId,
                partnerId,
                customerId,
                estimatedCost,
                file
            });

            await supabase.from('notifications').insert([{
                sender_id: partnerId,
                sender_role: 'Partner',
                recipient_id: customerId,
                recipient_role: 'Customer',
                message: 'New maintenance quotation received',
                inquiry_id: inquiryId
            }]);

            toast.success('Quotation submitted successfully');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Quotation submit error:', error);
            // Surface the server's actual message (e.g. the 409 "Renewal must be
            // accepted before a quotation can be created.") — axios's error.message
            // is just "Request failed with status code 409".
            const serverMsg = error.response?.data?.error || error.response?.data?.message;
            toast.error(serverMsg || error.message || 'Failed to submit quotation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 pb-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary-100 text-primary-600 rounded-2xl">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-display font-black text-slate-900 tracking-tight">Submit Quotation</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Final Professional Estimate</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Quotation Cost (SAR)
                        </label>

                        <input
                            type="text"
                            placeholder="e.g. 150.00"
                            value={estimatedCost}
                            onChange={(e) => setEstimatedCost(e.target.value)}
                            className="w-full pl-6 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Quotation PDF
                        </label>
                        <div className={`relative group border-2 border-dashed rounded-3xl p-8 transition-all flex flex-col items-center justify-center text-center gap-4 ${file ? 'border-primary-500 bg-primary-50/30' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setFile(e.target.files[0])}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {file ? (
                                <>
                                    <div className="w-14 h-14 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center">
                                        <CheckCircle size={28} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{file.name}</p>
                                        <p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · Click to change</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-14 h-14 bg-slate-200/50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Upload size={28} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-600">Drop your quotation here</p>
                                        <p className="text-xs text-slate-400 mt-1">PDF file is required · Max 10MB</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-3xl shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group uppercase tracking-widest text-xs"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                <CheckCircle size={20} className="group-hover:rotate-12 transition-transform" />
                                Confirm & Submit Quotation
                            </>
                        )}
                    </button>

                    <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Customer will be notified immediately
                    </p>
                </form>
            </div>
        </div>
    );
};

export default PartnerQuotationModal;
