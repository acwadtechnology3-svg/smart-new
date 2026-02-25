import { z } from 'zod';

// ===== Common Schemas =====

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const phoneSchema = z
  .string()
  .refine(
    (phone) => /^(\+20|0)?1\d{9}$/.test(phone),
    'Phone must be Egyptian format: +201XXXXXXXXX or 01XXXXXXXXX'
  );

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters');

export const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90, 'Invalid latitude'),
  lng: z.number().min(-180).max(180, 'Invalid longitude'),
});

export const priceSchema = z
  .number()
  .positive('Price must be positive')
  .max(10000, 'Price cannot exceed 10000');

export const roleSchema = z.enum(['customer', 'driver', 'admin']);

export const tripStatusSchema = z.enum([
  'requested',
  'accepted',
  'arrived',
  'started',
  'completed',
  'cancelled',
]);

export const paymentMethodSchema = z.enum(['cash', 'wallet', 'card']);

export const vehicleTypeSchema = z.enum(['saver', 'comfort', 'vip', 'scooter', 'taxi']);

// ===== Authentication Schemas =====

export const checkPhoneSchema = z.object({
  phone: phoneSchema,
});

export const signupSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
  role: roleSchema,
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email').optional(),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Password is required'),
});

// ===== OTP Schemas =====

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(4, 'OTP code must be 4 digits'),
});

export const resetPasswordSchema = z.object({
  phone: phoneSchema,
  newPassword: passwordSchema,
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ===== Trip Schemas =====

export const createTripSchema = z.object({
  customer_id: uuidSchema,
  pickup_lat: z.number().min(-90).max(90),
  pickup_lng: z.number().min(-180).max(180),
  dest_lat: z.number().min(-90).max(90),
  dest_lng: z.number().min(-180).max(180),
  pickup_address: z.string().min(1, 'Pickup address is required').max(500),
  dest_address: z.string().min(1, 'Destination address is required').max(500),
  price: priceSchema,
  distance: z.number().positive('Distance must be positive').max(1000, 'Distance too large'),
  duration: z.number().positive('Duration must be positive').max(1440, 'Duration too large'), // Max 24 hours
  car_type: vehicleTypeSchema,
  payment_method: paymentMethodSchema,
});

export const updateTripStatusSchema = z.object({
  tripId: uuidSchema,
  status: tripStatusSchema,
});

export const acceptOfferSchema = z.object({
  tripId: uuidSchema,
  offerId: uuidSchema,
  driverId: uuidSchema,
  finalPrice: priceSchema,
});

// ===== Payment Schemas =====

export const depositInitSchema = z.object({
  userId: uuidSchema,
  amount: z.number().positive('Amount must be positive').max(100000, 'Amount too large'),
});

export const withdrawRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive').max(100000, 'Amount too large'),
  method: z.string().min(1, 'Payment method is required'),
  accountNumber: z.string().min(1, 'Account number is required').max(100),
});

export const withdrawManageSchema = z.object({
  requestId: uuidSchema,
  action: z.enum(['approve', 'reject']),
  adminNote: z.string().max(500).optional(),
});

// ===== Location Schemas =====

export const locationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).nullable().optional(),
  speed: z.number().min(0).max(200).nullable().optional(), // km/h
  accuracy: z.number().positive().optional(), // meters
  timestamp: z.string().datetime().optional(),
});

export const nearbyDriversSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().positive().max(50).default(5), // km
  vehicleType: vehicleTypeSchema.optional(),
});

// ===== Driver Schemas =====

export const driverRegistrationSchema = z.object({
  national_id: z.string().min(1, 'National ID is required'),
  city: z.string().min(1, 'City is required'),
  vehicle_type: vehicleTypeSchema,
  vehicle_model: z.string().min(1, 'Vehicle model is required'),
  vehicle_plate: z.string().min(1, 'Vehicle plate is required'),
});

export const updateDriverStatusSchema = z.object({
  isOnline: z.boolean(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

// ===== Dashboard Auth Schemas =====

export const dashboardRoleSchema = z.enum(['super_admin', 'admin', 'manager', 'viewer']);

export const dashboardLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const dashboardRegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1, 'Full name is required').max(100),
  role: dashboardRoleSchema.default('viewer'),
});

export const dashboardUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  role: dashboardRoleSchema.optional(),
  is_active: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export const passwordChangeSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
});

export const passwordResetSchema = z.object({
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
});

export const initSuperAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1, 'Full name is required').max(100),
});

// Type exports for dashboard auth
export type DashboardLoginInput = z.infer<typeof dashboardLoginSchema>;
export type DashboardRegisterInput = z.infer<typeof dashboardRegisterSchema>;
export type DashboardUpdateInput = z.infer<typeof dashboardUpdateSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type InitSuperAdminInput = z.infer<typeof initSuperAdminSchema>;

// Type exports for use in controllers
export type CheckPhoneInput = z.infer<typeof checkPhoneSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripStatusInput = z.infer<typeof updateTripStatusSchema>;
export type AcceptOfferInput = z.infer<typeof acceptOfferSchema>;
export type DepositInitInput = z.infer<typeof depositInitSchema>;
export type WithdrawRequestInput = z.infer<typeof withdrawRequestSchema>;
export type WithdrawManageInput = z.infer<typeof withdrawManageSchema>;
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;
export type NearbyDriversInput = z.infer<typeof nearbyDriversSchema>;
export type DriverRegistrationInput = z.infer<typeof driverRegistrationSchema>;
export type UpdateDriverStatusInput = z.infer<typeof updateDriverStatusSchema>;
