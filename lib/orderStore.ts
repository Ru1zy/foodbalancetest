import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PackageType } from "@/lib/order-logic";
import { getPackageLimit } from "@/lib/order-logic";

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
  street: string;
  house: string;
  apartment: string;
  entrance: string;
  intercom: string;
  chatId: string;
  cutlery: number;
  isAuthenticated: boolean;
  name: string;
  notes: string;
  phone: string;
  userId: string;
  username: string;
};

export interface OrderStore {
  customerProfile: CustomerProfile;
  /** Wizard / menu tariff id; `null` until the user completes step 1. */
  selectedPackage: string | null;
  /** Weekday indices as strings `"1"`…`"7"` (menu week days). */
  selectedDates: string[];
  /** Wizard screen: 1 = package, 2 = days, 3 = dishes. */
  step: number;
  selections: Selections;
  cartItems: CartItem[];
  incrementDish: (dayId: string, dishId: string) => void;
  decrementDish: (dayId: string, dishId: string) => void;
  setCustomerProfile: (profile: Partial<CustomerProfile>) => void;
  setPackage: (packageType: PackageType) => void;
  /** Step 1 → 2: set tariff; clears selections & dates only if tariff changed. */
  selectWizardPackage: (packageType: string) => void;
  setStep: (step: number) => void;
  setSelectedDates: (dates: string[]) => void;
  resetWizard: () => void;
  setSelection: (dayId: string, category: string, dishIndex: number) => void;
  clearSelections: () => void;
  clearDaySelections: (dayId: string) => void;
  addCartItem: (item: CartItem) => void;
  removeCartItem: (itemId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

function normalizeSelectedDateStrings(dates: string[]): string[] {
  return [...new Set(dates.map((s) => String(s).trim()))]
    .filter((s) => /^[1-7]$/.test(s))
    .sort((a, b) => Number(a) - Number(b));
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      customerProfile: {
        street: "",
        house: "",
        apartment: "",
        entrance: "",
        intercom: "",
        chatId: "",
        cutlery: 0,
        isAuthenticated: false,
        name: "",
        notes: "",
        phone: "",
        userId: "",
        username: "",
      },
      selectedPackage: null,
      selectedDates: [],
      step: 1,
      selections: {},
      cartItems: [],

  setCustomerProfile: (profile) =>
    set((state) => ({
      customerProfile: {
        ...state.customerProfile,
        ...profile,
      },
    })),

  setPackage: (packageType) =>
    set(() => ({
      selectedPackage: packageType,
      selections: {},
    })),

  selectWizardPackage: (packageType) =>
    set((state) => {
      const pkgChanged = state.selectedPackage !== packageType;
      return {
        selectedPackage: packageType,
        selections: pkgChanged ? {} : state.selections,
        selectedDates: pkgChanged ? [] : state.selectedDates,
        step: 2,
      };
    }),

  setStep: (step) => set({ step }),

  setSelectedDates: (dates) =>
    set({
      selectedDates: normalizeSelectedDateStrings(dates),
    }),

  resetWizard: () =>
    set({
      step: 1,
      selectedPackage: null,
      selectedDates: [],
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
    set((state) => {
      const packageLimit = getPackageLimit(state.selectedPackage ?? undefined);
      const isIndiv = state.selectedPackage?.toLowerCase().includes("інд") ||
                      state.selectedPackage?.toLowerCase().includes("ind");

      const daySelections = state.selections[dayId] ?? {};
      const currentQuantity = daySelections[dishId] ?? 0;

      // Calculate total dishes for this day
      const totalDishesInDay = Object.values(daySelections).reduce((sum, qty) => sum + qty, 0);

      // For "Indiv" package
      if (isIndiv) {
        // Max 10 total dishes per day
        if (totalDishesInDay >= 10) {
          return state; // Prevent increment, max total reached
        }
        // Max 3 of the same dish
        if (currentQuantity >= 3) {
          return state; // Prevent increment, max per dish reached
        }
      } else {
        // For all other packages: total must equal package limit exactly
        if (totalDishesInDay >= packageLimit) {
          return state; // Prevent increment, limit reached
        }
      }

      // Allow increment
      return {
        selections: {
          ...state.selections,
          [dayId]: {
            ...daySelections,
            [dishId]: currentQuantity + 1,
          },
        },
      };
    }),

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
}),
    {
      name: "food-balance-storage",
    }
  )
);
