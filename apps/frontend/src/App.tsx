import { Navigate, Route, Routes } from 'react-router-dom';
import { isAuthed } from './lib/api';
import LoginScreen from './screens/LoginScreen';
import TablesScreen from './screens/TablesScreen';
import OrderScreen from './screens/OrderScreen';
import ReportScreen from './screens/ReportScreen';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isAuthed() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <TablesScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <RequireAuth>
            <OrderScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/report"
        element={
          <RequireAuth>
            <ReportScreen />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
