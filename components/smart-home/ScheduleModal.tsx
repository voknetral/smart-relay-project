import { SmartHomeColors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface Schedule {
    id: string;
    startTime: string;
    endTime: string;
    isEnabled: boolean;
    name?: string;
}

interface ScheduleModalProps {
    visible: boolean;
    onClose: () => void;
    deviceName: string;
    schedules: Schedule[];
    onUpdateSchedules: (schedules: Schedule[]) => void;
}

const createDefaultRange = () => {
    const start = new Date();
    start.setSeconds(0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 5);

    return { start, end };
};

const checkOverlap = (s1: string, e1: string, s2: string, e2: string) => {
    const toMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const firstStart = toMinutes(s1);
    const firstEnd = toMinutes(e1);
    const secondStart = toMinutes(s2);
    const secondEnd = toMinutes(e2);

    const firstSegments = firstStart < firstEnd ? [[firstStart, firstEnd]] : [[firstStart, 1440], [0, firstEnd]];
    const secondSegments = secondStart < secondEnd ? [[secondStart, secondEnd]] : [[secondStart, 1440], [0, secondEnd]];

    for (const [a1, b1] of firstSegments) {
        for (const [a2, b2] of secondSegments) {
            if (Math.max(a1, a2) < Math.min(b1, b2)) {
                return true;
            }
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
    const [startDateTime, setStartDateTime] = useState(() => createDefaultRange().start);
    const [endDateTime, setEndDateTime] = useState(() => createDefaultRange().end);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const formatTime = (date: Date) =>
        `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    const dateFromTime = (time: string) => {
        const date = new Date();
        const [hours, minutes] = time.split(':').map(Number);
        date.setHours(hours, minutes, 0, 0);
        return date;
    };

    const resetForm = () => {
        const { start, end } = createDefaultRange();
        setEditingScheduleId(null);
        setName('');
        setStartDateTime(start);
        setEndDateTime(end);
        setShowStartPicker(false);
        setShowEndPicker(false);
    };

    useEffect(() => {
        if (visible) {
            resetForm();
        };
    }, [visible]);

    const onStartChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowStartPicker(false);
        if (selectedDate) {
            setStartDateTime(selectedDate);
        }
    };

    const onEndChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowEndPicker(false);
        if (selectedDate) {
            setEndDateTime(selectedDate);
        }
    };

    const submitSchedule = () => {
        const startStr = formatTime(startDateTime);
        const endStr = formatTime(endDateTime);

        if (startStr === endStr) {
            const message = 'Waktu nyala dan mati tidak boleh sama.';
            if (Platform.OS === 'web') {
                window.alert(message);
            } else {
                Alert.alert('Waktu Tidak Valid', message);
            }
            return;
        }

        const conflict = schedules.find((schedule) => {
            if (schedule.id === editingScheduleId) {
                return false;
            }

            if (!schedule.isEnabled) {
                return false;
            }

            return checkOverlap(startStr, endStr, schedule.startTime, schedule.endTime);
        });

        if (conflict) {
            const conflictName = conflict.name || TXT.device.schedules;
            const message = `Waktu bentrok dengan "${conflictName}".`;
            if (Platform.OS === 'web') {
                window.alert(message);
            } else {
                Alert.alert('Jadwal Bentrok', message);
            }
            return;
        }

        if (editingScheduleId) {
            onUpdateSchedules(
                schedules.map((schedule) =>
                    schedule.id === editingScheduleId
                        ? {
                              ...schedule,
                              name: name.trim() || undefined,
                              startTime: startStr,
                              endTime: endStr,
                          }
                        : schedule
                )
            );
        } else {
            onUpdateSchedules([
                ...schedules,
                {
                    id: Math.random().toString(36).slice(2, 11),
                    name: name.trim() || undefined,
                    startTime: startStr,
                    endTime: endStr,
                    isEnabled: false,
                },
            ]);
        }

        resetForm();
    };

    const startEditing = (schedule: Schedule) => {
        setEditingScheduleId(schedule.id);
        setName(schedule.name || '');
        setStartDateTime(dateFromTime(schedule.startTime));
        setEndDateTime(dateFromTime(schedule.endTime));
    };

    const removeSchedule = (id: string) => {
        onUpdateSchedules(schedules.filter((schedule) => schedule.id !== id));
        if (editingScheduleId === id) {
            resetForm();
        }
    };

    const toggleSchedule = (id: string) => {
        const target = schedules.find((schedule) => schedule.id === id);
        if (!target) {
            return;
        }

        if (!target.isEnabled) {
            const conflict = schedules.find((schedule) => {
                if (schedule.id === id || !schedule.isEnabled) {
                    return false;
                }

                return checkOverlap(target.startTime, target.endTime, schedule.startTime, schedule.endTime);
            });

            if (conflict) {
                const message = `Gagal mengaktifkan jadwal. Waktunya bentrok dengan "${conflict.name || TXT.device.schedules}".`;
                if (Platform.OS === 'web') {
                    window.alert(message);
                } else {
                    Alert.alert('Tabrakan Jadwal', message);
                }
                return;
            }
        }

        onUpdateSchedules(
            schedules.map((schedule) =>
                schedule.id === id ? { ...schedule, isEnabled: !schedule.isEnabled } : schedule
            )
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContainer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.headerBackBtn}>
                            <Ionicons name="chevron-back" size={28} color={SmartHomeColors.textPrimary} />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.title} numberOfLines={1}>
                                {deviceName}
                            </Text>
                        </View>
                        <View style={styles.headerSpacer} />
                    </View>

                    <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{TXT.device.schedules}</Text>
                        </View>

                        {schedules.length === 0 ? (
                            <Text style={styles.emptyText}>{TXT.device.noSchedules}</Text>
                        ) : (
                            schedules.map((schedule) => (
                                <TouchableOpacity
                                    key={schedule.id}
                                    style={[styles.item, !schedule.isEnabled && styles.itemDisabled]}
                                    onPress={() => startEditing(schedule)}
                                >
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName}>{schedule.name || TXT.device.schedules}</Text>
                                        <View style={styles.timeRow}>
                                            <Text style={styles.itemTime}>{schedule.startTime}</Text>
                                            <View style={styles.timeDivider} />
                                            <Text style={styles.itemTime}>{schedule.endTime}</Text>
                                        </View>
                                        <View
                                            style={[
                                                styles.statusTag,
                                                schedule.isEnabled ? styles.statusTagActive : styles.statusTagInactive,
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.statusTagDot,
                                                    {
                                                        backgroundColor: schedule.isEnabled
                                                            ? '#10B981'
                                                            : SmartHomeColors.textMuted,
                                                    },
                                                ]}
                                            />
                                            <Text
                                                style={[
                                                    styles.statusTagText,
                                                    {
                                                        color: schedule.isEnabled
                                                            ? '#10B981'
                                                            : SmartHomeColors.textMuted,
                                                    },
                                                ]}
                                            >
                                                {schedule.isEnabled ? TXT.device.enabled : TXT.common.off}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.itemActions}>
                                        <Switch
                                            value={schedule.isEnabled}
                                            onValueChange={() => toggleSchedule(schedule.id)}
                                            trackColor={{ false: '#CBD5E1', true: '#8B5CF688' }}
                                            thumbColor={schedule.isEnabled ? SmartHomeColors.purple : '#F1F5F9'}
                                            ios_backgroundColor="#CBD5E1"
                                        />
                                        <TouchableOpacity
                                            onPress={() => removeSchedule(schedule.id)}
                                            style={styles.deleteBtn}
                                        >
                                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>

                    <View style={styles.addForm}>
                        <View style={styles.addHeader}>
                            <Text style={styles.addTitle}>
                                {editingScheduleId ? TXT.device.editSchedule : TXT.device.addSchedule}
                            </Text>
                            {editingScheduleId && (
                                <TouchableOpacity onPress={resetForm}>
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
                            <TouchableOpacity style={styles.timePickerBtn} onPress={() => setShowStartPicker(true)}>
                                <Text style={styles.timePickerText}>{formatTime(startDateTime)}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.timePickerBtn} onPress={() => setShowEndPicker(true)}>
                                <Text style={styles.timePickerText}>{formatTime(endDateTime)}</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={submitSchedule}
                            style={[styles.addBtnFull, editingScheduleId && styles.saveBtnEdit]}
                        >
                            <Ionicons name={editingScheduleId ? 'checkmark' : 'add'} size={24} color="#FFF" />
                            <Text style={styles.addBtnText}>
                                {editingScheduleId ? TXT.common.save : TXT.device.addSchedule}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {showStartPicker && (
                <DateTimePicker
                    value={startDateTime}
                    mode="time"
                    is24Hour
                    display="default"
                    onChange={onStartChange}
                />
            )}

            {showEndPicker && (
                <DateTimePicker
                    value={endDateTime}
                    mode="time"
                    is24Hour
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
        flex: 1,
        backgroundColor: SmartHomeColors.cardBg,
        padding: 24,
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
        right: 0,
        bottom: 0,
        left: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: SmartHomeColors.textPrimary,
        letterSpacing: -0.5,
    },
    list: {
        marginBottom: 20,
    },
    listContent: {
        paddingBottom: 20,
    },
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: SmartHomeColors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
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
        height: 46,
        backgroundColor: '#F8F9FF',
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 14,
        color: SmartHomeColors.textPrimary,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    fieldLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    fieldLabel: {
        width: '48%',
        textAlign: 'center',
        fontSize: 11,
        fontWeight: '700',
        color: SmartHomeColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
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
});
