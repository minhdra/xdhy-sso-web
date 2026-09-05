import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './index.css';
import { PRIMARY, getThemeModeFromCookie } from './theme';

// Set data-theme TRƯỚC khi React render (không phải trong effect) - tránh
// nháy sáng/tối lúc trang vừa tải, xem lý do đầy đủ trong theme.ts.
const mode = getThemeModeFromCookie();
document.documentElement.setAttribute('data-theme', mode);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: PRIMARY },
      }}
    >
      {/* antd v5: gọi notification.success(...) kiểu tĩnh (không qua hook)
      KHÔNG ăn theme của ConfigProvider - luôn ra light bất kể đang dark mode
      (bug thật đã gặp). Phải bọc <AntdApp> rồi lấy notification qua
      AntdApp.useApp() ở từng trang mới ăn đúng theme. */}
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);
