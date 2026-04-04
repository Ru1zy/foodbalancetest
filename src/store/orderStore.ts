import { create } from "zustand";
import { PackageType } from "@/lib/order-logic";
import type { DeliveryMethod } from "@/src/lib/checkout";

export type Selections = Record<string, Record<string, number>>;
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
  selections: Selections;
  incrementDish: (dayId: string, dishId: string) => void;
  decrementDish: (dayId: string, dishId: string) => void;
  setCustomerProfile: (profile: Partial<CustomerProfile>) => void;
  setPackage: (packageType: PackageType) => void;
  setSelection: (dayId: string, category: string, dishIndex: number) => void;
  clearSelections: () => void;
}

export const useOrderStore = create<OrderStore>((set) => ({
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
  selections: {},

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
}));
