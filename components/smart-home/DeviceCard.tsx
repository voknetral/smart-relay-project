import { SmartHomeColors } from '@/constants/theme';
import { TXT } from '@/constants/translations';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback } from 'react';
import {
    StyleSheet,
    Text,
    Pressable,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export type DeviceIconName = 'humidifier' | 'plug' | 'light' | 'fan' | 'ac';

const ICON_MAP: Record<DeviceIconName, string> = {
    humidifier: 'water',
    plug: 'flash',
    light: 'bulb',
    fan: 'aperture',
    ac: 'snow',
};

interface DeviceCardProps {
    name: string;
    iconType: DeviceIconName;
    accentColor: string;
    accentColorLight?: string;
    isOn: boolean;
    mode: 'auto' | 'manual';
    onToggle?: (newState: boolean) => void;
    onToggleMode?: () => void;
    onSchedulePress?: () => void;
    hasSchedules?: boolean;
    onLongPress?: () => void;
    customIconUri?: string;
    isMcuOnline?: boolean;
}

function AnimatedToggle({
    isOn,
    accentColor,
    onToggle,
    disabled = false,
}: {
    isOn: boolean;
    accentColor: string;
    onToggle?: (v: boolean) => void;
    disabled?: boolean;
}) {
    const isToggled = useSharedValue(isOn ? 1 : 0);

    React.useEffect(() => {
        isToggled.value = withSpring(isOn ? 1 : 0, {
            mass: 1,
            damping: 15,
            stiffness: 120,
            overshootClamping: false,
        });
    }, [isOn]);

    const handlePress = useCallback(() => {
        if (disabled) return;
        const next = !isOn;
        onToggle?.(next);
    }, [isOn, onToggle, disabled]);

    const trackStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            isToggled.value,
            [0, 1],
            [SmartHomeColors.toggleOff, accentColor]
        );
        return { backgroundColor };
    });

    const knobStyle = useAnimatedStyle(() => {
        const translateX = interpolate(isToggled.value, [0, 1], [3, 22]);
        return { transform: [{ translateX }] };
    });

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={disabled ? 1 : 0.8}
            disabled={disabled}
        >
            <Animated.View style={[
                styles.track,
                { opacity: disabled ? 0.4 : 1 },
                trackStyle
            ]}>
                <Animated.View style={[styles.knob, knobStyle]} />
            </Animated.View>
        </TouchableOpacity>
    );
}

