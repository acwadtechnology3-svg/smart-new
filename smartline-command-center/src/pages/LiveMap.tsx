import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminLiveMapView } from '@/components/dashboard/AdminLiveMapView';

export default function LiveMap() {
    return (
        <DashboardLayout title="Live Driver Map">
            <AdminLiveMapView height="calc(100vh - 140px)" />
        </DashboardLayout>
    );
}
