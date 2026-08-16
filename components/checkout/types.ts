import { CartItem } from "@/lib/orderStore";
import { OrderCartData } from "@/app/actions/order-impl";

export type SubmittedState = {
  deliveryDateLabel: string | null;
  packageType: string;
  totalDays: number;
  totalPrice: number;
  orderCount: number;
};

export type SummaryDay = {
  dayId: string;
  dayName: string;
  dayOfWeek: number;
  scheduleLabel: string;
};
