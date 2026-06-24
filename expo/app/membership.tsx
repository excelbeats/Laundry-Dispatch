import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking, ActivityIndicator } from 'react-native';
import { Check, Crown, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useAppState } from '@/hooks/useAppState';
import { notify } from '@/lib/dialog';

interface Tier {
  key: string;
  name: string;
  price: number;
  tagline: string;
  popular?: boolean;
  features: string[];
}

const TIERS: Tier[] = [
  { key: 'basic', name: 'Basic', price: 50, tagline: 'Perfect for one person', features: ['Weekly wash, dry & fold', 'Free pickup & delivery', 'Fees waived on every order'] },
  { key: 'plus', name: 'Plus', price: 99, popular: true, tagline: 'Great for couples', features: ['Everything in Basic', 'Up to 2 pickups per week', 'Priority scheduling'] },
  { key: 'family', name: 'Family', price: 169, tagline: 'For busy households', features: ['Everything in Plus', 'Unlimited weekly pickups', 'Dry-cleaning discounts'] },
];

export default function MembershipScreen() {
  const { profile, isMember } = useAuth();
  const { startSubscription } = useAppState();
  const [busy, setBusy] = useState<string | null>(null);

  const subscribe = useCallback(async (tier: string) => {
    try {
      setBusy(tier);
      const url = await startSubscription(tier);
      if (!url) { notify('Something went wrong', 'Could not start checkout — please try again.'); return; }
      if (Platform.OS === 'web') window.location.href = url;
      else await Linking.openURL(url);
    } catch (e) {
      notify('Could not subscribe', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [startSubscription]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Crown size={30} color={Colors.accent} />
        <Text style={styles.heroTitle}>Membership</Text>
        <Text style={styles.heroSubtitle}>Never think about laundry again. Members get free pickup &amp; delivery and waived fees on every single order.</Text>
      </View>

      {isMember && (
        <View style={styles.currentCard}>
          <Sparkles size={18} color={Colors.success} />
          <Text style={styles.currentText}>You&apos;re a <Text style={styles.currentTier}>{profile?.subscriptionTier ?? 'member'}</Text> member — fees are waived on your orders 🎉</Text>
        </View>
      )}

      {TIERS.map((t) => {
        const isCurrent = isMember && profile?.subscriptionTier === t.key;
        return (
          <View key={t.key} style={[styles.card, t.popular && styles.cardPopular, isCurrent && styles.cardCurrent]}>
            {t.popular && !isMember && (
              <View style={styles.badge}><Text style={styles.badgeText}>MOST POPULAR</Text></View>
            )}
            <Text style={styles.tierName}>{t.name}</Text>
            <Text style={styles.tierTagline}>{t.tagline}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>${t.price}</Text>
              <Text style={styles.per}>/week</Text>
            </View>
            <View style={styles.features}>
              {t.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Check size={16} color={Colors.success} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.cta, t.popular && styles.ctaPopular, (isMember || busy !== null) && styles.ctaDisabled]}
              disabled={isMember || busy !== null}
              activeOpacity={0.85}
              onPress={() => subscribe(t.key)}
            >
              {busy === t.key ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>{isCurrent ? 'Current plan' : `Choose ${t.name}`}</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}

      <Text style={styles.fineprint}>Billed weekly · Cancel anytime</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  hero: { alignItems: 'center', marginBottom: 20, gap: 8 },
  heroTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.text },
  heroSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  currentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E7F8F0', borderRadius: 14, padding: 14, marginBottom: 16 },
  currentText: { flex: 1, fontSize: 13, color: Colors.text },
  currentTier: { fontWeight: '800' as const, textTransform: 'capitalize' },
  card: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardPopular: { borderColor: Colors.primary, borderWidth: 2 },
  cardCurrent: { borderColor: Colors.success, borderWidth: 2 },
  badge: { position: 'absolute', top: -10, right: 20, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' as const, letterSpacing: 0.5 },
  tierName: { fontSize: 20, fontWeight: '800' as const, color: Colors.text },
  tierTagline: { fontSize: 13, color: Colors.textTertiary, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 12, marginBottom: 16 },
  price: { fontSize: 36, fontWeight: '800' as const, color: Colors.text },
  per: { fontSize: 15, color: Colors.textSecondary, marginBottom: 7, marginLeft: 2 },
  features: { gap: 10, marginBottom: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, color: Colors.text },
  cta: { backgroundColor: Colors.text, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ctaPopular: { backgroundColor: Colors.primary },
  ctaDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.7 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
  fineprint: { textAlign: 'center', fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
});
