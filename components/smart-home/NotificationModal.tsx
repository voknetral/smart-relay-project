import { SmartHomeColors } from '@/constants/theme';
import { TXT } from '@/constants/translations';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    timestamp: Date;
    type: 'info' | 'success' | 'warning';
}

interface NotificationModalProps {
    visible: boolean;
    onClose: () => void;
    notifications: NotificationItem[];
    onClearAll: () => void;
}

export function NotificationModal({
    visible,
    onClose,
    notifications,
    onClearAll,
}: NotificationModalProps) {
    const insets = useSafeAreaInsets();
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                            <Text style={styles.title}>{TXT.common.notifications}</Text>
                            {notifications.length > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{notifications.length}</Text>
                                </View>
                            )}
                        </View>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                        {notifications.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="notifications-off-outline" size={48} color={SmartHomeColors.textMuted} />
                                <Text style={styles.emptyText}>{TXT.common.noNotifications}</Text>
                            </View>
                        ) : (
                            notifications.map((item) => (
                                <View key={item.id} style={styles.item}>
                                    <View style={[styles.typeIndicator, { backgroundColor: getTypeColor(item.type) }]} />
                                    <View style={styles.itemContent}>
                                        <View style={styles.itemHeader}>
                                            <Text style={styles.itemTitle}>{item.title}</Text>
                                            <Text style={styles.itemTime}>{formatTime(item.timestamp)}</Text>
                                        </View>
                                        <Text style={styles.itemMessage}>{item.message}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>

                    {notifications.length > 0 && (
                        <TouchableOpacity onPress={onClearAll} style={styles.clearBtn}>
                            <Text style={styles.clearBtnText}>{TXT.common.clearAll}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

function getTypeColor(type: NotificationItem['type']) {
    switch (type) {
        case 'success': return '#10B981';
        case 'warning': return '#F97316';
        default: return SmartHomeColors.purple;
    }
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
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
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: SmartHomeColors.textPrimary,
        letterSpacing: -0.5,
    },
    badge: {
        backgroundColor: SmartHomeColors.purple,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8,
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800',
    },
    list: {
        flexGrow: 0,
        paddingBottom: 20,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
        color: SmartHomeColors.textMuted,
        fontWeight: '600',
    },
    item: {
        flexDirection: 'row',
        backgroundColor: '#F8F9FF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        alignItems: 'center',
        gap: 12,
    },
    typeIndicator: {
        width: 4,
        height: '100%',
        borderRadius: 2,
    },
    itemContent: {
        flex: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: SmartHomeColors.textPrimary,
    },
    itemTime: {
        fontSize: 11,
        color: SmartHomeColors.textMuted,
        fontWeight: '600',
    },
    itemMessage: {
        fontSize: 13,
        color: SmartHomeColors.textSecondary,
        lineHeight: 18,
    },
    clearBtn: {
        marginTop: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: SmartHomeColors.divider,
    },
    clearBtnText: {
        color: '#EF4444',
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
