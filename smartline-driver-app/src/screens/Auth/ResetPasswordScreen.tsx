import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { apiRequest } from '../../services/backend';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';

type ResetPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;
type ResetPasswordScreenRouteProp = RouteProp<RootStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen() {
    const navigation = useNavigation<ResetPasswordScreenNavigationProp>();
    const route = useRoute<ResetPasswordScreenRouteProp>();
    const { phone } = route.params;
    const { t, isRTL } = useLanguage();
    const { colors } = useTheme();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleReset = async () => {
        if (!password || !confirmPassword) {
            Alert.alert(t('error'), t('pleaseFillAllFields'));
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert(t('error'), t('passwordsDoNotMatch'));
            return;
        }

        if (password.length < 6) {
            Alert.alert(t('error'), t('passwordTooShort')); // Ensure this key exists or use generic
            return;
        }

        setLoading(true);

        try {
            await apiRequest('/auth/reset-password', {
                method: 'POST',
                auth: false,
                body: JSON.stringify({
                    phone,
                    newPassword: password
                })
            });

            setLoading(false);
            Alert.alert(t('success'), t('passwordResetSuccess'), [
                {
                    text: t('ok'),
                    onPress: () => navigation.reset({
                        index: 0,
                        routes: [{ name: 'PhoneInput' }]
                    })
                }
            ]);

        } catch (err: any) {
            console.error('[ResetPassword] Error:', err);
            setLoading(false);
            const errorCode = err?.message;
            if (errorCode === 'OTP_REQUIRED') {
                Alert.alert(t('error'), t('otpRequired') || 'Phone verification required. Please verify your phone first.', [
                    { text: t('ok'), onPress: () => navigation.goBack() }
                ]);
            } else {
                Alert.alert(t('error'), t('genericError'));
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.container}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.inner}>
                        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }]}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                                <ArrowLeft size={24} color={Colors.textPrimary} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.content}>
                            <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t('resetPassword')}</Text>
                            <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('enterPasswordFor')} {phone}</Text>

                            <View style={styles.form}>
                                <View style={styles.inputContainer}>
                                    <View style={[styles.passwordContainer, { flexDirection: isRTL ? 'row-reverse' : 'row', borderColor: colors.border, backgroundColor: colors.surface }]}>
                                        <TextInput
                                            style={[styles.input, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}
                                            placeholder={t('newPassword')}
                                            secureTextEntry={!showPassword}
                                            value={password}
                                            onChangeText={setPassword}
                                            placeholderTextColor={colors.textMuted}
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                            {showPassword ? <EyeOff size={20} color={Colors.textSecondary} /> : <Eye size={20} color={Colors.textSecondary} />}
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.inputContainer}>
                                    <View style={[styles.passwordContainer, { flexDirection: isRTL ? 'row-reverse' : 'row', borderColor: colors.border, backgroundColor: colors.surface }]}>
                                        <TextInput
                                            style={[styles.input, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}
                                            placeholder={t('confirmPassword')}
                                            secureTextEntry={!showPassword}
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.button, loading && styles.buttonDisabled]}
                                    onPress={handleReset}
                                    disabled={loading}
                                >
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('resetPassword')}</Text>}
                                </TouchableOpacity>
                            </View>
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
    content: { padding: 24, paddingTop: 0 },
    title: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 32 },
    form: { gap: 16 },
    inputContainer: { marginBottom: 16 },
    passwordContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 8,
        borderWidth: 1, borderColor: Colors.border,
        paddingHorizontal: 12
    },
    input: { flex: 1, paddingVertical: 12, fontSize: 16, color: Colors.textPrimary },
    eyeIcon: { padding: 8 },
    button: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 16 },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
