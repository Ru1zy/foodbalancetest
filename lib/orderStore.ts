import { create } from "zustand";
import { PackageType } from "@/lib/order-logic";
import type { DeliveryMethod } from "@/lib/checkout";

export type OrderWizardStep = 1 | 2 | 3;

export type Selections = Record<string, Record<string, number>>;

export type CartItem = {
  id: string;
  date: string;
  planType: PackageType;
  dishes: Array<{ dishId: string; quantity: number }>;
  selections?: Record<string, number>;
  price: number | null;
};

export type CustomerProfile = {
  address: string;
  chatId: string;
  cutlery: number;
  deliveryMethod: DeliveryMethod;
  isAuthenticated: boolean;
  name: string;
  notes: string;
  phone: string;
  userId: string;
  username: string;
};

export interface OrderStore {
  customerProfile: CustomerProfile;
  selectedPackage: PackageType;
  /** Menu weekday indices 1–7 chosen on wizard step 2. */
  selectedDates: number[];
  orderWizardStep: OrderWizardStep;
  selections: Selections;
  cartItems: CartItem[];
  incrementDish: (dayId: string, dishId: string) => void;
  decrementDish: (dayId: string, dishId: string) => void;
  setCustomerProfile: (profile: Partial<CustomerProfile>) => void;
  setPackage: (packageType: PackageType) => void;
  wizardSelectPackage: (packageType: PackageType) => void;
  setWizardStep: (step: OrderWizardStep) => void;
  setSelectedDates: (dates: number[]) => void;
  setSelection: (dayId: string, category: string, dishIndex: number) => void;
  clearSelections: () => void;
  clearDaySelections: (dayId: string) => void;
  addCartItem: (item: CartItem) => void;
  removeCartItem: (itemId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  customerProfile: {
    address: "",
    chatId: "",
    cutlery: 0,
    deliveryMethod: "delivery",
    isAuthenticated: false,
    name: "",
    notes: "",
    phone: "",
    userId: "",
    username: "",
  },
  selectedPackage: "Slim",
  selectedDates: [],
  orderWizardStep: 1,
  selections: {},
  cartItems: [],

  setCustomerProfile: (profile) =>
    set((state) => ({
      customerProfile: {
        ...state.customerProfile,
        ...profile,
      },
    })),

  setPackage: (packageType: PackageType) =>
    set(() => ({
      selectedPackage: packageType,
      selections: {},
    })),

  wizardSelectPackage: (packageType) =>
    set((state) => {
      const pkgChanged = state.selectedPackage !== packageType;
      return {
        selectedPackage: packageType,
        selections: pkgChanged ? {} : state.selections,
        selectedDates: pkgChanged ? [] : state.selectedDates,
        orderWizardStep: 2,
      };
    }),

  setWizardStep: (step) => set({ orderWizardStep: step }),

  setSelectedDates: (dates) =>
    set({
      selectedDates: [...new Set(dates)]
        .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
        .sort((a, b) => a - b),
    }),

  setSelection: (dayId, category, dishIndex) =>
    set((state) => ({
      selections: {
        ...state.selections,
        [dayId]: {
          ...state.selections[dayId],
          [category]: dishIndex,
        },
      },
    })),

  incrementDish: (dayId, dishId) =>
    set((state) => ({
      selections: {
        ...state.selections,
        [dayId]: {
          ...state.selections[dayId],
          [dishId]: (state.selections[dayId]?.[dishId] ?? 0) + 1,
        },
      },
    })),

  decrementDish: (dayId, dishId) =>
    set((state) => {
      const daySelections = state.selections[dayId] ?? {};
      const nextQuantity = (daySelections[dishId] ?? 0) - 1;

      if (nextQuantity > 0) {
        return {
          selections: {
            ...state.selections,
            [dayId]: {
              ...daySelections,
              [dishId]: nextQuantity,
            },
          },
        };
      }

      const remainingSelections = { ...daySelections };
      delete remainingSelections[dishId];

      if (Object.keys(remainingSelections).length === 0) {
        const remainingDays = { ...state.selections };
        delete remainingDays[dayId];

        return {
          selections: remainingDays,
        };
      }

      return {
        selections: {
          ...state.selections,
          [dayId]: remainingSelections,
        },
      };
    }),

  clearSelections: () =>
    set(() => ({
      selections: {},
    })),

  clearDaySelections: (dayId) =>
    set((state) => {
      if (!state.selections[dayId]) {
        return state;
      }
      const next = { ...state.selections };
      delete next[dayId];
      return { selections: next };
    }),

  addCartItem: (item) =>
    set((state) => ({
      cartItems: [...state.cartItems, item],
    })),

  removeCartItem: (itemId) =>
    set((state) => ({
      cartItems: state.cartItems.filter((item) => item.id !== itemId),
    })),

  clearCart: () =>
    set(() => ({
      cartItems: [],
    })),

  getCartTotal: () => {
    const state = get();
    return state.cartItems.reduce((total, item) => total + (item.price || 0), 0);
  },
}));
