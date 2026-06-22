import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const onSubmit = useCallback(async () => {
    if (!name || !email || !password) {
      Alert.alert('Missing info', 'Name, email, and password are required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const { needsConfirmation } = await signUp({ name, email, phone, password });
      if (needsConfirmation) {
        Alert.alert(
          'Confirm your email',
          'We sent you a confirmation link. Confirm it, then log in.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
        );
      }
      // Otherwise the auth listener routes us in automatically.
    } catch (e) {
      Alert.alert('Sign up failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [name, email, phone, password, signUp, router]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>
          Laundry<Text style={styles.brandAccent}> Dispatch</Text>
        </Text>
        <Text style={styles.subtitle}>Create your account</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Alex Rivera"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="words"
            testID="signup-name"
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            testID="signup-email"
          />
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 (415) 555-0142"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="phone-pad"
            testID="signup-phone"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={Colors.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            testID="signup-password"
          />

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            testID="signup-submit"
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              Log in
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  container: { flexGrow: 1, paddingHorizontal: 28, alignItems: 'center' },
  logo: { width: 72, height: 72, marginBottom: 8 },
  brand: { fontSize: 24, fontWeight: '800' as const, color: Colors.text, letterSpacing: 0.3 },
  brandAccent: { color: Colors.primary },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 6, marginBottom: 20 },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' as const },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: Colors.textSecondary, fontSize: 15 },
  link: { color: Colors.primary, fontSize: 15, fontWeight: '700' as const },
});
