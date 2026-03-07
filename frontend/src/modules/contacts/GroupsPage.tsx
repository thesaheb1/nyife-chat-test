import { Navigate } from 'react-router-dom';

export function GroupsPage() {
  return <Navigate to="/contacts?tab=groups" replace />;
}
