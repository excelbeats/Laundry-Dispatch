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
  ScrollView,
} from 'react-native';
import { Link, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { notify } from '@/lib/dialog';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const onSubmit = useCallback(async () => {
    if (!email || !password) {
      notify('Missing info', 'Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (e) {
      notify('Login failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [email, password, signIn]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>
          Laundry<Text style={styles.brandAccent}> Dispatch</Text>
        </Text>
        <Text style={styles.subtitle}>Welcome back</Text>

        <View style={styles.form}>
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
            testID="login-email"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            testID="login-password"
          />

          <Link href={'/forgot-password' as Href} style={styles.forgotLink}>
            Forgot password?
          </Link>

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            testID="login-submit"
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Link href="/(auth)/signup" style={styles.link}>
              Sign up
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
  logo: { width: 88, height: 88, marginBottom: 8 },
  brand: { fontSize: 26, fontWeight: '800' as const, color: Colors.text, letterSpacing: 0.3 },
  brandAccent: { color: Colors.primary },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 6, marginBottom: 28 },
  form: { width: '100%' },
  forgotLink: { alignSelf: 'flex-end' as const, marginTop: 12, color: Colors.primary, fontSize: 13, fontWeight: '600' as const },
  label: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8, marginTop: 14 },
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
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' as const },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: Colors.textSecondary, fontSize: 15 },
  link: { color: Colors.primary, fontSize: 15, fontWeight: '700' as const },
});
