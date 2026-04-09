export type DishOption = {
  full: string;
  short: string;
};

export type Dishes = {
  breakfast: DishOption[];
  lunch: DishOption[];
  dinner: DishOption[];
  snack?: DishOption[];
  extra?: DishOption[];
};

export type MenuItem = {
  id: string;
  dayOfWeek: number;
  packageType: string;
  dishes: Dishes;
  photoUrl?: string | null;
};
