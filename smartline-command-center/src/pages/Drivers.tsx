import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getDriverImageUrl } from '@/lib/media';
import { toast } from 'sonner';
import { Filter, Loader2, MoreHorizontal, Search, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

type DriverStatus = 'pending' | 'approved' | 'rejected' | 'banned';

interface DriverRow {
  id: string;
  national_id: string | null;
  city: string | null;
  vehicle_type: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  status: DriverStatus | null;
  profile_photo_url: string | null;
  created_at: string;
  is_online: boolean | null;
  last_location_update: string | null;
  rating: number | null;
  users?: {
    full_name: string | null;
    phone: string;
    email: string | null;
  } | null;
}

type DriverDetail = DriverRow & {
  id_front_url?: string | null;
  id_back_url?: string | null;
  license_front_url?: string | null;
  license_back_url?: string | null;
  vehicle_license_front_url?: string | null;
  vehicle_license_back_url?: string | null;
  vehicle_front_url?: string | null;
  vehicle_back_url?: string | null;
  vehicle_right_url?: string | null;
  vehicle_left_url?: string | null;
};

export default function Drivers() {
  const [search, setSearch] = useState('');
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [viewDriver, setViewDriver] = useState<DriverDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const driversQuery = useQuery({
    queryKey: ['drivers'],
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const startedAt = performance.now();
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          id,
          national_id,
          city,
          vehicle_type,
          vehicle_model,
          vehicle_plate,
          status,
          profile_photo_url,
          created_at,
          is_online,
          last_location_update,
          rating,
          users!drivers_id_fkey (
            full_name,
            phone,
            email
          )
        `)
        .order('created_at', { ascending: false });

      setLastLatencyMs(Math.round(performance.now() - startedAt));

      if (error) {
        toast.error('Failed to load drivers');
        throw error;
      }

      const rows = (data ?? []) as any[];
      return rows.map((d) => ({
        ...d,
        users: Array.isArray(d.users) ? d.users[0] : d.users,
      })) as DriverRow[];
    },
  });

  const fetchDriverDetail = async (driverId: string) => {
    setLoadingDetail(true);
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          *,
          users!drivers_id_fkey (
            full_name,
            phone,
            email
          )
        `)
        .eq('id', driverId)
        .single();

      if (error) throw error;

      const normalized: DriverDetail = {
        ...(data as any),
        users: Array.isArray((data as any)?.users) ? (data as any)?.users[0] : (data as any)?.users,
      };
      setViewDriver(normalized);
    } catch (err: any) {
      console.error('Failed to load driver detail', err);
      toast.error('Failed to load driver details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api';
    if (!window.confirm('Delete this driver and all related data? This cannot be undone.')) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE.replace(/\/$/, '')}/admin/users/${driverId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || 'Delete failed');
      }

      toast.success('Driver removed');
      setViewDriver(null);
      driversQuery.refetch();
    } catch (err: any) {
      console.error('Delete driver error', err);
      toast.error(err.message || 'Failed to delete driver');
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderDoc = (url?: string | null, label?: string) => (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="border rounded-md overflow-hidden bg-muted aspect-video flex items-center justify-center">
        {url ? (
          <img src={getDriverImageUrl(url)} alt={label} className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">No Image</span>
        )}
      </div>
    </div>
  );

  const filteredDrivers = useMemo(() => {
    const rows = driversQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((d) => {
      const haystack = [
        d.users?.full_name ?? '',
        d.users?.phone ?? '',
        d.users?.email ?? '',
        d.city ?? '',
        d.vehicle_type ?? '',
        d.vehicle_model ?? '',
        d.vehicle_plate ?? '',
        d.status ?? '',
        d.national_id ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [driversQuery.data, search]);

  const stats = useMemo(() => {
    const rows = driversQuery.data ?? [];
    const countBy = (s: DriverStatus) => rows.filter((d) => d.status === s).length;

    return {
      total: rows.length,
      approved: countBy('approved'),
      pending: countBy('pending'),
      banned: countBy('banned'),
    };
  }, [driversQuery.data]);

  const updatedAt = driversQuery.dataUpdatedAt ? new Date(driversQuery.dataUpdatedAt) : null;
  const cacheAgeSeconds = driversQuery.dataUpdatedAt
    ? Math.max(0, Math.round((Date.now() - driversQuery.dataUpdatedAt) / 1000))
    : null;

  return (
    <DashboardLayout title="Drivers Management">
      <div className="space-y-6 animate-fade-in">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search drivers..."
                className="pl-9 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => driversQuery.refetch()}
            disabled={driversQuery.isFetching}
          >
            {driversQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        </div>

        <div className="card-elevated p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Latency:</span>
              <span className="font-medium">{lastLatencyMs === null ? '—' : `${lastLatencyMs} ms`}</span>

              <span className="text-muted-foreground ml-4">Cache:</span>
              <span className="font-medium">
                {driversQuery.isFetching
                  ? 'Refreshing'
                  : driversQuery.isStale
                    ? 'Stale'
                    : 'Fresh'}
              </span>

              <span className="text-muted-foreground ml-4">Age:</span>
              <span className="font-medium">{cacheAgeSeconds === null ? '—' : `${cacheAgeSeconds}s`}</span>
            </div>

            <div className="text-sm text-muted-foreground">
              Updated: {updatedAt ? updatedAt.toLocaleString() : '—'}
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card py-4">
            <p className="text-sm text-muted-foreground">Total Drivers</p>
            <p className="text-2xl font-semibold">{driversQuery.isLoading ? '…' : stats.total}</p>
          </div>
          <div className="stat-card py-4">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-semibold text-success">{driversQuery.isLoading ? '…' : stats.approved}</p>
          </div>
          <div className="stat-card py-4">
            <p className="text-sm text-muted-foreground">Pending Approval</p>
            <p className="text-2xl font-semibold text-warning">{driversQuery.isLoading ? '…' : stats.pending}</p>
          </div>
          <div className="stat-card py-4">
            <p className="text-sm text-muted-foreground">Banned</p>
            <p className="text-2xl font-semibold text-destructive">{driversQuery.isLoading ? '…' : stats.banned}</p>
          </div>
        </div>

        {/* Drivers Table */}
        <div className="card-elevated overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Driver</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Online</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {driversQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading drivers...
                    </div>
                  </TableCell>
                </TableRow>
              ) : driversQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Failed to load drivers.
                  </TableCell>
                </TableRow>
              ) : filteredDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No drivers found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDrivers.map((driver) => {
                  const name = driver.users?.full_name ?? 'Unnamed Driver';
                  const initials = name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]!.toUpperCase())
                    .join('');

                  const vehicleLabel = [driver.vehicle_model, driver.vehicle_type].filter(Boolean).join(' • ');
                  const status = (driver.status ?? 'pending') as any;

                  return (
                    <TableRow key={driver.id} className="table-row-hover">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={getDriverImageUrl(driver.profile_photo_url)} />
                            <AvatarFallback>{initials || 'DR'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-sm text-muted-foreground">{driver.users?.email ?? '—'}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>{driver.users?.phone ?? '—'}</TableCell>

                      <TableCell>
                        <div>
                          <p className="text-sm">{vehicleLabel || '—'}</p>
                          <p className="text-xs text-muted-foreground">{driver.vehicle_plate ?? '—'}</p>
                        </div>
                      </TableCell>

                      <TableCell>{driver.city ?? '—'}</TableCell>

                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>

                      <TableCell>
                        {driver.rating && Number(driver.rating) > 0 ? (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-warning text-warning" />
                            <span>{Number(driver.rating).toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {driver.is_online ? (
                          <span className="text-success font-medium">Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                fetchDriverDetail(driver.id);
                              }}
                            >
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!viewDriver || loadingDetail} onOpenChange={(open) => !open && setViewDriver(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Driver Details</DialogTitle>
            <DialogDescription>
              {loadingDetail ? 'Loading driver data...' : viewDriver?.users?.full_name || '—'}
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
            </div>
          ) : viewDriver ? (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-muted border">
                  {viewDriver.profile_photo_url ? (
                    <img src={getDriverImageUrl(viewDriver.profile_photo_url)} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No Photo</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm flex-1">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{viewDriver.users?.full_name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{viewDriver.users?.phone ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{viewDriver.users?.email ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">City</p>
                    <p className="font-medium">{viewDriver.city ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vehicle</p>
                    <p className="font-medium">{[viewDriver.vehicle_model, viewDriver.vehicle_type].filter(Boolean).join(' • ') || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Plate</p>
                    <p className="font-medium">{viewDriver.vehicle_plate ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant="secondary">{viewDriver.status ?? 'pending'}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-muted-foreground">Rating</p>
                    {viewDriver.rating ? (
                      <span className="font-medium">{Number(viewDriver.rating).toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {renderDoc(viewDriver.id_front_url, 'ID Front')}
                {renderDoc(viewDriver.id_back_url, 'ID Back')}
                {renderDoc(viewDriver.license_front_url, 'License Front')}
                {renderDoc(viewDriver.license_back_url, 'License Back')}
                {renderDoc(viewDriver.vehicle_license_front_url, 'Vehicle License Front')}
                {renderDoc(viewDriver.vehicle_license_back_url, 'Vehicle License Back')}
                {renderDoc(viewDriver.vehicle_front_url, 'Vehicle Front')}
                {renderDoc(viewDriver.vehicle_back_url, 'Vehicle Back')}
                {renderDoc(viewDriver.vehicle_right_url, 'Vehicle Right')}
                {renderDoc(viewDriver.vehicle_left_url, 'Vehicle Left')}
              </div>

              <DialogFooter className="justify-between">
                <Button variant="outline" onClick={() => setViewDriver(null)}>
                  Close
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteLoading}
                  onClick={() => viewDriver && handleDeleteDriver(viewDriver.id)}
                >
                  {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Delete Driver
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
