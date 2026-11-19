import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken } from "../services/api";
import { SESSION_EXPIRED_EVENT } from "../utils/constants";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          api.logout();
          setUser(null);
        } else setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setError("");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, []);
  async function login(username, password) {
    const profile = await api.login(username, password);
    setUser(profile);
    setError("");
    return profile;
  }
  function logout() {
    api.logout();
    setUser(null);
    setError("");
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        token: getToken(),
        permissions: user?.permissions || [],
        loading,
        error,
        login,
        logout,
        retry: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
