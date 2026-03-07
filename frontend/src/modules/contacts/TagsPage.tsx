import { Navigate } from 'react-router-dom';

export function TagsPage() {
  return <Navigate to="/contacts?panel=tags" replace />;
}
