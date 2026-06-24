import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Navigation,
  DollarSign,
  Star,
  Package,
  Clock,
  CheckCircle,
  MapPin,
  ArrowRight,
  LogOut,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useAppState } from '@/hooks/useAppState';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { confirmAction, notify } from '@/lib/dialog';
import { mockServices, ORDER_STATUS_CONFIG } from '@/mocks/data';
import type { Order, OrderStatus } from '@/types';

const DRIVER_FLOW: OrderStatus[] = [
  'driver_assigned',
  'driver_en_route',
  'picked_up',
  'at_facility',
  'washing',
  'drying',
  'folding',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
];

function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = DRIVER_FLOW.indexOf(status);
  return i >= 0 && i < DRIVER_FLOW.length - 1 ? DRIVER_FLOW[i + 1] : null;
}

function itemsLabel(order: Order): string {
  const names = order.services.map(s => mockServices.find(x => x.id === s)?.name ?? s).join(', ');
  return `${names} · ${order.estimatedPounds} lbs`;
}

function addressLabel(order: Order): string {
  const a = order.pickupAddress;
  if (!a) return 'Address unavailable';
  return [a.street, a.city].filter(Boolean).join(', ');
}

function slotLabel(order: Order): string {
  const s = order.pickupSlot;
  return s?.startTime ? `${s.startTime} - ${s.endTime}` : 'Flexible';
}

function amount(order: Order): number {
  return order.finalPrice ?? order.estimatedPrice ?? 0;
}

