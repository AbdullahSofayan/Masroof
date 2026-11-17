import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canUseFinance, hasPermission } from '../utils/constants';
import { ErrorBox, Spinner } from './UI';
export default function ProtectedRoute({ permission, finance = false }) {
  const { user, loading, error, retry, logout } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (error) return <div className="mx-auto max-w-lg p-8"><ErrorBox message={error} retry={retry} /><button className="btn-secondary mt-4" onClick={logout}>Return to login</button></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if ((finance && !canUseFinance(user)) || (permission && !hasPermission(user, permission))) return <Navigate to="/access-denied" replace />;
  return <Outlet />;
}
