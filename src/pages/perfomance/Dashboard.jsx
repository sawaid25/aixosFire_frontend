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
// import { useRouter } from 'react-router-dom'
import { Link } from 'react-router-dom';
import PageLoader from "../../components/PageLoader";

/* ---------- Reusable Card ---------- */
const StatCard = ({ icon: Icon, title, value, color }) => (
  <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100">
    <div className={`p-3 rounded-2xl ${color} bg-opacity-10 w-fit mb-4`}>
      <Icon size={22} className={color.replace("bg-", "text-")} />
    </div>
    <p className="text-sm text-slate-500">{title}</p>
    <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
  </div>
);

const AgentPerformance = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [categoryCountRange, setCategoryCountRange] = useState("Monthly");
  const [categoryValueRange, setCategoryValueRange] = useState("Monthly");

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

        const { data, error } = await supabase
          .from("extinguishers")
          .select(
            `
            status,
            price,
            quantity,
            visits (
              visit_date,
              agent_id
            )
          `,
          )
          .eq("visits.agent_id", user.id)
          .gte("visits.visit_date", fromDate);

        if (error) throw error;

        /* ---------- SUMMARY ---------- */
        const todayStr = new Date().toISOString().split("T")[0];

        const categorySummary = {};

        data.forEach((d) => {
          categorySummary[d.status] = (categorySummary[d.status] || 0) + 1;
        });

        const totalValue = data.reduce(
          (sum, d) => sum + toNumber(d.price) * toNumber(d.quantity, 1),
          0,
        );

        setSummary({
          today: data.filter(
            (d) => d.visits?.visit_date?.split("T")[0] === todayStr,
          ).length,
          total: data.length,
          totalValue,
          byCategory: categorySummary,
        });

        /* ---------- CATEGORY CHART DATA ---------- */
        const countMap = {};
        const valueMap = {};

        data.forEach((d) => {
          countMap[d.status] = (countMap[d.status] || 0) + 1;
          valueMap[d.status] =
            (valueMap[d.status] || 0) +
            toNumber(d.price) * toNumber(d.quantity, 1);
        });

        setCategoryCount(
          Object.keys(countMap).map((k) => ({ name: k, count: countMap[k] })),
        );

        setCategoryValue(
          Object.keys(valueMap).map((k) => ({ name: k, value: valueMap[k] })),
        );

        /* ---------- TABLE DATA ---------- */
        const tableMap = {};

        data.forEach((d) => {
          if (!tableMap[d.status]) {
            tableMap[d.status] = {
              category: d.status,
              total: 0,
              active: 0,
              closed: 0,
              quantity: 0,
              value: 0,
            };
          }

          tableMap[d.status].total += 1;
          tableMap[d.status].quantity += toNumber(d.quantity, 1);
          tableMap[d.status].value +=
            toNumber(d.price) * toNumber(d.quantity, 1);

          if (["Validation", "New"].includes(d.status)) {
            tableMap[d.status].active += 1;
          }

          if (["Refilled", "Maintenance"].includes(d.status)) {
            tableMap[d.status].closed += 1;
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
        <StatCard
          icon={ClipboardList}
          title="Today Inquiries"
          value={summary.today}
          color="bg-blue-500"
        />
        <StatCard
          icon={Layers}
          title="Total Inquiries"
          value={summary.total}
          color="bg-green-500"
        />
        <StatCard
          icon={DollarSign}
          title="Total Value"
          value={`$${summary.totalValue}`}
          color="bg-orange-500"
        />
        <div className="bg-white rounded-3xl p-4 shadow-soft border border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-red-100">
              <RefreshCcw size={18} className="text-red-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              Requests by Category
            </p>
          </div>

          <div className="space-y-1">
            {Object.entries(summary.byCategory || {}).map(([category, qty]) => (
              <div
                key={category}
                className="flex justify-between items-center
                   text-sm px-2 py-1 rounded-lg
                   hover:bg-slate-50"
              >
                {/* Category */}
                <span className="text-slate-600 truncate">
                  {category}
                </span>
                {/* Quantity */}
                <span className="font-bold text-slate-900">
                  {qty}
                </span>


              </div>
            ))}
          </div>
        </div>


      </div>

      {/* ---------- CATEGORY CHARTS ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Wise Inquiries */}
        <div className="bg-white p-6 rounded-3xl shadow-soft">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Category Wise Inquiries</h3>
          </div>

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

        {/* Category Wise Value */}
        <div className="bg-white p-6 rounded-3xl shadow-soft">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Category Wise Value</h3>
          </div>

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

      {/* ---------- TABLE ---------- */}
      <div className="bg-white rounded-3xl shadow-soft p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-semibold text-slate-900">
            Performance Details
          </h3>
          <span className="text-xs text-slate-500">Category wise summary</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
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
                  to={`/agent/performance/${row.category.toLowerCase()}`}
                  className="contents"
                >
                  <tr
                    className={`cursor-pointer border-b last:border-0 transition
                    ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                    hover:bg-blue-50`}
                  >
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {row.category}
                    </td>
                    <td className="px-5 py-4 text-center font-semibold">
                      {row.total}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full
                bg-green-100 text-green-700 text-xs font-semibold"
                      >
                        {row.active}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full
                bg-red-100 text-red-700 text-xs font-semibold"
                      >
                        {row.closed}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center text-slate-700">
                      {row.quantity}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-orange-600">
                      ${row.value}
                    </td>
                  </tr>
                </Link>
              ))}

              {/* ---------- GRAND TOTAL ROW ---------- */}
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
                <td className="px-5 py-4 text-right text-orange-600">
                  ${tableData.reduce((sum, r) => sum + r.value, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AgentPerformance;

