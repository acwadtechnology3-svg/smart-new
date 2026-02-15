import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Modal, TouchableWithoutFeedback, I18nManager, Platform, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
    BookOpen, CreditCard, Headphones, ShieldCheck, Settings,
    Gift, Tag, ChevronRight, User, LogOut, ArrowRight, ArrowLeft, MapPin
} from 'lucide-react-native';
import { RootStackParamList } from '../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../theme/useTheme';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75;

interface SideMenuProps {
    visible: boolean;
    onClose: () => void;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SideMenu({ visible, onClose }: SideMenuProps) {
    const [modalVisible, setModalVisible] = React.useState(false);
    const { t, isRTL } = useLanguage();
    const { colors, isDark } = useTheme();
    const [userInfo, setUserInfo] = React.useState<{ name: string; photo: string | null } | null>(null);

    useEffect(() => {
        if (visible) {
            loadUser();
        }
    }, [visible]);

    const loadUser = async () => {
        try {
            const session = await AsyncStorage.getItem('userSession');
            if (session) {
                const { user } = JSON.parse(session);
                if (user) {
                    setUserInfo({
                        name: user.full_name || 'User',
                        photo: user.profile_photo_url || null
                    });
                }
            }
        } catch (e) {
            console.log('Error loading user in SideMenu', e);
        }
    };

    // Calculate correct hidden offset
    const getHiddenOffset = () => {
        const wantsRight = isRTL;
        const nativeRTL = I18nManager.isRTL;

        if (nativeRTL) {
            // Native RTL: 0 is Right, +X is Left, -X is Right(offscreen)
            return wantsRight ? -SIDEBAR_WIDTH : SIDEBAR_WIDTH;
        } else {
            // Native LTR: 0 is Left, +X is Right, -X is Left(offscreen)
            return wantsRight ? SIDEBAR_WIDTH : -SIDEBAR_WIDTH;
        }
    };

    const hiddenValue = getHiddenOffset();

    const slideAnim = useRef(new Animated.Value(hiddenValue)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const navigation = useNavigation<NavigationProp>();

    useEffect(() => {
        if (visible) {
            setModalVisible(true);
            // Instant reset to hidden position before animating in
            slideAnim.setValue(hiddenValue);

            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: hiddenValue,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setModalVisible(false);
            });
        }
    }, [visible, isRTL]); // Re-run if RTL changes

    if (!modalVisible) return null;

    const handleNavigation = (screen: any) => {
        onClose();
        setTimeout(() => {
            navigation.navigate(screen);
        }, 300);
    };

    const handleSignOut = async () => {
        onClose();
        await AsyncStorage.multiRemove(['userSession', 'token']);
        navigation.reset({
            index: 0,
            routes: [{ name: 'SplashScreen' as never }],
        });
    };

    // Layout Direction Helper
    const flexDirection = (isRTL === I18nManager.isRTL) ? 'row' : 'row-reverse';

