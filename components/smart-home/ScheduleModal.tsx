import { SmartHomeColors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { Storage } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Platform,
    Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface Schedule {
    id: string;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    isEnabled: boolean;
    name?: string;
}

interface ScheduleTemplate {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
}

interface ScheduleModalProps {
    visible: boolean;
    onClose: () => void;
    deviceName: string;
    schedules: Schedule[];
    onUpdateSchedules: (schedules: Schedule[]) => void;
}

const checkOverlap = (s1: string, e1: string, s2: string, e2: string) => {
    const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const mS1 = toMins(s1), mE1 = toMins(e1), mS2 = toMins(s2), mE2 = toMins(e2);
    
    // Jika melewati tengah malam (misal 23:00 ke 01:00), pecah jadi 2 segmen: [23:00 - 24:00] dan [00:00 - 01:00]
    const segs1 = mS1 < mE1 ? [[mS1, mE1]] : [[mS1, 1440], [0, mE1]];
    const segs2 = mS2 < mE2 ? [[mS2, mE2]] : [[mS2, 1440], [0, mE2]];
    
    for (const [a1, b1] of segs1) {
        for (const [a2, b2] of segs2) {
            if (Math.max(a1, a2) < Math.min(b1, b2)) return true; // Tabrakan rentang waktu!
        }
    }
    return false;
};

export function ScheduleModal({
    visible,
    onClose,
    deviceName,
    schedules,
    onUpdateSchedules,
}: ScheduleModalProps) {
    const { TXT } = useLanguage();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState('');
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [startDateTime, setStartDateTime] = useState(new Date());
    const [endDateTime, setEndDateTime] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [scheduleTemplates, setScheduleTemplates] = useState<ScheduleTemplate[]>([]);

    const formatTime = (date: Date) => {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const dateFromTime = (time: string) => {
        const date = new Date();
        const [hours, minutes] = time.split(':').map(Number);
        date.setHours(hours, minutes, 0, 0);
        return date;
    };

    useEffect(() => {
        if (!visible) return;

        const loadTemplates = async () => {
            const templates = await Storage.loadScheduleTemplates();
            setScheduleTemplates(templates);
        };

        loadTemplates();
    }, [visible]);

    const onStartChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowStartPicker(false);
        if (selectedDate) {
            setStartDateTime(selectedDate);
        }
    };

    const onEndChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowEndPicker(false);
        if (selectedDate) {
            setEndDateTime(selectedDate);
        }
    };

    const addSchedule = () => {
        const timeStr = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        const startStr = timeStr(startDateTime);
        const endStr = timeStr(endDateTime);

        if (startStr === endStr) {
            const msg = "Waktu nyala (Start) dan mati (End) tidak boleh sama persis.";
            if (Platform.OS === 'web') window.alert(msg); else Alert.alert("Waktu Tidak Valid", msg);
            return;
        }

        const conflict = schedules.find(s => {
            if (s.id === editingScheduleId) return false;
            // Abaikan jadwal yang sedang dalam keadaan mati (disabled) saat mengecek bentrokan
            if (!s.isEnabled) return false;
            return checkOverlap(startStr, endStr, s.startTime, s.endTime);
        });

        if (conflict) {
            const conflictName = conflict.name || 'Jadwal Lain';
            const msg = `Waktu bentrok dengan "${conflictName}".\nTidak boleh ada waktu nyala/mati yang bersinggungan di jadwal yang sama.`;
            if (Platform.OS === 'web') window.alert(msg); else Alert.alert("Jadwal Bentrok", msg);
            return;
        }

        if (editingScheduleId) {
            onUpdateSchedules(
                schedules.map((s) =>
                    s.id === editingScheduleId
                        ? { ...s, name: name.trim() || undefined, startTime: startStr, endTime: endStr }
                        : s
                )
            );
            setEditingScheduleId(null);
        } else {
            const newSched: Schedule = {
                id: Math.random().toString(36).substr(2, 9),
                name: name.trim() || undefined,
                startTime: startStr,
                endTime: endStr,
                isEnabled: true,
            };
            onUpdateSchedules([...schedules, newSched]);
        }
        setName('');
    };

    const startEditing = (s: Schedule) => {
        setEditingScheduleId(s.id);
        setName(s.name || '');
        const d1 = new Date();
        const [h1, m1] = s.startTime.split(':');
        d1.setHours(parseInt(h1), parseInt(m1));
        setStartDateTime(d1);

        const d2 = new Date();
        const [h2, m2] = s.endTime.split(':');
        d2.setHours(parseInt(h2), parseInt(m2));
        setEndDateTime(d2);
    };

    const cancelEditing = () => {
        setEditingScheduleId(null);
        setName('');
    };

    const saveCurrentAsTemplate = async () => {
        const startStr = formatTime(startDateTime);
        const endStr = formatTime(endDateTime);
        const templateName = (name || `${startStr} - ${endStr}`).trim();

        const nextTemplates: ScheduleTemplate[] = [
            ...scheduleTemplates.filter((template) => template.name !== templateName),
            {
                id: Math.random().toString(36).slice(2, 11),
                name: templateName,
                startTime: startStr,
                endTime: endStr,
            },
        ];

        setScheduleTemplates(nextTemplates);
        await Storage.saveScheduleTemplates(nextTemplates);

        if (Platform.OS === 'web') {
            window.alert(`Template "${templateName}" berhasil disimpan.`);
        } else {
            Alert.alert('Template Tersimpan', `Template "${templateName}" siap dipakai lagi.`);
        }
    };

    const applyTemplate = (template: ScheduleTemplate) => {
        setName(template.name);
        setStartDateTime(dateFromTime(template.startTime));
        setEndDateTime(dateFromTime(template.endTime));
    };

    const removeTemplate = async (templateId: string) => {
        const nextTemplates = scheduleTemplates.filter((template) => template.id !== templateId);
        setScheduleTemplates(nextTemplates);
        await Storage.saveScheduleTemplates(nextTemplates);
    };

    const removeSchedule = (id: string) => {
        onUpdateSchedules(schedules.filter((s) => s.id !== id));
    };

    const toggleSchedule = (id: string) => {
        const target = schedules.find(s => s.id === id);
        if (!target) return;

        // Jika akan diaktifkan dari mati ke nyala, pastikan tidak bentrok dengan jadwal aktif lain
        if (!target.isEnabled) {
            const conflict = schedules.find(s => {
                if (s.id === id) return false;
                if (!s.isEnabled) return false;
                return checkOverlap(target.startTime, target.endTime, s.startTime, s.endTime);
            });

            if (conflict) {
                const msg = `Gagal mengaktifkan jadwal.\nWaktunya bentrok dengan jadwal aktif lain: "${conflict.name || 'Jadwal Lain'}".`;
                if (Platform.OS === 'web') window.alert(msg); else Alert.alert("Tabrakan Jadwal", msg);
                return;
            }
        }

        onUpdateSchedules(
            schedules.map((s) =>
                s.id === id ? { ...s, isEnabled: !s.isEnabled } : s
            )
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            statusBarTranslucent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContainer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.headerBackBtn}>
                            <Ionicons name="chevron-back" size={28} color={SmartHomeColors.textPrimary} />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.title} numberOfLines={1}>{deviceName}</Text>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView style={styles.list}>
                        {scheduleTemplates.length > 0 && (
                            <View style={styles.templateSection}>
                                <View style={styles.templateHeader}>
                                    <Text style={styles.templateTitle}>Template Jadwal</Text>
                                    <Text style={styles.templateSubtitle}>Pakai ulang tanpa buat dari awal</Text>
                                </View>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.templateRow}
                                >
                                    {scheduleTemplates.map((template) => (
                                        <TouchableOpacity
                                            key={template.id}
                                            style={styles.templateChip}
                                            onPress={() => applyTemplate(template)}
                                        >
                                            <View style={styles.templateChipContent}>
                                                <Text style={styles.templateChipName}>{template.name}</Text>
                                                <Text style={styles.templateChipTime}>
                                                    {template.startTime} - {template.endTime}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => removeTemplate(template.id)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons name="close" size={16} color={SmartHomeColors.textMuted} />
                                            </TouchableOpacity>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {schedules.length === 0 ? (
                            <Text style={styles.emptyText}>{TXT.device.noSchedules}</Text>
                        ) : (
                            schedules.map((s) => (
                                <TouchableOpacity
                                    key={s.id}
                                    style={[styles.item, !s.isEnabled && styles.itemDisabled]}
                                    onPress={() => startEditing(s)}
                                >
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName}>{s.name || TXT.device.schedules}</Text>
                                        <View style={styles.timeRow}>
                                            <Text style={styles.itemTime}>{s.startTime}</Text>
                                            <View style={styles.timeDivider} />
                                            <Text style={styles.itemTime}>{s.endTime}</Text>
                                        </View>
                                        <View style={[styles.statusTag, s.isEnabled ? styles.statusTagActive : styles.statusTagInactive]}>
                                            <View style={[styles.statusTagDot, { backgroundColor: s.isEnabled ? '#10B981' : SmartHomeColors.textMuted }]} />
                                            <Text style={[styles.statusTagText, { color: s.isEnabled ? '#10B981' : SmartHomeColors.textMuted }]}>
                                                {s.isEnabled ? TXT.device.enabled : TXT.common.off}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.itemActions}>
                                        <Switch
                                            value={s.isEnabled}
                                            onValueChange={() => toggleSchedule(s.id)}
                                            trackColor={{ false: '#CBD5E1', true: '#8B5CF688' }}
                                            thumbColor={s.isEnabled ? SmartHomeColors.purple : '#F1F5F9'}
                                            ios_backgroundColor="#CBD5E1"
                                        />
                                        <TouchableOpacity onPress={() => removeSchedule(s.id)} style={styles.deleteBtn}>
                                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>

                    <View style={styles.addForm}>
                        <View style={styles.addHeader}>
                            <Text style={styles.addTitle}>{editingScheduleId ? TXT.device.editDevice : TXT.device.addSchedule}</Text>
                            {editingScheduleId && (
                                <TouchableOpacity onPress={cancelEditing}>
                                    <Text style={styles.cancelLink}>{TXT.common.cancel}</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.fieldLabelSmall}>{TXT.device.scheduleName}</Text>
                            <TextInput
                                style={styles.nameInput}
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g. Lampu Pagi"
                                placeholderTextColor={SmartHomeColors.textMuted}
                            />
                        </View>

                        <View style={styles.fieldLabelRow}>
                            <Text style={styles.fieldLabel}>{TXT.device.startTime}</Text>
                            <Text style={styles.fieldLabel}>{TXT.device.endTime}</Text>
                        </View>
                        <View style={styles.inputRow}>
                            <TouchableOpacity
                                style={styles.timePickerBtn}
                                onPress={() => setShowStartPicker(true)}
                            >
                                <Text style={styles.timePickerText}>{formatTime(startDateTime)}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.timePickerBtn}
                                onPress={() => setShowEndPicker(true)}
                            >
                                <Text style={styles.timePickerText}>{formatTime(endDateTime)}</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={addSchedule} style={[styles.addBtnFull, editingScheduleId && styles.saveBtnEdit]}>
                            <Ionicons name={editingScheduleId ? "checkmark" : "add"} size={24} color="#FFF" />
                            <Text style={styles.addBtnText}>{editingScheduleId ? TXT.common.save : TXT.device.addSchedule}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={saveCurrentAsTemplate} style={styles.templateSaveBtn}>
                            <Ionicons name="bookmark-outline" size={18} color={SmartHomeColors.purple} />
                            <Text style={styles.templateSaveText}>Simpan sebagai template</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {showStartPicker && (
                <DateTimePicker
                    value={startDateTime}
                    mode="time"
                    is24Hour={true}
                    display="default"
                    onChange={onStartChange}
                />
            )}

            {showEndPicker && (
                <DateTimePicker
                    value={endDateTime}
                    mode="time"
                    is24Hour={true}
                    display="default"
                    onChange={onEndChange}
                />
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: SmartHomeColors.cardBg,
        padding: 24,
        flex: 1,
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
    list: {
        marginBottom: 20,
        paddingBottom: 20,
    },
    templateSection: {
        marginBottom: 18,
        gap: 10,
    },
    templateHeader: {
        gap: 2,
    },
    templateTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: SmartHomeColors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    templateSubtitle: {
        fontSize: 12,
        color: SmartHomeColors.textMuted,
    },
    templateRow: {
        gap: 10,
        paddingRight: 16,
    },
    templateChip: {
        minWidth: 180,
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    templateChipContent: {
        flex: 1,
        gap: 4,
    },
    templateChipName: {
        fontSize: 13,
        fontWeight: '700',
        color: SmartHomeColors.textPrimary,
    },
    templateChipTime: {
        fontSize: 12,
        color: SmartHomeColors.textMuted,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        color: SmartHomeColors.textMuted,
        marginVertical: 40,
        fontSize: 16,
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    itemDisabled: {
        backgroundColor: '#F8F9FF',
        borderColor: 'transparent',
    },
    itemInfo: {
        flex: 1,
        gap: 4,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '700',
        color: SmartHomeColors.textSecondary,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    itemTime: {
        fontSize: 18,
        fontWeight: '800',
        color: SmartHomeColors.textPrimary,
    },
    timeDivider: {
        width: 10,
        height: 2,
        backgroundColor: SmartHomeColors.textMuted,
        borderRadius: 1,
        opacity: 0.3,
    },
    statusTag: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 5,
    },
    statusTagActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    statusTagInactive: {
        backgroundColor: '#F1F5F9',
    },
    statusTagDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    statusTagText: {
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    itemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    deleteBtn: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addForm: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: SmartHomeColors.divider,
    },
    addHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    addTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: SmartHomeColors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    cancelLink: {
        fontSize: 13,
        fontWeight: '700',
        color: '#EF4444',
    },
    inputGroup: {
        marginBottom: 16,
    },
    fieldLabelSmall: {
        fontSize: 11,
        fontWeight: '700',
        color: SmartHomeColors.textMuted,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    nameInput: {
        backgroundColor: '#F8F9FF',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 46,
        fontSize: 14,
        color: SmartHomeColors.textPrimary,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    fieldLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: SmartHomeColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        width: '48%', // Balanced with the buttons below
        textAlign: 'center',
    },
    timePickerBtn: {
        flex: 1,
        backgroundColor: '#F8F9FF',
        borderRadius: 12,
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    timePickerText: {
        fontSize: 16,
        fontWeight: '700',
        color: SmartHomeColors.textPrimary,
    },
    addBtnFull: {
        height: 50,
        borderRadius: 14,
        backgroundColor: SmartHomeColors.purple,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 4px 8px rgba(139, 92, 246, 0.2)',
        elevation: 4,
        gap: 8,
    },
    saveBtnEdit: {
        backgroundColor: '#10B981',
        boxShadow: '0 4px 8px rgba(16, 185, 129, 0.2)',
    },
    addBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    templateSaveBtn: {
        marginTop: 12,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#D8B4FE',
        backgroundColor: '#F8F4FF',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    templateSaveText: {
        fontSize: 14,
        fontWeight: '700',
        color: SmartHomeColors.purple,
    },
});
