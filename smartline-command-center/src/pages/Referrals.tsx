import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Users, Gift, TrendingUp, Search, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.8.103:3000/api';

// Types
interface ReferralProgram {
    id: string;
    name: string;
    user_type: 'rider' | 'driver';
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
    rewards_config: any;
    created_at: string;
}

interface ReferralStat {
    id: string;
    referrer_id: string;
    referee_id: string;
    status: string;
    created_at: string;
    referrer?: {
        phone: string;
        email?: string;
    };
    referee?: {
        phone: string;
        email?: string;
    };
}

interface StatsSummary {
    total: number;
    pending: number;
    completed: number;
    total_rewards: number;
}

export default function Referrals() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const queryClient = useQueryClient();
    const { token } = useAuth(); // Get auth token

    // Axios instance with auth header
    const api = axios.create({
        baseURL: API_URL,
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    // Fetch Programs
    const { data: programs, isLoading: isLoadingPrograms } = useQuery({
        queryKey: ['referralPrograms'],
        queryFn: async () => {
            const { data } = await api.get('/referrals/programs');
            return data.programs as ReferralProgram[];
        },
        enabled: !!token
    });

    // Fetch Stats
    const { data: statsData, isLoading: isLoadingStats } = useQuery({
        queryKey: ['referralStats'],
        queryFn: async () => {
            const { data } = await api.get('/referrals/admin-stats');
            return data as {
                stats: ReferralStat[],
                summary: StatsSummary
            };
        },
        enabled: !!token
    });

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async (newProgram: any) => {
            const { data } = await api.post('/referrals/programs', newProgram);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['referralPrograms'] });
            setIsCreateOpen(false);
            toast.success("Program created successfully");
        },
        onError: (err: any) => {
            console.error(err);
            toast.error("Failed to create program: " + (err.response?.data?.message || err.message));
        }
    });

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);

        const newProgram = {
            name: formData.get('name'),
            user_type: formData.get('user_type'),
            start_date: formData.get('start_date') || null,
            end_date: formData.get('end_date') || null,
            is_active: true,
            // Basic rewards config - in a real app this would be a dynamic form
            rewards_config: {
                type: 'fixed_amount',
                amount: parseFloat(formData.get('reward_amount') as string || '0'),
                min_trips: parseInt(formData.get('min_trips') as string || '1')
            }
        };

        createMutation.mutate(newProgram);
    };

    const summary = statsData?.summary || { total: 0, pending: 0, completed: 0, total_rewards: 0 };
    const referrals = statsData?.stats || [];

    return (
        <DashboardLayout title="Referrals & Rewards">
            <div className="flex flex-col gap-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
                        <p className="text-sm text-muted-foreground">Manage referral programs and track performance.</p>
                    </div>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" /> Create Program
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Create Referral Program</DialogTitle>
                                <DialogDescription>Setup a new referral campaign for riders or drivers.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateSubmit} className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Program Name</Label>
                                    <Input id="name" name="name" placeholder="Summer Promo" required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="user_type">Target Audience</Label>
                                    <Select name="user_type" defaultValue="rider">
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="rider">Riders</SelectItem>
                                            <SelectItem value="driver">Drivers</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="reward_amount">Reward (EGP)</Label>
                                        <Input id="reward_amount" name="reward_amount" type="number" min="0" defaultValue="50" required />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="min_trips">Trips Required</Label>
                                        <Input id="min_trips" name="min_trips" type="number" min="1" defaultValue="1" required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="start_date">Start Date</Label>
                                        <Input id="start_date" name="start_date" type="date" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="end_date">End Date</Label>
                                        <Input id="end_date" name="end_date" type="date" />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={createMutation.isPending}>
                                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Program
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.total}</div>
                            <p className="text-xs text-muted-foreground">{summary.completed} completed</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Rewards Issued</CardTitle>
                            <Gift className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">EGP {summary.total_rewards.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Total payout</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0}%
                            </div>
                            <p className="text-xs text-muted-foreground">Signups to completion</p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="programs" className="w-full">
                    <TabsList>
                        <TabsTrigger value="programs">Active Programs</TabsTrigger>
                        <TabsTrigger value="referrals">Referral History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="programs" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Programs</CardTitle>
                                <CardDescription>List of all referral campaigns.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Reward</TableHead>
                                            <TableHead>Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoadingPrograms ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-4">Loading...</TableCell>
                                            </TableRow>
                                        ) : programs?.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-4">No programs found.</TableCell>
                                            </TableRow>
                                        ) : (
                                            programs?.map((program) => (
                                                <TableRow key={program.id}>
                                                    <TableCell className="font-medium">{program.name}</TableCell>
                                                    <TableCell className="capitalize">{program.user_type}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={program.is_active ? "default" : "secondary"}>
                                                            {program.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {program.rewards_config?.amount ? `EGP ${program.rewards_config.amount}` : 'Custom'}
                                                    </TableCell>
                                                    <TableCell>{new Date(program.created_at).toLocaleDateString()}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="referrals" className="mt-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Referral Log</CardTitle>
                                        <CardDescription>Recent referral activity.</CardDescription>
                                    </div>
                                    <div className="flex w-full max-w-sm items-center space-x-2">
                                        <Input type="email" placeholder="Search..." />
                                        <Button type="submit" size="icon" variant="ghost"><Search className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Referrer</TableHead>
                                            <TableHead>Referee</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoadingStats ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-4">Loading stats...</TableCell>
                                            </TableRow>
                                        ) : referrals.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-4">No referrals found.</TableCell>
                                            </TableRow>
                                        ) : (
                                            referrals.map((ref) => (
                                                <TableRow key={ref.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span>{ref.referrer?.phone || 'Unknown'}</span>
                                                            <span className="text-xs text-muted-foreground">{ref.referrer?.email}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span>{ref.referee?.phone || 'Unknown'}</span>
                                                            <span className="text-xs text-muted-foreground">{ref.referee?.email}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="capitalize">{ref.status}</Badge>
                                                    </TableCell>
                                                    <TableCell>{new Date(ref.created_at).toLocaleDateString()}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
