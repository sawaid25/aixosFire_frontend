import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Users, CheckCircle, DollarSign, Clock, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon not finding images in webpack/vite environments
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useRef } from 'react';

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
      {subtext && <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1"><TrendingUp size={12} /> {subtext}</span>}
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-display font-bold text-slate-900 tracking-tight">{value}</h3>
    </div>
  </div>
);

const AgentDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ totalVisits: 0, conversions: 0, earnings: 0, chartData: [] });
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState(null);
    const [activeTab, setActiveTab] = useState('Monthly');
    const markerRef = useRef(null);

    const getWeekNumber = (date) => {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), 0, 1);
      const diff = (d - start + (start.getDay() + 1) * 86400000) / 86400000;
      return Math.ceil(diff / 7);
    };

    const getChartData = (tab, visits) => {
  if (!visits || visits.length === 0) return [];

  // Sort visits by visit_date ascending (very important!)
  visits.sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date));

  let data = [];
  const now = new Date();

  switch (tab) {
    case 'Monthly':
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthVisits = visits.filter(v => {
          const d = new Date(v.visit_date);           // ← changed here
          return d >= monthStart && d <= monthEnd;
        });
        const countVisits = monthVisits.length;
        const countConv = monthVisits.filter(v => v.status === 'Completed').length;
        const earn = countConv * 50;
        const monthName = monthStart.toLocaleString('default', { month: 'short' });
        data.push({ name: monthName, visits: countVisits, earnings: earn });
      }
      break;

    case 'Weekly':
  for (let i = 3; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - (i * 7));
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekVisits = visits.filter(v => {
      const d = new Date(v.visit_date);
      return d >= weekStart && d <= weekEnd;
    });

    const countVisits = weekVisits.length;
    const countConv = weekVisits.filter(v => v.status === 'Completed').length;

    data.push({
      name: `Week ${4 - i}`,
      visits: countVisits,
      earnings: countConv * 50
    });
  }
  break;




    case 'Daily':
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
        const dayVisits = visits.filter(v => {
          const d = new Date(v.visit_date);           // ← changed here
          return d >= dayStart && d <= dayEnd;
        });
        const countVisits = dayVisits.length;
        const countConv = dayVisits.filter(v => v.status === 'Completed').length;
        const earn = countConv * 50;
        const dayName = day.toLocaleString('default', { weekday: 'short' });
        data.push({ name: dayName, visits: countVisits, earnings: earn });
      }
      break;

    default:
      break;
  }

  return data;
};

    useEffect(() => {
      if (!visits || visits.length === 0) return;
      const chartData = getChartData(activeTab, visits);
      setStats(prev => ({ ...prev, chartData }));
    }, [activeTab, visits]);

   useEffect(() => {
  const fetchStats = async () => {
    try {
      const { data: visits, error: vError } = await supabase
        .from('visits')
        .select('visit_date, status')                    // ← changed from created_at
        .eq('agent_id', user.id)
        .order('visit_date', { ascending: true });       // good to have chronological order

      if (vError) {
        console.error("Supabase fetch error:", vError);
        throw vError;
      }

      // If no visits exist yet
      if (!visits || visits.length === 0) {
        setVisits([]);
        setStats({
          totalVisits: 0,
          conversions: 0,
          earnings: 0,
          chartData: []
        });
        setLoading(false);
        return;
      }

      const totalVisits = visits.length;
      const conversions = visits.filter(v => v.status === 'Completed').length;
      const earnings = conversions * 50; // your earning logic

      setVisits(visits);
      setStats({
        totalVisits,
        conversions,
        earnings,
        chartData: [] // chart will be calculated in the other useEffect
      });

    } catch (err) {
      console.error("Failed to fetch visits:", err.message);
    } finally {
      setLoading(false);
    }
  };

  if (user) fetchStats();
}, [user]);

console.log("Fetched visits sample:", visits.slice(0,3));
console.log("First visit date:", visits[0]?.visit_date);
    useEffect(() => {
  if (!navigator.geolocation || !user) return;

  let lastUpdate = 0;

  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;

      setUserLocation([latitude, longitude]); // map pe marker move

      const now = Date.now();
      if (now - lastUpdate < 10000) return; // update every 10 sec
      lastUpdate = now;

      // ✅ Call backend just like login
      try {
        const response = await fetch('http://localhost:5000/api/agents/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            lat: latitude,
            lng: longitude
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error('Location update failed:', result.error);
        } else {
          console.log('Location updated successfully:', result);
        }
      } catch (err) {
        console.error('Error updating location:', err);
      }
    },
    (err) => console.error('Geolocation error:', err),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}, [user]);

useEffect(() => {
  if (markerRef.current) {
    markerRef.current.openPopup();
  }
}, [userLocation]);

console.log(userLocation, "<user locaton")
console.log('Current location state:', userLocation);


console.log(userLocation)
    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
                        Welcome back, <span className="text-primary-500">{user?.name}</span>
                    </h1>
                    <p className="text-slate-500">Here's what's happening in your territory today.</p>
                </div>
                <Link to="/agent/visit" className="btn-primary flex items-center gap-2 group">
                    <span>Log New Visit</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    icon={Users}
                    title="Total Visits"
                    value={stats.totalVisits}
                    color="bg-blue-500"
                    subtext="+12% this week"
                />
                <StatCard
                    icon={CheckCircle}
                    title="Conversions"
                    value={stats.conversions}
                    color="bg-green-500"
                    subtext="42% conversion rate"
                />
                <StatCard
                    icon={DollarSign}
                    title="Total Earnings"
                    value={`$${stats.earnings}`}
                    color="bg-orange-500"
                />
            </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Charts Section */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-soft border border-slate-100 p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp size={22} className="text-primary-500" /> Performance Analytics
                        </h3>
                        {/* Tabs */}
                        <div className="flex gap-2">
                            {['Daily', 'Weekly', 'Monthly'].map(tab => (
                                <button
                                    key={tab}
                                    className={`px-4 py-2 rounded-full font-medium ${
                                        activeTab === tab ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700'
                                    }`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-80 w-full">
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
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                    }}
                                />
                                <Area type="monotone" dataKey="visits" stroke="#f97316" fillOpacity={1} fill="url(#colorVisits)" strokeWidth={3} />
                                <Area type="monotone" dataKey="earnings" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEarnings)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

<div className="bg-white rounded-3xl shadow-soft border border-slate-100 p-8 flex flex-col">
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <MapPin size={22} className="text-green-500" /> My Territory
                    </h3>
                    <div className="flex-1 rounded-2xl overflow-hidden relative h-64 lg:h-auto min-h-[300px] bg-slate-100 z-0">
                        <MapContainer
                        center={userLocation || [24.8607, 67.0011]}
                        zoom={15}
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
        </div>
    );
};

export default AgentDashboard;