export function DeviceCard({
    name,
    iconType,
    accentColor,
    accentColorLight,
    isOn,
    mode,
    onToggle,
    onToggleMode,
    onSchedulePress,
    hasSchedules,
    onLongPress,
    customIconUri,
    isMcuOnline,
}: DeviceCardProps) {
    const baseIconName = ICON_MAP[iconType] ?? 'flash';
    const iconName = isOn ? baseIconName : `${baseIconName}-outline`;
    const bgLight = accentColorLight ?? `${accentColor}22`;

    // Assume online if explicitly undefined, else use the provided prop
    const isOnline = isMcuOnline ?? true;

    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => {
        return { transform: [{ scale: scale.value }] };
    });

    const handlePressIn = () => { scale.value = withSpring(0.96, { mass: 0.5, damping: 12 }); };
    const handlePressOut = () => { scale.value = withSpring(1, { mass: 0.5, damping: 12 }); };

    return (
        <Animated.View style={[animatedStyle, { flex: 1 }]}>
        <Pressable
            style={({ pressed }) => [
                styles.card,
                isOn && styles.cardOn,
                pressed && { opacity: 0.95 },
                !isOnline && { opacity: 0.6 } // Dim the card if ESP32 is offline
            ]}
            onLongPress={onLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            delayLongPress={500}
        >
            {/* Top row: Mode Toggle & Main Toggle */}
            <View style={styles.topRow}>
                <TouchableOpacity
                    onPress={onToggleMode}
                    style={[styles.modeToggle, mode === 'auto' ? styles.modeAuto : styles.modeManual]}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.modeText, mode === 'auto' ? styles.modeTextAuto : styles.modeTextManual]}>
                        {(mode === 'auto' ? TXT.common.auto : TXT.common.manual).toUpperCase()}
                    </Text>
                </TouchableOpacity>
                <AnimatedToggle
                    isOn={isOn}
                    accentColor={accentColor}
                    onToggle={onToggle}
                    disabled={mode === 'auto' || !isOnline}
                />
            </View>

            {/* Centered Main Content */}
            <View style={styles.centerContent}>
                <View style={[styles.iconBox, { backgroundColor: isOn ? accentColor : bgLight }]}>
                    {customIconUri ? (
                        <Image
                            source={{ uri: customIconUri }}
                            style={styles.customIcon}
                            contentFit="cover"
                        />
                    ) : (
                        <Ionicons
                            name={iconName as any}
                            size={28}
                            color={isOn ? '#FFF' : accentColor}
                        />
                    )}
                </View>

                <Text style={styles.deviceName} numberOfLines={1}>{name}</Text>
            </View>

            {/* Status indicator (bottom-left) */}
            <View style={styles.statusIndicator}>
                <View style={[
                  styles.statusDot, 
                  { backgroundColor: !isOnline ? '#EF4444' : (isOn ? accentColor : '#E5E7EB') }
                ]} />
                <Text style={[
                  styles.statusLabel, 
                  { color: !isOnline ? '#EF4444' : (isOn ? accentColor : SmartHomeColors.textMuted) }
                ]}>
                    {!isOnline ? 'OFFLINE' : (isOn ? TXT.common.on : TXT.common.off)}
                </Text>
            </View>

            {/* Schedule Button - Absolute Positioned to maintain symmetry of center info */}
            <TouchableOpacity
                onPress={onSchedulePress}
                style={[styles.scheduleBtn, { backgroundColor: hasSchedules ? 'rgba(139,92,246,0.1)' : '#F8F9FF' }]}
                activeOpacity={0.7}
            >
                <Ionicons
                    name="calendar-sharp"
                    size={16}
                    color={hasSchedules ? SmartHomeColors.purple : SmartHomeColors.textSecondary}
                />
                {hasSchedules && (
                    <View style={styles.scheduleBadge}>
                        <Ionicons name="time" size={8} color="#FFF" />
                    </View>
                )}
            </TouchableOpacity>
        </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: SmartHomeColors.cardBg,
        borderRadius: 22,
        padding: 15,
        flex: 1,
        boxShadow: '0 4px 14px rgba(139, 92, 246, 0.08)',
        elevation: 3,
        minHeight: 185,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    cardOn: {
        borderColor: 'rgba(139,92,246,0.15)',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modeToggle: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    modeAuto: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    modeManual: {
        backgroundColor: 'rgba(107, 114, 128, 0.1)',
        borderColor: 'rgba(107, 114, 128, 0.2)',
    },
    modeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    modeTextAuto: {
        color: '#10B981',
    },
    modeTextManual: {
        color: '#6B7280',
    },
    track: {
        width: 44,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
    },
    knob: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#FFF',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
        elevation: 2,
    },
    centerContent: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingBottom: 25,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        overflow: 'hidden',
    },
    customIcon: {
        width: '100%',
        height: '100%',
    },
    deviceName: {
        fontSize: 15,
        fontWeight: '700',
        color: SmartHomeColors.textPrimary,
        marginBottom: 2,
        letterSpacing: -0.2,
        textAlign: 'center',
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        position: 'absolute',
        bottom: 16,
        left: 16,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusLabel: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    uptimeLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: SmartHomeColors.textMuted,
        opacity: 0.8,
    },
    scheduleBtn: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#F1F5F9', // Slightly darker for better contrast
        justifyContent: 'center',
        alignItems: 'center',
    },
    scheduleBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: SmartHomeColors.purple,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: SmartHomeColors.cardBg,
    },
});
