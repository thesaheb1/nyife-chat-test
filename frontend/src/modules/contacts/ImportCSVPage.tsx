import { Navigate } from 'react-router-dom';

export function ImportCSVPage() {
  return <Navigate to="/contacts?panel=import" replace />;
}
