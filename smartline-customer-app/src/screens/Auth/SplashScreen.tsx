import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MapPin, Car } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkVersionPolicy, setRecommendedNotice, clearRecommendedNotice } from '../../services/versionGateService';

type SplashScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SplashScreen'>;

const { width } = Dimensions.get('window');

export default function SplashScreen() {
    const navigation = useNavigation<SplashScreenNavigationProp>();

    // Animation Values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.3)).current;
    const carSlideAnim = useRef(new Animated.Value(-width)).current; // Car starts off-screen left
    const textSlideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        // Animation Sequence (1200ms approx)
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.timing(carSlideAnim, {
                toValue: 0,
                duration: 1200,
                easing: Easing.out(Easing.exp),
                useNativeDriver: true,
            }),
            Animated.timing(textSlideAnim, {
                toValue: 0,
                duration: 1000,
                easing: Easing.out(Easing.exp),
                useNativeDriver: true,
            })
        ]).start();

        const initializeApp = async () => {
            const minDelayPromise = new Promise(resolve => setTimeout(resolve, 1500));

            // Check session in parallel
            const sessionLoadPromise = async () => {
                try {
                    const [hasOnboarded, sessionStr] = await Promise.all([
                        AsyncStorage.getItem('hasOnboarded'),
                        AsyncStorage.getItem('userSession')
                    ]);

                    if (!hasOnboarded) return 'Onboarding';
                    if (!sessionStr) return 'PhoneInput';

                    const { user } = JSON.parse(sessionStr);
                    if (user) {
                        return 'CustomerHome';
                    }
                    return 'PhoneInput';
                } catch (e) {
                    return 'Onboarding';
                }
            };

            // Wait for all async steps
            const [_, nextRoute, versionPolicy] = await Promise.all([
                minDelayPromise,
                sessionLoadPromise(),
                checkVersionPolicy(),
            ]);

            if (versionPolicy.action === 'force_update') {
                await clearRecommendedNotice();
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'ForceUpdate', params: { message: versionPolicy.message, storeUrl: versionPolicy.store_url } }],
                });
                return;
            }

            if (versionPolicy.action === 'recommend_update') {
                await setRecommendedNotice({ message: versionPolicy.message, storeUrl: versionPolicy.store_url });
            } else {
                await clearRecommendedNotice();
            }

            if (nextRoute === 'CustomerHome') {
                navigation.reset({ index: 0, routes: [{ name: 'CustomerHome' }] });
            } else if (nextRoute === 'Onboarding') {
                navigation.replace('Onboarding');
            } else {
                navigation.replace('PhoneInput');
            }
        };

        initializeApp();
    }, [navigation]);

    return (
        <LinearGradient
            colors={['#1E1B4B', '#4F46E5', '#6366F1']}
            style={styles.container}
        >
            {/* Background Circles for decoration */}
            <View style={[styles.circle, styles.circle1]} />
            <View style={[styles.circle, styles.circle2]} />

            <View style={styles.content}>
                <Animated.View style={[styles.iconContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                    <View style={styles.pinWrapper}>
                        <MapPin size={80} color="#fff" fill={Colors.primary} strokeWidth={1} />
                    </View>
                </Animated.View>

                {/* Animated Car sliding in */}
                <Animated.View style={{ transform: [{ translateX: carSlideAnim }] }}>
                    <Car size={40} color="#fff" style={styles.carIcon} />
                </Animated.View>

                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: textSlideAnim }] }}>
                    <Text style={styles.logoText}>SmartLine</Text>
                    <Text style={styles.tagline}>Your Ride, Simplified.</Text>
                </Animated.View>
            </View>

            <View style={styles.footer}>
                <ActivityIndicatorDot />
            </View>
        </LinearGradient>
    );
}

// Simple pulsing dot component
const ActivityIndicatorDot = () => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
            ])
        ).start();
    }, []);

    return <Animated.View style={[styles.loadingDot, { opacity }]} />;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    circle: {
        position: 'absolute',
        borderRadius: 1000,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    circle1: { width: width * 1.5, height: width * 1.5, top: -width * 0.5, left: -width * 0.2 },
    circle2: { width: width, height: width, bottom: -width * 0.2, right: -width * 0.2 },
    content: {
        alignItems: 'center',
        zIndex: 10,
    },
    iconContainer: {
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    pinWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    carIcon: {
        marginBottom: 20,
    },
    logoText: {
        fontSize: 48,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 2,
        marginBottom: 8,
        textAlign: 'center',
    },
    tagline: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.8)',
        letterSpacing: 1,
        textAlign: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 60,
    },
    loadingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#fff',
    },
});
