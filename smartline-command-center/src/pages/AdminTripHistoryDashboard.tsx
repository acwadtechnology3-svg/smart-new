
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Map, Search, Car, Calendar } from 'lucide-react';
import { TripRouteViewer } from '@/components/dashboard/TripRouteViewer';

// Define API Base
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Trip {
    id: string;
    createdAt: string;
    driverId: string;
    driverName: string;
    customerId: string;
    customerName: string;
    pickup: { address: string; lat: number; lng: number };
    destination: { address: string; lat: number; lng: number };
    distance: number;
    duration: number;
    fare: number;
    status: 'completed' | 'cancelled' | 'started' | 'requested';
    paymentStatus: 'paid' | 'pending' | 'failed';
}

export default function AdminTripHistoryDashboard() {
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
        status: 'all',
        search: '',
        startDate: '', // ISO string
        endDate: ''
    });
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

    // Fetch Trips
    const fetchTrips = async () => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '50',
            status: filters.status !== 'all' ? filters.status : '',
            search: filters.search,
            // Date handling omitted for brevity, would be start/end params
        });

        const res = await fetch(`${API_BASE}/admin/trips/history?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error('Failed to fetch trips');
        return res.json();
    };

    const { data, isLoading } = useQuery({
        queryKey: ['admin-trips', page, filters],
        queryFn: fetchTrips,
        placeholderData: (prev) => prev // Keep previous data while fetching new
    });

    const trips: Trip[] = data?.data?.trips || [];
    const meta = data?.data?.meta || { totalPages: 1 };

    const handleExportCSV = () => {
        // Generate CSV content
        const headers = ['Trip ID', 'Date', 'Driver', 'Customer', 'Pickup', 'Destination', 'Status', 'Fare'];
        const rows = trips.map(t => [
            t.id,
            new Date(t.createdAt).toLocaleString(),
            t.driverName,
            t.customerName,
            `"${t.pickup.address}"`,
            `"${t.destination.address}"`,
            t.status,
            t.fare
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'trips_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Trip History</h1>
                <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-sm font-medium mb-2 block">Search</label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Trip ID, Driver, Customer..."
                                    className="pl-8"
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="w-[180px]">
                            <label className="text-sm font-medium mb-2 block">Status</label>
                            <Select
                                value={filters.status}
                                onValueChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                    <SelectItem value="started">Started</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-[180px]">
                            <label className="text-sm font-medium mb-2 block">Date Range</label>
                            <Button variant="outline" className="w-full justify-start text-left font-normal text-muted-foreground">
                                <Calendar className="mr-2 h-4 w-4" /> Pick a date
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date/Time</TableHead>
                                <TableHead>Driver</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Route</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Fare</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                // Loading Skeltons
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><span className="h-4 w-24 bg-gray-100 rounded animate-pulse inline-block"></span></TableCell>
                                        <TableCell><span className="h-4 w-32 bg-gray-100 rounded animate-pulse inline-block"></span></TableCell>
                                        <TableCell><span className="h-4 w-32 bg-gray-100 rounded animate-pulse inline-block"></span></TableCell>
                                        <TableCell><span className="h-4 w-48 bg-gray-100 rounded animate-pulse inline-block"></span></TableCell>
                                        <TableCell><span className="h-4 w-20 bg-gray-100 rounded animate-pulse inline-block"></span></TableCell>
                                        <TableCell className="text-right"><span className="h-4 w-16 bg-gray-100 rounded animate-pulse inline-block"></span></TableCell>
                                        <TableCell className="text-right"><span className="h-8 w-8 bg-gray-100 rounded animate-pulse inline-block"></span></TableCell>
                                    </TableRow>
                                ))
                            ) : trips.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No trips found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                trips.map((trip) => (
                                    <TableRow key={trip.id}>
                                        <TableCell className="whitespace-nowrap">
                                            {format(new Date(trip.createdAt), 'MMM d, HH:mm')}
                                        </TableCell>
                                        <TableCell>{trip.driverName}</TableCell>
                                        <TableCell>{trip.customerName}</TableCell>
                                        <TableCell className="max-w-[300px]">
                                            <div className="flex flex-col text-sm truncate">
                                                <span className="text-green-600 truncate">Wait: {trip.pickup.address}</span>
                                                <span className="text-gray-400 text-xs">⬇</span>
                                                <span className="text-red-600 truncate">{trip.destination.address}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                trip.status === 'completed' ? 'default' :
                                                    trip.status === 'cancelled' ? 'destructive' : 'secondary'
                                            }>
                                                {trip.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            EGP {trip.fare}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => setSelectedTripId(trip.id)}>
                                                <Map className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            <div className="flex items-center justify-end space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                >
                    Previous
                </Button>
                <div className="text-sm font-medium">
                    Page {page} of {Math.max(1, meta.totalPages)}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= meta.totalPages}
                >
                    Next
                </Button>
            </div>

            {/* Route Viewer Modal */}
            <Dialog open={!!selectedTripId} onOpenChange={(open) => !open && setSelectedTripId(null)}>
                <DialogContent className="max-w-4xl h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Trip Route Replay</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden h-full pt-4">
                        {selectedTripId && (
                            <TripRouteViewer tripId={selectedTripId} onClose={() => setSelectedTripId(null)} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
