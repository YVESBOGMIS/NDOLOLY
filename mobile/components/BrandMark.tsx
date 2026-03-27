import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type BrandMarkProps = {
  size?: 'hero' | 'header' | 'sub';
  align?: 'left' | 'center';
};

export default function BrandMark({ size = 'header', align = 'left' }: BrandMarkProps) {
  const textStyles = [
    styles.base,
    size === 'hero' ? styles.hero : size === 'sub' ? styles.sub : styles.header,
    align === 'center' && styles.centerText,
  ];

  return (
    <View style={[styles.wrap, align === 'center' && styles.centerWrap]}>
      <Text style={textStyles}>NDOLOLY</Text>
      <View style={[styles.rule, align === 'center' && styles.ruleCenter]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  centerWrap: {
    alignItems: 'center',
  },
  base: {
    fontFamily: 'PlayfairDisplay_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 6,
    color: '#b8860b',
    textShadowColor: 'rgba(20, 16, 10, 0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  hero: {
    fontSize: 34,
    fontWeight: '700',
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
  },
  sub: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 4,
  },
  centerText: {
    textAlign: 'center',
  },
  rule: {
    marginTop: 6,
    height: 2,
    width: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(212, 175, 55, 0.7)',
  },
  ruleCenter: {
    alignSelf: 'center',
  },
});
