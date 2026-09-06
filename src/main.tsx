import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import ThemeProvider from './ThemeProvider';
import './index.css';
import { getThemeModeFromCookie, setThemeModeCookie } from './theme';

// Set data-theme TRƯỚC khi React render (không phải trong effect) - tránh
// nháy sáng/tối lúc trang vừa tải. Sau đó useThemeStore đọc lại cookie này.
const initialThemeMode = getThemeModeFromCookie();
setThemeModeCookie(initialThemeMode);
document.documentElement.setAttribute('data-theme', initialThemeMode);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
