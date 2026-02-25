import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, X } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { apiRequest } from '../../services/backend';
// @ts-ignore
import { readAsStringAsync } from 'expo-file-system/legacy';
import { useLanguage } from '../../context/LanguageContext';

type DriverDocumentsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DriverDocuments'>;
type DriverDocumentsScreenRouteProp = RouteProp<RootStackParamList, 'DriverDocuments'>;

export default function DriverDocumentsScreen() {
    const navigation = useNavigation<DriverDocumentsScreenNavigationProp>();
    const route = useRoute<DriverDocumentsScreenRouteProp>();
    const { t, isRTL } = useLanguage();

    // We expect profilePhoto to be passed from the previous screen (DriverProfilePhoto)
    // @ts-ignore 
    const { phone, name, nationalId, city, vehicleType, vehicleModel, vehiclePlate, profilePhoto, isTravelCaptain } = route.params;

    const [documents, setDocuments] = useState<{ [key: string]: string | null }>({
        idFront: null,
        idBack: null,
        licenseFront: null,
        licenseBack: null,
        vehicleLicenseFront: null,
        vehicleLicenseBack: null,
        vehicleFront: null,
        vehicleBack: null,
        vehicleRight: null,
        vehicleLeft: null,
    });
    const [loading, setLoading] = useState(false);

    // ... pickImage function ...

    const pickImage = async (key: string) => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false, // Documents usually full
            quality: 0.3,
            aspect: [4, 3],
        });

        if (!result.canceled) {
            setDocuments(prev => ({ ...prev, [key]: result.assets[0].uri }));
        }
    };

    const uploadToBackend = async (field: string, uri: string) => {
        const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
        const filename = uri.split('/').pop() || `${field}.jpg`;

        const response = await apiRequest<{ path: string }>(`/drivers/upload`, {
            method: 'POST',
            body: JSON.stringify({ base64, filename, field }),
        });

        return response.path; // relative path stored in DB
    };

    const handleSubmit = async () => {
        // Validation
        const missing = Object.keys(documents).filter(k => !documents[k]);
        if (missing.length > 0) {
            Alert.alert(t('error'), t('pleaseFillAllFields'));
            return;
        }

        setLoading(true);

        try {
            const sessionStr = await AsyncStorage.getItem('userSession');
            if (!sessionStr) throw new Error('No user found');
            const { user } = JSON.parse(sessionStr);
            const userId: string | undefined = user?.id;
            if (!userId) throw new Error('No user found');



            // 1. Prepare Upload Promises (Parallel)
            const uploadPromises: Promise<any>[] = [];

            // Helper to handle individual upload and result mapping
            // Returns [key, url]
            const handleUpload = async (key: string, uri: string | null): Promise<[string, string] | null> => {
                if (!uri) return null;
                if (uri.startsWith('http')) {
                    return [key, uri];
                }

                const extKey = key; // already snake_case with _url suffix
                const uploadedPath = await uploadToBackend(extKey, uri);
                return [key, uploadedPath];
            };

            // Add Profile Photo
            if (profilePhoto) {
                uploadPromises.push(handleUpload('profile_photo_url', profilePhoto));
            }

            // Add Documents
            Object.entries(documents).forEach(([key, uri]) => {
                if (uri) {
                    // Map local state key to API key suffix
                    // idFront -> id_front_url
                    // Convert camelCase to snake_case manually or map
                    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`) + '_url';
                    uploadPromises.push(handleUpload(snakeKey, uri));
                }
            });

            // Execute all
            const results = await Promise.all(uploadPromises);

            // Collect results
            const uploadedUrls: any = {};
            results.forEach(res => {
                if (res) {
                    uploadedUrls[res[0]] = res[1];
                }
            });

            // 3. Insert into Drivers Table (paths instead of URLs)
            await apiRequest('/drivers/register', {
                method: 'POST',
                body: JSON.stringify({
                    national_id: nationalId,
                    city: city,
                    vehicle_type: vehicleType,
                    vehicle_model: vehicleModel,
                    vehicle_plate: vehiclePlate,
                    profile_photo_url: uploadedUrls.profile_photo_url || null,
                    id_front_url: uploadedUrls.id_front_url,
                    id_back_url: uploadedUrls.id_back_url,
                    license_front_url: uploadedUrls.license_front_url,
                    license_back_url: uploadedUrls.license_back_url,
                    vehicle_license_front_url: uploadedUrls.vehicle_license_front_url,
                    vehicle_license_back_url: uploadedUrls.vehicle_license_back_url,
                    vehicle_front_url: uploadedUrls.vehicle_front_url,
                    vehicle_back_url: uploadedUrls.vehicle_back_url,
                    vehicle_left_url: uploadedUrls.vehicle_left_url,
                    vehicle_right_url: uploadedUrls.vehicle_right_url,
                    is_travel_captain_request: isTravelCaptain || false
                })
            });

            setLoading(false);
            navigation.navigate('DriverWaiting'); // Success!

        } catch (err: any) {
            setLoading(false);
            console.error('[DriverDocuments] Upload Error:', err);

            let message = t('genericError');
            if (err.message && (err.message.includes('Network Error') || err.message.includes('fetch failed'))) {
                message = t('connectionError');
            } else if (err.message === 'No user found') {
                message = t('authError');
            }

            Alert.alert(t('error'), message);
        }
    };

    const renderUploadBox = (key: string, label: string) => (
        <View style={styles.uploadBoxContainer}>
            <Text style={styles.boxLabel}>{label}</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(key)}>
                {documents[key] ? (
                    <>
                        <Image source={{ uri: documents[key]! }} style={styles.previewImage} />
                        <TouchableOpacity
                            style={styles.removeIcon}
                            onPress={() => setDocuments(prev => ({ ...prev, [key]: null }))}
                        >
                            <X size={16} color="#fff" />
                        </TouchableOpacity>
                    </>
                ) : (
                    <Camera size={32} color={Colors.textSecondary} />
                )}
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Legal Documents</Text>
                <Text style={styles.subtitle}>Step 4 of 4</Text>

                <Text style={styles.sectionTitle}>National ID</Text>
                <View style={styles.grid}>
                    {renderUploadBox('idFront', "Front Side")}
                    {renderUploadBox('idBack', "Back Side")}
                </View>

                <Text style={styles.sectionTitle}>Driver's License</Text>
                <View style={styles.grid}>
                    {renderUploadBox('licenseFront', "Front Side")}
                    {renderUploadBox('licenseBack', "Back Side")}
                </View>

                <Text style={styles.sectionTitle}>Vehicle License</Text>
                <View style={styles.grid}>
                    {renderUploadBox('vehicleLicenseFront', "Front Side")}
                    {renderUploadBox('vehicleLicenseBack', "Back Side")}
                </View>

                <Text style={styles.sectionTitle}>Vehicle Photos (4 Sides)</Text>
                <View style={styles.grid}>
                    {renderUploadBox('vehicleFront', "Front View")}
                    {renderUploadBox('vehicleBack', "Back View")}
                    {renderUploadBox('vehicleRight', "Right Side")}
                    {renderUploadBox('vehicleLeft', "Left Side")}
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit Application</Text>}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { padding: 16 },
    backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
    content: { padding: 24, paddingTop: 0 },
    title: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary, marginTop: 16, marginBottom: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
    uploadBoxContainer: { width: '48%', marginBottom: 16 },
    boxLabel: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
    uploadBox: { height: 110, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    previewImage: { width: '100%', height: '100%' },
    removeIcon: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 },
    button: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 32 },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
