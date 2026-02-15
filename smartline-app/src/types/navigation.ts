export type RootStackParamList = {
    SplashScreen: undefined;
    RoleSelection: undefined;
    PhoneInput: { role: 'customer' | 'driver' };
    Password: { phone: string; role: 'customer' | 'driver' };
    Signup: { phone: string; role: 'customer' | 'driver' };
    CustomerHome: undefined;
    DriverHome: undefined;
    DriverSignup: { phone: string };
    DriverVehicle: { phone: string; name: string; nationalId: string; city: string };
    DriverProfilePhoto: { phone: string; name: string; nationalId: string; city: string; vehicleType: string; vehicleModel: string; vehicleYear?: string; vehiclePlate: string; vehicleColor?: string; isTravelCaptain?: boolean };
    DriverDocuments: { phone: string; name: string; nationalId: string; city: string; vehicleType: string; vehicleModel: string; vehiclePlate: string; profilePhoto: string; isTravelCaptain?: boolean };
    DriverWaiting: undefined;
    OTPVerification: { phone: string; role: 'customer' | 'driver'; purpose?: 'signup' | 'reset-password' };
    ResetPassword: { phone: string };
    SearchLocation: {
        selectedAddress?: string;
        selectedCoordinates?: { latitude: number; longitude: number };
        selectionId?: number;
        field?: 'pickup' | 'destination';
        returnScreen?: keyof RootStackParamList; // Allows returning to any screen by name
        currentPickup?: any;
        currentDest?: any;
        saveAs?: 'home' | 'work' | 'favorite';
    } | undefined;
    LocationPicker: { field: 'pickup' | 'destination'; returnScreen?: keyof RootStackParamList; currentPickup?: any; currentDest?: any; saveAs?: 'home' | 'work' | 'favorite' };
    TripOptions: { pickup: string; destination: string; destinationCoordinates?: [number, number]; preselectedRide?: string; pickupCoordinates?: [number, number]; autoRequest?: boolean };
    SearchingDriver: { tripId: string };
    DriverFound: { tripId: string; driver?: any };
    OnTrip: { tripId: string };
    TripComplete: { tripId: string };
    TravelRequest: { pickup?: any; destination?: any };
    Wallet: undefined;
    MyTrips: undefined;
    Discounts: undefined;
    Help: undefined;
    CustomerSupportChat: { ticketId?: string; subject?: string };
    Messages: undefined;
    Chat: { driverName: string; tripId?: string; role?: 'customer' | 'driver' };
    Safety: { tripId?: string };
    Settings: undefined;
    LocationPreferences: {
        selectedAddress?: string;
        selectedCoordinates?: { latitude: number; longitude: number };
        selectionId?: number;
        saveAs?: 'home' | 'work' | 'favorite';
    } | undefined;
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
