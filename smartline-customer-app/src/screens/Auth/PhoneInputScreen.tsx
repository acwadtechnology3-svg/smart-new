import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Image as RNImage } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useTheme } from '../../theme/useTheme';

type PhoneInputScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PhoneInput'>;

import { useLanguage } from '../../context/LanguageContext';

export default function PhoneInputScreen() {
    const navigation = useNavigation<PhoneInputScreenNavigationProp>();
    const { t, isRTL } = useLanguage();
    const { colors } = useTheme();

    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    const handleContinue = async () => {
        if (!phone || phone.length < 10) {
            Alert.alert(t('error'), t('enterPhoneNumber')); // "Please enter valid..." -> reusing enterPhoneNumber or making new key? Let's treat as generic error for now or add key. Providing consistent feedback.
            return;
        }

        setLoading(true);
        const fullPhone = `+20${phone.replace(/^0+/, '')}`; // Ensure +20 format

        try {
            // Check if user exists via Backend API
            const response = await axios.post(`${API_URL}/auth/check-phone`, {
                phone: fullPhone
            }, { timeout: 10000 }); // 10s timeout

            setLoading(false);

            if (response.data.exists) {
                // User exists -> Password
                navigation.navigate('Password', { phone: fullPhone });
            } else {
                // New user -> Send OTP then navigate to verification
                try {
                    await axios.post(`${API_URL}/auth/otp/send`, { phone: fullPhone }, { timeout: 15000 });
                } catch (otpErr: any) {
                    console.warn('[PhoneInput] OTP send warning:', otpErr.message);
                }
                navigation.navigate('OTPVerification', { phone: fullPhone, purpose: 'signup' });
            }

        } catch (err: any) {
            console.error('[PhoneInput] Check Phone Error:', err);
            setLoading(false);

            let message = t('genericError');
            if (err.message && (err.message.includes('Network Error') || err.message.includes('fetch failed'))) {
                message = t('connectionError');
            }

            Alert.alert(t('error'), message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.keyboardAvoidingView}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.inner}>
                        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', minHeight: 60 }]}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={{ padding: 12, borderRadius: 20, backgroundColor: '#F3F4F6' }}
                            >
                                {isRTL ? (
                                    <ChevronRight size={32} color="#000000" />
                                ) : (
                                    <ChevronLeft size={32} color="#000000" />
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.content}>

                            <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t('enterPhoneNumber')}</Text>
                            <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('weWillSendCode')}</Text>

                            <View style={[styles.inputContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                <View style={[styles.prefixContainer, { backgroundColor: colors.surface2 }]}>
                                    <Text style={[styles.prefixText, { color: colors.textPrimary }]}>EG +20</Text>
                                </View>
                                <View style={[styles.inputWrapper, { borderColor: colors.primary, backgroundColor: colors.inputBg }]}>
                                    <TextInput
                                        style={[styles.input, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}
                                        placeholder="100 123 4567"
                                        keyboardType="phone-pad"
                                        value={phone}
                                        onChangeText={setPhone}
                                        maxLength={11}
                                        placeholderTextColor={colors.textMuted}
                                        autoComplete="off"
                                        textContentType="none"
                                        importantForAutofill="no"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>

                            <View style={styles.imageContainer}>
                                <RNImage
                                    source={require('../../assets/images/customer-phone.webp')}
                                    style={styles.headerImage}
                                    resizeMode="contain"
                                />
                            </View>



                            <TouchableOpacity
                                style={[styles.button, (!phone || loading) && styles.buttonDisabled]}
                                onPress={handleContinue}
                                disabled={loading || !phone}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>{t('continue')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    keyboardAvoidingView: { flex: 1 },
    inner: { flex: 1 },
    header: { padding: 16, paddingTop: 40 }, // 👽 02-02-2026: Increased top padding for status bar
    content: { flex: 1, padding: 24, justifyContent: 'flex-start' }, // Changed to flex-start + spacer
    title: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 32 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
    imageContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 24, width: '100%' },
    headerImage: { width: '80%', height: '80%' },
    prefixContainer: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    prefixText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
    inputWrapper: {
        flex: 1,
        height: 56,
        borderWidth: 1.5,
        borderColor: Colors.primary,
        borderRadius: 12,
        justifyContent: 'center',
        paddingHorizontal: 16,
        backgroundColor: '#F9FAFB'
    },
    input: {
        fontSize: 18,
        color: Colors.textPrimary,
        height: '100%',
        backgroundColor: 'transparent',
        textAlignVertical: 'center',
    },
    button: {
        width: '100%',
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16
    },
    buttonDisabled: {
        opacity: 0.5,
        backgroundColor: '#E5E7EB'
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
