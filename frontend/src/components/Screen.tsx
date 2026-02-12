import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  RefreshControlProps,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { colors, spacing } from '../theme/theme';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

export const Screen = ({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  refreshControl,
}: ScreenProps) => {
  return (
    <LinearGradient colors={[colors.backgroundTop, colors.backgroundBottom]} style={styles.background}>
      <SafeAreaView style={styles.safe}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, style]}>{children}</View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
  },
});
