import { SmartHomeColors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatItem {
    value: string;
    label: string;
    iconName: string;
}

interface WeatherStatsProps {
    feelsLike?: number;
    humidity?: number;
    windSpeed?: number;
}

export function WeatherStats({
    feelsLike = 24,
    humidity = 60,
    windSpeed = 5,
}: WeatherStatsProps) {
    const { TXT } = useLanguage();
    const stats: StatItem[] = [
        { value: `${feelsLike}°`, label: TXT.common.feelsLike, iconName: 'thermometer-outline' },
        { value: `${humidity}%`, label: TXT.common.humidity, iconName: 'water-outline' },
        { value: `${windSpeed} km/h`, label: TXT.common.windSpeed, iconName: 'leaf-outline' },
    ];

    return (
        <View style={styles.container}>
            {stats.map((item, index) => (
                <React.Fragment key={item.label}>
                    <View style={styles.statItem}>
                        <View style={styles.iconWrap}>
                            <Ionicons name={item.iconName as any} size={16} color={SmartHomeColors.purple} />
                        </View>
                        <Text style={styles.value}>{item.value}</Text>
                        <Text style={styles.label}>{item.label}</Text>
                    </View>
                    {index < stats.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: 'transparent',
        paddingVertical: 24,
        paddingHorizontal: 8,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        gap: 3,
    },
    iconWrap: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: 'rgba(139,92,246,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    value: {
        fontSize: 15,
        fontWeight: '700',
        color: SmartHomeColors.textPrimary,
    },
    label: {
        fontSize: 11,
        color: SmartHomeColors.textSecondary,
        fontWeight: '500',
    },
    divider: {
        width: 1,
        backgroundColor: SmartHomeColors.divider,
        marginVertical: 6,
    },
});
