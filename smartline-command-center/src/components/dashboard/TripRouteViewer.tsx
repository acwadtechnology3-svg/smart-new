import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { Play, Pause, FastForward, SkipBack, Download, Car, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Slider } from '../ui/slider';

// Fix Icons
const startIcon = L.divIcon({
    className: 'custom-start-icon',
    html: `<div style="background-color: #10B981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
    iconSize: [12, 12]
});

const endIcon = L.divIcon({
    className: 'custom-end-icon',
    html: `<div style="background-color: #EF4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
    iconSize: [12, 12]
});

const carIcon = L.divIcon({
    className: 'custom-car-playback',
    html: `
      <div style="
        background-color: #3B82F6;
        width: 24px; height: 24px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

interface RoutePoint {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    recordedAt: string;
}

interface TripRouteViewerProps {
    tripId: string;
    onClose?: () => void;
    apiBaseUrl?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Component to handle map resizing and centering
function MapUpdater({ center, points }: { center?: [number, number], points?: RoutePoint[] }) {
    const map = useMap();
    useEffect(() => {
        if (points && points.length > 0) {
            const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (center) {
            map.flyTo(center, 13);
        }
    }, [center, points, map]);
    return null;
}

export const TripRouteViewer: React.FC<TripRouteViewerProps> = ({
    tripId,
    onClose,
    apiBaseUrl = API_BASE
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const playbackRef = useRef<NodeJS.Timeout | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['trip-route', tripId],
        queryFn: async () => {
            const res = await fetch(`${apiBaseUrl}/trips/${tripId}/route`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Failed to fetch route');
            return res.json();
        }
    });

    const routePoints: RoutePoint[] = data?.data?.points || [];
    const summary = data?.data?.summary;

    // Reset playback when points load
    useEffect(() => {
        setCurrentIndex(0);
        setIsPlaying(false);
    }, [tripId]);

    // Playback Loop
    useEffect(() => {
        if (isPlaying && routePoints.length > 0) {
            playbackRef.current = setInterval(() => {
                setCurrentIndex(prev => {
                    if (prev >= routePoints.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000 / playbackSpeed); // Adjust speed
        } else if (playbackRef.current) {
            clearInterval(playbackRef.current);
        }

        return () => {
            if (playbackRef.current) clearInterval(playbackRef.current);
        };
    }, [isPlaying, playbackSpeed, routePoints]);

    const handleExport = () => {
        if (!routePoints.length) return;

        const geojson = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: routePoints.map(p => [p.lng, p.lat])
                },
                properties: {
                    tripId: tripId,
                    ...summary
                }
            }]
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trip-route-${tripId}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (isLoading) return <Skeleton className="h-[400px] w-full" />;
    if (!routePoints.length) return <div className="p-4 text-center text-gray-500">No route data available.</div>;

    const currentPoint = routePoints[currentIndex];

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Map */}
            <Card className="flex-1 min-h-[400px] overflow-hidden relative border shadow-sm rounded-lg">
                <MapContainer center={[routePoints[0].lat, routePoints[0].lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; OpenStreetMap'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <MapUpdater points={routePoints} />

                    {/* Full Route Line */}
                    <Polyline
                        positions={routePoints.map(p => [p.lat, p.lng])}
                        pathOptions={{ color: '#3B82F6', weight: 4, opacity: 0.6 }}
                    />

                    {/* Progress Line */}
                    <Polyline
                        positions={routePoints.slice(0, currentIndex + 1).map(p => [p.lat, p.lng])}
                        pathOptions={{ color: '#10B981', weight: 4 }}
                    />

                    {/* Start Marker */}
                    <Marker position={[routePoints[0].lat, routePoints[0].lng]} icon={startIcon}>
                        <Popup>Start: {new Date(routePoints[0].recordedAt).toLocaleTimeString()}</Popup>
                    </Marker>

                    {/* End Marker */}
                    <Marker position={[routePoints[routePoints.length - 1].lat, routePoints[routePoints.length - 1].lng]} icon={endIcon}>
                        <Popup>End: {new Date(routePoints[routePoints.length - 1].recordedAt).toLocaleTimeString()}</Popup>
                    </Marker>

                    {/* Moving Car */}
                    <Marker
                        position={[currentPoint.lat, currentPoint.lng]}
                        icon={carIcon}
                        zIndexOffset={100}
                    />
                </MapContainer>

                {/* Stats Overlay */}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow text-sm z-[1000]">
                    <div className="font-bold mb-1">Trip Summary</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-gray-500">Distance:</span>
                        <span>{summary?.totalDistance || 0} km</span>
                        <span className="text-gray-500">Duration:</span>
                        <span>{Math.round((summary?.totalDuration || 0) / 60)} min</span>
                        <span className="text-gray-500">Avg Speed:</span>
                        <span>{currentPoint.speed ? Math.round(currentPoint.speed) : 0} km/h</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                        {new Date(currentPoint.recordedAt).toLocaleString()}
                    </div>
                </div>
            </Card>

            {/* Controls */}
            <div className="flex flex-col gap-4 bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsPlaying(!isPlaying)}
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentIndex(0)}
                        disabled={currentIndex === 0}
                    >
                        <SkipBack className="h-4 w-4" />
                    </Button>

                    <Slider
                        className="flex-1"
                        value={[currentIndex]}
                        max={routePoints.length - 1}
                        step={1}
                        onValueChange={(val) => {
                            setCurrentIndex(val[0]);
                            setIsPlaying(false);
                        }}
                    />

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Speed:</span>
                        <select
                            className="border rounded p-1 text-sm"
                            value={playbackSpeed}
                            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                        >
                            <option value={1}>1x</option>
                            <option value={2}>2x</option>
                            <option value={5}>5x</option>
                            <option value={10}>10x</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" /> Export GeoJSON
                    </Button>
                </div>
            </div>
        </div>
    );
};
