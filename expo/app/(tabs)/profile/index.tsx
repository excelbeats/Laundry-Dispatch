import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  User,
  MapPin,
  CreditCard,
  Bell,
  CircleHelp,
  ChevronRight,
  Star,
  Shield,
  LogOut,
  Gift,
  Clock,
  Crown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAppState } from '@/hooks/useAppState';
import { useAuth } from '@/hooks/useAuth';
import { confirmAction } from '@/lib/dialog';

interface MenuItem {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  subtitle?: string;
  onPress: () => void;
  color?: string;
  badge?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orders, addresses } = useAppState();
  const { profile, signOut, isMember } = useAuth();
  const userName = profile?.name || 'there';

  const completedOrders = orders.filter(o => o.status === 'delivered').length;
  const defaultAddress = addresses.find(a => a.isDefault);

  const handleTap = useCallback((action: () => void) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    action();
  }, []);

  const accountItems: MenuItem[] = [
    {
      icon: Crown,
      label: 'Membership',
      subtitle: isMember ? 'Active member 🎉' : 'Free pickup + waived fees',
      onPress: () => router.push('/membership' as Href),
      color: Colors.accent,
    },
    {
      icon: User,
      label: 'Personal Info',
      subtitle: 'Name, email, phone',
      onPress: () => Alert.alert('Personal Info', 'Edit your profile details'),
    },
    {
      icon: MapPin,
      label: 'Saved Addresses',
      subtitle: `${addresses.length} addresses`,
      onPress: () => router.push('/add-address'),
    },
    {
      icon: CreditCard,
      label: 'Payment Methods',
      subtitle: 'Visa ****4242',
      onPress: () => Alert.alert('Payments', 'Manage your payment methods'),
    },
    {
      icon: Clock,
      label: 'Recurring Schedules',
      subtitle: 'Weekly pickup preferences',
      onPress: () => Alert.alert('Schedules', 'Set up recurring laundry pickups'),
    },
  ];

  const generalItems: MenuItem[] = [
    {
      icon: Bell,
      label: 'Notifications',
      onPress: () => router.push('/notifications'),
    },
    {
      icon: Gift,
      label: 'Promo Codes',
      subtitle: '1 active promo',
      onPress: () => Alert.alert('Promos', 'Use code FRESH20 for 20% off!'),
      badge: '1',
    },
    {
      icon: Star,
      label: 'Rate Us',
      onPress: () => Alert.alert('Thanks!', 'We appreciate your feedback'),
    },
    {
      icon: CircleHelp,
      label: 'Help & Support',
      onPress: () => Alert.alert('Support', 'How can we help?'),
    },
    {
      icon: Shield,
      label: 'Privacy & Terms',
      onPress: () => Alert.alert('Privacy', 'View our privacy policy'),
    },
  ];

  const renderMenuSection = (title: string, items: MenuItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.menuCard}>
        {items.map((item, idx) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.menuItem,
              idx < items.length - 1 && styles.menuItemBorder,
            ]}
            onPress={() => handleTap(item.onPress)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: (item.color || Colors.primary) + '10' }]}>
              <item.icon size={18} color={item.color || Colors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.subtitle && (
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              )}
            </View>
            {item.badge && (
              <View style={styles.menuBadge}>
                <Text style={styles.menuBadgeText}>{item.badge}</Text>
              </View>
            )}
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight]}
          style={[styles.headerGradient, { paddingTop: insets.top + 24 }]}
        />

        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={[Colors.accent, '#E8890C']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </View>
          <Text style={styles.profileName}>{userName}</Text>
          <Text style={styles.profileEmail}>{profile?.email ?? ''}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{completedOrders}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{addresses.length}</Text>
              <Text style={styles.statLabel}>Addresses</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>4.9</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

          {defaultAddress && (
            <View style={styles.locationRow}>
              <MapPin size={14} color={Colors.textTertiary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {defaultAddress.street}, {defaultAddress.city}
              </Text>
            </View>
          )}
        </View>

        {renderMenuSection('Account', accountItems)}
        {renderMenuSection('General', generalItems)}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => confirmAction('Log Out', 'Are you sure you want to log out?', () => { void signOut(); }, 'Log Out')}
        >
          <LogOut size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Laundry Dispatch v1.0.0</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  profileCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginTop: 80,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 8,
  },
  avatarWrap: {
    marginTop: -50,
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.card,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#fff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 4,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
    fontWeight: '500' as const,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.borderLight,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  menuBadge: {
    backgroundColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.errorLight,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 16,
  },
});
