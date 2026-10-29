import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ClipboardCheck, Upload, CalendarClock, Clock, XCircle, FileText } from 'lucide-react';
import { formatKsaDateTime } from '../../../utils/dateTime';

/**
 * Shown after a maintenance inquiry is accepted — matches “Inquiry accepted” next-step UI.
 */
const PartnerPostAcceptCard = ({ inquiryId, itemId, onUploadReport, onScheduleDate, onSubmitQuotation, approvalStatus, scheduledDate }) => {
    const navigate = useNavigate();

    const isApproved = approvalStatus === 'approved';
    const isPending = approvalStatus === 'pending' && scheduledDate;
    const isRejected = approvalStatus === 'rejected';

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-soft-xl p-8 w-full shrink-0">
            <div className="text-center space-y-2 mb-8">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-200">
                    <CheckCircle size={32} strokeWidth={2.5} />
                </div>
                <h4 className="text-xl font-black text-slate-900 tracking-tight font-display">Inquiry accepted</h4>

                {!scheduledDate && (
                    <p className="text-sm text-slate-500 leading-relaxed px-1 mt-2">
                        Please schedule a site visit to proceed.
                    </p>
                )}
                {isPending && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 text-left">
                        <Clock className="text-amber-700 shrink-0 mt-0.5" size={16} />
                        <div>
                            <p className="text-xs font-bold text-amber-800">Visit Pending Approval</p>
                            <p className="text-[11px] text-amber-700 mt-1">Scheduled for: {formatKsaDateTime(scheduledDate)}</p>
                        </div>
                    </div>
                )}
                {isRejected && (
                    <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-200 flex items-start gap-2 text-left">
                        <XCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                        <div>
                            <p className="text-xs font-bold text-red-800">Visit Rejected</p>
                            <p className="text-[11px] text-red-700 mt-1">Customer rejected the time. Please propose a new date.</p>
                        </div>
                    </div>
                )}
                {isApproved && (
                    <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-2 text-left">
                        <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                        <div>
                            <p className="text-xs font-bold text-emerald-800">Visit Approved</p>
                            <p className="text-[11px] text-emerald-700 mt-1">Scheduled for: {formatKsaDateTime(scheduledDate)}</p>
                        </div>
                    </div>
                )}
            </div>

            {(!isApproved || isRejected) && (
                <button
                    type="button"
                    onClick={onScheduleDate}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest mb-6"
                >
                    <CalendarClock size={22} className="shrink-0" />
                    {scheduledDate && !isRejected ? 'Reschedule Visit' : 'Schedule Date'}
                </button>
            )}

            <button
                type="button"
                onClick={() => navigate(`/partner/inquiry/${inquiryId}/item/${itemId}/site-assessment`)}
                disabled={!isApproved}
                className="w-full bg-white hover:bg-emerald-50/30 border-2 border-emerald-500 text-emerald-600 font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest mb-4 disabled:opacity-50 disabled:border-slate-300 disabled:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
                title={!isApproved ? 'Awaiting customer approval of schedule' : ''}
            >
                <ClipboardCheck size={22} className="shrink-0" />
                Start site assessment
            </button>

            <button
                type="button"
                onClick={onUploadReport}
                disabled={!isApproved}
                className="w-full bg-white hover:bg-blue-50/30 border-2 border-blue-500 text-blue-600 font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest mb-4 disabled:opacity-50 disabled:border-slate-300 disabled:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
                title={!isApproved ? 'Awaiting customer approval of schedule' : ''}
            >
                <Upload size={22} className="shrink-0" />
                Upload inspection report
            </button>

            <div className="flex items-center gap-4 my-5">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pricing</span>
                <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
                type="button"
                onClick={onSubmitQuotation}
                disabled={!isApproved}
                className="w-full bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/25 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
                title={!isApproved ? 'Awaiting customer approval of schedule' : ''}
            >
                <FileText size={22} className="shrink-0" />
                Submit Quotation
            </button>
        </div>
    );
};

export default PartnerPostAcceptCard;
