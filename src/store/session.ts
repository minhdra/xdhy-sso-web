import { create } from 'zustand';

import { getMe, type Me } from '../api';

// Pattern 3 trạng thái giống build-web (useUserStore) - bắt buộc phân biệt
// 'loading' với 'unauthenticated', nếu không lúc F5 store rỗng sẽ bị hiểu
// nhầm là chưa đăng nhập và redirect oan trước khi /me kịp trả lời.
type Status = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface SessionError {
  kind: 'network' | 'timeout' | 'server' | 'rate_limit' | 'unknown';
  message: string;
}

interface SessionState {
  status: Status;
  user: Me | null;
  error: SessionError | null;
  fetchMe: () => Promise<void>;
  retry: () => Promise<void>;
  setUser: (user: Me) => void;
  clear: () => void;
}

// Chặn nhiều RequireAuth mount gần nhau cùng bắn /me khi request đầu chưa
// hoàn tất. Store sống ngoài React tree nhưng StrictMode/route transition có
// thể mount component nhiều lần trong lúc status vẫn là "loading".
let fetchMePromise: Promise<void> | null = null;
const retryDelay = () => new Promise((resolve) => window.setTimeout(resolve, 500 + Math.random() * 250));

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,
  error: null,

  fetchMe: async () => {
    // Tránh gọi lại nếu đã có kết quả (RequireAuth gọi mỗi lần mount).
    if (get().status !== 'loading') return;
    if (!fetchMePromise) {
      fetchMePromise = (async () => {
        try {
          let res;
          try {
            res = await getMe();
            if (res.status >= 500) {
              await retryDelay();
              res = await getMe();
            }
          } catch {
            await retryDelay();
            res = await getMe();
          }
          if (res.ok) {
            set({ status: 'authenticated', user: res.data, error: null });
          } else if (res.status === 401 || res.status === 403) {
            set({ status: 'unauthenticated', user: null, error: null });
          } else {
            set({
              status: 'error',
              user: null,
              error: {
                kind: res.status === 429 ? 'rate_limit' : res.status >= 500 ? 'server' : 'unknown',
                message:
                  res.status === 429
                    ? 'Hệ thống đang nhận quá nhiều yêu cầu.'
                    : 'Không thể kiểm tra phiên đăng nhập.',
              },
            });
          }
        } catch (error) {
          const timedOut = error instanceof DOMException && error.name === 'AbortError';
          set({
            status: 'error',
            user: null,
            error: {
              kind: timedOut ? 'timeout' : 'network',
              message: timedOut
                ? 'Máy chủ phản hồi quá lâu.'
                : 'Không thể kết nối tới máy chủ.',
            },
          });
        } finally {
          fetchMePromise = null;
        }
      })();
    }
    await fetchMePromise;
  },

  retry: async () => {
    set({ status: 'loading', error: null });
    await get().fetchMe();
  },

  setUser: (user) => set({ status: 'authenticated', user, error: null }),
  clear: () => set({ status: 'unauthenticated', user: null, error: null }),
}));