export default function DriverDashboardScreen() {
  const { session, profile, signOut } = useAuth();
  const userId = session?.user?.id ?? null;
  const { orders, claimOrder, updateOrderStatus, isLoading } = useAppState();
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const available = useMemo(
    () => orders.filter(o => !o.driverId && o.status !== 'delivered' && o.status !== 'cancelled'),
    [orders],
  );
  const active = useMemo(
    () => orders.filter(o => o.driverId === userId && o.status !== 'delivered' && o.status !== 'cancelled'),
    [orders, userId],
  );

  // While online with active jobs, stream live GPS to those orders so customers can track.
  const activeKey = useMemo(() => active.map(o => o.id).join(','), [active]);
  useEffect(() => {
    const ids = activeKey ? activeKey.split(',') : [];
    if (ids.length === 0 || !isOnline) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 6000 },
          (loc) => {
            const { latitude, longitude, heading } = loc.coords;
            ids.forEach((id) => {
              void supabase
                .from('orders')
                .update({
                  driver_lat: latitude,
                  driver_lng: longitude,
                  driver_heading: heading ?? null,
                  driver_loc_updated_at: new Date().toISOString(),
                })
                .eq('id', id);
            });
          },
        );
      } catch {
        // location permission denied or unavailable — skip silently
      }
    })();
    return () => { cancelled = true; sub?.remove(); };
  }, [activeKey, isOnline]);
  const completed = useMemo(
    () => orders.filter(o => o.driverId === userId && o.status === 'delivered'),
    [orders, userId],
  );

  const todayStr = new Date().toDateString();
  const earnings = useMemo(() => {
    const total = completed.reduce((s, o) => s + amount(o), 0);
    const today = completed
      .filter(o => new Date(o.updatedAt).toDateString() === todayStr)
      .reduce((s, o) => s + amount(o), 0);
    const rated = completed.filter(o => typeof o.rating === 'number');
    const avg = rated.length ? rated.reduce((s, o) => s + (o.rating ?? 0), 0) / rated.length : null;
    return { total, today, jobs: completed.length, rating: avg };
  }, [completed, todayStr]);

  const haptic = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(style);
  }, []);

  const handleClaim = useCallback((order: Order) => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    claimOrder(order.id);
    notify('Job accepted', `${order.id} is yours. Head to the pickup address.`);
  }, [claimOrder, haptic]);

  const handleAdvance = useCallback((order: Order) => {
    const next = nextStatus(order.status);
    if (!next) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    updateOrderStatus(order.id, next);
  }, [updateOrderStatus, haptic]);

  const handleNavigate = useCallback((order: Order) => {
    const q = encodeURIComponent(addressLabel(order));
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{profile?.name || 'Driver'}</Text>
          <Text style={styles.headerEmail} numberOfLines={1}>{profile?.email}</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => confirmAction('Log Out', 'Log out?', () => { void signOut(); }, 'Log Out')}
        >
          <LogOut size={16} color={Colors.error} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.onlineRow}>
        <View style={styles.onlineInfo}>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? Colors.success : Colors.textTertiary }]} />
          <Text style={styles.onlineText}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={(v) => { haptic(Haptics.ImpactFeedbackStyle.Light); setIsOnline(v); }}
          trackColor={{ false: Colors.border, true: Colors.success + '40' }}
          thumbColor={isOnline ? Colors.success : Colors.textTertiary}
        />
      </View>

      <View style={styles.earningsCard}>
        <LinearGradient colors={[Colors.primary, Colors.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.earningsGradient}>
          <Text style={styles.earningsLabel}>Today&apos;s Earnings{profile?.name ? ` · ${profile.name.split(' ')[0]}` : ''}</Text>
          <Text style={styles.earningsValue}>${earnings.today.toFixed(2)}</Text>
          <View style={styles.earningsStats}>
            <View style={styles.earningStat}>
              <DollarSign size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.earningStatValue}>${earnings.total.toFixed(0)}</Text>
              <Text style={styles.earningStatLabel}>All Time</Text>
            </View>
            <View style={styles.earningStatDivider} />
            <View style={styles.earningStat}>
              <Package size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.earningStatValue}>{earnings.jobs}</Text>
              <Text style={styles.earningStatLabel}>Jobs</Text>
            </View>
            <View style={styles.earningStatDivider} />
            <View style={styles.earningStat}>
              <Star size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.earningStatValue}>{earnings.rating != null ? earnings.rating.toFixed(1) : '—'}</Text>
              <Text style={styles.earningStatLabel}>Rating</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {isLoading && active.length === 0 && available.length === 0 && (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
      )}

      {active.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Active Jobs ({active.length})</Text>
          {active.map(order => {
            const next = nextStatus(order.status);
            const cfg = ORDER_STATUS_CONFIG[order.status];
            return (
              <View key={order.id} style={styles.activeJobCard}>
                <View style={styles.activeJobHeader}>
                  <View style={styles.activeJobCustomer}>
                    <View style={styles.customerAvatar}>
                      <Package size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeJobName}>{order.id}</Text>
                      <Text style={styles.activeJobItems}>{itemsLabel(order)}</Text>
                    </View>
                  </View>
                  <Text style={styles.activeJobEarnings}>${amount(order).toFixed(2)}</Text>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: (cfg?.color ?? Colors.info) + '15' }]}>
                  <Text style={[styles.statusBadgeText, { color: cfg?.color ?? Colors.info }]}>{cfg?.label ?? order.status}</Text>
                </View>

                <View style={styles.activeJobAddress}>
                  <MapPin size={16} color={Colors.primary} />
                  <Text style={styles.activeJobAddressText}>{addressLabel(order)}</Text>
                </View>

                <View style={styles.activeJobActions}>
                  <TouchableOpacity style={styles.actionBtnSecondaryWide} onPress={() => handleNavigate(order)}>
                    <Navigation size={16} color={Colors.primary} />
                    <Text style={styles.actionBtnSecondaryText}>Navigate</Text>
                  </TouchableOpacity>
                  {next ? (
                    <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => handleAdvance(order)}>
                      <Text style={styles.actionBtnPrimaryText}>Mark {ORDER_STATUS_CONFIG[next]?.label ?? next}</Text>
                      <ArrowRight size={16} color="#fff" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </>
      )}

      <Text style={styles.sectionTitle}>Available Pickups ({available.length})</Text>
      {available.length === 0 && !isLoading && (
        <Text style={styles.emptyText}>No available pickups right now. New orders will appear here.</Text>
      )}
      {available.map(order => (
        <View key={order.id} style={styles.jobCard}>
          <View style={styles.jobHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobCustomer}>{order.id}</Text>
              <Text style={styles.jobItems}>{itemsLabel(order)}</Text>
            </View>
            <View style={styles.jobRight}>
              <Text style={styles.jobEarnings}>${amount(order).toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.jobAddressRow}>
            <MapPin size={14} color={Colors.textTertiary} />
            <Text style={styles.jobAddress}>{addressLabel(order)}</Text>
          </View>
          <View style={styles.jobTimeRow}>
            <Clock size={14} color={Colors.textTertiary} />
            <Text style={styles.jobTime}>{slotLabel(order)}</Text>
          </View>
          <View style={styles.jobActions}>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleClaim(order)}>
              <LinearGradient colors={[Colors.success, '#059669']} style={styles.acceptBtnGradient}>
                <Text style={styles.acceptBtnText}>Accept Job</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {completed.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Completed</Text>
          {completed.map(order => (
            <View key={order.id} style={styles.completedCard}>
              <View style={styles.completedLeft}>
                <CheckCircle size={18} color={Colors.success} />
                <View>
                  <Text style={styles.completedName}>{order.id}</Text>
                  <Text style={styles.completedItems}>{itemsLabel(order)}</Text>
                </View>
              </View>
              <View style={styles.completedRight}>
                <Text style={styles.completedEarnings}>${amount(order).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 18, fontWeight: '800' as const, color: Colors.text },
  headerEmail: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.errorLight },
  logoutBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.error },
  onlineRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 12,
  },
  onlineInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  onlineText: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  earningsCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
  earningsGradient: { padding: 24 },
  earningsLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' as const },
  earningsValue: { fontSize: 36, fontWeight: '800' as const, color: '#fff', marginTop: 4, marginBottom: 20 },
  earningsStats: { flexDirection: 'row', justifyContent: 'space-around' },
  earningStat: { alignItems: 'center', gap: 4 },
  earningStatValue: { fontSize: 16, fontWeight: '700' as const, color: '#fff' },
  earningStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  earningStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  sectionTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.text, marginBottom: 12, marginTop: 4 },
  emptyText: { fontSize: 14, color: Colors.textTertiary, marginBottom: 16, lineHeight: 20 },
  activeJobCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 2, borderColor: Colors.primary + '30',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  activeJobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activeJobCustomer: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  customerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  activeJobName: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  activeJobItems: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  activeJobEarnings: { fontSize: 18, fontWeight: '800' as const, color: Colors.success },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginBottom: 12 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' as const },
  activeJobAddress: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceAlt, padding: 12, borderRadius: 10, marginBottom: 14,
  },
  activeJobAddressText: { fontSize: 13, color: Colors.text, flex: 1 },
  activeJobActions: { flexDirection: 'row', gap: 10 },
  actionBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 12,
  },
  actionBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '600' as const },
  actionBtnSecondaryWide: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary + '10', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12,
  },
  actionBtnSecondaryText: { color: Colors.primary, fontSize: 14, fontWeight: '600' as const },
  jobCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  jobCustomer: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  jobItems: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  jobRight: { alignItems: 'flex-end' },
  jobEarnings: { fontSize: 16, fontWeight: '700' as const, color: Colors.success },
  jobAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  jobAddress: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  jobTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  jobTime: { fontSize: 13, color: Colors.textSecondary },
  jobActions: { flexDirection: 'row', gap: 10 },
  acceptBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  acceptBtnGradient: { paddingVertical: 12, alignItems: 'center' },
  acceptBtnText: { fontSize: 14, fontWeight: '600' as const, color: '#fff' },
  completedCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  completedLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  completedName: { fontSize: 14, fontWeight: '700' as const, color: Colors.text },
  completedItems: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  completedRight: { alignItems: 'flex-end' },
  completedEarnings: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
});
