import { apiRequest } from './client';
import { TokenResponse, User } from './types';

export const registerUser = async (email: string, password: string) => {
  return apiRequest<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const loginUser = async (email: string, password: string) => {
  return apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const fetchMe = async (token: string) => {
  return apiRequest<User>('/auth/me', { method: 'GET' }, token);
};
