import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Users, Truck, Package, DollarSign, AlertCircle, Shield } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { confirmAction, notify } from '@/lib/dialog';
import { ORDER_STATUS_CONFIG } from '@/mocks/data';
import type { UserRole } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
type TabType = 'overview' | 'orders' | 'people';
const ROLES: UserRole[] = ['customer', 'driver', 'admin'];

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminDashboardScreen() {
  const { profile, session } = useAuth();
  const userId = session?.user?.id ?? null;
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const isAdmin = profile?.role === 'admin';

  const profilesQuery = useQuery({
    queryKey: ['admin', 'profiles'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, estimated_price, final_price, customer_id, driver_id, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const profiles: any[] = profilesQuery.data ?? [];
  const orders: any[] = ordersQuery.data ?? [];
  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles]);

  const metrics = useMemo(() => {
    const delivered = orders.filter(o => o.status === 'delivered');
    const revenue = delivered.reduce((s, o) => s + Number(o.final_price ?? o.estimated_price ?? 0), 0);
    const active = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;
    const unassigned = orders.filter(o => !o.driver_id && o.status !== 'delivered' && o.status !== 'cancelled').length;
    return {
      revenue,
      active,
      unassigned,
      drivers: profiles.filter(p => p.role === 'driver').length,
      customers: profiles.filter(p => p.role === 'customer').length,
    };
  }, [orders, profiles]);

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'profiles'] }),
    onError: (e: any) => notify('Could not change role', e?.message ?? 'Please try again.'),
  });

  const changeRole = useCallback(
    (p: any, role: UserRole) => {
      if (p.role === role) return;
      if (p.id === userId) {
        notify('Heads up', "You can't change your own role.");
        return;
      }
      confirmAction('Change role', `Set ${p.name || p.email} to "${role}"?`, () => setRole.mutate({ id: p.id, role }));
    },
    [setRole, userId],
  );

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Shield size={40} color={Colors.textTertiary} />
        <Text style={styles.deniedText}>Admin access only</Text>
      </View>
    );
  }

  const loading = profilesQuery.isLoading || ordersQuery.isLoading;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.tabRow}>
        {(['overview', 'orders', 'people'] as TabType[]).map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />}

      {activeTab === 'overview' && (
        <>
          <View style={styles.metricsGrid}>
            <Metric icon={DollarSign} color={Colors.success} value={'$' + metrics.revenue.toFixed(2)} label="Revenue (delivered)" />
            <Metric icon={Package} color={Colors.primary} value={String(metrics.active)} label="Active orders" />
            <Metric icon={Truck} color={Colors.info} value={String(metrics.drivers)} label="Drivers" />
            <Metric icon={Users} color={Colors.accent} value={String(metrics.customers)} label="Customers" />
          </View>
          {metrics.unassigned > 0 && (
            <View style={styles.alertCard}>
              <AlertCircle size={18} color={Colors.warning} />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{metrics.unassigned} unassigned order{metrics.unassigned > 1 ? 's' : ''}</Text>
                <Text style={styles.alertSubtitle}>Waiting for a driver to accept.</Text>
              </View>
            </View>
          )}
          {!loading && orders.length === 0 && <Text style={styles.emptyText}>No orders yet.</Text>}
        </>
      )}

      {activeTab === 'orders' && (
        <>
          {!loading && orders.length === 0 && <Text style={styles.emptyText}>No orders yet.</Text>}
          {orders.map(o => {
            const cfg = ORDER_STATUS_CONFIG[o.status] || { label: o.status, color: Colors.textSecondary };
            const cust = profileMap[o.customer_id]?.name || 'Customer';
            const drv = o.driver_id ? profileMap[o.driver_id]?.name || 'Driver' : 'Unassigned';
            return (
              <View key={o.id} style={styles.orderRow}>
                <View style={styles.orderLeft}>
                  <View style={styles.orderIdRow}>
                    <Text style={styles.orderId}>{o.id}</Text>
                    <View style={[styles.orderStatusBadge, { backgroundColor: cfg.color + '15' }]}>
                      <Text style={[styles.orderStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.orderCustomer}>{cust} → {drv}</Text>
                </View>
                <Text style={styles.orderAmount}>${Number(o.final_price ?? o.estimated_price ?? 0).toFixed(2)}</Text>
              </View>
            );
          })}
        </>
      )}

      {activeTab === 'people' && (
        <>
          <Text style={styles.sectionHint}>Tap a role to change someone&apos;s access.</Text>
          {profiles.map(p => (
            <View key={p.id} style={styles.personRow}>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{p.name || '(no name)'}{p.id === userId ? '  · you' : ''}</Text>
                <Text style={styles.personEmail}>{p.email}</Text>
              </View>
              <View style={styles.roleBtnRow}>
                {ROLES.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleBtn, p.role === r && styles.roleBtnActive]}
                    onPress={() => changeRole(p, r)}
                    disabled={setRole.isPending}
                  >
                    <Text style={[styles.roleBtnText, p.role === r && styles.roleBtnTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Metric({ icon: Icon, color, value, label }: { icon: any; color: string; value: string; label: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: color + '12' }]}>
        <Icon size={18} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.background },
  deniedText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' as const },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 14, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  metricCard: {
    width: (SCREEN_WIDTH - 44) / 2, maxWidth: 240, backgroundColor: Colors.card, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  metricIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricValue: { fontSize: 22, fontWeight: '800' as const, color: Colors.text, marginBottom: 4 },
  metricLabel: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' as const },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.warningLight, borderRadius: 14, padding: 14, marginBottom: 16 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  alertSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  emptyText: { fontSize: 14, color: Colors.textTertiary, marginTop: 8 },
  orderRow: { backgroundColor: Colors.card, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderLeft: { flex: 1 },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  orderId: { fontSize: 14, fontWeight: '700' as const, color: Colors.text },
  orderStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  orderStatusText: { fontSize: 11, fontWeight: '600' as const },
  orderCustomer: { fontSize: 13, color: Colors.textSecondary },
  orderAmount: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  sectionHint: { fontSize: 13, color: Colors.textTertiary, marginBottom: 12 },
  personRow: { backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  personInfo: {},
  personName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  personEmail: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  roleBtnRow: { flexDirection: 'row', gap: 8 },
  roleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  roleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, textTransform: 'capitalize' },
  roleBtnTextActive: { color: '#fff' },
});
