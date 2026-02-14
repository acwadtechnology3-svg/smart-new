import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Database, Server, HardDrive, RefreshCw } from 'lucide-react';
import { formatBytes } from '@/lib/utils'; // You might need to add this utility
import { formatDistanceToNow } from 'date-fns';

const fetchSystemStats = async () => {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/admin/monitoring/stats`, {
        headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
        }
    });
    return response.data.data;
};

// Simple utility if not present
function formatBytesLocal(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function SystemMonitoringDashboard() {
    const { data: stats, isLoading, isError, refetch } = useQuery({
        queryKey: ['system-stats'],
        queryFn: fetchSystemStats,
        refetchInterval: 10000, // Refresh every 10 seconds
    });

    if (isLoading) {
        return (
            <DashboardLayout title="System Monitoring">
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    if (isError) {
        return (
            <DashboardLayout title="System Monitoring">
                <div className="text-red-500">Failed to load system stats.</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="System Monitoring">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatDistanceToNow(Date.now() - (stats.system.uptime * 1000))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Load Avg: {stats.system.os.loadavg.map((l: number) => l.toFixed(1)).join(', ')}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatBytesLocal(stats.system.memory.rss)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Heap: {formatBytesLocal(stats.system.memory.heapUsed)} / {formatBytesLocal(stats.system.memory.heapTotal)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Database Pool</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.services.database.pool.totalCount} conn
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Idle: {stats.services.database.pool.idleCount}, Waiting: {stats.services.database.pool.waitingCount}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Recordings</CardTitle>
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.services.tripRecorder.activeRecordings}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Buffered Trips: {stats.services.tripRecorder.bufferedTrips}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Detailed Service Status */}
                <Card>
                    <CardHeader>
                        <CardTitle>Service Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                <span>PostgreSQL Database</span>
                            </div>
                            <Badge variant={stats.services.database.status === 'connected' ? 'default' : 'destructive'}>
                                {stats.services.database.status}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                <span>Redis Cache</span>
                            </div>
                            <Badge variant={stats.services.redis.status === 'connected' ? 'default' : 'destructive'}>
                                {stats.services.redis.status}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                <span>Location Feed Service</span>
                            </div>
                            <Badge variant={stats.services.locationFeed.running ? 'default' : 'destructive'}>
                                {stats.services.locationFeed.running ? 'Running' : 'Stopped'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
