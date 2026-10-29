import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, CheckCircle2, AlertCircle, 
  FileText, FireExtinguisher, RefreshCcw, PlusCircle, 
  ChevronRight, ArrowRight, Loader2, Info, ExternalLink,
  Camera, Mic
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const CustomerHistoryModal = ({ isOpen, onClose, customerId, customerName }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && customerId) {
      fetchHistory();
    }
  }, [isOpen, customerId]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch inquiries for this customer
      const { data: inquiries, error: inqError } = await supabase
        .from('inquiries')
        .select(`
          id,
          inquiry_no,
          type,
          status,
          created_at,
          inquiry_items (*)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (inqError) throw inqError;
      setHistory(inquiries || []);
    } catch (err) {
      console.error('Error fetching customer history:', err);
      setError('Failed to load history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusColor = (status) => {
    const s = status?.toLowerCase();
    if (['completed', 'approved'].includes(s)) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (['pending', 'quoted'].includes(s)) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (['rejected', 'cancelled'].includes(s)) return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Validation': return <CheckCircle2 className="text-blue-500" size={18} />;
      case 'Maintenance': return <Clock className="text-purple-500" size={18} />;
      case 'Refill': return <RefreshCcw className="text-orange-700" size={18} />;
      case 'New Unit': return <PlusCircle className="text-emerald-600" size={18} />;
      default: return <FileText className="text-slate-500" size={18} />;
    }
  };

  const renderItemDetails = (inquiry) => {
    const items = inquiry.inquiry_items || [];
    if (items.length === 0) return <p className="text-xs text-slate-400 italic">No item details recorded.</p>;

    return (
      <div className="space-y-3 mt-3">
        {items.map((item, idx) => (
          <div key={item.id || idx} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
                  #{idx + 1}
                </span>
                <p className="text-sm font-bold text-slate-800">
                  {item.type || item.system_type || item.system || 'Fire Unit'}
                </p>
              </div>
              <p className="text-xs font-bold text-slate-900">Qty: {item.quantity || 1}</p>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              {/* Type-specific details */}
              {inquiry.type === 'Validation' && (
                <>
                  <DetailRow label="Expiry" value={item.expiry_date} />
                  <DetailRow label="Brand" value={item.brand} />
                </>
              )}
              {inquiry.type === 'Refill' && (
                <>
                  <DetailRow label="Gas/Type" value={item.type} />
                  <DetailRow label="Capacity" value={item.capacity} />
                  <DetailRow label="Expiry" value={item.expiry_date} />
                </>
              )}
              {inquiry.type === 'New Unit' && (
                <>
                  <DetailRow label="Material" value={item.system_type} />
                  <DetailRow label="System" value={item.system} />
                  <DetailRow label="Brand" value={item.brand} />
                  <DetailRow label="Capacity" value={item.capacity} />
                </>
              )}
              {inquiry.type === 'Maintenance' && (
                <div className="col-span-2 space-y-2">
                  <p className="text-slate-600 font-medium">
                    <span className="text-slate-400">Notes:</span> {item.maintenance_notes || 'No notes'}
                  </p>
                  <div className="flex gap-2">
                    {item.maintenance_unit_photo_url && (
                      <a href={item.maintenance_unit_photo_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-600 font-bold hover:underline">
                        <Camera size={12} /> View Photo
                      </a>
                    )}
                    {item.maintenance_voice_url && (
                      <a href={item.maintenance_voice_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-600 font-bold hover:underline">
                        <Mic size={12} /> Listen Voice Note
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const DetailRow = ({ label, value }) => (
    <div className="flex justify-between border-b border-white pb-1">
      <span className="text-slate-400 font-semibold uppercase tracking-tighter">{label}:</span>
      <span className="text-slate-700 font-bold text-right">{value || 'N/A'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-hidden">
      <div className="bg-white w-full max-w-2xl h-[85vh] rounded-[32px] shadow-2xl flex flex-col relative animate-slide-up">
        
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600">
              <Clock size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-slate-900 leading-tight">Service History</h2>
              <p className="text-slate-500 font-medium">{customerName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <Loader2 className="animate-spin text-primary-500" size={40} />
              <p className="font-medium animate-pulse">Scanning service logs...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex items-start gap-4 text-rose-800">
              <AlertCircle className="shrink-0" />
              <div>
                <p className="font-bold">Error Loaded History</p>
                <p className="text-sm opacity-80">{error}</p>
                <button onClick={fetchHistory} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold uppercase transition-transform hover:scale-105">
                  Try Again
                </button>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                <Info size={40} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No History Found</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-[280px]">
                We couldn't find any past inquiries or maintenance logs for this customer.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {history.map((inq) => (
                <div key={inq.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/5 transition-all group">
                  {/* Inquiry Header */}
                  <div className="p-4 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        {getTypeIcon(inq.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                            {inq.inquiry_no}
                          </span>
                          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${getStatusColor(inq.status)}`}>
                            {inq.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                          <Calendar size={12} />
                          {new Date(inq.created_at).toLocaleDateString(undefined, { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Type</span>
                      <span className="text-xs font-bold text-slate-700">{inq.type}</span>
                    </div>
                  </div>

                  {/* Inquiry Details */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Details</h4>
                      <span className="text-[10px] font-medium text-slate-400">{inq.inquiry_items?.length || 0} items</span>
                    </div>
                    {renderItemDetails(inq)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 rounded-b-[32px] shrink-0 text-center">
          <p className="text-xs text-slate-400 font-medium italic">
            Displaying complete service history for AXIOS authorized agents.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerHistoryModal;
