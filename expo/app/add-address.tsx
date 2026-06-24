import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAppState } from '@/hooks/useAppState';
import { notify } from '@/lib/dialog';
import type { Address } from '@/types';

export default function AddAddressScreen() {
  const router = useRouter();
  const { addresses, addAddress } = useAppState();

  const [label, setLabel] = useState<string>('');
  const [street, setStreet] = useState<string>('');
  const [apt, setApt] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [stateField, setStateField] = useState<string>('');
  const [zip, setZip] = useState<string>('');

  const onSave = useCallback(() => {
    if (!label || !street || !city || !stateField || !zip) {
      notify('Missing info', 'Label, street, city, state, and ZIP are required.');
      return;
    }
    const address: Address = {
      id: '',
      label: label.trim(),
      street: street.trim(),
      apt: apt.trim() || undefined,
      city: city.trim(),
      state: stateField.trim(),
      zip: zip.trim(),
      lat: 0,
      lng: 0,
      isDefault: addresses.length === 0,
    };
    addAddress(address);
    router.back();
  }, [label, street, apt, city, stateField, zip, addresses.length, addAddress, router]);

  const field = (
    lbl: string,
    value: string,
    setter: (v: string) => void,
    opts?: { placeholder?: string; autoCapitalize?: 'none' | 'words' | 'characters'; keyboardType?: 'default' | 'numeric' },
  ) => (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{lbl}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setter}
        placeholder={opts?.placeholder}
        placeholderTextColor={Colors.textTertiary}
        autoCapitalize={opts?.autoCapitalize ?? 'words'}
        keyboardType={opts?.keyboardType ?? 'default'}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {field('Label', label, setLabel, { placeholder: 'Home, Office, …' })}
        {field('Street address', street, setStreet, { placeholder: '742 Evergreen Terrace' })}
        {field('Apt / Suite (optional)', apt, setApt, { placeholder: 'Apt 4B' })}
        {field('City', city, setCity, { placeholder: 'San Francisco' })}
        <View style={styles.row}>
          <View style={styles.rowItemSmall}>
            {field('State', stateField, setStateField, { placeholder: 'CA', autoCapitalize: 'characters' })}
          </View>
          <View style={styles.rowItem}>
            {field('ZIP', zip, setZip, { placeholder: '94102', keyboardType: 'numeric' })}
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={onSave} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Save Address</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20, paddingBottom: 40 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  rowItemSmall: { width: 100 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' as const },
});
