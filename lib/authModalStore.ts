import { create } from "zustand";

export type AuthModalConfig = {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  badge?: string;
  promoNotice?: string;
  returnTo?: string;
};

interface AuthModalStore extends AuthModalConfig {
  openAuthModal: (config?: Partial<Omit<AuthModalConfig, "isOpen">>) => void;
  closeAuthModal: () => void;
}

export const useAuthModal = create<AuthModalStore>((set) => ({
  isOpen: false,
  title: undefined,
  subtitle: undefined,
  badge: undefined,
  promoNotice: undefined,
  returnTo: undefined,
  openAuthModal: (config) =>
    set({
      isOpen: true,
      title: config?.title,
      subtitle: config?.subtitle,
      badge: config?.badge,
      promoNotice: config?.promoNotice,
      returnTo: config?.returnTo,
    }),
  closeAuthModal: () =>
    set({
      isOpen: false,
      title: undefined,
      subtitle: undefined,
      badge: undefined,
      promoNotice: undefined,
      returnTo: undefined,
    }),
}));
