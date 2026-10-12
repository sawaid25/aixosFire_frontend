import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Filter, Loader2, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchPartnerStickerUsageLogs,
  repairMissingStickerRecords,
  stickerLogRowDisplay,
} from '../../api/partnerStickers';
import { formatKsaDateTime } from '../../utils/dateTime';

const SERVICE_FILTER_ALL = 'all';

const formatDateUsed = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : formatKsaDateTime(d);
  } catch {
    return '—';
  }
};

const sameLocalDay = (iso, ymd) => {
  if (!iso || !ymd) return true;
  const d = new Date(iso);
  const [y, m, day] = ymd.split('-').map(Number);
  return (
    d.getFullYear() === y &&
    d.getMonth() + 1 === m &&
    d.getDate() === day
  );
};

const StickersUsagePage = () => {
  const { user } = useAuth();
  const partnerId = user?.id;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [serviceFilter, setServiceFilter] = useState(SERVICE_FILTER_ALL);
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      await repairMissingStickerRecords(partnerId);
      const data = await fetchPartnerStickerUsageLogs(partnerId);
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [partnerId]);

  const displayRows = useMemo(() => {
    return rows.map(stickerLogRowDisplay).filter((r) => {
      if (serviceFilter !== SERVICE_FILTER_ALL && r.service_type !== serviceFilter) {
        return false;
      }
      if (dateFilter && !sameLocalDay(r.usedAt, dateFilter)) {
        return false;
      }
      return true;
    });
  }, [rows, serviceFilter, dateFilter]);

  return (
    <div className="min-h-screen pb-20 px-4 md:px-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/partner/dashboard"
          className="p-2 rounded-xl hover:bg-slate-200/80 text-slate-600 transition-colors inline-flex"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-500/10 rounded-xl text-primary-600">
            <Tag size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stickers usage</h1>
            <p className="text-sm font-medium text-slate-500">Validation and refilled inquiry deductions</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden mb-6">
        <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
            <Filter size={18} className="text-slate-400" />
            Filters
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Service type
              </label>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value={SERVICE_FILTER_ALL}>All</option>
                <option value="validation">Validation</option>
                <option value="refilled">Refilled</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Date used
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="self-end text-xs font-bold text-primary-600 hover:text-primary-700"
              >
                Clear date
              </button>
            )}
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 bg-slate-50/50">
                <th className="px-8 py-5">Customer name</th>
                <th className="px-8 py-5">Inquiry</th>
                <th className="px-8 py-5">Type</th>
                <th className="px-8 py-5">Quantity</th>
                <th className="px-8 py-5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center">
                    <Loader2 className="animate-spin text-primary-500 mx-auto mb-2" size={36} />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading…</p>
                  </td>
                </tr>
              )}
              {!loading && displayRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-500 font-bold text-sm">
                    No sticker usage yet
                  </td>
                </tr>
              )}
              {!loading &&
                displayRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-900">{r.customerName}</td>
                    <td className="px-8 py-5 text-sm font-semibold text-primary-700">{r.inquiryDisplay}</td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-700">
                        {r.serviceLabel}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm text-slate-700 font-semibold">{r.quantity}</td>
                    <td className="px-8 py-5 text-sm text-slate-600">{formatDateUsed(r.usedAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-4 space-y-3">
          {loading && (
            <div className="py-12 flex flex-col items-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span className="text-xs font-bold uppercase tracking-widest">Loading…</span>
            </div>
          )}
          {!loading && displayRows.length === 0 && (
            <p className="text-center py-12 text-slate-500 font-bold text-sm">No sticker usage yet</p>
          )}
          {!loading &&
            displayRows.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-100 p-4 bg-slate-50/50"
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="font-black text-slate-900">{r.customerName}</p>
                    <p className="text-xs font-semibold text-primary-700 mt-1">{r.inquiryDisplay}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                    {r.serviceLabel}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-3 text-xs text-slate-500">
                  <span>Qty: <span className="font-bold text-slate-700">{r.quantity}</span></span>
                  <span>{formatDateUsed(r.usedAt)}</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default StickersUsagePage;
