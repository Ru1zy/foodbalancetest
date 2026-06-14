import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PackageType } from "@/lib/order-logic";
import { getPackageLimit } from "@/lib/order-logic";
import { sanitizeTelegramPhone } from "@/lib/telegram-phone";
import type { OrderCartData } from "@/app/actions/order-impl";

export type Selections = Record<string, Record<string, number>>;

/**
 * A fully assembled package in the multi-order cart.
 *
 * Each CartItem is a complete snapshot of one wizard run (one package + its
 * days/selections) ready to be submitted as a single order. `quantity` lets the
 * customer order N identical copies of the same assembled package; on submit the
 * quantity is "unrolled" into N separate orders server-side (see submitOrders),
 * so neither the Prisma schema nor the Google Sheets logic has to change.
 */
export type CartItem = {
  /** Stable client-side id for this cart line. */
  id: string;
  /** Tariff/package type, e.g. "Balance". */
  packageType: PackageType;
  /** Human-readable label shown in the cart UI. */
  packageLabel: string;
  /** Full payload submitted to the server for ONE copy of this package. */
  cartData: OrderCartData;
  /** Earliest delivery date for this package, ISO string. */
  deliveryDate: string;
  /** Gross price for ONE copy of this package (all of its days). */
  unitPrice: number;
  /** Number of selected days inside this package. */
  dayCount: number;
  /** Display labels for the selected days. */
  dayLabels: string[];
  /** How many identical copies of this package to order. Default 1. */
  quantity: number;
};

export type CustomerProfile = {
  address: string;
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
  isCustomMode: boolean;
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
  toggleCustomMode: (value: boolean) => void;
  setStep: (step: number) => void;
  setSelectedDates: (dates: string[]) => void;
  resetWizard: () => void;
  hardReset: () => void;
  setSelection: (dayId: string, category: string, dishIndex: number) => void;
  clearSelections: () => void;
  clearDaySelections: (dayId: string) => void;
  addCartItem: (item: CartItem) => void;
  removeCartItem: (itemId: string) => void;
  incrementQuantity: (cartItemId: string) => void;
  decrementQuantity: (cartItemId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

/** Hard ceiling on copies of a single package to avoid runaway order loops. */
const MAX_CART_ITEM_QUANTITY = 50;

function normalizeSelectedDateStrings(dates: string[]): string[] {
  return [...new Set(dates.map((s) => String(s).trim()))]
    .filter((s) => /^[1-7]$/.test(s))
    .sort((a, b) => Number(a) - Number(b));
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      customerProfile: {
        address: "",
        chatId: "",
        cutlery: 0,
        isAuthenticated: false,
        name: "",
        notes: "",
        phone: "",
        userId: "",
        username: "",
      },
      isCustomMode: false,
      selectedPackage: null,
      selectedDates: [],
      step: 1,
      selections: {},
      cartItems: [],

  setCustomerProfile: (profile) =>
    set((state) => {
      const nextProfile = {
        ...profile,
      };

      if ("phone" in nextProfile) {
        nextProfile.phone = sanitizeTelegramPhone(nextProfile.phone);
      }

      return {
        customerProfile: {
          ...state.customerProfile,
          ...nextProfile,
        },
      };
    }),

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

  toggleCustomMode: (value) =>
    set(() => ({
      isCustomMode: value,
      selections: {},
    })),

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
      isCustomMode: false,
    }),

  hardReset: () =>
    set({
      step: 1,
      selectedPackage: null,
      selectedDates: [],
      isCustomMode: false,
      selections: {},
      cartItems: [],
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
      const { limit: packageLimit } = getPackageLimit(state.selectedPackage ?? undefined);
      const isIndiv = state.selectedPackage?.toLowerCase().includes("інд") ||
                      state.selectedPackage?.toLowerCase().includes("ind");

      const daySelections = state.selections[dayId] ?? {};
      const currentQuantity = daySelections[dishId] ?? 0;

      // Calculate total dishes for this day
      const totalDishesInDay = Object.values(daySelections).reduce((sum, qty) => sum + qty, 0);

      // For all other packages: total must equal package limit exactly
      if (!isIndiv) {
        if (totalDishesInDay >= packageLimit) {
          return state; // Prevent increment, limit reached
        }
      } else {
        // For "Indiv" package
        // Max 10 total dishes per day
        if (totalDishesInDay >= 10) {
          return state; // Prevent increment, max total reached
        }
        // Max 3 of the same dish (specific to Indiv)
        if (currentQuantity >= 3) {
          return state; // Prevent increment, max per dish reached
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
      cartItems: [
        ...state.cartItems,
        {
          ...item,
          quantity:
            Number.isInteger(item.quantity) && item.quantity > 0
              ? Math.min(item.quantity, MAX_CART_ITEM_QUANTITY)
              : 1,
        },
      ],
    })),

  removeCartItem: (itemId) =>
    set((state) => ({
      cartItems: state.cartItems.filter((item) => item.id !== itemId),
    })),

  incrementQuantity: (cartItemId) =>
    set((state) => ({
      cartItems: state.cartItems.map((item) =>
        item.id === cartItemId
          ? { ...item, quantity: Math.min(item.quantity + 1, MAX_CART_ITEM_QUANTITY) }
          : item,
      ),
    })),

  decrementQuantity: (cartItemId) =>
    set((state) => ({
      cartItems: state.cartItems.map((item) =>
        item.id === cartItemId
          ? { ...item, quantity: Math.max(1, item.quantity - 1) }
          : item,
      ),
    })),

  clearCart: () =>
    set(() => ({
      cartItems: [],
    })),

  getCartTotal: () => {
    const state = get();
    return state.cartItems.reduce(
      (total, item) => total + (item.unitPrice || 0) * (item.quantity || 1),
      0,
    );
  },
}),
    {
      name: "food-balance-storage",
    }
  )
);
