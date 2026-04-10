import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type BrandMarkProps = {
  size?: 'hero' | 'header' | 'sub';
  align?: 'left' | 'center';
};

const brandWordmark = require('../assets/images/brand-wordmark.png');

export default function BrandMark({ size = 'header', align = 'left' }: BrandMarkProps) {
  const imageStyles = [
    styles.image,
    size === 'hero' ? styles.hero : size === 'sub' ? styles.sub : styles.header,
  ];

  return (
    <View style={[styles.wrap, align === 'center' && styles.centerWrap]}>
      <Image source={brandWordmark} style={imageStyles} resizeMode="contain" />
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
  image: {
    flexShrink: 0,
  },
  hero: {
    width: 280,
    height: 63,
  },
  header: {
    width: 188,
    height: 42,
  },
  sub: {
    width: 156,
    height: 35,
  },
});
