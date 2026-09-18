import { App as AntdApp, ConfigProvider } from "antd";
import { type ReactNode } from "react";

import { VersionUpdateBanner } from "./components/VersionUpdateBanner";
import { useThemeStore } from "./store/theme";
import { getThemeConfig } from "./theme";

// ConfigProvider phải nằm trong React tree để đổi theme LIVE khi bấm toggle.
// antd v5: notification tĩnh không ăn theme -> vẫn phải bọc <AntdApp> và dùng
// App.useApp() ở mỗi trang.
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const fontSizeMode = useThemeStore((s) => s.fontSizeMode);

  return (
    <ConfigProvider theme={getThemeConfig(mode, fontSizeMode)}>
      <AntdApp>
        <VersionUpdateBanner />
        {children}
      </AntdApp>
    </ConfigProvider>
  );
}
