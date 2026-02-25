import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Animated } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { ArrowLeft, Gift, ChevronDown } from 'lucide-react-native';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useTheme } from '../../theme/useTheme';

type SignupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;
type SignupScreenRouteProp = RouteProp<RootStackParamList, 'Signup'>;

import { useLanguage } from '../../context/LanguageContext';

export default function SignupScreen() {
    const navigation = useNavigation<SignupScreenNavigationProp>();
    const route = useRoute<SignupScreenRouteProp>();
    const { phone } = route.params;
    const { t, isRTL } = useLanguage();
    const { colors } = useTheme();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [showReferral, setShowReferral] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Enforce OTP-first: if phone is missing, return to phone input
        if (!phone) {
            Alert.alert(t('error'), t('pleaseFillAllFields'));
            navigation.replace('PhoneInput');
        }
    }, [phone, navigation, t]);

    const isValidName = (value: string) => {
        // Allow letters (including Arabic), spaces, hyphen, apostrophe. No digits/specials.
        const nameRegex = /^(?=.{2,100}$)[A-Za-z\u0600-\u06FF\s'-]+$/;
        return nameRegex.test(value.trim());
    };

    const isValidEmail = (value: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        return emailRegex.test(value.trim());
    };

    const handleSignup = async () => {
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert(t('error'), t('pleaseFillAllFields'));
            return;
        }

        if (!isValidName(name)) {
            Alert.alert(t('error'), t('invalidName') || 'Name must only contain letters and spaces.');
            return;
        }

        if (!isValidEmail(email)) {
            Alert.alert(t('error'), t('invalidEmail') || 'Please enter a valid email address.');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert(t('error'), t('passwordsDoNotMatch'));
            return;
        }

        setLoading(true);

        try {
            // Sign up via Backend API
            const payload: any = {
                phone: phone,
                password: password,
                email: email.trim(),
                name: name.trim(),
                role: 'driver'
            };
            // Include referral code if entered
            const trimmedCode = referralCode.trim().toUpperCase();
            if (trimmedCode) {
                payload.referralCode = trimmedCode;
            }
            const response = await axios.post(`${API_URL}/auth/signup`, payload);

            // Save Session
            const { user, token } = response.data;
            await AsyncStorage.setItem('userSession', JSON.stringify({ token, user }));

            // Success
            setLoading(false);
            proceedToNextScreen();

        } catch (err: any) {
            console.error('[Signup] Error:', err);
            setLoading(false);

            let message = t('signupFailed');
            if (err.message && (err.message.includes('Network Error') || err.message.includes('fetch failed'))) {
                message = t('connectionError');
            }

            Alert.alert(t('error'), message);
        }
    };

    const proceedToNextScreen = () => {
        setLoading(false);
        navigation.navigate('DriverSignup', { phone: phone });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                    <ArrowLeft size={28} color={Colors.textPrimary} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t('createAccount')}</Text>
                        <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('signUpAs')} {t('driver')}</Text>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{t('fullName')}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                                placeholder="John Doe"
                                value={name}
                                onChangeText={setName}
                                placeholderTextColor={Colors.textSecondary}
                                autoComplete="off"
                                textContentType="none"
                                importantForAutofill="no"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{t('email')}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                                placeholder="john@example.com"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholderTextColor={Colors.textSecondary}
                                autoComplete="off"
                                textContentType="none"
                                importantForAutofill="no"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{t('password')}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                                placeholder="******"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                                placeholderTextColor={Colors.textSecondary}
                                autoComplete="off"
                                textContentType="none"
                                importantForAutofill="no"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{t('confirmPassword')}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                                placeholder="******"
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholderTextColor={Colors.textSecondary}
                                autoComplete="off"
                                textContentType="none"
                                importantForAutofill="no"
                                autoCorrect={false}
                            />
                        </View>

                        {/* Referral Code Section */}
                        <TouchableOpacity
                            style={styles.referralToggle}
                            onPress={() => setShowReferral(!showReferral)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.referralToggleInner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                <Gift size={18} color={Colors.primary} />
                                <Text style={styles.referralToggleText}>{t('haveReferralCode')}</Text>
                                <ChevronDown
                                    size={16}
                                    color={Colors.textSecondary}
                                    style={{ transform: [{ rotate: showReferral ? '180deg' : '0deg' }] }}
                                />
                            </View>
                        </TouchableOpacity>

                        {showReferral && (
                            <View style={styles.referralInputContainer}>
                                <TextInput
                                    style={[styles.referralInput, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary, borderColor: colors.primary + '40' }]}
                                    placeholder={t('referralCodePlaceholder')}
                                    value={referralCode}
                                    onChangeText={setReferralCode}
                                    autoCapitalize="characters"
                                    placeholderTextColor={Colors.textSecondary}
                                    autoComplete="off"
                                    textContentType="none"
                                    importantForAutofill="no"
                                    autoCorrect={false}
                                    maxLength={10}
                                />
                                <Text style={[styles.referralHint, { textAlign: isRTL ? 'right' : 'left' }]}>{t('referralCodeHint')}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSignup}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>{t('createAccountBtn')}</Text>
                            )}
                        </TouchableOpacity>

                        {/* Spacer for bottom scrolling */}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { padding: 16 },
    content: { padding: 24, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 32 },
    inputContainer: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 16, fontSize: 16, backgroundColor: Colors.surface, color: Colors.textPrimary },
    referralToggle: { marginTop: 8, paddingVertical: 12 },
    referralToggleInner: { alignItems: 'center', gap: 8 },
    referralToggleText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
    referralInputContainer: { marginTop: 4, marginBottom: 4 },
    referralInput: {
        borderWidth: 2,
        borderColor: Colors.primary + '40',
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        fontWeight: '700',
        backgroundColor: Colors.primary + '08',
        color: Colors.textPrimary,
        letterSpacing: 2,
        textAlign: 'center',
    },
    referralHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, marginLeft: 4 },
    button: { backgroundColor: Colors.primary, paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 24 },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
