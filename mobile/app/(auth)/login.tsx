import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AuthShell from '@/components/AuthShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');

  const buildPayload = () => {
    const value = contact.trim();
    if (!value) return {};
    if (value.includes('@')) return { email: value.toLowerCase() };
    return { phone: value.replace(/[^\d+]/g, '') };
  };

  const login = async () => {
    setNotice('');
    const payload = buildPayload();
    if (!payload.email && !payload.phone) {
      setNotice('Veuillez saisir votre email ou telephone.');
      return;
    }
    if (!password) {
      setNotice('Veuillez saisir votre mot de passe.');
      return;
    }

    try {
      const data = await api.post('/auth/login', { ...payload, password });
      await signIn(data.token);
    } catch (err: any) {
      const raw = String(err?.message || '');
      let parsed = raw;
      try {
        const json = JSON.parse(raw);
        parsed = json?.error || raw;
      } catch {
        // ignore
      }
      if (parsed.includes('Account not verified')) {
        setNotice('Compte non verifie. Veuillez verifier votre compte.');
        return;
      }
      setNotice('Identifiants incorrects. Veuillez mettre les bons identifiants.');
    }
  };

  return (
    <AuthShell
      title="Connexion"
      subtitle="Rencontrez des personnes compatibles, simplement et en toute securite."
      notice={notice}
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Vous n'avez pas de compte ?</Text>
          <Pressable onPress={() => router.push('/register')}>
            <Text style={styles.link}>S'inscrire</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.form}>
        <Text style={styles.label}>Email ou numero de telephone</Text>
        <TextInput
          style={styles.input}
          placeholder="email ou +237..."
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Mot de passe</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable style={styles.toggle} onPress={() => setShowPassword((v) => !v)}>
            <Ionicons
              name={showPassword ? 'eye' : 'eye-off'}
              size={20}
              color="#ff5a5f"
            />
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/reset-password')}>
          <Text style={styles.link}>Mot de passe oublie ?</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={login}>
          <Text style={styles.buttonText}>Se connecter</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1a1a1d',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 29, 0.1)',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fff',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  toggle: {
    position: 'absolute',
    right: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#ff5a5f',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  link: {
    color: '#ff5a5f',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  footerText: {
    color: '#6b6b6b',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});
