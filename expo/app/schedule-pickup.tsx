import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MapPin,
  ChevronRight,
  Check,
  Minus,
  Plus,
  Tag,
  CreditCard,
  Shirt,
  Zap,
  Droplets,
  Package,
  Clock,
  Star,
  Shield,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAppState } from '@/hooks/useAppState';
import { notify, notifyThen } from '@/lib/dialog';
import { mockServices, mockTimeSlots } from '@/mocks/data';
import { ServiceType, TimeSlot, Order } from '@/types';

type Step = 'address' | 'services' | 'schedule' | 'review';

const STEPS: Step[] = ['address', 'services', 'schedule', 'review'];

// Pickup fee ($3.99) + service fee ($1.50), added on top of the laundry subtotal.
const FEES = 5.49;

export default function SchedulePickupScreen() {
  const router = useRouter();
  const { addresses, addOrderAsync, startCheckout } = useAppState();

  const [currentStep, setCurrentStep] = useState<Step>('address');
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find(a => a.isDefault)?.id ?? addresses[0]?.id ?? ''
  );
  const [deliveryAddressId, setDeliveryAddressId] = useState<string>(
    addresses.find(a => a.isDefault)?.id ?? addresses[0]?.id ?? ''
  );
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([]);
  const [estimatedPounds, setEstimatedPounds] = useState<number>(10);
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [selectedPickupSlot, setSelectedPickupSlot] = useState<string>('');
  const [selectedDeliverySlot, setSelectedDeliverySlot] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [placing, setPlacing] = useState<boolean>(false);

  const stepIndex = STEPS.indexOf(currentStep);

  const toggleService = useCallback((serviceId: ServiceType) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(s => s !== serviceId)
        : [...prev, serviceId]
    );
  }, []);

  const estimatedPrice = useMemo(() => {
    if (selectedServices.length === 0) return 0;
    const totalPerPound = selectedServices.reduce((sum, sId) => {
      const svc = mockServices.find(s => s.id === sId);
      return sum + (svc?.pricePerPound ?? 0);
    }, 0);
    return totalPerPound * estimatedPounds;
  }, [selectedServices, estimatedPounds]);

  const availablePickupSlots = useMemo(
    () => mockTimeSlots.filter(s => s.available),
    []
  );

  const availableDeliverySlots = useMemo(
    () => mockTimeSlots.filter(s => s.available && s.id !== selectedPickupSlot),
    [selectedPickupSlot]
  );

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'address':
        return !!selectedAddressId;
      case 'services':
        return selectedServices.length > 0;
      case 'schedule':
        return !!selectedPickupSlot;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedAddressId, selectedServices, selectedPickupSlot]);

  const placeOrderAndPay = useCallback(async () => {
    const pickupAddr = addresses.find(a => a.id === selectedAddressId) ?? addresses[0];
    const deliveryAddr = addresses.find(a => a.id === deliveryAddressId) ?? pickupAddr;
    const pickupSlot = mockTimeSlots.find(s => s.id === selectedPickupSlot) ?? mockTimeSlots[0];
    const deliverySlot = mockTimeSlots.find(s => s.id === selectedDeliverySlot);

    const newOrder: Order = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: 'user_1',
      status: 'placed',
      services: selectedServices,
      pickupAddress: pickupAddr,
      deliveryAddress: deliveryAddr,
      pickupSlot: pickupSlot,
      deliverySlot: deliverySlot,
      estimatedPounds,
      specialInstructions: specialInstructions || undefined,
      estimatedPrice: estimatedPrice + FEES,
      promoCode: promoCode || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        { status: 'placed', timestamp: new Date().toISOString() },
      ],
    };

    try {
      setPlacing(true);
      const orderId = await addOrderAsync(newOrder);
      const url = await startCheckout(orderId);
      if (!url) {
        notifyThen('Order placed', "Your order is in — we couldn't open checkout, you can pay from your orders.", () => router.back());
        return;
      }
      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        await Linking.openURL(url);
        router.back();
      }
    } catch (e) {
      notify('Could not place order', (e as Error).message);
    } finally {
      setPlacing(false);
    }
  }, [addresses, selectedAddressId, deliveryAddressId, selectedPickupSlot, selectedDeliverySlot, selectedServices, estimatedPounds, specialInstructions, estimatedPrice, promoCode, addOrderAsync, startCheckout, router]);

  const handleNext = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (currentStep === 'review') {
      void placeOrderAndPay();
      return;
    }
    const nextIdx = stepIndex + 1;
    if (nextIdx < STEPS.length) {
      setCurrentStep(STEPS[nextIdx]);
    }
  }, [currentStep, stepIndex, placeOrderAndPay]);

  const handleBack = useCallback(() => {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) {
      setCurrentStep(STEPS[prevIdx]);
    }
  }, [stepIndex]);

  const getServiceIcon = (icon: string) => {
    const icons: Record<string, React.ComponentType<{ size: number; color: string }>> = {
      shirt: Shirt,
      zap: Zap,
      feather: Droplets,
      'shield-check': Shield,
      wind: Clock,
      sparkles: Star,
    };
    return icons[icon] || Package;
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, idx) => (
        <React.Fragment key={step}>
          <View
            style={[
              styles.stepDot,
              idx <= stepIndex && styles.stepDotActive,
            ]}
          >
            {idx < stepIndex ? (
              <Check size={12} color="#fff" />
            ) : (
              <Text
                style={[
                  styles.stepDotText,
                  idx <= stepIndex && styles.stepDotTextActive,
                ]}
              >
                {idx + 1}
              </Text>
            )}
          </View>
          {idx < STEPS.length - 1 && (
            <View
              style={[
                styles.stepLine,
                idx < stepIndex && styles.stepLineActive,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderAddressStep = () => (
    <View>
      <Text style={styles.stepTitle}>Pickup Address</Text>
      <Text style={styles.stepSubtitle}>Where should we pick up your laundry?</Text>

      {addresses.map(addr => (
        <TouchableOpacity
          key={addr.id}
          style={[
            styles.addressCard,
            selectedAddressId === addr.id && styles.addressCardSelected,
          ]}
          onPress={() => setSelectedAddressId(addr.id)}
        >
          <View style={styles.addressLeft}>
            <View
              style={[
                styles.addressIcon,
                selectedAddressId === addr.id && styles.addressIconSelected,
              ]}
            >
              <MapPin
                size={18}
                color={selectedAddressId === addr.id ? '#fff' : Colors.primary}
              />
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressLabel}>{addr.label}</Text>
              <Text style={styles.addressStreet}>{addr.street}</Text>
              <Text style={styles.addressCity}>
                {addr.city}, {addr.state} {addr.zip}
              </Text>
            </View>
          </View>
          {selectedAddressId === addr.id && (
            <View style={styles.checkCircle}>
              <Check size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.addAddressBtn} onPress={() => router.push('/add-address')} activeOpacity={0.8}>
        <Plus size={16} color={Colors.primary} />
        <Text style={styles.addAddressText}>Add new address</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { marginTop: 24 }]}>Delivery Address</Text>
      <Text style={styles.stepSubtitle}>Same as pickup or different?</Text>

      {addresses.map(addr => (
        <TouchableOpacity
          key={`del-${addr.id}`}
          style={[
            styles.addressCard,
            deliveryAddressId === addr.id && styles.addressCardSelected,
          ]}
          onPress={() => setDeliveryAddressId(addr.id)}
        >
          <View style={styles.addressLeft}>
            <View
              style={[
                styles.addressIcon,
                deliveryAddressId === addr.id && styles.addressIconSelected,
              ]}
            >
              <MapPin
                size={18}
                color={deliveryAddressId === addr.id ? '#fff' : Colors.primary}
              />
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressLabel}>{addr.label}</Text>
              <Text style={styles.addressStreet}>{addr.street}</Text>
            </View>
          </View>
          {deliveryAddressId === addr.id && (
            <View style={styles.checkCircle}>
              <Check size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderServicesStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Services</Text>
      <Text style={styles.stepSubtitle}>Choose one or more laundry services</Text>

      {mockServices.map(service => {
        const isSelected = selectedServices.includes(service.id);
        const IconComp = getServiceIcon(service.icon);
        return (
          <TouchableOpacity
            key={service.id}
            style={[styles.serviceCard, isSelected && styles.serviceCardSelected]}
            onPress={() => toggleService(service.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.serviceIconWrap, { backgroundColor: service.color + '15' }]}>
              <IconComp size={22} color={service.color} />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceDesc}>{service.description}</Text>
              <Text style={styles.servicePrice}>
                ${service.pricePerPound.toFixed(2)}/lb · ~{service.estimatedHours}h
              </Text>
            </View>
            <View
              style={[
                styles.serviceCheck,
                isSelected && styles.serviceCheckSelected,
              ]}
            >
              {isSelected && <Check size={14} color="#fff" />}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.poundsSection}>
        <Text style={styles.poundsLabel}>Estimated Weight</Text>
        <View style={styles.poundsControl}>
          <TouchableOpacity
            style={styles.poundsBtn}
            onPress={() => setEstimatedPounds(Math.max(1, estimatedPounds - 1))}
          >
            <Minus size={18} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.poundsValue}>{estimatedPounds} lbs</Text>
          <TouchableOpacity
            style={styles.poundsBtn}
            onPress={() => setEstimatedPounds(estimatedPounds + 1)}
          >
            <Plus size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={styles.instructionsInput}
        placeholder="Special instructions (optional)"
        placeholderTextColor={Colors.textTertiary}
        value={specialInstructions}
        onChangeText={setSpecialInstructions}
        multiline
        numberOfLines={3}
      />
    </View>
  );

  const renderScheduleStep = () => {
    const groupedSlots = availablePickupSlots.reduce<Record<string, TimeSlot[]>>((acc, slot) => {
      if (!acc[slot.date]) acc[slot.date] = [];
      acc[slot.date].push(slot);
      return acc;
    }, {});

    return (
      <View>
        <Text style={styles.stepTitle}>Pickup Time</Text>
        <Text style={styles.stepSubtitle}>When should we pick up?</Text>

        {Object.entries(groupedSlots).map(([date, slots]) => (
          <View key={date} style={styles.dateGroup}>
            <Text style={styles.dateLabel}>
              {formatDate(date)}
            </Text>
            <View style={styles.slotsRow}>
              {slots.map(slot => (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.slotChip,
                    selectedPickupSlot === slot.id && styles.slotChipSelected,
                  ]}
                  onPress={() => setSelectedPickupSlot(slot.id)}
                >
                  <Text
                    style={[
                      styles.slotText,
                      selectedPickupSlot === slot.id && styles.slotTextSelected,
                    ]}
                  >
                    {slot.startTime} - {slot.endTime}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={[styles.stepTitle, { marginTop: 24 }]}>
          Delivery Time (Optional)
        </Text>
        <Text style={styles.stepSubtitle}>When should we return your laundry?</Text>

        {Object.entries(
          availableDeliverySlots.reduce<Record<string, TimeSlot[]>>((acc, slot) => {
            if (!acc[slot.date]) acc[slot.date] = [];
            acc[slot.date].push(slot);
            return acc;
          }, {})
        ).map(([date, slots]) => (
          <View key={date} style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{formatDate(date)}</Text>
            <View style={styles.slotsRow}>
              {slots.map(slot => (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.slotChip,
                    selectedDeliverySlot === slot.id && styles.slotChipSelected,
                  ]}
                  onPress={() =>
                    setSelectedDeliverySlot(
                      selectedDeliverySlot === slot.id ? '' : slot.id
                    )
                  }
                >
                  <Text
                    style={[
                      styles.slotText,
                      selectedDeliverySlot === slot.id && styles.slotTextSelected,
                    ]}
                  >
                    {slot.startTime} - {slot.endTime}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderReviewStep = () => {
    const pickupAddr = addresses.find(a => a.id === selectedAddressId);
    const deliveryAddr = addresses.find(a => a.id === deliveryAddressId);
    const pickupSlot = mockTimeSlots.find(s => s.id === selectedPickupSlot);
    const deliverySlot = mockTimeSlots.find(s => s.id === selectedDeliverySlot);

    return (
      <View>
        <Text style={styles.stepTitle}>Review Order</Text>
        <Text style={styles.stepSubtitle}>Confirm your details before placing</Text>

        <View style={styles.reviewCard}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Pickup</Text>
            <Text style={styles.reviewValue}>{pickupAddr?.street}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Delivery</Text>
            <Text style={styles.reviewValue}>{deliveryAddr?.street}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Services</Text>
            <Text style={styles.reviewValue}>
              {selectedServices
                .map(s => mockServices.find(sv => sv.id === s)?.name)
                .join(', ')}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Weight</Text>
            <Text style={styles.reviewValue}>{estimatedPounds} lbs</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Pickup Time</Text>
            <Text style={styles.reviewValue}>
              {pickupSlot
                ? `${formatDate(pickupSlot.date)} ${pickupSlot.startTime}`
                : 'Not set'}
            </Text>
          </View>
          {deliverySlot && (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Delivery Time</Text>
              <Text style={styles.reviewValue}>
                {formatDate(deliverySlot.date)} {deliverySlot.startTime}
              </Text>
            </View>
          )}
          {specialInstructions ? (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Notes</Text>
              <Text style={styles.reviewValue}>{specialInstructions}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.promoRow}>
          <View style={styles.promoInputWrap}>
            <Tag size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.promoInput}
              placeholder="Promo code"
              placeholderTextColor={Colors.textTertiary}
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
            />
          </View>
          <TouchableOpacity style={styles.promoApply}>
            <Text style={styles.promoApplyText}>Apply</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pricingCard}>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Subtotal</Text>
            <Text style={styles.pricingValue}>${estimatedPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Pickup fee</Text>
            <Text style={styles.pricingValue}>$3.99</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Service fee</Text>
            <Text style={styles.pricingValue}>$1.50</Text>
          </View>
          <View style={[styles.pricingRow, styles.pricingTotal]}>
            <Text style={styles.pricingTotalLabel}>Total</Text>
            <Text style={styles.pricingTotalValue}>
              ${(estimatedPrice + FEES).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.paymentRow}>
          <CreditCard size={18} color={Colors.primary} />
          <Text style={styles.paymentText}>Visa ****4242</Text>
          <ChevronRight size={16} color={Colors.textTertiary} />
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderStepIndicator()}

        {currentStep === 'address' && renderAddressStep()}
        {currentStep === 'services' && renderServicesStep()}
        {currentStep === 'schedule' && renderScheduleStep()}
        {currentStep === 'review' && renderReviewStep()}
      </ScrollView>

      <View style={styles.bottomBar}>
        {stepIndex > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextBtn,
            (!canProceed || placing) && styles.nextBtnDisabled,
            stepIndex === 0 && styles.nextBtnFull,
          ]}
          onPress={handleNext}
          disabled={!canProceed || placing}
        >
          <LinearGradient
            colors={
              canProceed && !placing
                ? [Colors.primary, Colors.primaryLight]
                : [Colors.textTertiary, Colors.textTertiary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtnGradient}
          >
            <Text style={styles.nextBtnText}>
              {placing
                ? 'Processing…'
                : currentStep === 'review'
                ? `Place Order · $${(estimatedPrice + FEES).toFixed(2)}`
                : 'Continue'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: Colors.primary,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  addressCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  addressCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '05',
  },
  addressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressIconSelected: {
    backgroundColor: Colors.primary,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  addressStreet: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addressCity: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addAddressText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  serviceCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  serviceCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '05',
  },
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  serviceDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  servicePrice: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  serviceCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceCheckSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  poundsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  poundsLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  poundsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  poundsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poundsValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    minWidth: 50,
    textAlign: 'center',
  },
  instructionsInput: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  slotText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  slotTextSelected: {
    color: '#fff',
  },
  reviewCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  reviewLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
    minWidth: 80,
  },
  reviewValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500' as const,
    flex: 1,
    textAlign: 'right',
  },
  promoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  promoInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  promoInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 12,
  },
  promoApply: {
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  promoApplyText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  pricingCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 28,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  backBtn: {
    paddingHorizontal: 24,
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  nextBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  nextBtnFull: {
    flex: 1,
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
