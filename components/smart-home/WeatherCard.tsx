import { SmartHomeColors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, {
    Circle, Defs, Ellipse, LinearGradient, Path,
    RadialGradient, Stop,
} from 'react-native-svg';

// ─── Weather SVG Illustrations ───────────────────────────────────────────────

function SunnyIllustration() {
    return (
        <Svg width="110" height="100" viewBox="0 0 110 100">
            <Defs>
                <RadialGradient id="sun" cx="50%" cy="40%" r="55%">
                    <Stop offset="0%" stopColor="#FFE566" />
                    <Stop offset="60%" stopColor="#FFB82E" />
                    <Stop offset="100%" stopColor="#FF8C00" />
                </RadialGradient>
            </Defs>
            {/* Glow */}
            <Circle cx="55" cy="48" r="32" fill="#FFE08A" opacity="0.3" />
            <Circle cx="55" cy="48" r="26" fill="#FFE08A" opacity="0.25" />
            {/* Sun */}
            <Circle cx="55" cy="48" r="20" fill="url(#sun)" />
            {/* Rays */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
                const rad = (deg * Math.PI) / 180;
                const x1 = 55 + 24 * Math.cos(rad);
                const y1 = 48 + 24 * Math.sin(rad);
                const x2 = 55 + 31 * Math.cos(rad);
                const y2 = 48 + 31 * Math.sin(rad);
                return (
                    <Path
                        key={i}
                        d={`M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`}
                        stroke="#FFB82E"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    />
                );
            })}
        </Svg>
    );
}

function PartlySunnyIllustration() {
    return (
        <Svg width="130" height="105" viewBox="0 0 130 105">
            <Defs>
                {/* Sun warm gradient */}
                <RadialGradient id="sunPS" cx="35%" cy="30%" r="65%">
                    <Stop offset="0%" stopColor="#FFE566" />
                    <Stop offset="45%" stopColor="#FFAA2C" />
                    <Stop offset="100%" stopColor="#FF7043" />
                </RadialGradient>
                {/* Cloud main gradient — white top, very light lavender bottom */}
                <LinearGradient id="cloudMain" x1="20%" y1="0%" x2="80%" y2="100%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#EDE8FF" stopOpacity="0.95" />
                </LinearGradient>
                {/* Cloud shading gradient for depth */}
                <LinearGradient id="cloudShade" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.0" />
                    <Stop offset="100%" stopColor="#C8BFEE" stopOpacity="0.25" />
                </LinearGradient>
            </Defs>

            {/* --- Sun (behind cloud, top-right) --- */}
            {/* Outer glow */}
            <Circle cx="90" cy="34" r="28" fill="#FFE08A" opacity="0.22" />
            <Circle cx="90" cy="34" r="20" fill="#FFD580" opacity="0.30" />
            {/* Sun disk */}
            <Circle cx="90" cy="34" r="15" fill="url(#sunPS)" />

            {/* --- Shadow under cloud --- */}
            <Ellipse cx="57" cy="98" rx="46" ry="8" fill="rgba(140,120,200,0.10)" />

            {/* --- Cloud body (3 bumps + flat base) --- */}
            {/* Left bump */}
            <Circle cx="30" cy="74" r="20" fill="url(#cloudMain)" />
            {/* Left-center bump (tallest) */}
            <Circle cx="54" cy="62" r="26" fill="url(#cloudMain)" />
            {/* Right bump */}
            <Circle cx="78" cy="70" r="20" fill="url(#cloudMain)" />
            {/* Small right edge bump */}
            <Circle cx="92" cy="76" r="14" fill="url(#cloudMain)" />
            {/* Flat base fill */}
            <Ellipse cx="58" cy="88" rx="50" ry="14" fill="url(#cloudMain)" />
            {/* Subtle shading layer on base */}
            <Ellipse cx="58" cy="90" rx="50" ry="12" fill="url(#cloudShade)" />
        </Svg>
    );
}


