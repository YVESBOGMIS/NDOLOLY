import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Status = 'approved' | 'pending' | 'rejected' | 'none' | string;

const SNOOZE_KEY = 'lc_verification_photo_reminder_snooze_until';
const DEFAULT_SNOOZE_MS = 6 * 60 * 60 * 1000;

const readSnoozeUntil = async () => {
  try {
    const raw = await SecureStore.getItemAsync(SNOOZE_KEY);
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const writeSnoozeUntil = async (value: number) => {
  try {
    await SecureStore.setItemAsync(SNOOZE_KEY, String(value || 0));
  } catch {
    // ignore
  }
};

export default function VerificationReminderCard({
  status,
  onVerifyNow,
  snoozeMs = DEFAULT_SNOOZE_MS,
}: {
  status: Status;
  onVerifyNow: () => void;
  snoozeMs?: number;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [visible, setVisible] = useState(false);

  const title = useMemo(() => {
    if (status === 'rejected') return 'Verification photo a refaire';
    return 'Verification photo';
  }, [status]);

  const message = useMemo(() => {
    if (status === 'rejected') {
      return "Votre demande a ete rejetee. Envoyez une nouvelle photo claire de votre visage pour acceder a plus de fonctionnalites et inspirer confiance.";
    }
    return "Verifiez votre profil pour acceder a plus de fonctionnalites (likes, super likes, passer) et inspirer confiance sur la plateforme.";
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (status === 'approved' || status === 'pending') {
        if (!cancelled) setVisible(false);
        return;
      }
      const until = await readSnoozeUntil();
      if (cancelled) return;
      setVisible(Date.now() >= until);
    };

    sync().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status]);

  const snooze = async () => {
    setVisible(false);
    await writeSnoozeUntil(Date.now() + snoozeMs);
  };

  const verifyNow = async () => {
    setVisible(false);
    await writeSnoozeUntil(Date.now() + 10 * 60 * 1000);
    onVerifyNow();
  };

  if (!visible) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.text, { color: colors.muted }]}>{message}</Text>
      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.buttonSecondary, { borderColor: colors.border }]} onPress={snooze}>
          <Text style={[styles.buttonText, { color: colors.text }]}>Plus tard</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonPrimary]} onPress={verifyNow}>
          <Text style={[styles.buttonText, styles.buttonPrimaryText]}>Envoyer maintenant</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  text: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 17,
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonPrimary: {
    backgroundColor: '#111',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  buttonPrimaryText: {
    color: '#fff',
  },
});

