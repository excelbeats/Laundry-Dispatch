import { useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Order, Address, Notification, UserRole } from '@/types';

interface AppState {
  orders: Order[];
  addresses: Address[];
  notifications: Notification[];
  userName: string;
  userRole: UserRole;
  hasOnboarded: boolean;
  setUserName: (name: string) => void;
  setUserRole: (role: UserRole) => void;
  setHasOnboarded: (value: boolean) => void;
  addOrder: (order: Order) => void;
  addOrderAsync: (order: Order) => Promise<string>;
  startCheckout: (orderId: string) => Promise<string | null>;
  startSubscription: (tier: string) => Promise<string | null>;
  claimOrder: (orderId: string) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  markNotificationRead: (id: string) => void;
  unreadCount: number;
  addAddress: (address: Address) => void;
  isLoading: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapOrder(row: any): Order {
  return {
    id: row.id,
    customerId: row.customer_id,
    driverId: row.driver_id ?? undefined,
    status: row.status,
    services: row.services ?? [],
    pickupAddress: row.pickup_address,
    deliveryAddress: row.delivery_address,
    pickupSlot: row.pickup_slot,
    deliverySlot: row.delivery_slot ?? undefined,
    estimatedPounds: Number(row.estimated_pounds ?? 0),
    actualPounds: row.actual_pounds != null ? Number(row.actual_pounds) : undefined,
    specialInstructions: row.special_instructions ?? undefined,
    estimatedPrice: Number(row.estimated_price ?? 0),
    finalPrice: row.final_price != null ? Number(row.final_price) : undefined,
    tip: row.tip != null ? Number(row.tip) : undefined,
    promoCode: row.promo_code ?? undefined,
    discount: row.discount != null ? Number(row.discount) : undefined,
    rating: row.rating ?? undefined,
    review: row.review ?? undefined,
    pickupPhoto: row.pickup_photo ?? undefined,
    deliveryPhoto: row.delivery_photo ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    statusHistory: (row.status_history ?? [])
      .map((h: any) => ({ status: h.status, timestamp: h.created_at, note: h.note ?? undefined }))
      .sort((a: { timestamp: string }, b: { timestamp: string }) => a.timestamp.localeCompare(b.timestamp)),
  };
}

function mapAddress(row: any): Address {
  return {
    id: row.id,
    label: row.label,
    street: row.street,
    apt: row.apt ?? undefined,
    city: row.city,
    state: row.state,
    zip: row.zip,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    isDefault: !!row.is_default,
  };
}

function mapNotification(row: any): Notification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    read: !!row.read,
    orderId: row.order_id ?? undefined,
    createdAt: row.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const [AppStateProvider, useAppState] = createContextHook<AppState>(() => {
  const { session, profile } = useAuth();
  const userId = session?.user?.id ?? null;
  const qc = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ['orders', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, status_history:order_status_history(status, note, created_at)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapOrder);
    },
  });

  const addressesQuery = useQuery({
    queryKey: ['addresses', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .order('is_default', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapAddress);
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapNotification);
    },
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const addresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);
  const notifications = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);

  const addOrderMutation = useMutation({
    mutationFn: async (order: Order) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('orders')
        .insert({
          customer_id: userId,
          status: 'placed',
          services: order.services,
          pickup_address: order.pickupAddress,
          delivery_address: order.deliveryAddress,
          pickup_slot: order.pickupSlot,
          delivery_slot: order.deliverySlot ?? null,
          estimated_pounds: order.estimatedPounds,
          special_instructions: order.specialInstructions ?? null,
          estimated_price: order.estimatedPrice,
          promo_code: order.promoCode ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (!data?.id) throw new Error('Order could not be created');
      await supabase.from('order_status_history').insert({ order_id: data.id, status: 'placed' });
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', userId] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: Order['status'] }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
      if (error) throw error;
      await supabase.from('order_status_history').insert({ order_id: orderId, status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', userId] }),
  });

  const claimMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('orders')
        .update({ driver_id: userId, status: 'driver_assigned' })
        .eq('id', orderId);
      if (error) throw error;
      await supabase.from('order_status_history').insert({ order_id: orderId, status: 'driver_assigned' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', userId] }),
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  });

  const addAddressMutation = useMutation({
    mutationFn: async (address: Address) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('addresses').insert({
        user_id: userId,
        label: address.label,
        street: address.street,
        apt: address.apt ?? null,
        city: address.city,
        state: address.state,
        zip: address.zip,
        lat: address.lat,
        lng: address.lng,
        is_default: address.isDefault,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses', userId] }),
  });

  const addOrder = useCallback((order: Order) => addOrderMutation.mutate(order), [addOrderMutation]);
  const addOrderAsync = useCallback((order: Order) => addOrderMutation.mutateAsync(order), [addOrderMutation]);
  const startCheckout = useCallback(async (orderId: string) => {
    const { data, error } = await supabase.functions.invoke('create-checkout', { body: { order_id: orderId } });
    if (error) throw error;
    return ((data as { url?: string } | null)?.url) ?? null;
  }, []);
  const startSubscription = useCallback(async (tier: string) => {
    const { data, error } = await supabase.functions.invoke('create-subscription', { body: { tier } });
    if (error) throw error;
    return ((data as { url?: string } | null)?.url) ?? null;
  }, []);
  const claimOrder = useCallback((orderId: string) => claimMutation.mutate(orderId), [claimMutation]);
  const updateOrderStatus = useCallback(
    (orderId: string, status: Order['status']) => updateStatusMutation.mutate({ orderId, status }),
    [updateStatusMutation],
  );
  const markNotificationRead = useCallback((id: string) => markReadMutation.mutate(id), [markReadMutation]);
  const addAddress = useCallback((address: Address) => addAddressMutation.mutate(address), [addAddressMutation]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const userName = profile?.name ?? 'there';
  const userRole = profile?.role ?? 'customer';

  // Role is server-controlled and onboarding is handled by the auth gate now;
  // these setters are kept as no-ops for screens that still reference them.
  const noop = useCallback(() => {}, []);

  return useMemo(
    () => ({
      orders,
      addresses,
      notifications,
      userName,
      userRole,
      hasOnboarded: true,
      setUserName: noop,
      setUserRole: noop,
      setHasOnboarded: noop,
      addOrder,
      addOrderAsync,
      startCheckout,
      startSubscription,
      claimOrder,
      updateOrderStatus,
      markNotificationRead,
      unreadCount,
      addAddress,
      isLoading: ordersQuery.isLoading || addressesQuery.isLoading || notificationsQuery.isLoading,
    }),
    [
      orders,
      addresses,
      notifications,
      userName,
      userRole,
      noop,
      addOrder,
      addOrderAsync,
      startCheckout,
      startSubscription,
      claimOrder,
      updateOrderStatus,
      markNotificationRead,
      unreadCount,
      addAddress,
      ordersQuery.isLoading,
      addressesQuery.isLoading,
      notificationsQuery.isLoading,
    ],
  );
});
