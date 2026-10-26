import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, AUTH_UNAUTHORIZED_EVENT, getErrorMessage } from '../lib/api';
import { setAuthNotice } from '../lib/notice';
import type {
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  User,
} from '../lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<string>;
  deleteAccount: (currentPassword: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    api
      .me({ signal: controller.signal })
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setUser(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser((previous) => {
        if (previous) {
          setAuthNotice('Your session expired. Please sign in again.');
        }
        return null;
      });
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(async (payload: LoginPayload): Promise<User> => {
    const { user: currentUser } = await api.login(payload);
    setUser(currentUser);
    return currentUser;
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<User> => {
    const { user: currentUser } = await api.register(payload);
    setUser(currentUser);
    return currentUser;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.logout();
    } catch (error) {
      // The local session is cleared even if the server session already expired.
      if (!(error instanceof Error)) {
        throw error;
      }
    } finally {
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(
    async (payload: ChangePasswordPayload): Promise<string> => {
      try {
        const result = await api.changePassword(payload);
        setAuthNotice(result.message);
        setUser(null);
        return result.message;
      } catch (error) {
        throw new Error(getErrorMessage(error));
      }
    },
    []
  );

  const deleteAccount = useCallback(async (currentPassword: string): Promise<string> => {
    try {
      const result = await api.deleteAccount(currentPassword);
      setAuthNotice(result.message);
      setUser(null);
      return result.message;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, changePassword, deleteAccount }),
    [user, loading, login, register, logout, changePassword, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
