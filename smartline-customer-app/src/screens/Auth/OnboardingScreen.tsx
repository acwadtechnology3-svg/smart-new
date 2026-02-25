import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Animated,
    TouchableOpacity,
    SafeAreaView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MapPin, CarFront, ShieldCheck, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Quick & Easy Booking',
        description: 'Set your pickup location and request a ride with just a few taps.',
        icon: (props: any) => <MapPin {...props} />,
        colors: ['#4F46E5', '#818CF8'] as const,
    },
    {
        id: '2',
        title: 'Track Your Ride Live',
        description: 'See your driver arriving in real-time and share your trip status.',
        icon: (props: any) => <CarFront {...props} />,
        colors: ['#4338CA', '#A5B4FC'] as const,
    },
    {
        id: '3',
        title: 'Safe & Secure',
        description: 'Every trip is monitored, and every driver is vetted for your peace of mind.',
        icon: (props: any) => <ShieldCheck {...props} />,
        colors: ['#3730A3', '#C7D2FE'] as const,
    },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen() {
    const navigation = useNavigation<NavigationProp>();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const slidesRef = useRef<any>(null);
    const buttonBounce = useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(buttonBounce, {
                    toValue: 1.05,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(buttonBounce, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const viewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const handleNext = async () => {
        if (currentIndex < SLIDES.length - 1) {
            slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            await AsyncStorage.setItem('hasOnboarded', 'true');
            navigation.replace('PhoneInput');
        }
    };

    const handleSkip = async () => {
        await AsyncStorage.setItem('hasOnboarded', 'true');
        navigation.replace('PhoneInput');
    };

    return (
        <View style={styles.container}>
            <Animated.FlatList
                ref={slidesRef}
                data={SLIDES}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                bounces={false}
                keyExtractor={(item) => item.id}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                    useNativeDriver: false,
                })}
                onViewableItemsChanged={viewableItemsChanged}
                viewabilityConfig={viewConfig}
                renderItem={({ item, index }) => {
                    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

                    const scale = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.8, 1, 0.8],
                        extrapolate: 'clamp',
                    });

                    const opacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0, 1, 0],
                        extrapolate: 'clamp',
                    });

                    return (
                        <View style={styles.slide}>
                            <View style={styles.iconContainer}>
                                <LinearGradient colors={item.colors} style={styles.gradientCircle}>
                                    <Animated.View style={{ transform: [{ scale }], opacity }}>
                                        <item.icon color="#fff" size={80} strokeWidth={1.5} />
                                    </Animated.View>
                                </LinearGradient>
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={styles.title}>{item.title}</Text>
                                <Text style={styles.description}>{item.description}</Text>
                            </View>
                        </View>
                    );
                }}
            />

            <SafeAreaView style={styles.bottomContainer}>
                <View style={styles.paginationConfig}>
                    {SLIDES.map((_, i) => {
                        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                        const dotWidth = scrollX.interpolate({
                            inputRange,
                            outputRange: [10, 24, 10],
                            extrapolate: 'clamp',
                        });
                        const opacity = scrollX.interpolate({
                            inputRange,
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: 'clamp',
                        });
                        return <Animated.View key={i.toString()} style={[styles.dot, { width: dotWidth, opacity }]} />;
                    })}
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity onPress={handleSkip}>
                        <Text style={styles.skipButton}>Skip</Text>
                    </TouchableOpacity>
                    <Animated.View style={{ transform: [{ scale: buttonBounce }] }}>
                        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                            <LinearGradient
                                colors={SLIDES[currentIndex].colors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.nextGradientButton}
                            >
                                <Text style={styles.nextButtonText}>{currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
                                <ArrowRight color="#fff" size={20} />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    slide: {
        width,
        alignItems: 'center',
        paddingTop: height * 0.15,
    },
    iconContainer: {
        width: 250,
        height: 250,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradientCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 10,
    },
    textContainer: {
        flex: 1,
        paddingHorizontal: 40,
        marginTop: 40,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.textPrimary,
        marginBottom: 16,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.background,
    },
    paginationConfig: {
        flexDirection: 'row',
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
        marginHorizontal: 4,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingBottom: 40,
        paddingTop: 10,
    },
    skipButton: {
        color: Colors.textSecondary,
        fontSize: 16,
        fontWeight: '600',
    },
    nextButton: {
        overflow: 'hidden',
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
    },
    nextGradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 30,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginRight: 8,
    },
});
