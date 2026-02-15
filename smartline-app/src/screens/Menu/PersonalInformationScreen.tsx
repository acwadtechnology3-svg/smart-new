import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Image, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Mail, Smartphone, Camera, Lock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { apiRequest } from '../../services/backend';
import { Colors } from '../../constants/Colors';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { StatusBar } from 'expo-status-bar';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';
import { Text as ThemedText } from '../../components/ui/Text';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function PersonalInformationScreen() {
    const navigation = useNavigation();
    const { t, isRTL } = useLanguage();
    const { colors, spacing, radius, shadow } = useTheme();

    // RTL Layout Logic
    const isSimulating = isRTL !== I18nManager.isRTL;
    const flexDirection = isSimulating ? 'row-reverse' : 'row';
    const textAlign = isRTL ? 'right' : 'left';
    const iconMargin = isRTL ? { marginLeft: 12, marginRight: 0 } : { marginRight: 12, marginLeft: 0 };

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // User Data
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [photo, setPhoto] = useState<string | null>(null);
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    // Initial data to check for changes
    const [initialData, setInitialData] = useState({ fullName: '', email: '', photo: '' });

    useEffect(() => {
        loadUserProfile(true);
    }, []);

    const loadUserProfile = async (withLoading = false) => {
        try {
            // 1. Load from cache first
            const session = await AsyncStorage.getItem('userSession');
            if (session) {
                const { user: cachedUser } = JSON.parse(session);
                if (cachedUser) {
                    setUserId(cachedUser.id);
                    setFullName(cachedUser.full_name || '');
                    setEmail(cachedUser.email || '');
                    setPhone(cachedUser.phone || '');
                    setPhoto(cachedUser.profile_photo_url || null);
                    setInitialData({
                        fullName: cachedUser.full_name || '',
                        email: cachedUser.email || '',
                        photo: cachedUser.profile_photo_url || ''
                    });
                }
            }

            if (withLoading && !userId) setLoading(true);

            // 2. Fetch latest from server
            const data = await apiRequest<{ user: any }>('/users/me');
            if (data.user) {
                setUserId(data.user.id);
                setFullName(data.user.full_name || '');
                setEmail(data.user.email || '');
                setPhone(data.user.phone || '');
                setPhoto(data.user.profile_photo_url || null);

                setInitialData({
                    fullName: data.user.full_name || '',
                    email: data.user.email || '',
                    photo: data.user.profile_photo_url || ''
                });

                // Update cache
                if (session) {
                    const parsed = JSON.parse(session);
                    await AsyncStorage.setItem('userSession', JSON.stringify({ ...parsed, user: data.user }));
                }
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
            // Don't alert if we already have cached data, but maybe toast if it's a persistent failure
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant permission to access your photos.');
                return;
            }

            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setPhoto(result.assets[0].uri);
                setPhotoBase64(result.assets[0].base64 || null);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadProfilePhoto = async (uri: string, pickedBase64?: string | null): Promise<string> => {
        try {
            if (!userId) throw new Error('User ID not found');

            let arrayBuffer: ArrayBuffer;
            if (pickedBase64) {
                arrayBuffer = decode(pickedBase64);
            } else {
                try {
                    const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
                    arrayBuffer = decode(base64);
                } catch (_fileReadError) {
                    // Some providers can return URIs that fail with base64 reader; fallback to fetch/blob.
                    const response = await fetch(uri);
                    const blob = await response.blob();
                    arrayBuffer = await blob.arrayBuffer();
                }
            }

            // Use 'avatars' bucket, usually public
            // If it fails, fallback might be needed or ensure bucket exists
            const path = `${userId}/profile_${Date.now()}.jpg`;

            const { data, error } = await supabase.storage
                .from('avatars') // Trying standard public bucket
                .upload(path, arrayBuffer, {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (error) {
                // Fallback to 'driver-documents' if 'avatars' fails (temporary hack)
                // In production, ensure correct bucket exists
                console.warn("Avatars upload failed, trying driver-documents as fallback", error);
                const { data: data2, error: error2 } = await supabase.storage
                    .from('driver-documents')
                    .upload(path, arrayBuffer, {
                        contentType: 'image/jpeg',
                        upsert: true,
                    });

                if (error2) throw error2;

                const { data: publicUrlData } = supabase.storage
                    .from('driver-documents')
                    .getPublicUrl(path);
                return publicUrlData.publicUrl;
            }

            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(path);

            return publicUrlData.publicUrl;
        } catch (e) {
            console.error("Upload failed", e);
            throw e;
        }
    };

    const handleSave = async () => {
        if (!fullName.trim() || !email.trim()) {
            Alert.alert("Required", "Please fill in all fields");
            return;
        }

        const hasChanges = fullName !== initialData.fullName || email !== initialData.email || photo !== initialData.photo;

        if (!hasChanges) {
            navigation.goBack();
            return;
        }

        try {
            setSaving(true);
            Keyboard.dismiss();

            let profilePhotoUrl = initialData.photo;

            // If photo changed and it's a local URI (not http), upload it
            if (photo && photo !== initialData.photo && !photo.startsWith('http')) {
                profilePhotoUrl = await uploadProfilePhoto(photo, photoBase64);
            }

            const response = await apiRequest<{ success: boolean; user: any }>('/users/profile', {
                method: 'PUT',
                body: JSON.stringify({
                    full_name: fullName,
                    email: email,
                    profile_photo_url: profilePhotoUrl
                })
            });

            const savedUser = response?.user;
            const resolvedPhoto = savedUser?.profile_photo_url || profilePhotoUrl || null;

            const session = await AsyncStorage.getItem('userSession');
            if (session && savedUser) {
                const parsed = JSON.parse(session);
                await AsyncStorage.setItem('userSession', JSON.stringify({
                    ...parsed,
                    user: {
                        ...parsed.user,
                        ...savedUser
                    }
                }));
            }

            Alert.alert("Success", "Profile updated successfully");
            setInitialData({ fullName, email, photo: resolvedPhoto || '' });
            setPhoto(resolvedPhoto); // Update local state with remote URL
            setPhotoBase64(null);

        } catch (error: any) {
            console.error('Failed to update profile:', error);
            Alert.alert("Error", error.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
            <StatusBar style="dark" />
            <View style={[styles.header, { flexDirection, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <ArrowLeft size={24} color={colors.textPrimary} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
                </TouchableOpacity>
                <ThemedText variant="h2" style={{ color: colors.textPrimary }}>{t('personalInfo') || 'Personal Information'}</ThemedText>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <ThemedText variant="body" weight="bold" style={{ color: hasUnsavedChanges(fullName, email, photo, initialData) ? colors.primary : colors.textMuted }}>{t('save') || 'Save'}</ThemedText>
                    )}
                </TouchableOpacity>
            </View>

            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                        {/* Profile Photo - Now Touchable */}
                        <View style={styles.photoContainer}>
                            <TouchableOpacity onPress={pickImage} activeOpacity={0.7} style={[styles.avatarWrapper, { shadowColor: colors.shadow }]}>
                                {photo ? (
                                    <Image source={{ uri: photo }} style={[styles.avatar, { borderColor: colors.surface }]} />
                                ) : (
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceHighlight, borderColor: colors.surface }]}>
                                        <User size={40} color={colors.textSecondary} />
                                    </View>
                                )}
                                <View style={[styles.editBadge, { backgroundColor: colors.primary, borderColor: colors.surface, shadowColor: colors.shadow }]}>
                                    <Camera size={14} color={colors.textOnPrimary} />
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={pickImage}>
                                <ThemedText variant="body" weight="bold" style={{ color: colors.primary }}>Change Photo</ThemedText>
                            </TouchableOpacity>
                        </View>

                        {/* Form Fields */}
                        <View style={styles.inputGroup}>
                            <Input
                                label={t('fullName') || 'Full Name'}
                                placeholder={t('enterFullName') || "Enter your full name"}
                                value={fullName}
                                onChangeText={setFullName}
                                leftIcon={User}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Input
                                label={t('emailAddress') || 'Email Address'}
                                placeholder={t('enterEmail') || "Enter your email"}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                leftIcon={Mail}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Input
                                label={t('phoneNumber') || 'Phone Number'}
                                value={phone}
                                editable={false}
                                placeholder={t('phoneNumber') || "Phone number"}
                                leftIcon={Smartphone}
                                rightIcon={LockIcon as any}
                                style={{ color: colors.textSecondary, backgroundColor: colors.surfaceHighlight }}
                            />
                            <ThemedText variant="caption" style={{ color: colors.textSecondary, marginTop: 6, textAlign }}>{t('contactSupport') || 'Contact support to change phone number'}</ThemedText>
                        </View>

                    </ScrollView>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

function hasUnsavedChanges(fullName: string, email: string, photo: string | null, initialData: any) {
    return fullName !== initialData.fullName || email !== initialData.email || photo !== initialData.photo;
}

const LockIcon = ({ color }: { color?: string }) => (
    <View style={{ paddingHorizontal: 4 }}>
        <ThemedText variant="caption" style={{ fontSize: 10, color: color || '#9CA3AF' }}>LOCKED</ThemedText>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 20,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 4 },
    content: { padding: 24, paddingBottom: 50 },

    photoContainer: { alignItems: 'center', marginBottom: 32 },
    avatarWrapper: {
        width: 110, height: 110,
        marginBottom: 12, position: 'relative',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 4
    },
    avatar: { width: '100%', height: '100%', borderRadius: 55, borderWidth: 3 },
    avatarPlaceholder: {
        width: '100%', height: '100%', borderRadius: 55,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 3
    },
    editBadge: {
        position: 'absolute', bottom: 4, right: 4,
        width: 32, height: 32, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2, shadowRadius: 3, elevation: 3
    },

    inputGroup: { marginBottom: 20 },
});
