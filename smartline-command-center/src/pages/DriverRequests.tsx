import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getDriverImageUrl } from "@/lib/media";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, FileText, Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Driver {
    id: string;
    national_id: string;
    city: string;
    vehicle_type: string;
    vehicle_model: string;
    vehicle_plate: string; // Changed from license_plate
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    service_tier?: string; // Optional for now

    profile_photo_url: string;
    id_front_url: string;
    id_back_url: string;
    license_front_url: string;
    license_back_url: string;
    vehicle_license_front_url?: string;
    vehicle_license_back_url?: string;
    vehicle_front_url: string;
    vehicle_back_url: string;
    vehicle_right_url: string;
    vehicle_left_url: string;

    // Joined user data
    users?: {
        full_name: string;
        phone: string;
    };
}

const DriverRequests = () => {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
    const [selectedTier, setSelectedTier] = useState<string>('saver');

    useEffect(() => {
        fetchPendingDrivers();
    }, []);

    const fetchPendingDrivers = async () => {
        setLoading(true);
        try {
            // Fetch drivers with user information
            // drivers.id = users.id (same UUID for both tables)
            const { data, error } = await supabase
                .from('drivers')
                .select(`
          *,
          users!inner (
            full_name,
            phone
          )
        `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            console.log("Fetched Drivers:", data); // Debugging
            setDrivers(data as any || []);
        } catch (error) {
            console.error('Error fetching drivers:', error);
            toast.error("Failed to fetch pending drivers");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (driverId: string) => {
        try {
            const { error } = await supabase
                .from('drivers')
                .update({
                    status: 'approved',
                    service_tier: selectedTier
                })
                .eq('id', driverId);

            if (error) throw error;

            toast.success(`Driver approved as ${selectedTier.toUpperCase()}`);
            setDrivers(drivers.filter(d => d.id !== driverId));
            setSelectedDriver(null);
        } catch (error) {
            console.error('Error approving driver:', error);
            toast.error("Failed to approve driver");
        }
    };

    const handleReject = async (driverId: string) => {
        try {
            const { error } = await supabase
                .from('drivers')
                .update({ status: 'rejected' })
                .eq('id', driverId);

            if (error) throw error;

            toast.success("Driver rejected");
            setDrivers(drivers.filter(d => d.id !== driverId));
            setSelectedDriver(null);
        } catch (error) {
            console.error('Error rejecting driver:', error);
            toast.error("Failed to reject driver");
        }
    };

    const renderImage = (url: string | null, label: string) => (
        <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <div className="border rounded-md overflow-hidden bg-gray-50 aspect-video flex items-center justify-center">
                {url ? (
                    <img src={getDriverImageUrl(url)} alt={label} className="w-full h-full object-contain" />
                ) : (
                    <span className="text-xs text-gray-400">No Image</span>
                )}
            </div>
        </div>
    );

    const openReview = (driver: Driver) => {
        setSelectedDriver(driver);
        // Default tier based on vehicle type
        if (driver.vehicle_type === 'motorcycle') setSelectedTier('scooter');
        else if (driver.vehicle_type === 'taxi') setSelectedTier('taxi');
        else setSelectedTier('saver');
    };

    return (
        <DashboardLayout title="Driver Requests">
            <div className="space-y-6">
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={fetchPendingDrivers}>
                        Refresh
                    </Button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center p-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : drivers.length === 0 ? (
                    <div className="text-center p-10 bg-white rounded-lg border shadow-sm">
                        <p className="text-gray-500">No pending driver requests found.</p>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {drivers.map((driver) => (
                            <Card key={driver.id} className="overflow-hidden">
                                <div className="aspect-video bg-gray-100 relative">
                                    {driver.profile_photo_url ? (
                                        <img
                                            src={getDriverImageUrl(driver.profile_photo_url)}
                                            alt={driver.users?.full_name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400">
                                            No Photo
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium uppercase">
                                        {driver.status}
                                    </div>
                                </div>

                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">{driver.users?.full_name || 'Unnamed Driver'}</CardTitle>
                                    <p className="text-sm text-gray-500">{driver.users?.phone || 'No Phone'}</p>
                                </CardHeader>

                                <CardContent className="pb-4">
                                    <div className="space-y-2 text-sm mb-4">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Vehicle:</span>
                                            <span className="font-medium">{driver.vehicle_model}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Type:</span>
                                            <span className="font-medium">{driver.vehicle_type}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Plate:</span>
                                            <span className="font-medium">{driver.vehicle_plate}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">City:</span>
                                            <span className="font-medium">{driver.city || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Dialog open={selectedDriver?.id === driver.id} onOpenChange={(open) => !open && setSelectedDriver(null)}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="w-full" onClick={() => openReview(driver)}>
                                                    <FileText className="mr-2 h-4 w-4" /> Review
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle>Driver Application Review</DialogTitle>
                                                    <DialogDescription>
                                                        Review details and documents for {driver.users?.full_name}
                                                    </DialogDescription>
                                                </DialogHeader>

                                                <div className="grid md:grid-cols-2 gap-6 py-4">
                                                    <div className="space-y-6">
                                                        {/* Personal Info */}
                                                        <div>
                                                            <h3 className="font-semibold text-lg border-b pb-2 mb-3">Personal Info</h3>
                                                            <div className="grid grid-cols-2 gap-y-2 text-sm">
                                                                <span className="text-gray-500">Full Name:</span>
                                                                <span className="font-medium">{driver.users?.full_name}</span>

                                                                <span className="text-gray-500">Phone:</span>
                                                                <span>{driver.users?.phone}</span>

                                                                <span className="text-gray-500">National ID:</span>
                                                                <span>{driver.national_id}</span>

                                                                <span className="text-gray-500">City:</span>
                                                                <span>{driver.city}</span>
                                                            </div>
                                                        </div>

                                                        {/* Vehicle Info */}
                                                        <div>
                                                            <h3 className="font-semibold text-lg border-b pb-2 mb-3">Vehicle Info</h3>
                                                            <div className="grid grid-cols-2 gap-y-2 text-sm">
                                                                <span className="text-gray-500">Type:</span>
                                                                <span>{driver.vehicle_type}</span>

                                                                <span className="text-gray-500">Model:</span>
                                                                <span>{driver.vehicle_model}</span>

                                                                <span className="text-gray-500">Plate:</span>
                                                                <span className="font-medium">{driver.vehicle_plate}</span>
                                                            </div>
                                                        </div>

                                                        {/* Service Tier Selection */}
                                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                                            <h3 className="font-semibold text-blue-900 mb-2">Assign Category</h3>
                                                            <Select value={selectedTier} onValueChange={setSelectedTier}>
                                                                <SelectTrigger className="w-full bg-white">
                                                                    <SelectValue placeholder="Select Tier" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="saver">Saver (Economy)</SelectItem>
                                                                    <SelectItem value="comfort">Comfort</SelectItem>
                                                                    <SelectItem value="vip">VIP</SelectItem>
                                                                    <SelectItem value="scooter">Scooter</SelectItem>
                                                                    <SelectItem value="taxi">Taxi</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* Profile Photo */}
                                                        <div>
                                                            <h3 className="font-semibold text-lg border-b pb-2 mb-3">Profile Photo</h3>
                                                            <div className="w-40 h-40 border rounded-full overflow-hidden bg-gray-100 mx-auto">
                                                                {driver.profile_photo_url ? (
                                                                    <img src={getDriverImageUrl(driver.profile_photo_url)} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="flex items-center justify-center h-full text-gray-400">No Photo</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <h3 className="font-semibold text-lg border-b pb-2">Documents</h3>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {renderImage(driver.id_front_url, "ID Front")}
                                                            {renderImage(driver.id_back_url, "ID Back")}
                                                            {renderImage(driver.license_front_url, "License Front")}
                                                            {renderImage(driver.license_back_url, "License Back")}
                                                            {driver.vehicle_license_front_url && renderImage(driver.vehicle_license_front_url, "Vehicle License Front")}
                                                            {driver.vehicle_license_back_url && renderImage(driver.vehicle_license_back_url, "Vehicle License Back")}
                                                            {renderImage(driver.vehicle_front_url, "Vehicle Front")}
                                                            {renderImage(driver.vehicle_back_url, "Vehicle Back")}
                                                            {renderImage(driver.vehicle_right_url, "Vehicle Right")}
                                                            {renderImage(driver.vehicle_left_url, "Vehicle Left")}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-end gap-3 pt-4 border-t">
                                                    <Button variant="outline" onClick={() => setSelectedDriver(null)}>Cancel</Button>
                                                    <Button variant="destructive" onClick={() => handleReject(driver.id)}>
                                                        <X className="mr-2 h-4 w-4" /> Reject
                                                    </Button>
                                                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(driver.id)}>
                                                        <Check className="mr-2 h-4 w-4" /> Approve
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default DriverRequests;
