import { SmartHomeColors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { Storage } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface SetupScreenProps {
    onComplete: (username: string) => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
    const { TXT } = useLanguage();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleStart = async () => {
        if (!name.trim()) return;

        setLoading(true);
        const config = {
            username: name.trim(),
            isSetupComplete: true
        };

        await Storage.saveConfig(config as any);
        onComplete(config.username);
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#8B5CF6', '#6366F1']}
                style={styles.header}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name="sparkles" size={40} color="#fff" />
                </View>
                <Text style={styles.title}>{TXT.setup.welcome}</Text>
                <Text style={styles.subtitle}>{TXT.setup.personalize}</Text>
            </LinearGradient>

            <KeyboardAvoidingView
                behavior="height"
                style={styles.form}
            >
                <View style={styles.content}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{TXT.setup.whatIsName}</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="person-outline" size={20} color={SmartHomeColors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={TXT.setup.placeholderName}
                                placeholderTextColor={SmartHomeColors.textMuted}
                                value={name}
                                onChangeText={setName}
                                autoFocus
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, !name.trim() && styles.buttonDisabled]}
                        onPress={handleStart}
                        disabled={!name.trim() || loading}
                    >
                        <Text style={styles.buttonText}>{loading ? TXT.setup.settingUp : TXT.setup.getStarted}</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        height: '40%',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
    },
    form: {
        flex: 1,
        padding: 30,
        marginTop: -30,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingBottom: 40,
    },
    inputGroup: {
        marginBottom: 25,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: SmartHomeColors.textPrimary,
        marginBottom: 10,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 15,
        paddingHorizontal: 15,
        height: 55,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 2,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: SmartHomeColors.textPrimary,
    },
    button: {
        backgroundColor: '#a855f7',
        height: 55,
        borderRadius: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        gap: 10,
        elevation: 5,
    },
    buttonDisabled: {
        backgroundColor: '#cbd5e1',
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
