import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/dialog';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const onSubmit = useCallback(async () => {
    if (!email.trim()) {
      notify('Missing info', 'Enter your email address.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'https://laundrydispatch.com/reset-password',
      });
      if (error) throw error;
      notify('Check your email', "If an account exists for that address, we've sent a link to reset your password.");
      router.back();
    } catch (e) {
      notify('Could not send reset', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [email, router]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>Enter your email and we&apos;ll send you a link to set a new password.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={Colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={submitting} activeOpacity={0.85}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send reset link</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '800' as const, color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
  backLink: { alignItems: 'center', marginTop: 16 },
  backLinkText: { color: Colors.primary, fontSize: 14, fontWeight: '600' as const },
});
