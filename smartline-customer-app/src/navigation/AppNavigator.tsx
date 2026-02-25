import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useTheme } from '../theme/useTheme';

import SplashScreen from '../screens/Auth/SplashScreen';
import OnboardingScreen from '../screens/Auth/OnboardingScreen';
import PhoneInputScreen from '../screens/Auth/PhoneInputScreen';
import OTPVerificationScreen from '../screens/Auth/OTPVerificationScreen';
import PasswordScreen from '../screens/Auth/PasswordScreen';
import SignupScreen from '../screens/Auth/SignupScreen';
import ResetPasswordScreen from '../screens/Auth/ResetPasswordScreen';
import ForceUpdateScreen from '../screens/Auth/ForceUpdateScreen';

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

import HelpScreen from '../screens/Menu/HelpScreen';
import MessagesScreen from '../screens/Menu/MessagesScreen';
import SafetyScreen from '../screens/Menu/SafetyScreen';
import SettingsScreen from '../screens/Menu/SettingsScreen';
import InviteFriendsScreen from '../screens/Menu/InviteFriendsScreen';
import ScanScreen from '../screens/Menu/ScanScreen';
import PersonalInformationScreen from '../screens/Menu/PersonalInformationScreen';
import LocationPreferencesScreen from '../screens/Menu/LocationPreferencesScreen';
import { AppearanceScreen } from '../screens/Settings/AppearanceScreen';
import { tripStatusService } from '../services/tripStatusService';


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
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
                <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
                <Stack.Screen name="Password" component={PasswordScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
                <Stack.Screen name="ForceUpdate" component={ForceUpdateScreen} />

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
