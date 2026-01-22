import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../supabaseClient';
import L from 'leaflet';
import { User, Briefcase } from 'lucide-react';
import { renderToString } from 'react-dom/server';

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
                const { data: agentsData } = await supabase.from('agents').select('id, name, territory, lat, lng');
                const { data: customersData } = await supabase.from('customers').select('id, business_name, address, lat, lng');

                setData({
                    agents: (agentsData || []).filter(a => a.lat && a.lng),
                    customers: (customersData || []).filter(c => c.lat && c.lng)
                });
            } catch (err) {
                console.error("Map data error", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMapData();
    }, []);

    if (loading) return <div className="h-[600px] flex items-center justify-center bg-slate-50 text-slate-400">Loading Map Data...</div>;

    return (
        <div className="space-y-6">
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
                        <Marker key={`a-${agent.id}`} position={[agent.lat, agent.lng]} icon={agentIcon}>
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
                        <Marker key={`c-${cust.id}`} position={[cust.lat, cust.lng]} icon={customerIcon}>
                            <Popup>
                                <div className="p-2">
                                    <h3 className="font-bold text-slate-900">{cust.business_name}</h3>
                                    <p className="text-xs text-slate-500">{cust.address}</p>
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
