import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AuthShell from '@/components/AuthShell';
import { api } from '@/lib/api';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [notice, setNotice] = useState('');

  const parseContact = () => {
    const value = contact.trim();
    if (!value) return {} as { email?: string; phone?: string };
    if (value.includes('@')) return { email: value.toLowerCase() };
    return { phone: value.replace(/[^\d+]/g, '') };
  };

  const requestCode = async () => {
    setNotice('');
    const payload = parseContact();
    if (!payload.email && !payload.phone) {
      setNotice('Veuillez saisir votre email ou telephone.');
      return;
    }
    try {
      const data = await api.post('/auth/request-reset', payload);
      setNotice(data.message || 'Code envoye');
      setCodeSent(true);
    } catch (err: any) {
      const raw = String(err?.message || '');
      let parsed = raw;
      try {
        const json = JSON.parse(raw);
        parsed = json?.error || raw;
      } catch {
        // ignore
      }
      setNotice(parsed || "Impossible d'envoyer le code");
    }
  };

  const resetPassword = async () => {
    setNotice('');
    if (newPassword !== confirmPassword) {
      setNotice('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      const payload = parseContact();
      const data = await api.post('/auth/reset', {
        ...payload,
        code: otp.trim(),
        newPassword,
      });
      setNotice(data.message || 'Mot de passe mis a jour');
      setCodeSent(false);
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const raw = String(err?.message || '');
      let parsed = raw;
      try {
        const json = JSON.parse(raw);
        parsed = json?.error || raw;
      } catch {
        // ignore
      }
      setNotice(parsed || 'Erreur de reinitialisation');
    }
  };

  return (
    <AuthShell
      title="Reinitialiser le mot de passe"
      subtitle="Reinitialisez votre mot de passe en toute securite."
      notice={notice}
      footer={
        <View style={styles.footerRow}>
          <Pressable onPress={() => router.push('/login')}>
            <Text style={styles.link}>Retour a la connexion</Text>
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

        <Pressable style={styles.button} onPress={requestCode}>
          <Text style={styles.buttonText}>Envoyer le code</Text>
        </Pressable>

        {codeSent ? <View style={styles.divider} /> : null}

        {codeSent ? (
          <View style={styles.form}>
            <Text style={styles.label}>Code OTP</Text>
            <TextInput style={styles.input} placeholder="123456" value={otp} onChangeText={setOtp} />

            <Text style={styles.label}>Nouveau mot de passe</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Pressable style={styles.toggle} onPress={() => setShowNewPassword((v) => !v)}>
                <Ionicons
                  name={showNewPassword ? 'eye' : 'eye-off'}
                  size={20}
                  color="#ff5a5f"
                />
              </Pressable>
            </View>

            <Text style={styles.label}>Confirmer mot de passe</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Pressable style={styles.toggle} onPress={() => setShowConfirmPassword((v) => !v)}>
                <Ionicons
                  name={showConfirmPassword ? 'eye' : 'eye-off'}
                  size={20}
                  color="#ff5a5f"
                />
              </Pressable>
            </View>

            <Pressable style={styles.button} onPress={resetPassword}>
              <Text style={styles.buttonText}>Reinitialiser le mot de passe</Text>
            </Pressable>
          </View>
        ) : null}
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
  divider: {
    height: 1,
    backgroundColor: 'rgba(26, 26, 29, 0.1)',
    marginVertical: 12,
  },
});
