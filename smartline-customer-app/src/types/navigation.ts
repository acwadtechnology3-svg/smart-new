export type RootStackParamList = {
    SplashScreen: undefined;
    Onboarding: undefined;
    PhoneInput: undefined;
    Password: { phone: string };
    Signup: { phone: string };
    CustomerHome: undefined;
    OTPVerification: { phone: string; purpose?: 'signup' | 'reset-password' };
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
    ForceUpdate: { message?: string; storeUrl?: string };
};
