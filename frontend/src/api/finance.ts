import { apiRequest, buildQuery } from './client';
import {
  CashflowPoint,
  Category,
  CategoryBreakdown,
  FinanceSummary,
  Transaction,
  TransactionType,
} from './types';

export const listCategories = async (token: string) => {
  return apiRequest<Category[]>('/finance/categories', { method: 'GET' }, token);
};

export const createCategory = async (token: string, name: string) => {
  return apiRequest<Category>(
    '/finance/categories',
    {
      method: 'POST',
      body: JSON.stringify({ name }),
    },
    token
  );
};

export const updateCategory = async (token: string, categoryId: number, name: string) => {
  return apiRequest<Category>(
    `/finance/categories/${categoryId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ name }),
    },
    token
  );
};

export const deleteCategory = async (token: string, categoryId: number) => {
  return apiRequest<void>(`/finance/categories/${categoryId}`, { method: 'DELETE' }, token);
};

export type TransactionFilters = {
  start_date?: string;
  end_date?: string;
  category_id?: number;
  transaction_type?: TransactionType;
};

export const listTransactions = async (token: string, filters: TransactionFilters = {}) => {
  const query = buildQuery(filters);
  return apiRequest<Transaction[]>(`/finance/transactions${query}`, { method: 'GET' }, token);
};

export const createTransaction = async (
  token: string,
  payload: {
    description: string;
    amount: number;
    transaction_type: TransactionType;
    category_id?: number | null;
    date?: string;
  }
) => {
  return apiRequest<Transaction>(
    '/finance/transactions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token
  );
};

export const updateTransaction = async (
  token: string,
  id: number,
  payload: Partial<{
    description: string;
    amount: number;
    transaction_type: TransactionType;
    category_id: number | null;
    date: string;
  }>
) => {
  return apiRequest<Transaction>(
    `/finance/transactions/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    token
  );
};

export const deleteTransaction = async (token: string, id: number) => {
  return apiRequest<void>(`/finance/transactions/${id}`, { method: 'DELETE' }, token);
};

export const getSummary = async (token: string, filters: TransactionFilters = {}) => {
  const query = buildQuery(filters);
  return apiRequest<FinanceSummary>(`/finance/reports/summary${query}`, { method: 'GET' }, token);
};

export const getCategoryBreakdown = async (token: string, filters: TransactionFilters = {}) => {
  const query = buildQuery(filters);
  return apiRequest<CategoryBreakdown[]>(
    `/finance/reports/category-breakdown${query}`,
    { method: 'GET' },
    token
  );
};

export const getCashflow = async (token: string, filters: TransactionFilters = {}) => {
  const query = buildQuery(filters);
  return apiRequest<CashflowPoint[]>(`/finance/reports/cashflow${query}`, { method: 'GET' }, token);
};