function CloudyIllustration() {
    return (
        <Svg width="120" height="90" viewBox="0 0 120 90">
            <Defs>
                <LinearGradient id="cl1" x1="0%" y1="0%" x2="10%" y2="100%">
                    <Stop offset="0%" stopColor="#D0D8E8" />
                    <Stop offset="100%" stopColor="#B8C4D8" />
                </LinearGradient>
                <LinearGradient id="cl2" x1="0%" y1="0%" x2="10%" y2="100%">
                    <Stop offset="0%" stopColor="#E8EEF8" />
                    <Stop offset="100%" stopColor="#D0D8EC" />
                </LinearGradient>
            </Defs>
            <Circle cx="28" cy="55" r="18" fill="url(#cl1)" />
            <Circle cx="52" cy="45" r="26" fill="url(#cl2)" />
            <Circle cx="78" cy="52" r="20" fill="url(#cl1)" />
            <Ellipse cx="52" cy="68" rx="48" ry="12" fill="url(#cl2)" />
            <Ellipse cx="52" cy="75" rx="44" ry="8" fill="rgba(180,190,210,0.3)" />
        </Svg>
    );
}

function RainyIllustration() {
    return (
        <Svg width="120" height="100" viewBox="0 0 120 100">
            <Defs>
                <LinearGradient id="rainCl" x1="0%" y1="0%" x2="10%" y2="100%">
                    <Stop offset="0%" stopColor="#B8C8E8" />
                    <Stop offset="100%" stopColor="#8AA0C0" />
                </LinearGradient>
            </Defs>
            <Circle cx="28" cy="48" r="18" fill="url(#rainCl)" />
            <Circle cx="52" cy="38" r="26" fill="url(#rainCl)" />
            <Circle cx="78" cy="45" r="20" fill="url(#rainCl)" />
            <Ellipse cx="52" cy="60" rx="48" ry="12" fill="url(#rainCl)" />
            {/* Raindrops */}
            {[28, 44, 60, 76].map((x, i) => (
                <Path
                    key={i}
                    d={`M${x},72 L${x - 3},86`}
                    stroke="#6890C0"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity={0.7 - i * 0.05}
                />
            ))}
        </Svg>
    );
}

function ThunderstormIllustration() {
    return (
        <Svg width="120" height="100" viewBox="0 0 120 100">
            <Defs>
                <LinearGradient id="stormCl" x1="0%" y1="0%" x2="10%" y2="100%">
                    <Stop offset="0%" stopColor="#7880A0" />
                    <Stop offset="100%" stopColor="#505870" />
                </LinearGradient>
            </Defs>
            <Circle cx="28" cy="46" r="18" fill="url(#stormCl)" />
            <Circle cx="52" cy="36" r="26" fill="url(#stormCl)" />
            <Circle cx="78" cy="43" r="20" fill="url(#stormCl)" />
            <Ellipse cx="52" cy="58" rx="48" ry="12" fill="url(#stormCl)" />
            {/* Lightning bolt */}
            <Path
                d="M56,64 L46,80 L54,80 L44,96 L64,76 L55,76 Z"
                fill="#FFD700"
                opacity="0.95"
            />
        </Svg>
    );
}

function SnowIllustration() {
    return (
        <Svg width="120" height="100" viewBox="0 0 120 100">
            <Defs>
                <LinearGradient id="snowCl" x1="0%" y1="0%" x2="10%" y2="100%">
                    <Stop offset="0%" stopColor="#E0EAF8" />
                    <Stop offset="100%" stopColor="#C4D4EC" />
                </LinearGradient>
            </Defs>
            <Circle cx="28" cy="48" r="18" fill="url(#snowCl)" />
            <Circle cx="52" cy="38" r="26" fill="url(#snowCl)" />
            <Circle cx="78" cy="45" r="20" fill="url(#snowCl)" />
            <Ellipse cx="52" cy="60" rx="48" ry="12" fill="url(#snowCl)" />
            {/* Snowflakes */}
            {[28, 44, 60, 76].map((x, i) => (
                <Circle key={i} cx={x} cy={76 + i * 4} r="3.5" fill="#A0C4E8" opacity="0.8" />
            ))}
        </Svg>
    );
}

