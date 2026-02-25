export type RootStackParamList = {
    SplashScreen: undefined;
    Onboarding: undefined;
    PhoneInput: undefined;
    Password: { phone: string };
    Signup: { phone: string };
    DriverHome: undefined;
    DriverSignup: { phone: string };
    DriverVehicle: { phone: string; name: string; nationalId: string; city: string };
    DriverProfilePhoto: { phone: string; name: string; nationalId: string; city: string; vehicleType: string; vehicleModel: string; vehicleYear?: string; vehiclePlate: string; vehicleColor?: string; isTravelCaptain?: boolean };
    DriverDocuments: { phone: string; name: string; nationalId: string; city: string; vehicleType: string; vehicleModel: string; vehiclePlate: string; profilePhoto: string; isTravelCaptain?: boolean };
    DriverWaiting: undefined;
    OTPVerification: { phone: string; purpose?: 'signup' | 'reset-password' };
    ResetPassword: { phone: string };
    Help: undefined;
    Messages: undefined;
    Chat: { driverName: string; tripId?: string; role?: 'customer' | 'driver' };
    Safety: { tripId?: string };
    Settings: undefined;
    PersonalInformation: undefined;
    InviteFriends: undefined;
    Profile: undefined;
    Scan: undefined;
    Appearance: undefined;

    // Driver Routes
    DriverHistory: undefined;
    DriverEarnings: undefined;
    DriverMyVehicle: undefined;
    DriverSupport: undefined;
    DriverActiveTrip: { tripId: string };
    DriverWallet: undefined;
    DriverChangeVehicle: undefined;
    SupportChat: { ticketId?: string; subject?: string };
};
