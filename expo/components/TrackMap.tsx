import React from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Colors from '@/constants/colors';
import { staticMapUrl } from '@/lib/mapbox';

interface Pt { lat: number; lng: number }

interface Props {
  driver?: Pt | null;
  dest?: Pt | null;
  height?: number;
}

export default function TrackMap({ driver, dest, height = 240 }: Props) {
  if (!driver && !dest) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.placeholderText}>Waiting for live location…</Text>
      </View>
    );
  }

  const uri = staticMapUrl({ driver: driver ?? undefined, dest: dest ?? undefined });

  return (
    <View style={[styles.wrap, { height }]}>
      <Image source={{ uri }} style={styles.img} resizeMode="cover" />
      {!driver && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Driver location pending</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.borderLight },
  img: { width: '100%', height: '100%' },
  placeholder: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 20, backgroundColor: Colors.borderLight,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  placeholderText: { fontSize: 13, color: Colors.textSecondary },
  badge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' as const },
});