function FoggyIllustration() {
    return (
        <Svg width="120" height="90" viewBox="0 0 120 90">
            <Defs>
                <LinearGradient id="fogL" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#D8DFE8" stopOpacity="0.3" />
                    <Stop offset="50%" stopColor="#C8D0DC" stopOpacity="0.9" />
                    <Stop offset="100%" stopColor="#D8DFE8" stopOpacity="0.3" />
                </LinearGradient>
            </Defs>
            {[20, 36, 52, 68].map((y, i) => (
                <Ellipse key={i} cx="60" cy={y} rx={50 - i * 4} ry="8" fill="url(#fogL)" />
            ))}
        </Svg>
    );
}

const ICON_MAP: Record<string, React.FC> = {
    sunny: SunnyIllustration,
    'partly-sunny': PartlySunnyIllustration,
    cloudy: CloudyIllustration,
    cloud: FoggyIllustration,
    rainy: RainyIllustration,
    snow: SnowIllustration,
    thunderstorm: ThunderstormIllustration,
};

// ─── Component ───────────────────────────────────────────────────────────────

interface WeatherCardProps {
    temperature?: number;
    feelsLike?: number;
    description?: string;
    iconName?: string;
    city?: string;
    loading?: boolean;
}

export function WeatherCard({
    temperature = 20,
    feelsLike = 18,
    description = 'Partly cloudy',
    iconName = 'partly-sunny',
    city = 'My Location',
    loading = false,
}: WeatherCardProps) {
    const { TXT } = useLanguage();
    const Illustration = ICON_MAP[iconName] ?? PartlySunnyIllustration;

    return (
        <View style={styles.card}>
            {/* Header: city — centered tab flush with top */}
            <View style={styles.cardHeader}>
                <View style={styles.cityRow}>
                    <Ionicons name="location-sharp" size={12} color={SmartHomeColors.purple} />
                    <Text style={styles.cityText}>{city}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={SmartHomeColors.purple} />
                    <Text style={styles.loadingText}>{TXT.weather.searching}</Text>
                </View>
            ) : (
                <View style={styles.content}>
                    <Illustration />
                    <View style={styles.tempBlock}>
                        <View style={styles.tempRow}>
                            <Text style={styles.tempMain}>{temperature}</Text>
                            <Text style={styles.tempDeg}>°</Text>
                            <View style={styles.feelsWrap}>
                                <Text style={styles.tempSub}>{feelsLike}°</Text>
                                <Text style={styles.feelsLabel}>{TXT.common.feelsLike}</Text>
                            </View>
                        </View>
                        <Text style={styles.description} numberOfLines={2}>{description}</Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'transparent',
        paddingHorizontal: 20,
        paddingTop: 0,
        paddingBottom: 20,
    },
    cardHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    cityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#F7F5FF',
        paddingHorizontal: 20,
        paddingVertical: 8, // Increased padding
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        borderWidth: 1,
        borderColor: '#E6E0FF',
        borderTopWidth: 0,
    },
    cityText: {
        fontSize: 10,
        fontWeight: '800',
        color: SmartHomeColors.purple,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    todayLabel: {
        fontSize: 12,
        color: SmartHomeColors.textSecondary,
        fontWeight: '500',
    },
    loadingWrap: {
        height: 90,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
        color: SmartHomeColors.textMuted,
    },
    container: {
        flexDirection: 'row',
        backgroundColor: 'transparent',
        paddingVertical: 14,
        paddingHorizontal: 8,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tempBlock: {
        flex: 1,
        paddingLeft: 4,
    },
    tempRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    tempMain: {
        fontSize: 70,
        fontWeight: '800',
        color: SmartHomeColors.textPrimary,
        lineHeight: 74,
        letterSpacing: -2,
    },
    tempDeg: {
        fontSize: 28,
        fontWeight: '400',
        color: SmartHomeColors.textPrimary,
        marginTop: 8,
    },
    feelsWrap: {
        marginLeft: 8,
        marginTop: 10,
        alignItems: 'flex-start',
    },
    tempSub: {
        fontSize: 20,
        fontWeight: '600',
        color: SmartHomeColors.textMuted,
    },
    feelsLabel: {
        fontSize: 11,
        color: SmartHomeColors.textMuted,
        marginTop: -2,
    },
    description: {
        fontSize: 13,
        color: SmartHomeColors.textSecondary,
        marginTop: 4,
        fontWeight: '500',
    },
});
