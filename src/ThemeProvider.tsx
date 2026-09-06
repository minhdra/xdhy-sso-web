import { App as AntdApp, ConfigProvider } from 'antd';
import { type ReactNode } from 'react';

import { useThemeStore } from './store/theme';
import { getThemeConfig } from './theme';

// ConfigProvider phải nằm trong React tree để đổi theme LIVE khi bấm toggle.
// antd v5: notification tĩnh không ăn theme -> vẫn phải bọc <AntdApp> và dùng
// App.useApp() ở mỗi trang.
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);

  return (
    <ConfigProvider theme={getThemeConfig(mode)}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
