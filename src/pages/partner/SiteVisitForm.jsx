import React, { useState } from 'react';
import { X, ClipboardCheck, Upload, CheckCircle, AlertCircle, Trash2, FileText } from 'lucide-react';

const SiteVisitForm = ({ isOpen, onClose, inquiry, onSubmit }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        compliance: 'yes',
        environment: 'industrial',
        notes: '',
        file: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFormData({ ...formData, file: e.target.files[0] });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // In a real app, use FormData for file upload
            await onSubmit({ ...formData, inquiryId: inquiry.id });
            setStep(3); // Success step
        } catch (err) {
            console.error('Failed to submit site visit form:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 pb-4 flex justify-between items-center border-b border-slate-50">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Site Visit <span className="text-primary-500">Survey.</span></h3>
                        <p className="text-slate-500 text-sm font-medium mt-1">{inquiry?.client}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-2xl transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8">
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">1</div>
                                <div className="h-0.5 flex-1 bg-slate-100"></div>
                                <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center font-bold">2</div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-bold text-slate-700 block text-center mb-6">Initial Assessment</label>

                                <div className="space-y-3">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Safety Compliance Observed?</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['yes', 'no'].map((opt) => (
                                            <button
                                                key={opt}
                                                onClick={() => setFormData({ ...formData, compliance: opt })}
                                                className={`py-3 rounded-2xl border-2 font-bold capitalize transition-all ${formData.compliance === opt ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-slate-50 text-slate-400 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Environment Type</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['industrial', 'commercial', 'residential', 'other'].map((opt) => (
                                            <button
                                                key={opt}
                                                onClick={() => setFormData({ ...formData, environment: opt })}
                                                className={`py-3 rounded-2xl border-2 font-bold capitalize transition-all text-xs ${formData.environment === opt ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-slate-50 text-slate-400 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl transition-all mt-8 active:scale-95"
                            >
                                Continue to Upload
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold text-sm"><CheckCircle size={20} /></div>
                                <div className="h-0.5 flex-1 bg-emerald-100"></div>
                                <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">2</div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-bold text-slate-700 block text-center mb-6">Upload Survey Document</label>

                                {formData.file ? (
                                    <div className="p-6 border-2 border-emerald-100 bg-emerald-50/30 rounded-3xl flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-2xl text-emerald-600 shadow-sm">
                                            <FileText size={24} />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-sm font-bold text-slate-900 truncate">{formData.file.name}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">{(formData.file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                        <button
                                            onClick={() => setFormData({ ...formData, file: null })}
                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative group">
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            accept=".pdf,.doc,.docx,image/*"
                                        />
                                        <div className="p-12 border-2 border-dashed border-slate-200 group-hover:border-primary-300 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all bg-slate-50 group-hover:bg-primary-50/20">
                                            <div className="p-4 bg-white rounded-2xl text-slate-300 group-hover:text-primary-500 shadow-sm transition-colors">
                                                <Upload size={32} />
                                            </div>
                                            <p className="text-sm font-bold text-slate-500 group-hover:text-primary-600 transition-colors">Drag & drop or Click to upload</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Maximum file size: 10MB</p>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4">
                                    <textarea
                                        rows="3"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary-500 outline-none transition-all text-xs text-slate-600 font-medium resize-none"
                                        placeholder="Additional surveyor notes..."
                                    ></textarea>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !formData.file}
                                    className="flex-[2] bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Uploading...' : 'Submit Survey'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="py-12 text-center animate-in zoom-in-95 duration-500">
                            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <CheckCircle size={48} />
                            </div>
                            <h4 className="text-2xl font-black text-slate-900 tracking-tight">Survey Submitted!</h4>
                            <p className="text-slate-500 font-medium max-w-xs mx-auto mt-4">
                                The site visit record and files have been successfully uploaded and linked to the inquiry.
                            </p>
                            <button
                                onClick={onClose}
                                className="mt-12 bg-slate-900 hover:bg-slate-800 text-white font-black px-12 py-4 rounded-2xl shadow-xl transition-all active:scale-95"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SiteVisitForm;
