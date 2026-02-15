import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useTheme } from '../theme/useTheme';

import SplashScreen from '../screens/Auth/SplashScreen';
import RoleSelectionScreen from '../screens/Auth/RoleSelectionScreen';
import PhoneInputScreen from '../screens/Auth/PhoneInputScreen';
import OTPVerificationScreen from '../screens/Auth/OTPVerificationScreen';
import PasswordScreen from '../screens/Auth/PasswordScreen';
import SignupScreen from '../screens/Auth/SignupScreen';
import DriverSignupScreen from '../screens/Auth/DriverSignupScreen';
import DriverVehicleScreen from '../screens/Auth/DriverVehicleScreen';
import DriverProfilePhotoScreen from '../screens/Auth/DriverProfilePhotoScreen';
import DriverDocumentsScreen from '../screens/Auth/DriverDocumentsScreen';
import DriverWaitingScreen from '../screens/Auth/DriverWaitingScreen';

import CustomerHomeScreen from '../screens/Customer/CustomerHomeScreen';
import SearchLocationScreen from '../screens/Customer/SearchLocationScreen';
import LocationPickerScreen from '../screens/Customer/LocationPickerScreen';
import TripOptionsScreen from '../screens/Customer/TripOptionsScreen';
import SearchingDriverScreen from '../screens/Customer/SearchingDriverScreen';
import DriverFoundScreen from '../screens/Customer/DriverFoundScreen';
import OnTripScreen from '../screens/Customer/OnTripScreen';
import TripCompleteScreen from '../screens/Customer/TripCompleteScreen';
import TravelRequestScreen from '../screens/Customer/TravelRequestScreen';
import WalletScreen from '../screens/Customer/WalletScreen';
import MyTripsScreen from '../screens/Customer/MyTripsScreen';
import DiscountsScreen from '../screens/Customer/DiscountsScreen';
import ChatScreen from '../screens/Customer/ChatScreen';
import CustomerSupportChatScreen from '../screens/Customer/SupportChatScreen';
import DriverHomeScreen from '../screens/Driver/DriverHomeScreen';

import HelpScreen from '../screens/Menu/HelpScreen';
import MessagesScreen from '../screens/Menu/MessagesScreen';
import SafetyScreen from '../screens/Menu/SafetyScreen';
import SettingsScreen from '../screens/Menu/SettingsScreen';
import InviteFriendsScreen from '../screens/Menu/InviteFriendsScreen';
import ScanScreen from '../screens/Menu/ScanScreen';
import DriverHistoryScreen from '../screens/Driver/DriverHistoryScreen';
import DriverEarningsScreen from '../screens/Driver/DriverEarningsScreen';
import DriverMyVehicleScreen from '../screens/Driver/DriverMyVehicleScreen';
import DriverSupportScreen from '../screens/Driver/DriverSupportScreen';
import DriverActiveTripScreen from '../screens/Driver/DriverActiveTripScreen';
import DriverWalletScreen from '../screens/Driver/DriverWalletScreen';
import DriverChangeVehicleScreen from '../screens/Driver/DriverChangeVehicleScreen';
import SupportChatScreen from '../screens/Driver/SupportChatScreen';
import PersonalInformationScreen from '../screens/Menu/PersonalInformationScreen';
import LocationPreferencesScreen from '../screens/Menu/LocationPreferencesScreen';
import { tripStatusService } from '../services/tripStatusService';
import { AppearanceScreen } from '../screens/Settings/AppearanceScreen';


const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    const navigationRef = React.useRef<any>(null);
    const { colors, resolvedScheme } = useTheme();

    React.useEffect(() => {
        if (navigationRef.current) {
            tripStatusService.setNavigationRef(navigationRef.current);
        }
    }, []);

    const NavigationTheme = {
        ...(resolvedScheme === 'dark' ? DarkTheme : DefaultTheme),
        colors: {
            ...(resolvedScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
            primary: colors.primary,
            background: colors.background,
            card: colors.surface,
            text: colors.textPrimary,
            border: colors.border,
            notification: colors.danger,
        },
    };

    return (
        <NavigationContainer ref={navigationRef} theme={NavigationTheme}>
            <Stack.Navigator
                initialRouteName="SplashScreen"
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: colors.background },
                }}
            >
                <Stack.Screen name="SplashScreen" component={SplashScreen} />
                <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
                <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
                <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
                <Stack.Screen name="Password" component={PasswordScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />

                <Stack.Screen name="DriverSignup" component={DriverSignupScreen} />
                <Stack.Screen name="DriverVehicle" component={DriverVehicleScreen} />
                <Stack.Screen name="DriverProfilePhoto" component={DriverProfilePhotoScreen} />
                <Stack.Screen name="DriverDocuments" component={DriverDocumentsScreen} />
                <Stack.Screen name="DriverWaiting" component={DriverWaitingScreen} />
                <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
                <Stack.Screen name="DriverHistory" component={DriverHistoryScreen} />
                <Stack.Screen name="DriverEarnings" component={DriverEarningsScreen} />
                <Stack.Screen name="DriverMyVehicle" component={DriverMyVehicleScreen} />
                <Stack.Screen name="DriverSupport" component={DriverSupportScreen} />
                <Stack.Screen name="DriverActiveTrip" component={DriverActiveTripScreen} />
                <Stack.Screen name="DriverWallet" component={DriverWalletScreen} />
                <Stack.Screen name="DriverChangeVehicle" component={DriverChangeVehicleScreen} />
                <Stack.Screen name="SupportChat" component={SupportChatScreen} />


                <Stack.Screen name="CustomerHome" component={CustomerHomeScreen} />
                <Stack.Screen name="SearchLocation" component={SearchLocationScreen} />
                <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
                <Stack.Screen name="TripOptions" component={TripOptionsScreen} />
                <Stack.Screen name="SearchingDriver" component={SearchingDriverScreen} />
                <Stack.Screen name="DriverFound" component={DriverFoundScreen} />
                <Stack.Screen name="OnTrip" component={OnTripScreen} />
                <Stack.Screen name="TripComplete" component={TripCompleteScreen} />
                <Stack.Screen name="TravelRequest" component={TravelRequestScreen} />
                <Stack.Screen name="Wallet" component={WalletScreen} />
                <Stack.Screen name="MyTrips" component={MyTripsScreen} />
                <Stack.Screen name="Discounts" component={DiscountsScreen} />

                {/* Menu Screens */}
                <Stack.Screen name="Help" component={HelpScreen} />
                <Stack.Screen name="CustomerSupportChat" component={CustomerSupportChatScreen} />
                <Stack.Screen name="Messages" component={MessagesScreen} />
                <Stack.Screen name="Safety" component={SafetyScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="LocationPreferences" component={LocationPreferencesScreen} />
                <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
                <Stack.Screen name="InviteFriends" component={InviteFriendsScreen} />
                <Stack.Screen name="Scan" component={ScanScreen} />
                <Stack.Screen name="Chat" component={ChatScreen} />

                {/* New Settings Screens */}
                <Stack.Screen name="Appearance" component={AppearanceScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
