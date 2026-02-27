import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '../components/Screen';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, spacing } from '../theme/theme';
import { useAuth } from '../state/AuthContext';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../api/finance';
import { Category } from '../api/types';

export const CategoriesScreen = () => {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setEditingId(null);
    setError(null);
  };

  const loadCategories = async () => {
    if (!token) {
      return;
    }
    const data = await listCategories(token);
    setCategories(data);
  };

  useEffect(() => {
    loadCategories();
  }, [token]);

  const handleSubmit = async () => {
    if (!token) {
      return;
    }
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        await updateCategory(token, editingId, name.trim());
      } else {
        await createCategory(token, name.trim());
      }
      resetForm();
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save category.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setError(null);
  };

  const handleDelete = (category: Category) => {
    if (!token) {
      return;
    }
    Alert.alert(
      'Delete category',
      `Delete "${category.name}"? Related transactions will become Uncategorized.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              await deleteCategory(token, category.id);
              if (editingId === category.id) {
                resetForm();
              }
              await loadCategories();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not delete category.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <Text style={styles.title}>Categories</Text>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>{editingId ? 'Edit category' : 'New category'}</Text>
        <TextInput
          style={styles.input}
          placeholder="Category name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label={loading ? 'Saving...' : editingId ? 'Save changes' : 'Add category'}
          onPress={handleSubmit}
        />
        {editingId ? (
          <Pressable onPress={resetForm} style={styles.cancelEditButton}>
            <Text style={styles.cancelEditText}>Cancel edit</Text>
          </Pressable>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Your categories</Text>
        <View style={styles.list}>
          {categories.length ? (
            categories.map((category) => (
              <View key={category.id} style={styles.categoryRow}>
                <View style={styles.categoryMain}>
                  <View style={styles.categoryDot} />
                  <Text style={styles.categoryName}>{category.name}</Text>
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => handleEdit(category)} style={styles.actionButton}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(category)} style={styles.actionButton}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.mutedText}>No categories yet</Text>
          )}
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
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  list: {
    gap: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  categoryName: {
    color: colors.text,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  editText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
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
