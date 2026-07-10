import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Users, CheckCircle, DollarSign, TrendingUp, MessageSquare, Calendar, Eye, ArrowRight, Phone } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import ChatModal from '../../components/Chat/ChatModal';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const StatCard = ({ icon: Icon, title, value, subtext, color }) => (
  <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 hover:shadow-lg transition-all duration-300 group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-2xl ${color} bg-opacity-10 transition-transform group-hover:scale-110`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
      {subtext && (
        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
          <TrendingUp size={12} /> {subtext}
        </span>
      )}
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-display font-bold text-slate-900 tracking-tight">{value}</h3>
    </div>
  </div>
);

const QueryCard = ({ query, onViewDetails }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-soft hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs text-slate-500">Query No</p>
          <p className="font-bold text-lg text-slate-900">
            {query.inquiry_no || query.id.toString().slice(-6).toUpperCase()}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-2xl text-xs font-bold ${(query.status || '').toLowerCase() === 'completed' || (query.status || '').toLowerCase() === 'accepted'
              ? 'bg-green-100 text-green-700'
              : (query.status || '').toLowerCase() === 'rejected'
                ? 'bg-red-100 text-red-700'
                : 'bg-orange-100 text-orange-700'
            }`}
        >
          {query.status || 'Pending'}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600 mb-5">
        <Calendar size={16} className="text-slate-400" />
        <span>
          Due: {query.visits?.last_updated_follow_up_date
            ? new Date(query.visits.last_updated_follow_up_date).toLocaleDateString()
            : 'No date set'}
        </span>
      </div>

      <button
        onClick={() => navigate(`/agent/query/${query.id}`)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl font-medium transition-colors"
      >
        <Eye size={18} />
        View Details
      </button>
    </div>
  );
};

const AgentDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalVisits: 0, conversions: 0, earnings: 0, chartData: [] });
  const [visits, setVisits] = useState([]);
  const [queries, setQueries] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingQueries, setLoadingQueries] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [activeTab, setActiveTab] = useState('Monthly');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedQueryId, setSelectedQueryId] = useState(null);
  const markerRef = useRef(null);
  const navigate = useNavigate();

  const getChartData = (tab, visitsData) => {
    if (!visitsData || visitsData.length === 0) return [];

    const sortedVisits = [...visitsData].sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date));
    let data = [];
    const now = new Date();

    switch (tab) {
      case 'Monthly':
        for (let i = 5; i >= 0; i--) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          const monthVisits = sortedVisits.filter(v => {
            const d = new Date(v.visit_date);
            return d >= monthStart && d <= monthEnd;
          });
          const countVisits = monthVisits.length;
          const countConv = monthVisits.filter(v => v.status === 'Completed').length;
          const monthName = monthStart.toLocaleString('default', { month: 'short' });
          data.push({ name: monthName, visits: countVisits, earnings: countConv * 50 });
        }
        break;

      case 'Weekly':
        for (let i = 3; i >= 0; i--) {
          const weekEnd = new Date(now);
          weekEnd.setDate(now.getDate() - (i * 7));
          weekEnd.setHours(23, 59, 59, 999);
          const weekStart = new Date(weekEnd);
          weekStart.setDate(weekEnd.getDate() - 6);

          const weekVisits = sortedVisits.filter(v => {
            const d = new Date(v.visit_date);
            return d >= weekStart && d <= weekEnd;
          });

          data.push({
            name: `Week ${4 - i}`,
            visits: weekVisits.length,
            earnings: weekVisits.filter(v => v.status === 'Completed').length * 50
          });
        }
        break;

      case 'Daily':
        for (let i = 6; i >= 0; i--) {
          const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);

          const dayVisits = sortedVisits.filter(v => {
            const d = new Date(v.visit_date);
            return d >= dayStart && d <= dayEnd;
          });

          const dayName = day.toLocaleString('default', { weekday: 'short' });
          data.push({
            name: dayName,
            visits: dayVisits.length,
            earnings: dayVisits.filter(v => v.status === 'Completed').length * 50
          });
        }
        break;

      default:
        break;
    }
    return data;
  };

  useEffect(() => {
    const chartData = getChartData(activeTab, visits);
    setStats(prev => ({ ...prev, chartData }));
  }, [activeTab, visits]);

  // Fetch Visits
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const { data: visitsData, error } = await supabase
          .from('visits')
          .select('visit_date, status')
          .eq('agent_id', user.id)
          .order('visit_date', { ascending: true });

        if (error) throw error;

        const totalVisits = visitsData?.length || 0;
        const conversions = visitsData?.filter(v => v.status === 'Completed').length || 0;
        const earnings = conversions * 50;

        setVisits(visitsData || []);
        setStats({ totalVisits, conversions, earnings, chartData: [] });
      } catch (err) {
        console.error("Failed to fetch visits:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  // Fetch Queries
  useEffect(() => {
    const fetchQueries = async () => {
      if (!user) return;
      try {
        setLoadingQueries(true);
        const { data, error } = await supabase
          .from('inquiries')
          .select(`
            id, inquiry_no, type, status, priority, created_at, updated_at,
            visits!inner (id, visit_date, last_updated_follow_up_date, agent_id)
          `)
          .eq('agent_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setQueries(data || []);
      } catch (err) {
        console.error("Failed to fetch queries:", err);
      } finally {
        setLoadingQueries(false);
      }
    };

    fetchQueries();
  }, [user]);

  // Fetch Recent Customers — only customers this agent has actually visited
  useEffect(() => {
    const fetchRecentCustomers = async () => {
      if (!user) return;
      try {
        setLoadingCustomers(true);
        const { data, error } = await supabase
          .from('visits')
          .select(`
            customer_id,
            visit_date,
            customers (id, business_name, owner_name, phone, address, status)
          `)
          .eq('agent_id', user.id)
          .order('visit_date', { ascending: false });

        if (error) throw error;

        // Dedupe by customer_id, keeping the most recent visit (list is already sorted desc)
        const seen = new Set();
        const unique = [];
        (data || []).forEach((v) => {
          if (v.customers && !seen.has(v.customer_id)) {
            seen.add(v.customer_id);
            unique.push({ ...v.customers, last_visit: v.visit_date });
          }
        });

        setRecentCustomers(unique.slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch recent customers:', err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchRecentCustomers();
  }, [user]);

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation || !user) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
      },
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
            Welcome back, <span className="text-primary-500">{user?.name}</span>
          </h1>
          <p className="text-slate-500">Here's what's happening in your territory today.</p>
        </div>
        <Link to="/agent/visit" className="btn-primary flex items-center justify-center gap-2 py-3 px-6 group w-full md:w-auto">
          <span>Log New Visit</span>
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon={Users} title="Total Visits" value={stats.totalVisits} color="bg-blue-500" subtext="+12% this week" />
        <StatCard icon={CheckCircle} title="Conversions" value={stats.conversions} color="bg-green-500" subtext="42% conversion rate" />
        <StatCard icon={DollarSign} title="Total Earnings" value={`SAR ${stats.earnings}`} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-soft border border-slate-100 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp size={22} className="text-primary-500" /> Performance Analytics
            </h3>
            <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
              {['Daily', 'Weekly', 'Monthly'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-xl font-medium text-sm transition-all ${activeTab === tab
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-600 hover:bg-white/60'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="visits" stroke="#f97316" fillOpacity={1} fill="url(#colorVisits)" strokeWidth={3} />
                <Area type="monotone" dataKey="earnings" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEarnings)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Map Section */}
        <div className="bg-white rounded-3xl shadow-soft border border-slate-100 p-6 md:p-8 flex flex-col">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <MapPin size={22} className="text-green-500" /> My Territory
          </h3>
          <div className="flex-1 rounded-2xl overflow-hidden relative min-h-[280px] md:min-h-[320px] bg-slate-100">
            <MapContainer
              center={userLocation || [24.8607, 67.0011]}
              zoom={13}
              scrollWheelZoom={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {userLocation && (
                <Marker position={userLocation} ref={markerRef}>
                  <Popup>You are here 📍</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Recent Queries Section */}
      <div className="bg-white rounded-3xl shadow-soft border border-slate-100 p-6 md:p-8">
        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <MessageSquare size={22} className="text-secondary-500" /> Recent Queries
        </h3>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                <th className="px-6 py-4">Query No</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loadingQueries ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                    </div>
                  </td>
                </tr>
              ) : queries.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-500 italic">
                    No active queries found.
                  </td>
                </tr>
              ) : (
                queries.map((query) => (
                  <tr key={query.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">
                        {query.inquiry_no || query.id.toString().slice(-6).toUpperCase()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${(query.status || '').toLowerCase() === 'completed' || (query.status || '').toLowerCase() === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : (query.status || '').toLowerCase() === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                        {query.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {query.visits?.last_updated_follow_up_date
                        ? new Date(query.visits.last_updated_follow_up_date).toLocaleDateString()
                        : 'No date set'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/agent/query/${query.id}`)}
                        className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden space-y-4">
          {loadingQueries ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : queries.length === 0 ? (
            <p className="text-center py-12 text-slate-500 italic">No active queries found.</p>
          ) : (
            queries.map((query) => (
              <QueryCard key={query.id} query={query} />
            ))
          )}
        </div>
      </div>

      {/* Recent Customers Section */}
      <div className="bg-white rounded-3xl shadow-soft border border-slate-100 p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users size={22} className="text-primary-500" /> Recent Customers
          </h3>
          <Link to="/agent/customers" className="text-sm font-semibold text-primary-600 hover:underline flex items-center gap-1">
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                <th className="px-6 py-4">Business</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Last Visit</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loadingCustomers ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                    </div>
                  </td>
                </tr>
              ) : recentCustomers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500 italic">
                    You haven't visited any customers yet.
                  </td>
                </tr>
              ) : (
                recentCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{customer.business_name}</div>
                      <div className="text-xs text-slate-400">{customer.owner_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Phone size={14} className="text-slate-400" /> {customer.phone || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-slate-400" /> {customer.address || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/agent/customer/${customer.id}`}
                        className="inline-flex items-center justify-center p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                      >
                        <Eye size={18} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden space-y-4">
          {loadingCustomers ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : recentCustomers.length === 0 ? (
            <p className="text-center py-12 text-slate-500 italic">You haven't visited any customers yet.</p>
          ) : (
            recentCustomers.map((customer) => (
              <div key={customer.id} className="border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-bold text-slate-900">{customer.business_name}</p>
                    <p className="text-xs text-slate-400">{customer.owner_name || 'N/A'}</p>
                  </div>
                  <Link
                    to={`/agent/customer/${customer.id}`}
                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    <Eye size={18} />
                  </Link>
                </div>
                <div className="text-sm text-slate-600 flex items-center gap-1.5 mt-2">
                  <Phone size={14} className="text-slate-400" /> {customer.phone || 'N/A'}
                </div>
                <div className="text-sm text-slate-600 flex items-center gap-1.5 mt-1">
                  <MapPin size={14} className="text-slate-400" /> {customer.address || 'N/A'}
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Last visit: {customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : '—'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        queryId={selectedQueryId}
      />
    </div>
  );
};

export default AgentDashboard;