import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Screen } from '../components/Screen';
import { GlassCard } from '../components/GlassCard';
import { DonutChart, DualLineChart } from '../components/Charts';
import { colors, radius, spacing } from '../theme/theme';
import { formatCurrency, formatDate } from '../utils/format';
import { useAuth } from '../state/AuthContext';
import { getCashflow, getCategoryBreakdown, getSummary } from '../api/finance';
import { CashflowPoint, CategoryBreakdown } from '../api/types';

const chartPalette = ['#2f8cff', '#39d4c4', '#f8b400', '#ff6b6b', '#6b7a90'];
const PERIOD_OPTIONS = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All', days: null },
] as const;

type PeriodKey = (typeof PERIOD_OPTIONS)[number]['key'];

const toDateParam = (value: Date) => value.toISOString().slice(0, 10);

const resolvePeriodFilter = (period: PeriodKey) => {
  const selected = PERIOD_OPTIONS.find((item) => item.key === period);
  if (!selected || selected.days === null) {
    return {};
  }
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (selected.days - 1));
  return {
    start_date: toDateParam(startDate),
    end_date: toDateParam(endDate),
  };
};

export const ReportsScreen = () => {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [summary, setSummary] = useState({ total_income: 0, total_expense: 0, balance: 0 });
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const filters = resolvePeriodFilter(period);
      const [summaryData, breakdownData, cashflowData] = await Promise.all([
        getSummary(token, filters),
        getCategoryBreakdown(token, filters),
        getCashflow(token, filters),
      ]);
      setSummary(summaryData);
      setBreakdown(breakdownData);
      setCashflow(cashflowData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [token, period]);

  const segments = useMemo(
    () =>
      breakdown.map((item, index) => ({
        value: item.spent,
        color: chartPalette[index % chartPalette.length],
      })),
    [breakdown]
  );

  const incomeSeries = useMemo(() => cashflow.map((point) => point.income), [cashflow]);
  const expenseSeries = useMemo(() => cashflow.map((point) => point.expense), [cashflow]);
  const chartWidth = Math.max(210, width - 120);
  const firstDate = cashflow.length ? formatDate(cashflow[0].period) : '-';
  const lastDate = cashflow.length ? formatDate(cashflow[cashflow.length - 1].period) : '-';

  return (
    <Screen>
      <Text style={styles.title}>Reports</Text>
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setPeriod(option.key)}
            style={[styles.periodChip, period === option.key && styles.periodChipActive]}
          >
            <Text
              style={[styles.periodChipText, period === option.key && styles.periodChipTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatCurrency(summary.total_income)}
            </Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>Expense</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>
              {formatCurrency(summary.total_expense)}
            </Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={styles.summaryValue}>{formatCurrency(summary.balance)}</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Income vs expense over time</Text>
        {loading ? (
          <Text style={styles.mutedText}>Loading report...</Text>
        ) : cashflow.length ? (
          <>
            <DualLineChart
              incomeData={incomeSeries}
              expenseData={expenseSeries}
              width={chartWidth}
              height={170}
              incomeStroke={colors.success}
              expenseStroke={colors.danger}
            />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={styles.legendLabel}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                <Text style={styles.legendLabel}>Expense</Text>
              </View>
            </View>
            <Text style={styles.mutedText}>{`${firstDate} - ${lastDate}`}</Text>
          </>
        ) : (
          <Text style={styles.mutedText}>No data in selected period</Text>
        )}
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Category breakdown</Text>
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
              <Text style={styles.mutedText}>No data yet</Text>
            )}
          </View>
        </View>
      </GlassCard>
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  periodChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  periodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  periodChipTextActive: {
    color: '#ffffff',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  card: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: colors.textMuted,
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
  mutedText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
