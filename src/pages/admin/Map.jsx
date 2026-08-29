import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../supabaseClient';
import L from 'leaflet';
import { User, Briefcase, ArrowRight } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { Link } from 'react-router-dom';
import PageLoader from '../../components/PageLoader';

// Custom Icons
const createIcon = (color, Icon) => {
    return L.divIcon({
        className: 'custom-icon',
        html: `<div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                ${renderToString(<Icon size={18} color="white" />)}
               </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    });
};

const agentIcon = createIcon('#ef4444', Briefcase); // Brand Red
const customerIcon = createIcon('#3b82f6', User); // Brand Blue

const GlobalMap = () => {
    const [data, setData] = useState({ agents: [], customers: [] });
    const [loading, setLoading] = useState(true);
    const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // Default NYC
    const [hasLocation, setHasLocation] = useState(false);

    useEffect(() => {
        // Get user's current location to center map
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setMapCenter([position.coords.latitude, position.coords.longitude]);
                    setHasLocation(true);
                },
                (error) => {
                    console.error("Geolocation error:", error);
                }
            );
        }
    }, []);

    useEffect(() => {
        const fetchMapData = async () => {
            try {
                const { data: agentsData } = await supabase
                    .from('agents')
                    .select('id, name, territory, location_lat, location_lng')
                    .or('status.ilike.accepted,status.ilike.active');
                const { data: customersData } = await supabase
                    .from('customers')
                    .select('id, business_name, address, location_lat, location_lng');

                setData({
                    agents: (agentsData || []).filter(
                        (a) => a.location_lat != null && a.location_lng != null
                    ),
                    customers: (customersData || []).filter(
                        (c) => c.location_lat != null && c.location_lng != null
                    )
                });
            } catch (err) {
                console.error("Map data error", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMapData();
    }, []);

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading map data..." />}
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900">Territory Overview</h1>
                <p className="text-slate-500">Live view of active agents and customer locations.</p>
            </div>

            <div className="h-[600px] rounded-3xl overflow-hidden border border-slate-200 shadow-soft relative z-0">
                <MapContainer center={mapCenter} zoom={hasLocation ? 13 : 4} style={{ height: '100%', width: '100%' }} key={`${mapCenter[0]}-${mapCenter[1]}`}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    {hasLocation && (
                        <Marker position={mapCenter} icon={createIcon('#10B981', User)}>
                            <Popup>You are here</Popup>
                        </Marker>
                    )}

                    {data.agents.map(agent => (
                        <Marker key={`a-${agent.id}`} position={[agent.location_lat, agent.location_lng]} icon={agentIcon}>
                            <Popup>
                                <div className="p-2">
                                    <h3 className="font-bold text-slate-900">{agent.name} (Agent)</h3>
                                    <p className="text-xs text-slate-500">{agent.territory}</p>
                                    <span className="text-xs font-bold text-blue-600">Active</span>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {data.customers.map(cust => (
                        <Marker key={`c-${cust.id}`} position={[cust.location_lat, cust.location_lng]} icon={customerIcon}>
                            <Popup>
                                <div className="p-2 min-w-[160px]">
                                    <h3 className="font-bold text-slate-900">{cust.business_name}</h3>
                                    <p className="text-xs text-slate-500 mb-3">{cust.address}</p>
                                    <Link
                                        to={`/admin/customers/${cust.id}`}
                                        className="inline-flex items-center justify-center gap-1.5 w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                                    >
                                        View Details <ArrowRight size={12} />
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Legend */}
                    <div className="absolute bottom-6 left-6 bg-white p-4 rounded-2xl shadow-lg z-[1000] border border-slate-100">
                        <h4 className="font-bold text-slate-900 mb-2 text-sm">Legend</h4>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-xs text-slate-600">Agents</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="text-xs text-slate-600">Customers</span>
                        </div>
                    </div>
                </MapContainer>
            </div>
        </div>
    );
};

export default GlobalMap;
