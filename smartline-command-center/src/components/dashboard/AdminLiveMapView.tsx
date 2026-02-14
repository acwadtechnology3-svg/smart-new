import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Car, AlertTriangle, Users } from 'lucide-react';

// Fix Leaflet marker icons
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
});

interface DriverLocation {
    driverId: string;
    name: string;
    vehicleType: string;
    location: {
        lat: number;
        lng: number;
        heading?: number;
        speed?: number;
    };
    status: 'idle' | 'on_trip';
    activeTrip?: {
        tripId: string;
        customerName: string;
        pickup: { lat: number; lng: number; address: string };
        destination: { lat: number; lng: number; address: string };
        status: string;
        startedAt: string;
    };
    lastUpdate: string;
}

interface AdminLiveMapViewProps {
    refreshInterval?: number;
    height?: string;
    apiBaseUrl?: string; // Optional override
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getMarkerIcon = (status: string, heading?: number) => {
    const color = status === 'on_trip' ? '#3B82F6' : '#10B981';
    // Use a simple divIcon with rotation if heading exists
    const rotation = heading || 0;

    return L.divIcon({
        className: 'custom-driver-marker',
        html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transform: rotate(${rotation}deg);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round class="lucide lucide-car"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
      </div>
    `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
};

export const AdminLiveMapView: React.FC<AdminLiveMapViewProps> = ({
    refreshInterval = 30000,
    height = '600px',
    apiBaseUrl = API_BASE
}) => {
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const [filters, setFilters] = useState({ status: 'all', vehicleType: 'all' });
    const [mapCenter] = useState<[number, number]>([30.0444, 31.2357]); // Default Cairo

    const fetchDriverLocations = async () => {
        const params = new URLSearchParams({
            status: filters.status !== 'all' ? filters.status : '',
            vehicleType: filters.vehicleType !== 'all' ? filters.vehicleType : '',
            limit: '500' // Cap at 500 for map performance
        });

        const response = await fetch(`${apiBaseUrl}/admin/locations/live?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Ensure auth
            }
        });

        if (!response.ok) throw new Error('Failed to fetch locations');
        return response.json();
    };

    const { data, isLoading, isError } = useQuery({
        queryKey: ['admin-locations', filters],
        queryFn: fetchDriverLocations,
        refetchInterval: refreshInterval,
        refetchOnWindowFocus: false,
    });

    const drivers: DriverLocation[] = data?.data?.drivers || [];
    const selectedDriver = drivers.find(d => d.driverId === selectedDriverId);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4 items-center bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" /> Live Map
                </h3>
                <Select
                    value={filters.status}
                    onValueChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="idle">Idle</SelectItem>
                        <SelectItem value="on_trip">On Trip</SelectItem>
                    </SelectContent>
                </Select>

                <div className="ml-auto text-sm text-gray-500">
                    {drivers.length} drivers online
                </div>
            </div>

            <Card className="overflow-hidden border shadow-md" style={{ height }}>
                <MapContainer
                    center={mapCenter}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {drivers.map(driver => (
                        <Marker
                            key={driver.driverId}
                            position={[driver.location.lat, driver.location.lng]}
                            icon={getMarkerIcon(driver.status, driver.location.heading)}
                            eventHandlers={{
                                click: () => setSelectedDriverId(driver.driverId),
                            }}
                        >
                            <Popup>
                                <div className="p-2 min-w-[200px]">
                                    <h4 className="font-bold text-lg mb-1">{driver.name}</h4>
                                    <div className="text-sm text-gray-600 mb-2 capitalize">{driver.vehicleType}</div>

                                    <div className="flex gap-2 mb-2">
                                        <Badge variant={driver.status === 'on_trip' ? 'default' : 'secondary'}>
                                            {driver.status === 'on_trip' ? 'On Trip' : 'Idle'}
                                        </Badge>
                                    </div>

                                    {driver.activeTrip && (
                                        <div className="mt-2 pt-2 border-t text-sm">
                                            <div className="font-semibold mb-1">Active Trip</div>
                                            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                                                <span className="text-gray-500">To:</span>
                                                <span className="truncate">{driver.activeTrip.destination.address || 'Unknown'}</span>
                                                <span className="text-gray-500">Customer:</span>
                                                <span>{driver.activeTrip.customerName}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-2 text-xs text-gray-400">
                                        Updated: {new Date(driver.lastUpdate).toLocaleTimeString()}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Draw route line for selected driver if on trip */}
                    {selectedDriver?.activeTrip && (
                        <>
                            {/* Line from pickup to current to desination? No, we only have current and points */}
                            {/* Ideally we fetch the route path here. For now, draw straight line to dest */}
                            <Polyline
                                positions={[
                                    [selectedDriver.location.lat, selectedDriver.location.lng],
                                    [selectedDriver.activeTrip.destination.lat, selectedDriver.activeTrip.destination.lng]
                                ]}
                                pathOptions={{ color: 'blue', dashArray: '10, 10', weight: 3 }}
                            />
                            <Marker
                                position={[selectedDriver.activeTrip.destination.lat, selectedDriver.activeTrip.destination.lng]}
                            >
                                <Popup>Destination: {selectedDriver.activeTrip.destination.address}</Popup>
                            </Marker>
                        </>
                    )}

                </MapContainer>
            </Card>

            {isError && (
                <div className="text-red-500 text-sm mt-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Failed to load live locations.
                </div>
            )}
        </div>
    );
};
