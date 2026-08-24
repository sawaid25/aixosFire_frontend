import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Split, Truck, Info, XCircle, MessageCircle, ChevronLeft, Loader2, Beaker, Calendar, Clock, CheckCircle2, User, Package } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { finalizeRefillAcceptance } from '../../../api/partnerRefill';
import CustomerContactSection from './CustomerContactSection';
import InquiryChatBox from '../../../components/Chat/InquiryChatBox';

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const DetailField = ({ label, value }) => (
  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
    <p className="text-slate-900 font-semibold text-sm break-words">{value ?? '—'}</p>
  </div>
);

/**
 * Process Refill Request — per-kg pricing, per-line partial acceptance.
 */
const RefillInquiryDetail = forwardRef(({ viewModel, onFinalized }, ref) => {
  const { user } = useAuth();
  const partnerId = user?.id;
  const lastInquiryIdRef = useRef(null);

  const {
    inquiryNo,
    customerName,
    pickupTypeLabel,
    pickupStrategyDescription,
    isTransportChargeable,
    requirementNote,
    customerEmail,
    customerPhone,
    customerOwnerName,
    customerId,
    customerAddress,
    customerLocationLat,
    customerLocationLng,
    refillLines: modelLines,
    transportFlatSar,
    inquiryId,
    agentId,
    deliveryMode,
    deliveryStatus,
    pickupDate,
    deliveryDate,
    deliveryDeductionPerKg,
    status,
  } = viewModel;

  useImperativeHandle(ref, () => ({
    getRefillLines: () => lines,
    getAggregatedItems: () => {
      const aggregatedMap = {};
      lines.forEach((l) => {
        if (!aggregatedMap[l.itemId]) {
          aggregatedMap[l.itemId] = { id: l.itemId, accepted_kg: 0, quantity_kg: Number(l.quantityKg) || 0 };
        }
        aggregatedMap[l.itemId].accepted_kg += (Number(l.acceptedKg) || 0);
      });
      return Object.values(aggregatedMap).map((row) => ({
        id: row.id,
        accepted_kg: row.accepted_kg,
        rejected_kg: Math.max(0, (Number(row.quantity_kg) || 0) - (Number(row.accepted_kg) || 0)),
        accepted_quantity: row.accepted_kg, // legacy compatibility
      }));
    }
  }));

  const isLocked = status !== 'pending' && status !== 'submitted';

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const [lines, setLines] = useState(() => []);
  const [saving, setSaving] = useState(false);
  const [openChat, setOpenChat] = useState(null); // null | 'customer' | 'agent'

  // acceptedLocked is true once a line's accepted_kg has actually been persisted
  // (either just now, via the local patch in handleFinalize, or on an earlier visit,
  // read back from the DB via modelLines/refillInquiryViewModel). Deriving the
  // "already finalized" state from this — rather than from the inquiry's overall
  // status, which this action never touches — means the button correctly stays
  // locked both immediately after a successful submit and after a page reload.
  const allFinalized = lines.length > 0 && lines.every((l) => l.acceptedLocked);

  useEffect(() => {
    if (!modelLines || !inquiryId) return;

    // PREVENT AUTO-RESET: Skip initialization if we are mid-process with the same inquiry
    if (lastInquiryIdRef.current === inquiryId && lines.length > 0) {
      console.log("[RefillInquiryDetail] Skipping line initialization (already loaded for this inquiry)");
      return;
    }

    console.log("[RefillInquiryDetail] Initializing lines for inquiry:", inquiryId);
    const expanded = [];
    modelLines.forEach((item) => {
      // Debug logs
      console.log("Item Data:", item);
      console.log("Quantity:", item.quantity);
      console.log("Capacity:", item.capacity);

      const capNum = parseFloat(item.capacity) || 0;
      // Default each row to its fair share of accepted quantity, or full capacity
      const totalQty = Number(item.quantity) || 1;
      const totalAccepted = Number(item.acceptedKg);
      const perRowAccepted = Number.isFinite(totalAccepted)
        ? totalAccepted / totalQty
        : capNum;

      for (let i = 0; i < (item.quantity || 1); i++) {
        expanded.push({
          ...item,
          rowId: `${item.itemId}-${i}`,
          rowIndex: i + 1,
          acceptedKg: perRowAccepted,
          rejectedKg: Math.max(0, (Number(item.quantityKg) || 0) - perRowAccepted),
          acceptedLocked: Boolean(item.acceptedLocked),
          displayCapacity: item.capacity || item.type || '—'
        });
      }
    });
    setLines(expanded);
    lastInquiryIdRef.current = inquiryId;
  }, [modelLines, inquiryId]);

  const defaultPickupDescription =
    isTransportChargeable && transportFlatSar > 0
      ? `Partner is responsible for pickup. A transportation fee of SAR ${Number(transportFlatSar).toFixed(2)} applies to this order.`
      : 'Agent or customer will drop the units. No separate transport fee for this order.';

  const pickupBody = pickupStrategyDescription?.trim() ? pickupStrategyDescription : defaultPickupDescription;

  const lineTotals = useMemo(() => {
    return (lines || []).map((line) => {
      const has = Boolean(line.hasPrice) && line.pricePerKg != null;
      const lineRefillSar = has
        ? (Number(line.acceptedKg) || 0) * (Number(line.pricePerKg) || 0)
        : null;
      return { ...line, lineRefillSar };
    });
  }, [lines]);

  const refillSubtotal = useMemo(
    () =>
      lineTotals.reduce(
        (acc, l) => acc + (l.lineRefillSar != null ? l.lineRefillSar : 0),
        0
      ),
    [lineTotals]
  );

  const grandTotal = useMemo(
    () => refillSubtotal + (isTransportChargeable ? Number(transportFlatSar) || 0 : 0),
    [refillSubtotal, isTransportChargeable, transportFlatSar]
  );

  const updateAccepted = (rowId, value) => {
    const n = Math.max(0, parseFloat(value) || 0);
    setLines((prev) => {
      const next = prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const qty = Number(row.quantityKg) || 0;
        const safeAccepted = Math.min(n, qty);
        return {
          ...row,
          acceptedKg: safeAccepted,
          rejectedKg: Math.max(0, qty - safeAccepted),
        };
      });
      return next;
    });
  };

  const handleFinalize = async () => {
    if (!inquiryId) {
      toast.error('Missing inquiry reference.');
      return;
    }

    // Pricing is mandatory: a line with no resolvable price (not even the
    // built-in fallback) must not be submitted as if SAR 0.00 were correct.
    const unpriced = lines.filter((l) => !l.hasPrice || l.pricePerKg == null);
    if (unpriced.length > 0) {
      const names = [...new Set(unpriced.map((l) => l.type || l.serviceName || 'line item'))].join(', ');
      toast.error(`Cannot finalize — no pricing is set for: ${names}. Contact an admin to configure pricing.`);
      return;
    }

    setSaving(true);
    try {
      console.log('[RefillInquiryDetail] acceptedKg before submit', lines.map((l) => ({
        rowId: l.rowId,
        itemId: l.itemId,
        acceptedKg: l.acceptedKg,
        quantityKg: l.quantityKg,
      })));

      // Aggregate expanded rows back into original item format
      const aggregatedMap = {};
      lines.forEach((l) => {
        if (!aggregatedMap[l.itemId]) {
          aggregatedMap[l.itemId] = {
            itemId: l.itemId,
            quantityKg: l.quantityKg,
            acceptedKg: 0,
          };
        }
        aggregatedMap[l.itemId].acceptedKg += Number(l.acceptedKg) || 0;
      });

      const finalLines = Object.values(aggregatedMap);
      const overflow = finalLines.find((l) => Number(l.acceptedKg) > Number(l.quantityKg));
      if (overflow) {
        toast.error('Accepted KG cannot be greater than total KG.');
        setSaving(false);
        return;
      }

      const payloadPreview = finalLines.map((l) => ({
        itemId: l.itemId,
        accepted_kg: l.acceptedKg,
        rejected_kg: Math.max(0, (Number(l.quantityKg) || 0) - (Number(l.acceptedKg) || 0)),
      }));
      console.log('[RefillInquiryDetail] payload', payloadPreview);

      const response = await finalizeRefillAcceptance({
        inquiryId,
        inquiryNo,
        agentId,
        customerId,
        partnerId,
        transportFlatSar: isTransportChargeable ? Number(transportFlatSar) || 0 : 0,
        lines: finalLines,
      });
      console.log('[RefillInquiryDetail] API response', response);

      // Keep submitted values and lock input rows.
      setLines((prev) => prev.map((row) => ({ ...row, acceptedLocked: true })));
      toast.success('Acceptance saved.');
      if (onFinalized) onFinalized();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || 'Could not save acceptance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link
        to="/partner/dashboard"
        className="inline-flex items-center gap-2 text-slate-500 hover:text-primary-500 transition-colors mb-6 font-bold text-sm"
      >
        <ChevronLeft size={18} /> Back to Global List
      </Link>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-soft-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Process Refill Request</h2>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <p className="text-slate-500 font-medium">
                Inquiry: {inquiryNo} | {customerName}
              </p>
              <button
                type="button"
                onClick={() => setOpenChat(prev => prev === 'customer' ? null : 'customer')}
                disabled={!customerId}
                title={customerId ? 'Chat with Customer' : 'No customer linked'}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-200 ${
                  openChat === 'customer'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-900 text-white hover:bg-primary-600'
                } disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none`}
              >
                <MessageCircle size={14} /> Message Customer
              </button>
              <button
                type="button"
                onClick={() => setOpenChat(prev => prev === 'agent' ? null : 'agent')}
                disabled={!agentId}
                title={agentId ? 'Chat with Agent' : 'No agent assigned'}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-200 ${
                  openChat === 'agent'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-700 text-white hover:bg-primary-600'
                } disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none`}
              >
                <User size={14} /> Message Agent
              </button>
            </div>
          </div>
          <Link
            to="/partner/dashboard"
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 self-start shrink-0"
            aria-label="Close"
          >
            <XCircle size={24} />
          </Link>
        </div>

        <div className="p-8 space-y-12">
          {/* Customer Contact */}
          <CustomerContactSection
            ownerName={customerOwnerName}
            email={customerEmail}
            phone={customerPhone}
            customerId={customerId}
            address={customerAddress}
            locationLat={customerLocationLat}
            locationLng={customerLocationLng}
          />

          {/* Chat Section */}
          {openChat === 'customer' && customerId && inquiryId && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <InquiryChatBox
                inquiryId={inquiryId}
                recipientId={customerId}
                recipientRole="Customer"
                title="Chat with Customer"
              />
            </div>
          )}
          {openChat === 'agent' && agentId && inquiryId && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <InquiryChatBox
                inquiryId={inquiryId}
                recipientId={agentId}
                recipientRole="Agent"
                title="Chat with Agent"
              />
            </div>
          )}

          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Split size={20} className="text-primary-500" /> Accept by service (kg)
              </h3>
              {requirementNote ? (
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 italic text-sm text-slate-600 mb-6 leading-relaxed">
                  {requirementNote}
                </div>
              ) : null}
              <div className="overflow-x-auto rounded-[2rem] border border-slate-100 shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 bg-slate-50/50">
                      <th className="px-6 py-5">#</th>
                      <th className="px-6 py-5">Service Name</th>
                      <th className="px-6 py-5">Capacity</th>
                      <th className="px-6 py-5">Accept Capacity</th>
                      <th className="px-6 py-5">
                        {deliveryMode === 'agent' ? 'Base Price / Deduction' : 'Price (per kg)'}
                      </th>
                      <th className="px-6 py-5 text-right">Accept KG Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500 font-medium italic">
                          No line items for this refill.
                        </td>
                      </tr>
                    ) : (
                      lines.map((item, idx) => {
                        const lineTotal = (Number(item.acceptedKg) || 0) * (Number(item.pricePerKg) || 0);
                        return (
                          <tr key={item.rowId} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-5">
                              <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-lg bg-primary-500/10 text-primary-600">
                                  <Beaker size={14} />
                                </div>
                                <span className="font-bold text-slate-900 text-sm whitespace-nowrap">{item.type}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <span className="text-sm font-medium text-slate-600">{item.displayCapacity}</span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="relative max-w-[120px]">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.acceptedKg}
                                  onChange={(e) => updateAccepted(item.rowId, e.target.value)}
                                  disabled={isLocked || item.acceptedLocked}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 pointer-events-none">KG</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              {item.hasPrice && item.pricePerKg != null ? (
                                <div className="space-y-1">
                                  <span className="font-bold text-primary-600 text-sm block">
                                    SAR {Number(item.pricePerKg).toFixed(2)}
                                  </span>
                                  {item.priceSource === 'fallback' && (
                                    <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[8px] font-black uppercase tracking-wider">
                                      Default pricing — not configured
                                    </span>
                                  )}
                                  {deliveryMode === 'agent' && (
                                    <span className="text-[10px] text-slate-400 block italic">
                                      (Base {Number(item.basePricePerKg).toFixed(2)} - Deduct {Number(item.deliveryDeduction).toFixed(2)})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-amber-700">Not set</span>
                              )}
                            </td>
                            <td className="px-6 py-5 text-right font-black text-slate-900 text-sm">
                              SAR {lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Truck size={20} className="text-primary-500" /> Pricing breakdown
              </h3>
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                  <p className="text-slate-500 font-medium">Refill Subtotal</p>
                  <p className="font-display font-black text-slate-900 text-lg">SAR {refillSubtotal.toFixed(2)}</p>
                </div>
                {deliveryMode === 'agent' && (
                  <div className="flex justify-between items-center pb-4 border-b border-slate-50 bg-rose-50/30 -mx-6 px-6">
                    <div className="flex flex-col">
                      <p className="text-rose-600 font-bold text-sm">Delivery Deduction</p>
                      <p className="text-[10px] text-rose-400 font-medium italic">Agent handles delivery</p>
                    </div>
                    <p className="font-display font-black text-rose-600 text-lg">- SAR {(deliveryDeductionPerKg * lines.reduce((acc, l) => acc + (Number(l.acceptedKg) || 0), 0)).toFixed(2)}</p>
                  </div>
                )}
                <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-slate-500 font-medium">Transport</p>
                    {isTransportChargeable && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[8px] font-black uppercase">
                        Chargeable
                      </span>
                    )}
                  </div>
                  <p className="font-display font-black text-emerald-600 text-lg">
                    SAR {(isTransportChargeable ? Number(transportFlatSar) || 0 : 0).toFixed(2)}
                  </p>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <p className="text-slate-900 font-black uppercase text-sm">Estimated total</p>
                  <p className="font-display font-black text-primary-600 text-2xl">SAR {grandTotal.toFixed(2)}</p>
                </div>
                {isLocked && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-emerald-500 text-white rounded-lg">
                      <CheckCircle2 size={16} />
                    </div>
                    <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Selection Locked — Inquiry Accepted</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-end space-y-4">
              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 space-y-4 shadow-sm">
                <div className="flex justify-between items-start gap-4">
                  <h4 className="font-bold text-amber-900 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                    <Info size={14} className="text-amber-600" /> Pickup strategy: {pickupTypeLabel}
                  </h4>
                  {deliveryMode === 'partner' ? (
                    <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border ${deliveryStatus === 'agent_confirmed' || deliveryStatus === 'confirmed'
                        ? 'bg-emerald-500 text-white border-emerald-400'
                        : deliveryStatus === 'partner_confirmed'
                          ? 'bg-blue-500 text-white border-blue-400'
                          : deliveryStatus === 'rejected'
                            ? 'bg-rose-500 text-white border-rose-400'
                            : 'bg-amber-500 text-white border-amber-400'
                      }`}>
                      {deliveryStatus === 'agent_confirmed' || deliveryStatus === 'confirmed' ? (
                        <span className="flex items-center gap-1.5"><CheckCircle2 size={10} /> Confirmed by Agent</span>
                      ) : deliveryStatus === 'partner_confirmed' ? (
                        <span className="flex items-center gap-1.5"><Package size={10} /> Confirmed by You</span>
                      ) : deliveryStatus === 'rejected' ? (
                        <span className="flex items-center gap-1.5"><XCircle size={10} /> Rejected by Agent</span>
                      ) : (
                        <span className="flex items-center gap-1.5"><Clock size={10} /> Awaiting Agent Confirmation</span>
                      )}
                    </div>
                  ) : (
                    <div className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white border border-emerald-400 text-[9px] font-black uppercase tracking-tighter shadow-sm">
                      <span className="flex items-center gap-1.5"><CheckCircle2 size={10} /> Handled by Agent</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-amber-700/80 leading-relaxed font-medium bg-white/40 p-3 rounded-xl border border-amber-200/30">
                  {pickupBody}
                </p>

                {deliveryMode === 'partner' && (pickupDate || deliveryDate) && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-white/60 p-3 rounded-2xl border border-amber-100 shadow-sm">
                      <p className="text-[9px] font-black text-amber-900/50 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Calendar size={10} /> Pickup Date
                      </p>
                      <p className="text-xs font-bold text-slate-900">{formatDate(pickupDate)}</p>
                    </div>
                    <div className="bg-white/60 p-3 rounded-2xl border border-amber-100 shadow-sm">
                      <p className="text-[9px] font-black text-amber-900/50 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Truck size={10} /> Delivery Date
                      </p>
                      <p className="text-xs font-bold text-slate-900">{formatDate(deliveryDate)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {allFinalized ? (
                <div className="w-full bg-emerald-50 border-2 border-emerald-200 text-emerald-700 font-black py-5 rounded-2xl flex items-center justify-center gap-2 text-sm uppercase tracking-widest">
                  <CheckCircle2 size={22} /> Selection Finalized
                </div>
              ) : isLocked ? (
                <div className="w-full bg-amber-50 border-2 border-amber-200 text-amber-700 font-bold py-5 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm text-center leading-relaxed">
                  <Info size={20} className="shrink-0" />
                  This inquiry was accepted before line items were finalized — selection can no longer be edited here. Contact support if accepted quantities need correcting.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={saving || !inquiryId}
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl transform active:scale-95 transition-all text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={22} /> : null}
                  {saving ? 'FINALIZING…' : 'FINALIZE SELECTION'}
                </button>
              )}
              <Link
                to="/partner/dashboard"
                className="block w-full text-center bg-white text-slate-400 font-bold py-4 rounded-2xl hover:text-slate-600 transition-all text-sm"
              >
                CANCEL PROCESS
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
);

export default RefillInquiryDetail;
