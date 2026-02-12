import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '../components/Screen';
import { GlassCard } from '../components/GlassCard';
import { LineChart, DonutChart } from '../components/Charts';
import { colors, spacing, radius } from '../theme/theme';
import { formatCurrency, formatDate } from '../utils/format';
import { useAuth } from '../state/AuthContext';
import { getCategoryBreakdown, getSummary, listTransactions } from '../api/finance';
import { CategoryBreakdown, Transaction } from '../api/types';

const chartPalette = ['#2f8cff', '#39d4c4', '#f8b400', '#ff6b6b', '#6b7a90'];

export const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const { token, user } = useAuth();
  const { width } = useWindowDimensions();
  const [summary, setSummary] = useState({ total_income: 0, total_expense: 0, balance: 0 });
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!token) {
      return;
    }
    const [summaryData, breakdownData, transactionsData] = await Promise.all([
      getSummary(token),
      getCategoryBreakdown(token),
      listTransactions(token),
    ]);
    setSummary(summaryData);
    setBreakdown(breakdownData);
    setTransactions(transactionsData);
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  const sparkline = useMemo(() => {
    if (!transactions.length) {
      return [3, 5, 4, 6, 5, 7, 6];
    }
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const values: number[] = [];
    let running = 0;
    sorted.slice(-7).forEach((item) => {
      running += item.transaction_type === 'income' ? item.amount : -item.amount;
      values.push(running);
    });
    return values.length ? values : [2, 4, 3, 5, 4, 6, 5];
  }, [transactions]);

  const segments = breakdown.map((item, index) => ({
    value: item.spent,
    color: chartPalette[index % chartPalette.length],
  }));
  const chartWidth = Math.max(180, width - 140);

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning</Text>
          <Text style={styles.name}>{user?.email || 'User'}</Text>
        </View>
        <View style={styles.avatar}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/100?img=32' }}
            style={styles.avatarImage}
          />
        </View>
      </View>

      <GlassCard style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total balance</Text>
        <Text style={styles.balanceValue}>{formatCurrency(summary.balance)}</Text>
        <LineChart data={sparkline} width={chartWidth} height={70} stroke={colors.primary} />
        <View style={styles.balanceMeta}>
          <View>
            <Text style={styles.metaLabel}>Income</Text>
            <Text style={[styles.metaValue, { color: colors.success }]}>
              {formatCurrency(summary.total_income)}
            </Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Expense</Text>
            <Text style={[styles.metaValue, { color: colors.danger }]}>
              {formatCurrency(summary.total_expense)}
            </Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.quickRow}>
        <GlassCard style={styles.quickCard}>
          <Text style={styles.quickLabel}>Add transaction</Text>
          <Pressable onPress={() => navigation.navigate('Transactions')} style={styles.quickButton}>
            <Text style={styles.quickButtonText}>Open</Text>
          </Pressable>
        </GlassCard>
        <GlassCard style={styles.quickCard}>
          <Text style={styles.quickLabel}>Manage categories</Text>
          <Pressable onPress={() => navigation.navigate('Categories')} style={styles.quickButton}>
            <Text style={styles.quickButtonText}>Open</Text>
          </Pressable>
        </GlassCard>
      </View>

      <GlassCard style={styles.breakdownCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spend by category</Text>
        </View>
        <View style={styles.breakdownBody}>
          <DonutChart segments={segments.length ? segments : [{ value: 1, color: colors.primary }]} />
          <View style={styles.breakdownList}>
            {breakdown.length ? (
              breakdown.map((item, index) => (
                <View key={`${item.category}-${index}`} style={styles.breakdownRow}>
                  <View
                    style={[
                      styles.breakdownDot,
                      { backgroundColor: chartPalette[index % chartPalette.length] },
                    ]}
                  />
                  <Text style={styles.breakdownLabel}>{item.category}</Text>
                  <Text style={styles.breakdownValue}>{formatCurrency(item.spent)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No data yet</Text>
            )}
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.transactionsCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent transactions</Text>
        </View>
        {recentTransactions.length ? (
          recentTransactions.map((item) => (
            <View key={item.id} style={styles.transactionRow}>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>{item.description}</Text>
                <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  { color: item.transaction_type === 'income' ? colors.success : colors.danger },
                ]}
              >
                {item.transaction_type === 'income' ? '+' : '-'}
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No transactions yet</Text>
        )}
      </GlassCard>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: colors.textMuted,
    fontSize: 14,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  avatar: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarImage: {
    height: 42,
    width: 42,
    borderRadius: 21,
  },
  balanceCard: {
    gap: spacing.sm,
  },
  balanceLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  balanceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  metaValue: {
    fontWeight: '700',
    fontSize: 14,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickCard: {
    flex: 1,
    gap: spacing.sm,
  },
  quickLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  quickButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  quickButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  breakdownCard: {
    gap: spacing.md,
  },
  breakdownBody: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  breakdownList: {
    flex: 1,
    gap: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  breakdownValue: {
    color: colors.textMuted,
    fontSize: 12,
  },
  transactionsCard: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  transactionDate: {
    color: colors.textMuted,
    fontSize: 11,
  },
  transactionAmount: {
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
