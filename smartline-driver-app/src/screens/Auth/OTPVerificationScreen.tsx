import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useTheme } from '../../theme/useTheme';

type OTPVerificationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'OTPVerification'>;
type OTPVerificationScreenRouteProp = RouteProp<RootStackParamList, 'OTPVerification'>;

import { useLanguage } from '../../context/LanguageContext';

export default function OTPVerificationScreen() {
    const navigation = useNavigation<OTPVerificationScreenNavigationProp>();
    const route = useRoute<OTPVerificationScreenRouteProp>();
    const { phone } = route.params;
    const { t, isRTL } = useLanguage();
    const { colors } = useTheme();

    const [otp, setOtp] = useState(['', '', '', '']);
    const [timer, setTimer] = useState(60);
    const [loading, setLoading] = useState(false);

    // Refs for input fields to manage focus
    const inputRefs = useRef<Array<TextInput | null>>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Auto-focus first input on mount
    useEffect(() => {
        if (inputRefs.current[0]) {
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, []);

    const handleOtpChange = (value: string, index: number) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        // Handle backspace to focus previous input
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const code = otp.join('');
        if (code.length !== 4) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/auth/otp/verify`, { phone, code }, { timeout: 15000 });
            if (res.data.success) {
                if (route.params.purpose === 'reset-password') {
                    navigation.replace('ResetPassword', { phone });
                } else {
                    navigation.replace('Signup', { phone });
                }
            }
        } catch (err: any) {
            const msg = err.response?.data?.error;
            if (msg === 'INVALID_CODE') {
                Alert.alert(t('error'), t('invalidCode') || 'Invalid verification code. Please try again.');
            } else if (msg === 'TOO_MANY_ATTEMPTS') {
                Alert.alert(t('error'), err.response?.data?.message || 'Too many failed attempts. Please request a new code after 15 minutes.');
            } else {
                Alert.alert(t('error'), t('genericError') || 'Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (timer > 0) return;
        try {
            const res = await axios.post(`${API_URL}/auth/otp/send`, { phone }, { timeout: 15000 });
            const retryAfter = res.data?.retryAfter || 60;
            setTimer(retryAfter);
            setOtp(['', '', '', '']);
        } catch (err: any) {
            const errorCode = err?.response?.data?.error;
            if (errorCode === 'OTP_COOLDOWN') {
                const retryAfter = err.response?.data?.retryAfter || 60;
                setTimer(retryAfter);
            } else {
                Alert.alert(t('error'), t('genericError') || 'Failed to resend code.');
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.inner}>
                        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }]}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                                <ArrowLeft size={28} color={Colors.textPrimary} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.content}>
                            <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{t('verifyNumber')}</Text>
                            <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('enterCodeSentTo')} {phone}</Text>

                            <View style={[styles.otpContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                {otp.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => {
                                            inputRefs.current[index] = ref;
                                        }}
                                        style={[
                                            styles.otpInput,
                                            digit ? styles.otpInputFilled : null,
                                            { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }
                                        ]}
                                        value={digit}
                                        onChangeText={(text) => handleOtpChange(text, index)}
                                        onKeyPress={(e) => handleKeyPress(e, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        textAlign="center"
                                        selectTextOnFocus
                                    />
                                ))}
                            </View>

                            <TouchableOpacity disabled={timer > 0} onPress={handleResend}>
                                <Text style={[styles.resendText, timer === 0 && styles.resendTextActive]}>
                                    {timer > 0 ? `${t('resendCode')}\n${t('availableIn')} 0:${timer.toString().padStart(2, '0')}` : t('resendCode')}
                                </Text>
                            </TouchableOpacity>

                            <View style={{ flex: 1 }} />

                            <TouchableOpacity
                                style={[styles.button, (otp.join('').length !== 4 || loading) ? styles.buttonDisabled : null]}
                                onPress={handleVerify}
                                disabled={otp.join('').length !== 4 || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>{t('verify')}</Text>
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
    inner: { flex: 1 },
    header: { padding: 16 },
    content: { flex: 1, padding: 24 },
    title: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 32 },
    otpContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, gap: 16 },
    otpInput: { flex: 1, height: 60, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#F3F4F6', fontSize: 24, color: Colors.textPrimary },
    otpInputFilled: { borderColor: Colors.primary, borderWidth: 2 },
    resendText: { textAlign: 'center', color: Colors.textSecondary, marginBottom: 32, lineHeight: 22 },
    resendTextActive: { color: Colors.primary, fontWeight: '600' },
    button: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 16 },
    buttonDisabled: { opacity: 0.5, backgroundColor: '#F3F4F6' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
