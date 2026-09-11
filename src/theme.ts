import { type ThemeConfig, theme as antTheme } from "antd";

// Đồng bộ theme với app chính qua cookie `xdhy_theme_mode` (không
// httpOnly, domain cha dùng chung) - KHÔNG tự đoán theo prefers-color-scheme
// của OS (build-web cũng vậy, luôn mặc định light trừ khi user đã bấm dark).
export type ThemeMode = "light" | "dark";
export type FontSizeMode = "standard" | "large";

const COOKIE_KEY = "xdhy_theme_mode";
const LEGACY_COOKIE_KEY = "theme_mode";
const COOKIE_DOMAIN = import.meta.env.VITE_COOKIE_DOMAIN ?? "";
// localStorage riêng của sso-web dùng làm fallback khi chạy local.
// nguồn chính cho việc TỰ nhớ theme của chính nó (cookie domain cha có thể
// rỗng lúc dev local -> không lưu qua origin được, nhưng localStorage luôn
// lưu được trong cùng origin sso-web).
const STORAGE_KEY = "sso_theme_mode";
const FONT_COOKIE_KEY = "xdhy_font_size";
const FONT_STORAGE_KEY = "sso_font_size";

function readCookie(): ThemeMode | null {
  const match = document.cookie.match(/(?:^|;\s*)xdhy_theme_mode=([^;]*)/);
  if (!match) return null;
  return decodeURIComponent(match[1]) === "dark" ? "dark" : "light";
}

function readLegacyCookie(): ThemeMode | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LEGACY_COOKIE_KEY}=([^;]*)`),
  );
  if (!match) return null;
  return decodeURIComponent(match[1]) === "dark" ? "dark" : "light";
}

function readStorage(): ThemeMode | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

// Cookie là nguồn dùng chung giữa các origin, nên phải được ưu tiên. Storage
// chỉ fallback cho môi trường local khi không cấu hình được domain cookie.
export function getThemeModeFromCookie(): ThemeMode {
  return readCookie() ?? readLegacyCookie() ?? readStorage() ?? "light";
}

// Ghi cả localStorage và cookie domain cha để hai app đồng bộ qua lại.
export function setThemeModeCookie(mode: ThemeMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage có thể bị chặn (private mode nghiêm ngặt) - cookie vẫn chạy.
  }
  const domainPart = COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : "";
  document.cookie = `${COOKIE_KEY}=${mode}; Path=/; Max-Age=${400 * 24 * 60 * 60}; SameSite=Lax${domainPart}`;
}

export function getFontSizeMode(): FontSizeMode {
  const match = document.cookie.match(/(?:^|;\s*)xdhy_font_size=([^;]*)/);
  if (match)
    return decodeURIComponent(match[1]) === "large" ? "large" : "standard";
  try {
    return window.localStorage.getItem(FONT_STORAGE_KEY) === "large"
      ? "large"
      : "standard";
  } catch {
    return "standard";
  }
}

export function setFontSizeModeCookie(mode: FontSizeMode) {
  try {
    window.localStorage.setItem(FONT_STORAGE_KEY, mode);
  } catch {
    // Cookie vẫn là nguồn dùng chung nếu localStorage bị chặn.
  }
  const domainPart = COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : "";
  document.cookie = `${FONT_COOKIE_KEY}=${mode}; Path=/; Max-Age=${400 * 24 * 60 * 60}; SameSite=Lax${domainPart}`;
}

export const PRIMARY = "#2563a6";

// Token antd - lấy đúng bộ của build-web (src/theme.ts getThemeConfig) để 2
// app cùng "cảm giác": bo góc 10/16, controlHeight 34, fontSize 13, shadow mềm.
export const getThemeConfig = (
  mode: ThemeMode,
  fontSizeMode: FontSizeMode = "standard",
): ThemeConfig => ({
  algorithm:
    mode === "dark" ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
  token: {
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: fontSizeMode === "large" ? 16 : 13,
    colorPrimary: PRIMARY,
    colorSuccess: "#53c31b",
    colorInfo: "#3fa9ff",
    colorWarning: "#ffbf69",
    colorError: "#ff4d4f",
    borderRadius: 10,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    controlHeight: fontSizeMode === "large" ? 40 : 34,
    boxShadow:
      mode === "dark"
        ? "0 4px 16px 0 rgba(0, 0, 0, 0.35)"
        : "0 4px 16px 0 rgba(20, 30, 40, 0.06)",
    boxShadowSecondary:
      mode === "dark"
        ? "0 2px 8px 0 rgba(0, 0, 0, 0.3)"
        : "0 2px 8px 0 rgba(20, 30, 40, 0.04)",
  },
  components: {
    Button: {
      borderRadius: 10,
      controlHeight: fontSizeMode === "large" ? 40 : 34,
    },
    Card: { borderRadiusLG: 16 },
    Modal: { borderRadiusLG: 16 },
  },
});
