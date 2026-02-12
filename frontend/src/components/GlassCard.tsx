import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, ViewStyle } from 'react-native';

import { colors, radius, shadow } from '../theme/theme';

type GlassCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  colorsOverride?: [string, string, ...string[]];
};

export const GlassCard = ({ children, style, colorsOverride }: GlassCardProps) => {
  return (
    <LinearGradient
      colors={colorsOverride || [colors.cardTop, colors.cardBottom]}
      style={[styles.card, style]}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
});
