import { DashboardLayout } from '@/components/layout/DashboardLayout';
import AdminTripHistoryDashboard from './AdminTripHistoryDashboard';

export default function Trips() {
  return (
    <DashboardLayout title="Trips Management">
      <AdminTripHistoryDashboard />
    </DashboardLayout>
  );
}
