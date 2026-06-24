import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Package,
  Clock,
  Star,
  Phone,
  MessageCircle,
  Navigation,
  RefreshCw,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAppState } from '@/hooks/useAppState';
import { confirmAction } from '@/lib/dialog';
import { ORDER_STATUS_CONFIG, mockDriver, mockServices } from '@/mocks/data';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus } = useAppState();

  const order = useMemo(() => orders.find(o => o.id === id), [orders, id]);

  if (!order) {
    return (
      <View style={styles.emptyContainer}>
        <Package size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>Order not found</Text>
      </View>
    );
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status];
  const isActive = order.status !== 'delivered' && order.status !== 'cancelled';
  const driver = mockDriver;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.statusBanner, { backgroundColor: statusConfig.color + '12' }]}>
        <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
        <View style={styles.statusBannerContent}>
          <Text style={[styles.statusBannerText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
          <Text style={styles.statusBannerOrder}>{order.id}</Text>
        </View>
        {isActive && (
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => router.push('/(tabs)/track')}
          >
            <Navigation size={14} color={Colors.primary} />
            <Text style={styles.trackButtonText}>Track</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Services</Text>
        {order.services.map(sId => {
          const svc = mockServices.find(s => s.id === sId);
          if (!svc) return null;
          return (
            <View key={sId} style={styles.serviceRow}>
              <View style={[styles.serviceIcon, { backgroundColor: svc.color + '15' }]}>
                <Package size={16} color={svc.color} />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{svc.name}</Text>
                <Text style={styles.servicePrice}>${svc.pricePerPound.toFixed(2)}/lb</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Addresses</Text>
        <View style={styles.addressRow}>
          <View style={[styles.addressDot, { backgroundColor: Colors.accent }]} />
          <View style={styles.addressInfo}>
            <Text style={styles.addressLabel}>Pickup</Text>
            <Text style={styles.addressStreet}>{order.pickupAddress.street}</Text>
            <Text style={styles.addressCity}>
              {order.pickupAddress.city}, {order.pickupAddress.state}
            </Text>
          </View>
        </View>
        <View style={styles.addressConnector} />
        <View style={styles.addressRow}>
          <View style={[styles.addressDot, { backgroundColor: Colors.success }]} />
          <View style={styles.addressInfo}>
            <Text style={styles.addressLabel}>Delivery</Text>
            <Text style={styles.addressStreet}>{order.deliveryAddress.street}</Text>
            <Text style={styles.addressCity}>
              {order.deliveryAddress.city}, {order.deliveryAddress.state}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schedule</Text>
        <View style={styles.scheduleRow}>
          <Clock size={16} color={Colors.textTertiary} />
          <View>
            <Text style={styles.scheduleLabel}>Pickup</Text>
            <Text style={styles.scheduleValue}>
              {order.pickupSlot.startTime} - {order.pickupSlot.endTime}
            </Text>
          </View>
        </View>
        {order.deliverySlot && (
          <View style={styles.scheduleRow}>
            <Clock size={16} color={Colors.textTertiary} />
            <View>
              <Text style={styles.scheduleLabel}>Delivery</Text>
              <Text style={styles.scheduleValue}>
                {order.deliverySlot.startTime} - {order.deliverySlot.endTime}
              </Text>
            </View>
          </View>
        )}
      </View>

      {order.driverId && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Driver</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{driver.name.charAt(0)}</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.driverMeta}>
                {driver.vehicleType} · ⭐ {driver.rating}
              </Text>
            </View>
            <View style={styles.driverActions}>
              <TouchableOpacity style={styles.driverActionBtn}>
                <Phone size={16} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.driverActionBtn}>
                <MessageCircle size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Timeline</Text>
        {order.statusHistory.map((update, idx) => {
          const config = ORDER_STATUS_CONFIG[update.status];
          return (
            <View key={idx} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: config.color }]} />
                {idx < order.statusHistory.length - 1 && (
                  <View style={styles.timelineLine} />
                )}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>{config.label}</Text>
                <Text style={styles.timelineTime}>
                  {new Date(update.timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pricing</Text>
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>
            Estimated ({order.estimatedPounds} lbs)
          </Text>
          <Text style={styles.pricingValue}>${order.estimatedPrice.toFixed(2)}</Text>
        </View>
        {order.actualPounds && (
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>
              Actual ({order.actualPounds} lbs)
            </Text>
            <Text style={styles.pricingValue}>
              ${(order.finalPrice ?? order.estimatedPrice).toFixed(2)}
            </Text>
          </View>
        )}
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>Pickup fee</Text>
          <Text style={styles.pricingValue}>$3.99</Text>
        </View>
        {order.tip !== undefined && order.tip > 0 && (
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Tip</Text>
            <Text style={styles.pricingValue}>${order.tip.toFixed(2)}</Text>
          </View>
        )}
        <View style={[styles.pricingRow, styles.pricingTotal]}>
          <Text style={styles.pricingTotalLabel}>Total</Text>
          <Text style={styles.pricingTotalValue}>
            ${((order.finalPrice ?? order.estimatedPrice) + 3.99 + (order.tip ?? 0)).toFixed(2)}
          </Text>
        </View>
      </View>

      {order.rating && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Rating</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <Star
                key={i}
                size={24}
                color={i <= order.rating! ? Colors.accent : Colors.borderLight}
                fill={i <= order.rating! ? Colors.accent : 'none'}
              />
            ))}
          </View>
          {order.review && (
            <Text style={styles.reviewText}>{order.review}</Text>
          )}
        </View>
      )}

      {order.specialInstructions && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Special Instructions</Text>
          <Text style={styles.instructionsText}>{order.specialInstructions}</Text>
        </View>
      )}

      {order.status === 'delivered' && (
        <TouchableOpacity
          style={styles.reorderBtn}
          onPress={() => router.push('/schedule-pickup')}
        >
          <RefreshCw size={18} color={Colors.textInverse} />
          <Text style={styles.reorderBtnText}>Reorder</Text>
        </TouchableOpacity>
      )}

      {isActive && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() =>
            confirmAction(
              'Cancel Order',
              'Are you sure you want to cancel this order?',
              () => {
                updateOrderStatus(order.id, 'cancelled');
                router.back();
              },
              'Cancel Order',
            )
          }
        >
          <Text style={styles.cancelBtnText}>Cancel Order</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  emptyTitle: {
    fontSize: 16,
    color: Colors.textTertiary,
    marginTop: 12,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusBannerContent: {
    flex: 1,
  },
  statusBannerText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  statusBannerOrder: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  trackButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  servicePrice: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  addressConnector: {
    width: 2,
    height: 16,
    backgroundColor: Colors.borderLight,
    marginLeft: 4,
    marginVertical: 4,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  addressStreet: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    marginTop: 2,
  },
  addressCity: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  scheduleLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  scheduleValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  driverMeta: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  driverActions: {
    flexDirection: 'row',
    gap: 8,
  },
  driverActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 20,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
    minHeight: 20,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  timelineTime: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  pricingLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  pricingValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  pricingTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
    paddingTop: 12,
  },
  pricingTotalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  pricingTotalValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  instructionsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  reorderBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textInverse,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.errorLight,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.error,
  },
});
