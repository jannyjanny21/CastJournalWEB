import { createContext } from 'react';
import type { CurrentUser } from '../types/auth';

interface RegisterPayload {
  userName: string;
  email: string;
  fullName: string;
  password: string;
  /** Privacy notice accepted (F-19). */
  acceptPrivacyPolicy: boolean;
}

export interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  /** acceptPrivacyPolicy is sent from the Register page; needed only when this creates a new account. */
  googleLogin: (credential: string, acceptPrivacyPolicy?: boolean) => Promise<void>;

  logout: () => void;
  sessionExpiredMessage: string | null;
  clearSessionExpiredMessage: () => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, token: string, newPassword: string) => Promise<void>;
}
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
