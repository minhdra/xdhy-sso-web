import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// 2 trang tĩnh, tự phân theo pathname - chưa cần react-router cho quy mô
// nhỏ này (đúng 2 route, không lồng nhau, không cần link nội bộ phức tạp).
export default function App() {
  const path = window.location.pathname;
  if (path === '/reset-password') return <ResetPasswordPage />;
  return <LoginPage />;
}
