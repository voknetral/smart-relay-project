import { APP_DEFAULTS } from '@/constants/Config';
import { SmartHomeColors } from '@/constants/theme';
import { AppLanguage } from '@/constants/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMqttContext } from '@/contexts/MqttContext';
import { AppConfig, Storage } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Battery from 'expo-battery';
import * as Application from 'expo-application';

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const { TXT, language, setLanguage } = useLanguage();
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [username, setUsername] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(language);
    const [mqttTopic, setMqttTopic] = useState('');
    const [mqttHost, setMqttHost] = useState('');
    const [mqttPort, setMqttPort] = useState('');
    const [isChecking, setIsChecking] = useState(false);

    const [isResultModalVisible, setIsResultModalVisible] = useState(false);

    // General Status Modal States (Confirm/Success)
    const [statusModal, setStatusModal] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info' as 'info' | 'confirm' | 'danger',
        onConfirm: () => { },
    });

    const { connected: mqttConnected, subscribe, reconnect, mcuOnline } = useMqttContext();

    // Effect for auto-subscribing when checking and connection succeeds
    useEffect(() => {
        if (isChecking && mqttConnected) {
            subscribe(`${mqttTopic}/availability`);
        }
    }, [isChecking, mqttConnected, mqttTopic, subscribe]);

    useEffect(() => {
        const loadConfig = async () => {
            const savedConfig = await Storage.loadConfig();
            if (savedConfig) {
                setConfig(savedConfig);
                setUsername(savedConfig.username);
                setSelectedLanguage(savedConfig.language || language);
                setMqttTopic(savedConfig.mqttTopic!);
                setMqttHost(savedConfig.mqttHost!);
                setMqttPort(savedConfig.mqttPort!);
            }
        };
        loadConfig();
    }, [language]);

    const handleCheckConnection = () => {
        // Validasi port sebelum mencoba connect
        const portNum = parseInt(mqttPort, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            const errorTitle = "Port Tidak Valid";
            const errorMessage = "Silakan masukkan nomor port antara 1 - 65535.";

            if (Platform.OS === 'web') {
                window.alert(`${errorTitle}\n\n${errorMessage}`);
            } else {
                Alert.alert(errorTitle, errorMessage);
            }
            return;
        }

        // Jangan mereset mcuResultOnline(false) secara paksa jika indikator sudah terbukti nyala.
        // Broker MQTT publik (HiveMQ) rata-rata MENGAMBAIKAN perintah "subscribe" ulang 
        // ke topik yang sama, jadi pesan 'online' tidak akan dikirim kedua kalinya.

        // Update connection target to whatever is currently typed
        reconnect(mqttHost, mqttPort);

        setIsChecking(true);
 
        // Wait a bit to show result
        setTimeout(() => {
            setIsChecking(false);
            setIsResultModalVisible(true);
        }, 3000); // Show modal after 3s 
    };

    const handleSave = async () => {
        if (!username.trim() || !config) return;
        const newConfig = {
            ...config,
            username: username.trim(),
            language: selectedLanguage,
            mqttTopic: mqttTopic.trim() || APP_DEFAULTS.mqttTopic,
            mqttHost: mqttHost.trim() || APP_DEFAULTS.mqttHost,
            mqttPort: mqttPort.trim() || APP_DEFAULTS.mqttPort
        };
        await Storage.saveConfig(newConfig);
        setLanguage(selectedLanguage);
        
        // Trigger global reconnection with new settings including topic
        reconnect(newConfig.mqttHost, newConfig.mqttPort, newConfig.mqttTopic);
        
        router.back();
    };

    const handleResetDefaults = () => {
        setStatusModal({
            visible: true,
            title: "⚠️ Konfirmasi Reset",
            message: `Kembalikan ke pengaturan awal?\n\nHost: ${APP_DEFAULTS.mqttHost}\nPort: ${APP_DEFAULTS.mqttPort}\nTopik: ${APP_DEFAULTS.mqttTopic}`,
            type: 'confirm',
            onConfirm: performResetDefaults
        });
    };

    const performResetDefaults = async () => {
        setMqttTopic(() => APP_DEFAULTS.mqttTopic);
        setMqttHost(() => APP_DEFAULTS.mqttHost);
        setMqttPort(() => APP_DEFAULTS.mqttPort);

        if (config) {
            const newConfig = {
                ...config,
                mqttTopic: APP_DEFAULTS.mqttTopic,
                mqttHost: APP_DEFAULTS.mqttHost,
                mqttPort: APP_DEFAULTS.mqttPort
            };
            await Storage.saveConfig(newConfig);
            setConfig(newConfig);

            setStatusModal({
                visible: true,
                title: "Berhasil",
                message: `Pengaturan MQTT telah dikembalikan:\n\nHost: ${APP_DEFAULTS.mqttHost}\nPort: ${APP_DEFAULTS.mqttPort}\nTopik: ${APP_DEFAULTS.mqttTopic}`,
                type: 'info',
                onConfirm: () => setStatusModal(prev => ({ ...prev, visible: false }))
            });
        }
    };

    const handleReset = () => {
        setStatusModal({
            visible: true,
            title: TXT.settings.resetApp,
            message: TXT.settings.resetConfirm,
            type: 'danger',
            onConfirm: performAppReset
        });
    };

    const [isBatteryExempt, setIsBatteryExempt] = useState(true);

    const checkBatteryStatus = async () => {
        if (Platform.OS === 'android') {
            const isOptimized = await Battery.isBatteryOptimizationEnabledAsync();
            setIsBatteryExempt(!isOptimized);
        }
    };

    useEffect(() => {
        checkBatteryStatus();
        const interval = setInterval(checkBatteryStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleBatteryExemption = async () => {
        if (Platform.OS !== 'android') return;

        const pkg = Application.applicationId;
        if (!pkg) return;

        try {
            await IntentLauncher.startActivityAsync('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', {
                data: `package:${pkg}`,
            });
        } catch {
            // Fallback to general settings if specific intent fails
            IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
        }
    };

    const performAppReset = async () => {
        await Storage.clearConfig();
        router.replace('/');
    };

    if (!config) return null;

    return (
        <View style={{ flex: 1, backgroundColor: SmartHomeColors.cardBg }}>
            <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
                <Stack.Screen options={{ headerShown: false }} />

                <View style={styles.customHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
                        <Ionicons name="chevron-back" size={28} color={SmartHomeColors.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{TXT.common.settings}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={!username.trim()}
                        style={[styles.headerSaveBtn, !username.trim() && { opacity: 0.5 }]}
                    >
                        <Text style={styles.headerSaveText}>{TXT.common.save}</Text>
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
                >
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Profile Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{TXT.settings.profile}</Text>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{TXT.setup.whatIsName}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder={TXT.setup.placeholderName}
                                    placeholderTextColor={SmartHomeColors.textMuted}
                                />
                            </View>
                        </View>

                        <View style={[styles.section, styles.borderTop]}>
                            <Text style={styles.sectionTitle}>{TXT.settings.language}</Text>
                            <View style={styles.languageRow}>
                                <TouchableOpacity
                                    style={[styles.languageChip, selectedLanguage === 'en' && styles.languageChipActive]}
                                    onPress={() => setSelectedLanguage('en')}
                                >
                                    <Text style={[styles.languageChipText, selectedLanguage === 'en' && styles.languageChipTextActive]}>
                                        {TXT.settings.english}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.languageChip, selectedLanguage === 'id' && styles.languageChipActive]}
                                    onPress={() => setSelectedLanguage('id')}
                                >
                                    <Text style={[styles.languageChipText, selectedLanguage === 'id' && styles.languageChipTextActive]}>
                                        {TXT.settings.indonesian}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* MQTT Section */}
                        <View style={[styles.section, styles.borderTop]}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>{TXT.settings.mqttSection}</Text>
                                <TouchableOpacity
                                    onPress={handleResetDefaults}
                                    activeOpacity={0.6}
                                    style={styles.resetLinkContainer}
                                >
                                    <Ionicons name="refresh-outline" size={14} color={SmartHomeColors.purple} />
                                    <Text style={styles.resetLink}>{TXT.settings.resetMqtt}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{TXT.settings.mqttTopic}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={mqttTopic}
                                    onChangeText={setMqttTopic}
                                    placeholder={TXT.settings.mqttTopicPlaceholder}
                                    placeholderTextColor={SmartHomeColors.textMuted}
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{TXT.settings.mqttHost}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={mqttHost}
                                    onChangeText={setMqttHost}
                                    placeholder={TXT.settings.mqttHostPlaceholder}
                                    placeholderTextColor={SmartHomeColors.textMuted}
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{TXT.settings.mqttPort}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={mqttPort}
                                    onChangeText={setMqttPort}
                                    placeholder={TXT.settings.mqttPortPlaceholder}
                                    placeholderTextColor={SmartHomeColors.textMuted}
                                    keyboardType="number-pad"
                                />
                            </View>
                            <TouchableOpacity
                                onPress={handleCheckConnection}
                                disabled={isChecking}
                                style={[styles.checkBtn, isChecking && { opacity: 0.7 }]}
                            >
                                <Ionicons name="pulse" size={18} color={SmartHomeColors.purple} />
                                <Text style={styles.checkBtnText}>
                                    {isChecking ? TXT.settings.checking : TXT.settings.checkConnection}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Battery Optimization Section (Android Only) */}
                        {Platform.OS === 'android' && (
                            <View style={[styles.section, styles.borderTop]}>
                                <Text style={styles.sectionTitle}>{TXT.settings.batteryOptimization}</Text>
                                <View style={styles.batteryCard}>
                                    <View style={styles.batteryInfo}>
                                        <Ionicons 
                                            name={isBatteryExempt ? "battery-full" : "battery-dead"} 
                                            size={24} 
                                            color={isBatteryExempt ? "#10B981" : "#F59E0B"} 
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.batteryTitle}>
                                                {isBatteryExempt ? TXT.settings.batteryDisabled : TXT.settings.batteryEnabled}
                                            </Text>
                                            <Text style={styles.batteryDesc}>
                                                {isBatteryExempt 
                                                    ? TXT.settings.batteryDisabledDesc
                                                    : TXT.settings.batteryEnabledDesc}
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    {!isBatteryExempt && (
                                        <TouchableOpacity 
                                            style={styles.batteryBtn} 
                                            onPress={handleBatteryExemption}
                                        >
                                            <Text style={styles.batteryBtnText}>{TXT.settings.disableOptimization}</Text>
                                            <Ionicons name="open-outline" size={16} color="#FFF" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <Text style={styles.hint}>
                                    {TXT.settings.batteryHint}
                                </Text>
                            </View>
                        )}

                        {/* Danger Zone */}
                        <View style={[styles.section, styles.borderTop, { marginBottom: 20 }]}>
                            <Text style={styles.sectionTitle}>{TXT.settings.about}</Text>
                            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                <Text style={styles.resetText}>{TXT.settings.resetApp}</Text>
                            </TouchableOpacity>
                            <View style={styles.versionContainer}>
                                <Text style={styles.hint}>
                                    Version 1.2.5 • Build 2024.03
                                </Text>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                <Modal
                    animationType="fade"
                    transparent={true}
                    statusBarTranslucent={true}
                    visible={isResultModalVisible}
                    onRequestClose={() => setIsResultModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <View style={styles.modalIconBg}>
                                    <Ionicons name="shield-checkmark" size={32} color={SmartHomeColors.purple} />
                                </View>
                                <Text style={styles.modalTitle}>{TXT.settings.connectionDetails}</Text>
                            </View>

                            <View style={styles.modalContent}>
                                <View style={styles.statusRow}>
                                    <View style={[styles.statusIcon, mqttConnected ? styles.statusIconOnline : styles.statusIconOffline]}>
                                        <Ionicons
                                            name={mqttConnected ? "checkmark-circle" : "close-circle"}
                                            size={22}
                                            color={mqttConnected ? "#10B981" : "#EF4444"}
                                        />
                                    </View>
                                    <View style={styles.statusInfo}>
                                        <Text style={styles.statusLabel}>MQTT Broker</Text>
                                        <Text style={[styles.statusValue, mqttConnected ? styles.textOnline : styles.textOffline]}>
                                            {mqttConnected ? TXT.settings.online : TXT.settings.offline}
                                        </Text>
                                    </View>
                                </View>
                                
                                <View style={styles.statusRow}>
                                    <View style={[styles.statusIcon, (mqttConnected && mcuOnline) ? styles.statusIconOnline : styles.statusIconOffline]}>
                                        <Ionicons
                                            name={(mqttConnected && mcuOnline) ? "checkmark-circle" : "close-circle"}
                                            size={22}
                                            color={(mqttConnected && mcuOnline) ? "#10B981" : "#EF4444"}
                                        />
                                    </View>
                                    <View style={styles.statusInfo}>
                                        <Text style={styles.statusLabel}>MCU Status</Text>
                                        <Text style={[styles.statusValue, (mqttConnected && mcuOnline) ? styles.textOnline : styles.textOffline]}>
                                            {(mqttConnected && mcuOnline) ? TXT.settings.online : TXT.settings.offline}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setIsResultModalVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.modalCloseBtnText}>Selesai</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Status Modal (Generic for Confirm/Success) */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    statusBarTranslucent={true}
                    visible={statusModal.visible}
                    onRequestClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <View style={[styles.modalIconBg, statusModal.type === 'info' ? styles.statusIconOnline : styles.statusIconOffline]}>
                                    <Ionicons
                                        name={statusModal.type === 'info' ? "checkmark-circle" : "warning"}
                                        size={32}
                                        color={statusModal.type === 'info' ? "#10B981" : "#EF4444"}
                                    />
                                </View>
                                <Text style={styles.modalTitle}>{statusModal.title}</Text>
                            </View>

                            <Text style={[styles.modalMessage, { textAlign: 'center', marginBottom: 24 }]}>
                                {statusModal.message}
                            </Text>

                            <View style={styles.modalFooter}>
                                {statusModal.type !== 'info' ? (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.modalBtn, styles.modalBtnSecondary]}
                                            onPress={() => setStatusModal(prev => ({ ...prev, visible: false }))}
                                        >
                                            <Text style={styles.modalBtnTextSecondary}>BATAL</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modalBtn, statusModal.type === 'danger' ? styles.modalBtnDanger : styles.modalBtnPrimary]}
                                            onPress={() => {
                                                setStatusModal(prev => ({ ...prev, visible: false }));
                                                statusModal.onConfirm();
                                            }}
                                        >
                                            <Text style={styles.modalBtnTextPrimary}>
                                                {statusModal.type === 'danger' ? 'YA, HAPUS' : 'YA, RESET'}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.modalBtn, styles.modalBtnPrimary, { width: '100%' }]}
                                        onPress={() => setStatusModal(prev => ({ ...prev, visible: false }))}
                                    >
                                        <Text style={styles.modalBtnTextPrimary}>OK</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: SmartHomeColors.cardBg,
    },
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: SmartHomeColors.cardBg,
        position: 'relative',
    },
    headerBackBtn: {
        padding: 4,
        marginLeft: -4,
        zIndex: 10,
    },
    headerTitleContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: SmartHomeColors.textPrimary,
        letterSpacing: -0.5,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 40,
        gap: 24,
    },
    section: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: SmartHomeColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    resetLink: {
        fontSize: 13,
        fontWeight: '700',
        color: SmartHomeColors.purple,
    },
    resetLinkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#F3E8FF',
        borderRadius: 8,
    },
    headerSaveBtn: {
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        zIndex: 10,
    },
    headerSaveText: {
        color: SmartHomeColors.purple,
        fontWeight: '800',
        fontSize: 14,
    },
    borderTop: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 24,
    },
    inputGroup: {
        gap: 8,
    },
    languageRow: {
        flexDirection: 'row',
        gap: 10,
    },
    languageChip: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(139, 92, 246, 0.03)',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
    },
    languageChipActive: {
        backgroundColor: '#F3E8FF',
        borderColor: '#C4B5FD',
    },
    languageChipText: {
        fontSize: 14,
        fontWeight: '700',
        color: SmartHomeColors.textSecondary,
    },
    languageChipTextActive: {
        color: SmartHomeColors.purple,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: SmartHomeColors.textSecondary,
    },
    input: {
        backgroundColor: 'rgba(139, 92, 246, 0.03)',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        paddingHorizontal: 18,
        height: 56,
        fontSize: 16,
        color: SmartHomeColors.textPrimary,
    },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FFF1F1',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    resetText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#EF4444',
    },
    hint: {
        fontSize: 12,
        color: SmartHomeColors.textMuted,
        textAlign: 'center',
    },
    versionContainer: {
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    saveBtnGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#F3E8FF',
        padding: 14,
        borderRadius: 14,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E9D5FF',
    },
    checkBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: SmartHomeColors.purple,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContainer: {
        backgroundColor: '#FFF',
        borderRadius: 28,
        width: '100%',
        maxWidth: 340,
        padding: 24,
        alignItems: 'center',
        boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
        elevation: 20,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 24,
        gap: 16,
    },
    modalIconBg: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#F3E8FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: SmartHomeColors.textPrimary,
        textAlign: 'center',
    },
    modalContent: {
        width: '100%',
        gap: 12,
        marginBottom: 24,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 20,
        gap: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    statusIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusIconOnline: {
        backgroundColor: '#ECFDF5',
    },
    statusIconOffline: {
        backgroundColor: '#FEF2F2',
    },
    statusInfo: {
        flex: 1,
    },
    statusLabel: {
        fontSize: 12,
        color: SmartHomeColors.textMuted,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    statusValue: {
        fontSize: 16,
        fontWeight: '800',
    },
    textOnline: {
        color: '#10B981',
    },
    textOffline: {
        color: '#EF4444',
    },
    modalCloseBtn: {
        backgroundColor: SmartHomeColors.purple,
        width: '100%',
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 4px 8px rgba(139, 92, 246, 0.2)',
        elevation: 4,
    },
    modalCloseBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
    },
    modalMessage: {
        fontSize: 15,
        color: SmartHomeColors.textSecondary,
        lineHeight: 22,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBtnPrimary: {
        backgroundColor: SmartHomeColors.purple,
    },
    modalBtnSecondary: {
        backgroundColor: '#F1F5F9',
    },
    modalBtnDanger: {
        backgroundColor: '#EF4444',
    },
    modalBtnTextPrimary: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '800',
    },
    modalBtnTextSecondary: {
        color: SmartHomeColors.textSecondary,
        fontSize: 14,
        fontWeight: '800',
    },
    batteryCard: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 20,
        gap: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    batteryInfo: {
        flexDirection: 'row',
        gap: 14,
        alignItems: 'center',
    },
    batteryTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: SmartHomeColors.textPrimary,
        marginBottom: 2,
    },
    batteryDesc: {
        fontSize: 13,
        color: SmartHomeColors.textMuted,
        lineHeight: 18,
    },
    batteryBtn: {
        backgroundColor: SmartHomeColors.purple,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        borderRadius: 12,
    },
    batteryBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '800',
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: SmartHomeColors.textPrimary,
    },
    resultSub: {
        fontSize: 13,
        color: SmartHomeColors.textSecondary,
        marginTop: 2,
    },
});
