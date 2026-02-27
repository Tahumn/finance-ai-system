import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing } from '../theme/theme';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../state/AuthContext';

export const SettingsScreen = () => {
  const { user, logout, loading } = useAuth();

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.text}>Signed in as</Text>
        <Text style={styles.value}>{user?.email || '-'}</Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>API</Text>
        <Text style={styles.text}>Base URL</Text>
        <Text style={styles.value}>{API_BASE_URL}</Text>
      </GlassCard>

      <View style={styles.actions}>
        <PrimaryButton label={loading ? 'Signing out...' : 'Sign out'} onPress={logout} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  card: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  text: {
    color: colors.textMuted,
    fontSize: 12,
  },
  value: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    marginTop: spacing.sm,
  },
});
