import React, { useEffect, useRef } from 'react';
import {
    Animated,
    PanResponder,
    StyleSheet,
    Text,
    View,
    Dimensions,
    StyleProp,
    ViewStyle,
    Image
} from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../theme/useTheme';

interface ChatBotButtonProps {
    onPress: () => void;
    disableDrag?: boolean;
    style?: StyleProp<ViewStyle>;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUTTON_SIZE = 70;
const EDGE_PADDING = 16;

export default function ChatBotButton({ onPress, disableDrag = false, style }: ChatBotButtonProps) {
    const { colors, isDark } = useTheme();
    const initialPosition = {
        x: SCREEN_WIDTH - BUTTON_SIZE - EDGE_PADDING,
        y: SCREEN_HEIGHT - BUTTON_SIZE - 180,
    };

    const position = useRef(new Animated.ValueXY(initialPosition)).current;
    const pulse = useRef(new Animated.Value(1)).current;
    const lastPosition = useRef(initialPosition);
    const gestureStart = useRef(initialPosition);
    const hasMoved = useRef(false);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1.08,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const clamp = (value: number, min: number, max: number) => {
        'worklet';
        return Math.min(Math.max(value, min), max);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                hasMoved.current = false;
                gestureStart.current = { ...lastPosition.current };
            },
            onPanResponderMove: (_, gesture) => {
                hasMoved.current = true;
                const nextX = clamp(
                    gestureStart.current.x + gesture.dx,
                    EDGE_PADDING,
                    SCREEN_WIDTH - BUTTON_SIZE - EDGE_PADDING
                );
                const nextY = clamp(
                    gestureStart.current.y + gesture.dy,
                    EDGE_PADDING,
                    SCREEN_HEIGHT - BUTTON_SIZE - EDGE_PADDING
                );
                position.setValue({ x: nextX, y: nextY });
                lastPosition.current = { x: nextX, y: nextY };
            },
            onPanResponderRelease: (_, gesture) => {
                const distance = Math.abs(gesture.dx) + Math.abs(gesture.dy);
                const releaseX = clamp(
                    gestureStart.current.x + gesture.dx,
                    EDGE_PADDING,
                    SCREEN_WIDTH - BUTTON_SIZE - EDGE_PADDING
                );
                const releaseY = clamp(
                    gestureStart.current.y + gesture.dy,
                    EDGE_PADDING,
                    SCREEN_HEIGHT - BUTTON_SIZE - EDGE_PADDING
                );
                position.setValue({ x: releaseX, y: releaseY });
                lastPosition.current = { x: releaseX, y: releaseY };

                if (!hasMoved.current || distance < 10) {
                    onPress();
                }
            },
        })
    ).current;

    const animatedStyle = {
        transform: [
            ...(disableDrag ? [] : [{ translateX: position.x }, { translateY: position.y }]),
            { scale: pulse }
        ]
    };

    const gradientColors: [string, string] = isDark
        ? ['#1E40AF', colors.primary]
        : ['#2563EB', Colors.primary];

    return (
        <Animated.View
            {...(disableDrag ? {} : panResponder.panHandlers)}
            style={[
                styles.container,
                { shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 },
                style,
                animatedStyle
            ]}
        >
            {disableDrag && (
                <View style={{ flex: 1 }} onTouchEnd={onPress}>
                    <Image
                        source={require('../../../assets/images/chatbot_icon.png')}
                        style={{ width: '100%', height: '100%', resizeMode: 'contain', transform: [{ scale: 2 }, { translateX: -4 }] }}
                    />
                </View>
            )}

            {!disableDrag && (
                <Image
                    source={require('../../../assets/images/chatbot_icon.png')}
                    style={{ width: '100%', height: '100%', resizeMode: 'contain', transform: [{ scale: 2 }, { translateX: -4 }] }}
                />
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        shadowColor: '#1E40AF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 12,
        zIndex: 20,
    },
    gradient: {
        flex: 1,
        borderRadius: BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    wave: {
        position: 'absolute',
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5,
    },
    label: {
        color: '#F8FAFC',
        fontSize: 11,
        marginTop: 4,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#10B981',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
});
