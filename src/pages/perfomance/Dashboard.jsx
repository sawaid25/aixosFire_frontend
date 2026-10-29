import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { ClipboardList, DollarSign, RefreshCcw, Layers } from "lucide-react";
import { Link } from 'react-router-dom';
import PageLoader from "../../components/PageLoader";
import { iconTone } from '../../constants/iconTones';

/* ---------- Reusable Stat Card ---------- */
const StatCard = ({ icon, title, value, color }) => {
  const IconComponent = icon;
  return (
    <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100">
      <div className={`p-3 rounded-2xl ${iconTone(color)} w-fit mb-4`}>
        <IconComponent size={22} />
      </div>
      <p className="text-sm text-slate-500">{title}</p>
      <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
    </div>
  );
};

/* ---------- Mobile Performance Detail Card ---------- */
const PerformanceDetailCard = ({ row, isTotal = false }) => {
  return (
    <Link
      to={isTotal ? "#" : `/agent/performance/${encodeURIComponent(row.category)}`}
      className={`block ${isTotal ? 'pointer-events-none' : ''}`}
    >
      <div
        className={`bg-white rounded-3xl border p-6 transition-all hover:shadow-md
          ${isTotal
            ? "bg-primary-50 border-primary-200 font-semibold shadow-sm"
            : "border-slate-100 hover:border-blue-200"
          }`}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Category</p>
            <p className="font-semibold text-xl text-slate-900 mt-1">
              {row.category || "Total"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total</p>
            <p className="text-3xl font-bold text-slate-900">{row.total}</p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex gap-3 justify-between mb-5">
          <div >
            <p className="text-xs text-slate-500 mb-1">Active</p>
            <span className="inline-flex items-center px-4 py-1.5 rounded-2xl bg-green-100 text-green-700 text-sm font-semibold">
              {row.active}
            </span>
          </div>
          <div >
            <p className="text-xs text-slate-500 mb-1">Closed</p>
            <span className="inline-flex items-center px-4 py-1.5 rounded-2xl bg-red-100 text-red-700 text-sm font-semibold">
              {row.closed}
            </span>
          </div>
        </div>

        {/* Quantity & Value */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-500">Quantity</p>
            <p className="text-lg font-semibold text-slate-900 mt-1">{row.quantity}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Value</p>
            <p className="text-lg font-semibold text-orange-700 mt-1">
              SAR {row.value.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
};

const AgentPerformance = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categoryCount, setCategoryCount] = useState([]);
  const [categoryValue, setCategoryValue] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [summary, setSummary] = useState({
    today: 0,
    total: 0,
    totalValue: 0,
    byCategory: {},
  });

  const toNumber = (val, fallback = 0) =>
    isNaN(Number(val)) ? fallback : Number(val);

  const getDateByRange = () => {
    const now = new Date();
    return new Date(now.setMonth(now.getMonth() - 6));
  };

  useEffect(() => {
    if (!user) return;

    const fetchPerformance = async () => {
      setLoading(true);
      try {
        const fromDate = getDateByRange().toISOString();

        const { data: inquiries, error } = await supabase
          .from("inquiries")
          .select("id,type,status,created_at")
          .eq("agent_id", user.id)
          .gte("created_at", fromDate);

        if (error) throw error;

        const inquiryList = inquiries || [];
        const inquiryIds = inquiryList.map((i) => i.id);

        const { data: itemsData, error: itemsError } = inquiryIds.length > 0
          ? await supabase
            .from("inquiry_items")
            .select("inquiry_id,price,quantity")
            .in("inquiry_id", inquiryIds)
          : { data: [], error: null };

        if (itemsError) throw itemsError;

        const itemsByInquiry = {};
        (itemsData || []).forEach((it) => {
          if (!itemsByInquiry[it.inquiry_id]) {
            itemsByInquiry[it.inquiry_id] = { quantity: 0, value: 0 };
          }
          const qty = toNumber(it.quantity, 1);
          const price = toNumber(it.price, 0);
          itemsByInquiry[it.inquiry_id].quantity += qty;
          itemsByInquiry[it.inquiry_id].value += price * qty;
        });

        /* ---------- SUMMARY ---------- */
        const todayStr = new Date().toISOString().split("T")[0];
        const categorySummary = {};
        inquiryList.forEach((d) => {
          const category = d.type || "Unknown";
          categorySummary[category] = (categorySummary[category] || 0) + 1;
        });

        const totalValue = inquiryList.reduce((sum, d) => {
          return sum + (itemsByInquiry[d.id]?.value || 0);
        }, 0);

        setSummary({
          today: inquiryList.filter((d) => d.created_at?.split("T")[0] === todayStr).length,
          total: inquiryList.length,
          totalValue,
          byCategory: categorySummary,
        });

        /* ---------- CHARTS DATA ---------- */
        const countMap = {};
        const valueMap = {};
        inquiryList.forEach((d) => {
          const category = d.type || "Unknown";
          countMap[category] = (countMap[category] || 0) + 1;
          valueMap[category] = (valueMap[category] || 0) + (itemsByInquiry[d.id]?.value || 0);
        });

        setCategoryCount(Object.keys(countMap).map((k) => ({ name: k, count: countMap[k] })));
        setCategoryValue(Object.keys(valueMap).map((k) => ({ name: k, value: valueMap[k] })));

        /* ---------- TABLE DATA ---------- */
        const tableMap = {};
        inquiryList.forEach((d) => {
          const category = d.type || "Unknown";
          if (!tableMap[category]) {
            tableMap[category] = {
              category,
              total: 0,
              active: 0,
              closed: 0,
              quantity: 0,
              value: 0,
            };
          }
          const status = (d.status || "").toString().toLowerCase();
          tableMap[category].total += 1;
          tableMap[category].quantity += itemsByInquiry[d.id]?.quantity || 0;
          tableMap[category].value += itemsByInquiry[d.id]?.value || 0;

          if (["pending", "active", "in progress", "quoted", "new"].includes(status)) {
            tableMap[category].active += 1;
          }
          if (["accepted", "approved", "completed", "closed", "rejected"].includes(status)) {
            tableMap[category].closed += 1;
          }
        });

        setTableData(Object.values(tableMap));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [user]);

  return (
    <div className="relative min-h-[400px] space-y-8">
      {loading && <PageLoader />}
      <h1 className="text-3xl font-bold">Performance</h1>

      {/* ---------- STATS ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={ClipboardList} title="Today Inquiries" value={summary.today} color="bg-blue-500" />
        <StatCard icon={Layers} title="Total Inquiries" value={summary.total} color="bg-green-500" />
        <StatCard icon={DollarSign} title="Total Value" value={`SAR ${summary.totalValue}`} color="bg-orange-500" />

        <div className="bg-white rounded-3xl p-4 shadow-soft border border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-red-100">
              <RefreshCcw size={18} className="text-red-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Requests by Category</p>
          </div>
          <div className="space-y-1">
            {Object.entries(summary.byCategory || {}).map(([category, qty]) => (
              <div
                key={category}
                className="flex justify-between items-center text-sm px-2 py-1 rounded-lg hover:bg-slate-50"
              >
                <span className="text-slate-600 truncate">{category}</span>
                <span className="font-bold text-slate-900">{qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- CATEGORY CHARTS ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-3xl shadow-soft">
          <h3 className="font-bold mb-4">Category Wise Inquiries</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={categoryCount}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-soft">
          <h3 className="font-bold mb-4">Category Wise Value</h3>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={categoryValue}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#f97316"
                fill="#fed7aa"
                fillOpacity={0.6}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ==================== PERFORMANCE DETAILS SECTION ==================== */}
      <div className="bg-white rounded-3xl shadow-soft p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Performance Details</h3>
          <span className="text-xs text-slate-500">Category wise summary</span>
        </div>

        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-slate-600 uppercase text-xs tracking-wide">
                <th className="px-5 py-4 text-left">Category</th>
                <th className="px-5 py-4 text-center">Total</th>
                <th className="px-5 py-4 text-center">Active</th>
                <th className="px-5 py-4 text-center">Closed</th>
                <th className="px-5 py-4 text-center">Qty</th>
                <th className="px-5 py-4 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <Link
                  key={row.category}
                  to={`/agent/performance/${encodeURIComponent(row.category)}`}
                  className="contents"
                >
                  <tr
                    className={`cursor-pointer border-b last:border-0 transition hover:bg-blue-50
                      ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                  >
                    <td className="px-5 py-4 font-medium text-slate-900">{row.category}</td>
                    <td className="px-5 py-4 text-center font-semibold">{row.total}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                        {row.active}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                        {row.closed}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center font-semibold text-orange-700">
                      {row.quantity}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-orange-700">
                      SAR {row.value}
                    </td>
                  </tr>
                </Link>
              ))}

              {/* Grand Total Row */}
              <tr className="bg-primary-50 font-semibold text-slate-900 border-t-2 border-slate-200">
                <td className="px-5 py-4 text-left">Total</td>
                <td className="px-5 py-4 text-center">
                  {tableData.reduce((sum, r) => sum + r.total, 0)}
                </td>
                <td className="px-5 py-4 text-center">
                  {tableData.reduce((sum, r) => sum + r.active, 0)}
                </td>
                <td className="px-5 py-4 text-center">
                  {tableData.reduce((sum, r) => sum + r.closed, 0)}
                </td>
                <td className="px-5 py-4 text-center">
                  {tableData.reduce((sum, r) => sum + r.quantity, 0)}
                </td>
                <td className="px-5 py-4 text-right text-orange-700">
                  SAR {tableData.reduce((sum, r) => sum + r.value, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile: Cards */}
        <div className="block md:hidden space-y-4">
          {tableData.map((row) => (
            <PerformanceDetailCard key={row.category} row={row} />
          ))}

          {/* Grand Total Card */}
          {tableData.length > 0 && (
            <PerformanceDetailCard
              row={{
                category: "Total",
                total: tableData.reduce((sum, r) => sum + r.total, 0),
                active: tableData.reduce((sum, r) => sum + r.active, 0),
                closed: tableData.reduce((sum, r) => sum + r.closed, 0),
                quantity: tableData.reduce((sum, r) => sum + r.quantity, 0),
                value: tableData.reduce((sum, r) => sum + r.value, 0),
              }}
              isTotal={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentPerformance;