import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import BrandMark from '@/components/BrandMark';

type AuthShellProps = {
  title: string;
  subtitle?: string;
  notice?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function AuthShell({ title, subtitle, notice, children, footer }: AuthShellProps) {
  return (
    <LinearGradient colors={['#fff0f4', '#fff5f2', '#fef8e6']} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.hero}>
            <BrandMark size="hero" align="center" />
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {children}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  hero: {
    alignItems: 'center',
    gap: 4,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#5e6472',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#1a1a1d',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    marginBottom: 8,
  },
  notice: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#8b1e2d',
    marginBottom: 12,
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
});
