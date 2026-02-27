export type TransactionType = 'income' | 'expense';

export type User = {
  id: number;
  email: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type Category = {
  id: number;
  name: string;
  user_id: number;
};

export type Transaction = {
  id: number;
  user_id: number;
  description: string;
  amount: number;
  transaction_type: TransactionType;
  category_id: number | null;
  date: string;
};

export type FinanceSummary = {
  total_income: number;
  total_expense: number;
  balance: number;
};

export type CategoryBreakdown = {
  category: string;
  spent: number;
};

export type CashflowPoint = {
  period: string;
  income: number;
  expense: number;
  balance: number;
};
