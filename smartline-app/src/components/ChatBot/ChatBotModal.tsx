import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    Animated,
    PanResponder,
    Dimensions,
    Image
} from 'react-native';
import { X, Send, MapPin } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';
import { chatBotService, ChatMessage, QuickAction } from '../../services/chatBotService';
import MessageBubble from './MessageBubble';
import QuickActions from './QuickActions';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import MapPickerModal from './MapPickerModal';
import { LinearGradient } from 'expo-linear-gradient';

interface ChatBotModalProps {
    visible: boolean;
    onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAG_THRESHOLD = 100;

// Helper functions for trip calculations
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculatePrice(distanceKm: number, carType: string): number {
    const basePrices: Record<string, number> = {
        saver: 8,
        comfort: 12,
        vip: 20,
        taxi: 10
    };
    const perKmPrices: Record<string, number> = {
        saver: 3,
        comfort: 4,
        vip: 6,
        taxi: 3.5
    };
    const basePrice = basePrices[carType] || 10;
    const perKm = perKmPrices[carType] || 3.5;
    return Math.ceil(basePrice + (distanceKm * perKm));
}

function calculateDuration(distanceKm: number): number {
    const avgSpeedKmh = 30;
    const durationMinutes = (distanceKm / avgSpeedKmh) * 60;
    return Math.ceil(durationMinutes);
}

export default function ChatBotModal({ visible, onClose }: ChatBotModalProps) {
    const { t, isRTL } = useLanguage();
    const { colors, isDark } = useTheme();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [mapPickerTitle, setMapPickerTitle] = useState('');
    const [mapSelectionTarget, setMapSelectionTarget] = useState<'pickup' | 'destination' | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    // Animation values
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    // Pan responder for drag-to-dismiss
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > 5;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > DRAG_THRESHOLD) {
                    handleClose();
                } else {
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        damping: 20,
                        stiffness: 90,
                    }).start();
                }
            },
        })
    ).current;

    useEffect(() => {
        if (visible && messages.length === 0) {
            const greeting = chatBotService.getGreeting();
            setMessages([greeting]);
        }
    }, [visible]);

    useEffect(() => {
        if (visible) {
            animateIn();
        } else {
            translateY.setValue(SCREEN_HEIGHT);
            backdropOpacity.setValue(0);
        }
    }, [visible]);

    useEffect(() => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages]);

    useEffect(() => {
        console.log('💬 [ChatBotModal] Messages updated. Count:', messages.length);
        if (messages.length > 0) {
            console.log('💬 [ChatBotModal] Last message:', messages[messages.length - 1]);
        }
    }, [messages]);

    const animateIn = () => {
        translateY.setValue(SCREEN_HEIGHT);
        backdropOpacity.setValue(0);

        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                damping: 18,
                stiffness: 100,
                mass: 0.8,
                useNativeDriver: true,
            })
        ]).start();
    };

    const animateOut = (callback?: () => void) => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start(() => {
            if (callback) callback();
        });
    };

    const addMessage = (message: ChatMessage) => {
        setMessages(prev => [...prev, message]);
    };

    const addUserMessage = (text: string) => {
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text,
            timestamp: new Date()
        };
        addMessage(userMessage);
    };

    const handleCurrentLocation = async () => {
        setLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('تم رفض الإذن', 'نحتاج إلى إذن الموقع لاستخدام موقعك الحالي. يرجى اختيار الموقع على الخريطة بدلاً من ذلك.');
                setLoading(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const geocode = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });

            const address = geocode[0]
                ? `${geocode[0].street || ''}, ${geocode[0].city || ''}`
                : `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`;

            addUserMessage(t('useCurrentLocation') || 'استخدم موقعي الحالي');

            const botResponse = chatBotService.processPickupLocation(
                address,
                location.coords.latitude,
                location.coords.longitude
            );
            addMessage(botResponse);
        } catch (error) {
            Alert.alert('خطأ', 'لم نتمكن من الحصول على موقعك. يرجى المحاولة مرة أخرى أو اختيار الموقع على الخريطة.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOnMap = () => {
        const stage = chatBotService.getCurrentStage();
        const target: 'pickup' | 'destination' = stage === 'destination' ? 'destination' : 'pickup';

        setMapSelectionTarget(target);

        if (target === 'pickup') {
            setMapPickerTitle('اختر موقع الانطلاق');
            setShowMapPicker(true);
        } else {
            setMapPickerTitle('اختر الوجهة');
            setShowMapPicker(true);
        }
    };

    const handleMapLocationSelected = (address: string, lat: number, lng: number) => {
        setShowMapPicker(false);
        const stage = chatBotService.getCurrentStage();
        const target = mapSelectionTarget ?? (stage === 'destination' ? 'destination' : 'pickup');
        console.log('🗺️ [ChatBotModal] Map location selected:', { address, lat, lng, stage, target });

        if (target === 'pickup') {
            addUserMessage(address);
            const botResponse = chatBotService.processPickupLocation(address, lat, lng);
            console.log('📍 [ChatBotModal] Pickup response:', botResponse);
            addMessage(botResponse);
        } else {
            addUserMessage(address);
            const botResponse = chatBotService.processDestination(address, lat, lng);
            console.log('🎯 [ChatBotModal] Destination response:', botResponse);
            console.log('📝 [ChatBotModal] Response text length:', botResponse.text.length);
            addMessage(botResponse);
        }

        setMapSelectionTarget(null);
    };

    const handleCarTypeSelection = (carType: string) => {
        const carNames: Record<string, string> = {
            saver: 'موفر',
            comfort: 'مريح',
            vip: 'في آي بي',
            taxi: 'تاكسي'
        };

        addUserMessage(carNames[carType]);
        const botResponse = chatBotService.processCarType(carType);
        addMessage(botResponse);
    };

    const handleConfirmBooking = () => {
        const bookingData = chatBotService.getBookingData();

        if (!bookingData.pickup || !bookingData.destination || !bookingData.carType) {
            Alert.alert('خطأ', 'معلومات الحجز غير مكتملة');
            return;
        }

        onClose();
        chatBotService.resetConversation();
        setMessages([]);

        navigation.navigate('TripOptions', {
            pickup: bookingData.pickup.address,
            destination: bookingData.destination.address,
            pickupCoordinates: [bookingData.pickup.lng, bookingData.pickup.lat],
            destinationCoordinates: [bookingData.destination.lng, bookingData.destination.lat],
            preselectedRide: bookingData.carType,
            autoRequest: true
        });
    };

    const handleActionPress = (action: QuickAction) => {
        switch (action.action) {
            case 'current_location':
                handleCurrentLocation();
                break;
            case 'select_map':
                handleSelectOnMap();
                break;
            case 'car_type':
                if (action.data) {
                    handleCarTypeSelection(action.data);
                }
                break;
            case 'confirm':
                handleConfirmBooking();
                break;
            case 'cancel':
                handleClose();
                break;
        }
    };

    const handleSendMessage = () => {
        if (!inputText.trim()) return;

        const stage = chatBotService.getCurrentStage();
        addUserMessage(inputText);

        if (stage === 'destination') {
            const botResponse = chatBotService.processDestination(inputText, 0, 0);
            addMessage(botResponse);
        }

        setInputText('');
    };

    const handleClose = () => {
        animateOut(() => {
            chatBotService.resetConversation();
            setMessages([]);
            setShowMapPicker(false);
            setMapSelectionTarget(null);
            onClose();
        });
    };

    const lastMessage = messages[messages.length - 1];
    const heroGradientColors: [string, string] = isDark ? ['#0F172A', '#111827'] : ['#DBEAFE', '#FFFFFF'];
    const sendGradientColors: [string, string] = isDark ? ['#1D4ED8', colors.primary] : ['#2563EB', colors.primary];

    return (
        <>
            <Modal
                visible={visible}
                transparent
                animationType="none"
                onRequestClose={handleClose}
                statusBarTranslucent
            >
                <View style={styles.modalContainer}>
                    <Animated.View
                        style={[
                            styles.backdrop,
                            { opacity: backdropOpacity }
                        ]}
                    >
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            activeOpacity={1}
                            onPress={handleClose}
                        />
                    </Animated.View>

                    <KeyboardAvoidingView
                        style={styles.keyboardView}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                    >
                        <Animated.View
                            style={[
                                styles.sheet,
                                {
                                    transform: [{ translateY }],
                                    backgroundColor: colors.surface,
                                    shadowColor: colors.shadow,
                                }
                            ]}
                        >
                            <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
                                <View style={[styles.handle, { backgroundColor: colors.border }]} />
                            </View>

                            <LinearGradient
                                colors={heroGradientColors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.hero}
                            >
                                <View style={[styles.heroHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                    <View style={[styles.avatar, { backgroundColor: 'transparent', shadowColor: 'transparent', elevation: 0 }]}>
                                        <Image
                                            source={require('../../../assets/images/chatbot_icon.png')}
                                            style={{ width: 48, height: 48, resizeMode: 'cover', borderRadius: 14 }}
                                        />
                                    </View>
                                    <View style={styles.heroText}>
                                        <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>مساعد الحجز الذكي</Text>
                                        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>خطوات بسيطة لحجز رحلتك</Text>
                                        <View
                                            style={[
                                                styles.heroBadge,
                                                {
                                                    flexDirection: isRTL ? 'row-reverse' : 'row',
                                                    backgroundColor: isDark ? 'rgba(51,65,85,0.45)' : 'rgba(248,250,252,0.7)',
                                                },
                                            ]}
                                        >
                                            <MapPin size={14} color={colors.textPrimary} />
                                            <Text style={[styles.heroBadgeText, { color: colors.textPrimary }]}>اختر المواقع بسهولة</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={handleClose} style={[styles.closeButton, { backgroundColor: colors.surface2 }]}>
                                        <X size={22} color={colors.textPrimary} />
                                    </TouchableOpacity>
                                </View>
                            </LinearGradient>

                            <View style={[styles.messagesWrapper, { backgroundColor: colors.surface }]}>
                                <ScrollView
                                    ref={scrollViewRef}
                                    style={styles.messagesContainer}
                                    contentContainerStyle={styles.messagesContent}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {messages.map((message) => (
                                        <MessageBubble
                                            key={message.id}
                                            role={message.role}
                                            text={message.text}
                                            timestamp={message.timestamp}
                                        />
                                    ))}
                                    {loading && (
                                        <View style={styles.loadingContainer}>
                                            <ActivityIndicator color={colors.primary} />
                                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>جاري المعالجة...</Text>
                                        </View>
                                    )}
                                </ScrollView>
                            </View>

                            {/* Trip Summary Card - Shows when in confirmation stage */}
                            {chatBotService.getCurrentStage() === 'confirmation' && (
                                <View
                                    style={[
                                        styles.tripSummaryCard,
                                        {
                                            backgroundColor: isDark ? colors.surface2 : '#F0F9FF',
                                            borderColor: isDark ? colors.border : '#BFDBFE',
                                            shadowColor: colors.shadow,
                                        },
                                    ]}
                                >
                                    <Text style={[styles.tripSummaryTitle, { color: colors.textPrimary }]}>📋 ملخص الرحلة</Text>

                                    <View style={styles.tripInfoRow}>
                                        <View style={[styles.tripInfoItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                            <Text style={[styles.tripInfoLabel, { color: colors.textSecondary }]}>🚗 نوع السيارة</Text>
                                            <Text style={[styles.tripInfoValue, { color: colors.textPrimary }]}>
                                                {chatBotService.getBookingData().carType === 'saver' && 'موفر'}
                                                {chatBotService.getBookingData().carType === 'comfort' && 'مريح'}
                                                {chatBotService.getBookingData().carType === 'vip' && 'في آي بي'}
                                                {chatBotService.getBookingData().carType === 'taxi' && 'تاكسي'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.tripStatsRow}>
                                        <View style={[styles.tripStat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                            <Text style={[styles.tripStatLabel, { color: colors.textSecondary }]}>📏 المسافة</Text>
                                            <Text style={[styles.tripStatValue, { color: colors.textPrimary }]}>
                                                {(() => {
                                                    const booking = chatBotService.getBookingData();
                                                    if (booking.pickup && booking.destination) {
                                                        const dist = calculateDistance(
                                                            booking.pickup.lat,
                                                            booking.pickup.lng,
                                                            booking.destination.lat,
                                                            booking.destination.lng
                                                        );
                                                        return `${dist.toFixed(1)} كم`;
                                                    }
                                                    return '-- كم';
                                                })()}
                                            </Text>
                                        </View>

                                        <View style={[styles.tripStat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                            <Text style={[styles.tripStatLabel, { color: colors.textSecondary }]}>⏱️ الوقت</Text>
                                            <Text style={[styles.tripStatValue, { color: colors.textPrimary }]}>
                                                {(() => {
                                                    const booking = chatBotService.getBookingData();
                                                    if (booking.pickup && booking.destination) {
                                                        const dist = calculateDistance(
                                                            booking.pickup.lat,
                                                            booking.pickup.lng,
                                                            booking.destination.lat,
                                                            booking.destination.lng
                                                        );
                                                        const time = calculateDuration(dist);
                                                        return `${time} دقيقة`;
                                                    }
                                                    return '-- دقيقة';
                                                })()}
                                            </Text>
                                        </View>

                                        <View style={[styles.tripStat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                            <Text style={[styles.tripStatLabel, { color: colors.textSecondary }]}>💰 السعر</Text>
                                            <Text style={[styles.tripStatValue, styles.priceValue, { color: colors.primary }]}>
                                                {(() => {
                                                    const booking = chatBotService.getBookingData();
                                                    if (booking.pickup && booking.destination && booking.carType) {
                                                        const dist = calculateDistance(
                                                            booking.pickup.lat,
                                                            booking.pickup.lng,
                                                            booking.destination.lat,
                                                            booking.destination.lng
                                                        );
                                                        const price = calculatePrice(dist, booking.carType);
                                                        return `${price} جنيه`;
                                                    }
                                                    return '-- جنيه';
                                                })()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {lastMessage?.quickActions && (
                                <View style={[styles.quickActionsWrapper, { backgroundColor: colors.surface }]}>
                                    <QuickActions
                                        actions={lastMessage.quickActions}
                                        onActionPress={handleActionPress}
                                    />
                                </View>
                            )}

                            {chatBotService.getCurrentStage() === 'destination' && (
                                <View style={[styles.inputContainer, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.surface }]}>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                textAlign: isRTL ? 'right' : 'left',
                                                backgroundColor: colors.inputBg,
                                                color: colors.textPrimary,
                                                borderColor: colors.inputBorder,
                                            },
                                        ]}
                                        placeholder="اكتب عنوان الوجهة..."
                                        placeholderTextColor={colors.textMuted}
                                        value={inputText}
                                        onChangeText={setInputText}
                                        onSubmitEditing={handleSendMessage}
                                    />
                                    <TouchableOpacity
                                        style={styles.sendButton}
                                        onPress={handleSendMessage}
                                        disabled={!inputText.trim()}
                                        activeOpacity={0.9}
                                    >
                                        <LinearGradient
                                            colors={sendGradientColors}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={[styles.sendGradient, { opacity: inputText.trim() ? 1 : 0.6 }]}
                                        >
                                            <Send size={20} color="#FFFFFF" />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </Animated.View>
                    </KeyboardAvoidingView>

                    {showMapPicker && (
                        <View style={[styles.mapPickerOverlay, { backgroundColor: colors.background }]}>
                            <MapPickerModal
                                onClose={() => {
                                    setShowMapPicker(false);
                                    setMapSelectionTarget(null);
                                }}
                                onLocationSelected={handleMapLocationSelected}
                                title={mapPickerTitle}
                            />
                        </View>
                    )}
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        position: 'relative',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        zIndex: 1,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'flex-end',
        zIndex: 2,
    },
    mapPickerOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
        backgroundColor: '#FFFFFF',
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingBottom: Platform.OS === 'ios' ? 12 : 12,
        overflow: 'hidden',
        height: '90%',
        elevation: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
    },
    dragHandleArea: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    handle: {
        width: 54,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(148, 163, 184, 0.6)',
    },
    hero: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        paddingTop: 6,
    },
    heroHeader: {
        alignItems: 'center',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0EA5E9',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
        marginHorizontal: 6,
    },
    avatarEmoji: {
        fontSize: 24,
    },
    heroText: {
        flex: 1,
        paddingHorizontal: 6,
    },
    heroTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0F172A',
    },
    heroSubtitle: {
        fontSize: 12,
        color: '#1E293B',
        marginTop: 2,
    },
    heroBadge: {
        marginTop: 10,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(248, 250, 252, 0.7)',
        borderRadius: 999,
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
    },
    heroBadgeText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '600',
    },
    closeButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(248,250,252,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    messagesWrapper: {
        flex: 1,
        paddingHorizontal: 4,
        minHeight: 200,
        backgroundColor: '#FFFFFF',
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        paddingVertical: 16,
        flexGrow: 1,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    loadingText: {
        marginLeft: 8,
        color: '#64748B',
        fontSize: 14,
    },
    quickActionsWrapper: {
        paddingVertical: 4,
        backgroundColor: '#FFFFFF',
    },
    inputContainer: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 24 : 24,
        alignItems: 'center',
        gap: 12,
    },
    input: {
        flex: 1,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 18,
        fontSize: 16,
        color: '#0F172A',
    },
    sendButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    sendGradient: {
        flex: 1,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tripSummaryCard: {
        backgroundColor: '#F0F9FF',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    tripSummaryTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 16,
        textAlign: 'center',
    },
    tripInfoRow: {
        marginBottom: 16,
    },
    tripInfoItem: {
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0F2FE',
    },
    tripInfoLabel: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 4,
        fontWeight: '600',
    },
    tripInfoValue: {
        fontSize: 16,
        color: '#0F172A',
        fontWeight: '700',
    },
    tripStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    tripStat: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0F2FE',
    },
    tripStatLabel: {
        fontSize: 11,
        color: '#64748B',
        marginBottom: 6,
        fontWeight: '600',
    },
    tripStatValue: {
        fontSize: 15,
        color: '#0F172A',
        fontWeight: '700',
        textAlign: 'center',
    },
    priceValue: {
        color: Colors.primary,
        fontSize: 16,
    },
});

