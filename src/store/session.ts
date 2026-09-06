import { create } from 'zustand';

import { getMe, type Me } from '../api';

// Pattern 3 trạng thái giống build-web (useUserStore) - bắt buộc phân biệt
// 'loading' với 'unauthenticated', nếu không lúc F5 store rỗng sẽ bị hiểu
// nhầm là chưa đăng nhập và redirect oan trước khi /me kịp trả lời.
type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionState {
  status: Status;
  user: Me | null;
  fetchMe: () => Promise<void>;
  setUser: (user: Me) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,

  fetchMe: async () => {
    // Tránh gọi lại nếu đã có kết quả (RequireAuth gọi mỗi lần mount).
    if (get().status !== 'loading') return;
    try {
      const res = await getMe();
      if (res.ok) {
        set({ status: 'authenticated', user: res.data });
      } else {
        set({ status: 'unauthenticated', user: null });
      }
    } catch {
      set({ status: 'unauthenticated', user: null });
    }
  },

  setUser: (user) => set({ user }),
  clear: () => set({ status: 'unauthenticated', user: null }),
}));
