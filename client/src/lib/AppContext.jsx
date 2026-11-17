import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api';
const AppContext = createContext(null);
export function AppProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const refresh = useCallback(async () => {
    try {
      const next = await api('/bootstrap');
      setData(next);
      setError('');
      return next;
    } catch (err) {
      if (err.status === 401) {
        setData(null);
        setError('');
      } else setError(err.message);
      throw err;
    }
  }, []);
  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
    const expire = () => {
      setData(null);
      setError('');
    };
    window.addEventListener('edubridge:session-expired', expire);
    return () => {
      window.removeEventListener('edubridge:session-expired', expire);
      clearTimeout(timer.current);
    };
  }, [refresh]);
  useEffect(() => {
    if (!data?.user?.id) return;
    const sync = () => {
      if (document.visibilityState === 'visible') refresh().catch(() => {});
    };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    const interval = setInterval(sync, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [data?.user?.id, refresh]);
  const notify = useCallback((message, type = 'success') => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 4500);
  }, []);
  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setData(null);
  }
  return (
    <AppContext.Provider
      value={{ data, user: data?.user, loading, error, refresh, logout, notify }}
    >
      {children}
      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          <span>{toast.message}</span>
          <button aria-label="Tutup pemberitahuan" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
export const useApp = () => useContext(AppContext);
