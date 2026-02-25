import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useTheme } from '../theme/useTheme';
import { TextInput } from 'react-native';

import SplashScreen from '../screens/Auth/SplashScreen';
import OnboardingScreen from '../screens/Auth/OnboardingScreen';
import PhoneInputScreen from '../screens/Auth/PhoneInputScreen';
import OTPVerificationScreen from '../screens/Auth/OTPVerificationScreen';
import PasswordScreen from '../screens/Auth/PasswordScreen';
import ResetPasswordScreen from '../screens/Auth/ResetPasswordScreen';
import SignupScreen from '../screens/Auth/SignupScreen';
import DriverSignupScreen from '../screens/Auth/DriverSignupScreen';
import DriverVehicleScreen from '../screens/Auth/DriverVehicleScreen';
import DriverProfilePhotoScreen from '../screens/Auth/DriverProfilePhotoScreen';
import DriverDocumentsScreen from '../screens/Auth/DriverDocumentsScreen';
import DriverWaitingScreen from '../screens/Auth/DriverWaitingScreen';

import DriverHomeScreen from '../screens/Driver/DriverHomeScreen';
import DriverHistoryScreen from '../screens/Driver/DriverHistoryScreen';
import DriverEarningsScreen from '../screens/Driver/DriverEarningsScreen';
import DriverMyVehicleScreen from '../screens/Driver/DriverMyVehicleScreen';
import DriverSupportScreen from '../screens/Driver/DriverSupportScreen';
import DriverActiveTripScreen from '../screens/Driver/DriverActiveTripScreen';
import DriverWalletScreen from '../screens/Driver/DriverWalletScreen';
import DriverChangeVehicleScreen from '../screens/Driver/DriverChangeVehicleScreen';
import SupportChatScreen from '../screens/Driver/SupportChatScreen';
import ChatScreen from '../screens/Driver/ChatScreen';

import HelpScreen from '../screens/Menu/HelpScreen';
import MessagesScreen from '../screens/Menu/MessagesScreen';
import SafetyScreen from '../screens/Menu/SafetyScreen';
import SettingsScreen from '../screens/Menu/SettingsScreen';
import InviteFriendsScreen from '../screens/Menu/InviteFriendsScreen';
import ScanScreen from '../screens/Menu/ScanScreen';
import PersonalInformationScreen from '../screens/Menu/PersonalInformationScreen';
import { tripStatusService } from '../services/tripStatusService';
import { AppearanceScreen } from '../screens/Settings/AppearanceScreen';


const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    const navigationRef = React.useRef<any>(null);
    const { colors, resolvedScheme } = useTheme();

    // Apply theme-aware defaults to all TextInputs
    useEffect(() => {
        const ti = TextInput as any;
        const existing = ti.defaultProps || {};
        ti.defaultProps = {
            ...existing,
            placeholderTextColor: colors.textMuted,
            style: [existing.style, { color: colors.textPrimary }],
        };
    }, [colors.textMuted, colors.textPrimary]);

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
                <Stack.Screen name="Chat" component={ChatScreen} />

                {/* Menu Screens */}
                <Stack.Screen name="Help" component={HelpScreen} />
                <Stack.Screen name="Messages" component={MessagesScreen} />
                <Stack.Screen name="Safety" component={SafetyScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
                <Stack.Screen name="InviteFriends" component={InviteFriendsScreen} />
                <Stack.Screen name="Scan" component={ScanScreen} />

                {/* Settings Screens */}
                <Stack.Screen name="Appearance" component={AppearanceScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
