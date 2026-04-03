import { SmartHomeColors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export function LoadingScreen() {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Subtle rotation for background or elements if needed
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 4000,
                useNativeDriver: true,
            })
        ).start();
    }, [pulseAnim, rotateAnim]);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.container}>
            <View style={styles.center}>
                <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
                    <Ionicons name="sparkles" size={50} color="#FFF" />
                </Animated.View>

                <Text style={styles.title}>Anomali</Text>
                <Text style={styles.subtitle}>Smart Home Intelligence</Text>

                <View style={styles.loaderContainer}>
                    <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Secure Connection Established</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    center: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 30,
        backgroundColor: SmartHomeColors.purple,
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 10px 20px rgba(139, 92, 246, 0.3)',
        elevation: 10,
        marginBottom: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: SmartHomeColors.textPrimary,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: SmartHomeColors.textSecondary,
        opacity: 0.7,
        marginTop: 4,
    },
    loaderContainer: {
        marginTop: 40,
        height: 4,
        width: 120,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    spinner: {
        width: 40,
        height: 40,
        borderWidth: 3,
        borderColor: SmartHomeColors.purple,
        borderTopColor: 'transparent',
        borderRadius: 20,
        position: 'absolute',
        top: -18,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
    },
    footerText: {
        fontSize: 12,
        fontWeight: '700',
        color: SmartHomeColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
