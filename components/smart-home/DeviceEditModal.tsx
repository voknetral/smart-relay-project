import { DeviceIconName } from '@/components/smart-home/DeviceCard';
import { SmartHomeColors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
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

const ICONS: { type: DeviceIconName; label: string; icon: string }[] = [
    { type: 'humidifier', label: 'Lembap', icon: 'water' },
    { type: 'plug', label: 'Colokan', icon: 'flash' },
    { type: 'light', label: 'Lampu', icon: 'bulb' },
    { type: 'fan', label: 'Kipas', icon: 'aperture' },
    { type: 'ac', label: 'AC', icon: 'snow' },
    { type: 'tv', label: 'TV', icon: 'tv' },
    { type: 'speaker', label: 'Speaker', icon: 'volume-high' },
    { type: 'coffee', label: 'Coffee', icon: 'cafe' },
    { type: 'lock', label: 'Lock', icon: 'lock-closed' },
    { type: 'camera', label: 'Kamera', icon: 'videocam' },
    { type: 'wifi', label: 'Router', icon: 'wifi' },
    { type: 'water', label: 'Pompa', icon: 'water-outline' },
    { type: 'flame', label: 'Heater', icon: 'flame' },
    { type: 'car', label: 'Garasi', icon: 'car-sport' },
];

interface DeviceEditModalProps {
    visible: boolean;
    onClose: () => void;
    deviceId: string;
    deviceName: string;
    deviceIcon: DeviceIconName;
    onSave: (newName: string, newIcon: DeviceIconName) => void;
    onDelete?: () => void;
}

export function DeviceEditModal({
    visible,
    onClose,
    deviceId,
    deviceName,
    deviceIcon,
    onSave,
    onDelete,
}: DeviceEditModalProps) {
    const { TXT } = useLanguage();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState(deviceName);
    const [selectedIcon, setSelectedIcon] = useState<DeviceIconName>(deviceIcon);
    const prevVisibleRef = useRef(false);

    // Sync state only when modal is opened or when switching to another device.
    useEffect(() => {
        const becameVisible = visible && !prevVisibleRef.current;
        if (becameVisible) {
            setName(deviceName);
            setSelectedIcon(deviceIcon);
        }
        prevVisibleRef.current = visible;
    }, [visible, deviceId, deviceName, deviceIcon]);

    const handleSave = () => {
        if (!name.trim()) return;
        onSave(name.trim(), selectedIcon);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            statusBarTranslucent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Math.max(insets.top, 12)}
                    style={styles.keyboardAvoiding}
                >
                    <View style={[styles.modalContent, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 24) }]}>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onClose} style={styles.headerBackBtn}>
                                <Ionicons name="chevron-back" size={28} color={SmartHomeColors.textPrimary} />
                            </TouchableOpacity>
                            <View style={styles.headerTitleContainer}>
                                <Text style={styles.title} numberOfLines={1}>{TXT.device.editDevice}</Text>
                            </View>
                            <View style={{ width: 40 }} />
                        </View>

                        <ScrollView
                            style={styles.body}
                            contentContainerStyle={styles.bodyContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{TXT.device.deviceName}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="e.g. Living Room Lamp"
                                    placeholderTextColor={SmartHomeColors.textMuted}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{TXT.device.deviceIcon}</Text>
                                <View style={styles.iconGrid}>
                                    {ICONS.map((item) => (
                                        <TouchableOpacity
                                            key={item.type}
                                            style={[
                                                styles.iconOption,
                                                selectedIcon === item.type && styles.iconOptionActive,
                                            ]}
                                            onPress={() => {
                                                setSelectedIcon(item.type);
                                            }}
                                        >
                                            <Ionicons
                                                name={(selectedIcon === item.type ? item.icon : `${item.icon}-outline`) as any}
                                                size={32}
                                                color={selectedIcon === item.type ? '#FFF' : SmartHomeColors.textPrimary}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                    {ICONS.length % 3 !== 0 && Array.from({ length: 3 - (ICONS.length % 3) }).map((_, i) => (
                                        <View key={`dummy-${i}`} style={{ width: '31%' }} />
                                    ))}
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.bottomSection}>
                            {onDelete && (
                                <TouchableOpacity style={styles.deleteZone} onPress={onDelete}>
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                    <Text style={styles.deleteText}>Hapus Perangkat</Text>
                                </TouchableOpacity>
                            )}
                            <View style={styles.footer}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                    <Text style={styles.cancelText}>{TXT.common.cancel}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
                                    onPress={handleSave}
                                    disabled={!name.trim()}
                                >
                                    <Text style={styles.saveText}>{TXT.device.saveChanges}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end',
    },
    keyboardAvoiding: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: SmartHomeColors.cardBg,
        padding: 24,
        flex: 1,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        position: 'relative',
        height: 48,
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
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: SmartHomeColors.textPrimary,
        letterSpacing: -0.5,
    },
    body: {
        flex: 1,
        marginBottom: 20,
    },
    bodyContent: {
        paddingBottom: 8,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: SmartHomeColors.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F8F9FF',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
        fontSize: 16,
        color: SmartHomeColors.textPrimary,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 12,
        justifyContent: 'space-between',
    },
    iconOption: {
        width: '31%',
        paddingVertical: 18,
        backgroundColor: '#F8F9FF',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    iconOptionActive: {
        backgroundColor: SmartHomeColors.purple,
        borderColor: SmartHomeColors.purple,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '700',
        color: SmartHomeColors.textSecondary,
    },
    saveBtn: {
        flex: 2,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: SmartHomeColors.purple,
    },
    saveBtnDisabled: {
        opacity: 0.5,
    },
    saveText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
    bottomSection: {
        gap: 12,
    },
    deleteZone: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 14,
        paddingVertical: 14,
        gap: 8,
    },
    deleteText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#EF4444',
    },
});
