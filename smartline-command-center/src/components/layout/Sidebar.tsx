import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Car,
  MapPin,
  Users,
  Wallet,
  DollarSign,
  Ticket,
  HeadphonesIcon,
  Settings,
  LogOut,
  UserPlus,
  ChevronLeft,
  ShieldAlert,
  Shield,
  FileText,
  Megaphone,
  Zap,
  Bell,
  Image,
  Navigation,
  Activity,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth, type DashboardRole } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  page: string;
}

const allNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, page: 'dashboard' },
  { name: 'Live Map', href: '/live-map', icon: Navigation, page: 'dashboard' },
  { name: 'Driver Requests', href: '/driver-requests', icon: UserPlus, page: 'driver_requests' },
  { name: 'Vehicle Change Requests', href: '/vehicle-change-requests', icon: FileText, page: 'vehicle_change_requests' },
  { name: 'Withdrawal Requests', href: '/withdrawal-requests', icon: DollarSign, page: 'withdrawal_requests' },
  { name: 'Safety & SOS', href: '/safety', icon: ShieldAlert, page: 'safety' },
  { name: 'Drivers', href: '/drivers', icon: Car, page: 'drivers' },
  { name: 'Trips', href: '/trips', icon: MapPin, page: 'trips' },
  { name: 'Customers', href: '/customers', icon: Users, page: 'customers' },
  { name: 'Wallet & Payments', href: '/wallet', icon: Wallet, page: 'wallet' },
  { name: 'Promo Codes', href: '/promos', icon: Ticket, page: 'promos' },
  { name: 'Referrals & Rewards', href: '/referrals', icon: Gift, page: 'promos' },
  { name: 'App Popups', href: '/popups', icon: Bell, page: 'popups' },
  { name: 'Promo Banners', href: '/promo-banners', icon: Image, page: 'promo_banners' },
  { name: 'Surge Zones', href: '/surge-zones', icon: Zap, page: 'surge_zones' },
  { name: 'Support', href: '/support', icon: HeadphonesIcon, page: 'support' },
  { name: 'Settings', href: '/settings', icon: Settings, page: 'settings' },
  { name: 'System Monitoring', href: '/monitoring', icon: Activity, page: 'settings' }, // Visible to admins with settings access
];

const getRoleColor = (role: DashboardRole) => {
  switch (role) {
    case 'super_admin': return 'bg-red-500';
    case 'admin': return 'bg-orange-500';
    case 'manager': return 'bg-blue-500';
    case 'viewer': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
};

const getRoleLabel = (role: DashboardRole) => {
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'admin': return 'Admin';
    case 'manager': return 'Manager';
    case 'viewer': return 'Viewer';
    default: return role;
  }
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, canViewPage } = useAuth();

  // Filter navigation based on user permissions
  const navigation = allNavigation.filter(item => canViewPage(item.page));

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className={cn(
          'flex h-16 items-center border-b border-sidebar-border px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">SL</span>
              </div>
              <span className="font-semibold text-sidebar-foreground">SmartLine</span>
            </div>
          )}
          {collapsed && (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SL</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                  collapsed && 'justify-center px-2'
                )}
              >
                <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}

          {/* Members link - only for super_admin */}
          {user?.role === 'super_admin' && (
            <NavLink
              to="/members"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                location.pathname === '/members'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <Shield className={cn('h-5 w-5 flex-shrink-0', location.pathname === '/members' && 'text-primary')} />
              {!collapsed && <span>Team Members</span>}
            </NavLink>
          )}
        </nav>

        {/* User Info */}
        {user && !collapsed && (
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium', getRoleColor(user.role))}>
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user.full_name}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{getRoleLabel(user.role)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Collapse Button & Logout */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              collapsed ? 'justify-center' : 'justify-start gap-3'
            )}
          >
            <ChevronLeft className={cn('h-5 w-5 transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && <span>Collapse</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={cn(
              'w-full text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive',
              collapsed ? 'justify-center' : 'justify-start gap-3'
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Logout</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}
