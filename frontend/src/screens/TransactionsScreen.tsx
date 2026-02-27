import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '../components/Screen';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, spacing } from '../theme/theme';
import { formatCurrency, formatDate } from '../utils/format';
import { useAuth } from '../state/AuthContext';
import {
  createTransaction,
  deleteTransaction,
  listCategories,
  listTransactions,
  updateTransaction,
} from '../api/finance';
import { Category, Transaction, TransactionType } from '../api/types';

export const TransactionsScreen = () => {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setTransactionType('expense');
    setSelectedCategory(null);
    setEditingId(null);
    setError(null);
  };

  const loadData = async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const [transactionData, categoryData] = await Promise.all([
        listTransactions(token),
        listCategories(token),
      ]);
      setTransactions(transactionData);
      setCategories(categoryData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleSubmit = async () => {
    if (!token) {
      return;
    }
    setError(null);
    const numericAmount = Number(amount);
    if (!description.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid description and amount.');
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await updateTransaction(token, editingId, {
          description: description.trim(),
          amount: numericAmount,
          transaction_type: transactionType,
          category_id: selectedCategory,
          date: transactionDate,
        });
      } else {
        await createTransaction(token, {
          description: description.trim(),
          amount: numericAmount,
          transaction_type: transactionType,
          category_id: selectedCategory,
          date: transactionDate,
        });
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save transaction.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Transaction) => {
    setEditingId(item.id);
    setDescription(item.description);
    setAmount(String(item.amount));
    setTransactionDate(item.date);
    setTransactionType(item.transaction_type);
    setSelectedCategory(item.category_id);
  };

  const handleDelete = (item: Transaction) => {
    if (!token) {
      return;
    }
    Alert.alert(
      'Delete transaction',
      `Delete "${item.description}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError(null);
            setLoading(true);
            try {
              await deleteTransaction(token, item.id);
              if (editingId === item.id) {
                resetForm();
              }
              await loadData();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not delete transaction.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [transactions]);

  return (
    <Screen>
      <Text style={styles.title}>Transactions</Text>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>
          {editingId ? 'Edit transaction' : 'New transaction'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Description"
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          placeholder="Amount"
          placeholderTextColor={colors.textMuted}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Date (YYYY-MM-DD)"
          placeholderTextColor={colors.textMuted}
          value={transactionDate}
          onChangeText={setTransactionDate}
        />
        <View style={styles.typeRow}>
          {(['expense', 'income'] as TransactionType[]).map((type) => (
            <Pressable
              key={type}
              onPress={() => setTransactionType(type)}
              style={[
                styles.typeChip,
                transactionType === type && styles.typeChipActive,
              ]}
            >
              <Text
                style={[
                  styles.typeLabel,
                  transactionType === type && styles.typeLabelActive,
                ]}
              >
                {type === 'expense' ? 'Expense' : 'Income'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.categoryRow}>
          {categories.length ? (
            categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() =>
                  setSelectedCategory(selectedCategory === category.id ? null : category.id)
                }
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryLabel,
                    selectedCategory === category.id && styles.categoryLabelActive,
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.mutedText}>No categories yet</Text>
          )}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label={
            loading ? 'Saving...' : editingId ? 'Save changes' : 'Add transaction'
          }
          onPress={handleSubmit}
        />
        {editingId ? (
          <Pressable onPress={resetForm} style={styles.cancelEditButton}>
            <Text style={styles.cancelEditText}>Cancel edit</Text>
          </Pressable>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Recent</Text>
        {sortedTransactions.length ? (
          sortedTransactions.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{item.description}</Text>
                <Text style={styles.rowDate}>{formatDate(item.date)}</Text>
              </View>
              <View style={styles.rowActions}>
                <Text
                  style={[
                    styles.rowAmount,
                    { color: item.transaction_type === 'income' ? colors.success : colors.danger },
                  ]}
                >
                  {item.transaction_type === 'income' ? '+' : '-'}
                  {formatCurrency(item.amount)}
                </Text>
                <View style={styles.actionButtons}>
                  <Pressable onPress={() => handleEdit(item)} style={styles.actionButton}>
                    <Text style={styles.actionEditText}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)} style={styles.actionButton}>
                    <Text style={styles.actionDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.mutedText}>No transactions yet</Text>
        )}
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
  card: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeLabel: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  typeLabelActive: {
    color: '#fff',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  categoryLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  rowDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  rowAmount: {
    fontWeight: '700',
    fontSize: 13,
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  actionEditText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionDeleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  cancelEditButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cancelEditText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 12,
  },
  mutedText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