    return (
        <Modal transparent visible={modalVisible} onRequestClose={onClose} animationType="none">
            {/* The Overlay Container determines which side the Sidebar sits on */}
            <View style={[styles.overlay, { flexDirection }]}>

                {/* Backdrop */}
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
                </TouchableWithoutFeedback>

                {/* Sidebar */}
                <Animated.View style={[
                    styles.sidebar,
                    {
                        transform: [{ translateX: slideAnim }],
                        backgroundColor: colors.surface
                    }
                ]}>
                    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

                        {/* Header */}

                        <TouchableOpacity
                            style={[styles.header, { flexDirection }]}
                            onPress={() => handleNavigation('PersonalInformation')}
                        >
                            <View style={styles.avatarContainer}>
                                {userInfo?.photo ? (
                                    <Image source={{ uri: userInfo.photo }} style={styles.avatarImage} resizeMode="cover" />
                                ) : (
                                    <User size={30} color="#fff" />
                                )}
                            </View>
                            <View style={{ flex: 1, marginHorizontal: 12, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                                <Text style={[styles.userName, { color: colors.textPrimary }]}>{userInfo?.name || 'User'}</Text>
                                <Text style={styles.editProfileText}>{t('viewProfile')}</Text>
                            </View>
                            {isRTL ? <ArrowLeft size={16} color={colors.textMuted} /> : <ArrowRight size={16} color={colors.textMuted} />}
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {/* Menu Items */}
                        <View style={styles.menuContainer}>
                            <MenuItem
                                icon={<BookOpen size={22} color="#F97316" />}
                                label={t('tripHistory')}
                                onPress={() => handleNavigation('MyTrips')}
                                isRTL={isRTL}
                                textColor={colors.textPrimary}
                            />
                            <MenuItem
                                icon={<CreditCard size={22} color="#10B981" />}
                                label={t('wallet')}
                                onPress={() => handleNavigation('Wallet')}
                                isRTL={isRTL}
                                textColor={colors.textPrimary}
                            />
                            <MenuItem
                                icon={<Tag size={22} color="#14B8A6" />}
                                label={t('discounts')}
                                onPress={() => handleNavigation('Discounts')}
                                isRTL={isRTL}
                                textColor={colors.textPrimary}
                            />
                            <MenuItem
                                icon={<Headphones size={22} color="#3B82F6" />}
                                label={t('support')}
                                onPress={() => handleNavigation('Help')}
                                isRTL={isRTL}
                                textColor={colors.textPrimary}
                            />
                            <MenuItem
                                icon={<ShieldCheck size={22} color="#EF4444" />}
                                label={t('safetyCenter')}
                                onPress={() => handleNavigation('Safety')}
                                isRTL={isRTL}
                                textColor={colors.textPrimary}
                            />
                            <MenuItem
                                icon={<Settings size={22} color="#6B7280" />}
                                label={t('settings')}
                                onPress={() => handleNavigation('Settings')}
                                isRTL={isRTL}
                                textColor={colors.textPrimary}
                            />
                            <MenuItem
                                icon={<MapPin size={22} color="#0EA5E9" />}
                                label={t('locationPreferences')}
                                onPress={() => handleNavigation('LocationPreferences')}
                                isRTL={isRTL}
                                textColor={colors.textPrimary}
                            />
                            <MenuItem
                                icon={<Gift size={22} color="#EC4899" />}
                                label={t('inviteFriends')}
                                onPress={() => handleNavigation('InviteFriends')}
                                isRTL={isRTL}
                                textColor={colors.textPrimary}
                            />
                        </View>

                        {/* Footer */}
                        <View style={[styles.footer, { borderTopColor: colors.border }]}>
                            <TouchableOpacity style={[styles.menuItem, { flexDirection }]} onPress={handleSignOut}>
                                <View style={styles.iconBox}>
                                    <LogOut size={22} color={colors.danger} />
                                </View>
                                <Text style={[styles.menuLabel, { color: colors.danger }]}>{t('signOut')}</Text>
                            </TouchableOpacity>
                        </View>

                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const MenuItem = ({ icon, label, onPress, isRTL, textColor }: { icon: React.ReactNode, label: string, onPress: () => void, isRTL: boolean, textColor: string }) => {
    const flexDirection = (isRTL === I18nManager.isRTL) ? 'row' : 'row-reverse';

    return (
        <TouchableOpacity style={[styles.menuItem, { flexDirection }]} onPress={onPress}>
            <View style={styles.iconBox}>
                {icon}
            </View>
            <Text style={[styles.menuLabel, { textAlign: isRTL ? 'right' : 'left', color: textColor }]}>{label}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sidebar: {
        width: SIDEBAR_WIDTH,
        height: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    safeArea: {
        flex: 1,
        paddingTop: 20,
        paddingHorizontal: 20,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 20,
        marginTop: 20,
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    editProfileText: {
        fontSize: 14,
        color: '#3B82F6',
        marginTop: 2,
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    divider: {
        height: 1,
        marginVertical: 10,
    },
    menuContainer: {
        flex: 1,
        paddingTop: 10,
    },
    menuItem: {
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 8,
    },
    iconBox: {
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuLabel: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
        marginHorizontal: 12,
    },
    footer: {
        paddingVertical: 20,
        borderTopWidth: 1,
    }
});
