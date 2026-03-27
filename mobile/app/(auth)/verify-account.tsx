import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import AuthShell from '@/components/AuthShell';
import { api } from '@/lib/api';
import { clearPendingContact, getPendingContact } from '@/lib/auth';

export default function VerifyAccountScreen() {
  const router = useRouter();
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const load = async () => {
      const saved = await getPendingContact();
      if (saved?.email) {
        setContact(saved.email);
      } else if (saved?.phone) {
        setContact(saved.phone);
      }
    };
    load();
  }, []);

  const parseContact = () => {
    const value = contact.trim();
    if (!value) return {} as { email?: string; phone?: string };
    if (value.includes('@')) return { email: value.toLowerCase() };
    return { phone: value.replace(/[^\d+]/g, '') };
  };

  const verify = async () => {
    setNotice('');
    const payload = parseContact();
    if (!payload.email && !payload.phone) {
      setNotice('Veuillez saisir votre email ou telephone.');
      return;
    }
    if (!otp.trim()) {
      setNotice('Veuillez saisir le code OTP.');
      return;
    }

    try {
      const data = await api.post('/auth/verify', { ...payload, code: otp.trim() });
      setNotice(data.message || 'Compte verifie');
      await clearPendingContact();
      router.replace('/login');
    } catch (err: any) {
      const raw = String(err?.message || '');
      let parsed = raw;
      try {
        const json = JSON.parse(raw);
        parsed = json?.error || raw;
      } catch {
        // ignore
      }
      setNotice(parsed || 'Erreur de verification');
    }
  };

  const resend = async () => {
    setNotice('');
    const payload = parseContact();
    if (!payload.email && !payload.phone) {
      setNotice('Veuillez saisir votre email ou telephone.');
      return;
    }
    try {
      const data = await api.post('/auth/resend-otp', payload);
      setNotice(data.message || 'Code renvoye');
    } catch (err: any) {
      const raw = String(err?.message || '');
      let parsed = raw;
      try {
        const json = JSON.parse(raw);
        parsed = json?.error || raw;
      } catch {
        // ignore
      }
      setNotice(parsed || 'Impossible de renvoyer le code');
    }
  };

  return (
    <AuthShell
      title="Verifiez votre compte"
      subtitle="Verifiez votre compte pour activer votre profil."
      notice={notice}
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Code non recu ?</Text>
          <Pressable onPress={resend}>
            <Text style={styles.link}>Renvoyer le code</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.form}>
        <Text style={styles.info}>Un code OTP a ete envoye a votre email ou telephone.</Text>

        <Text style={styles.label}>Email ou numero de telephone</Text>
        <TextInput
          style={styles.input}
          placeholder="email ou +237..."
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Code OTP</Text>
        <TextInput
          style={styles.input}
          placeholder="123456"
          value={otp}
          onChangeText={setOtp}
        />

        <Pressable style={styles.button} onPress={verify}>
          <Text style={styles.buttonText}>Verifier mon compte</Text>
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
  info: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#5e6472',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 29, 0.1)',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fff',
    fontFamily: 'PlusJakartaSans_500Medium',
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
