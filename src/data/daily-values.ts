// HealthVault — FDA 2020 Daily Reference Values
// Source: 21 CFR 101.36 — FDA Daily Values for nutrition labeling
// https://www.fda.gov/media/135301/download
// These values are public domain (U.S. federal government work).

export interface DailyValue {
  /** Nutrient name (matches AI output key) */
  nutrient: string;
  /** Daily reference value amount */
  amount: number;
  /** Unit of measurement */
  unit: string;
}

/**
 * FDA 2020 Daily Values used for %DV calculations on nutrition labels.
 * Based on a 2,000-calorie reference diet for adults and children
 * aged 4 years and older.
 */
export const FDA_DAILY_VALUES: DailyValue[] = [
  // Macronutrients
  { nutrient: 'Total Fat', amount: 78, unit: 'g' },
  { nutrient: 'Saturated Fat', amount: 20, unit: 'g' },
  { nutrient: 'Trans Fat', amount: 0, unit: 'g' }, // no DV established
  { nutrient: 'Cholesterol', amount: 300, unit: 'mg' },
  { nutrient: 'Sodium', amount: 2300, unit: 'mg' },
  { nutrient: 'Total Carbohydrate', amount: 275, unit: 'g' },
  { nutrient: 'Dietary Fiber', amount: 28, unit: 'g' },
  { nutrient: 'Total Sugars', amount: 0, unit: 'g' }, // no DV established
  { nutrient: 'Added Sugars', amount: 50, unit: 'g' },
  { nutrient: 'Protein', amount: 50, unit: 'g' },

  // Vitamins
  { nutrient: 'Vitamin A', amount: 900, unit: 'mcg' },
  { nutrient: 'Vitamin C', amount: 90, unit: 'mg' },
  { nutrient: 'Vitamin D', amount: 20, unit: 'mcg' },
  { nutrient: 'Vitamin E', amount: 15, unit: 'mg' },
  { nutrient: 'Vitamin K', amount: 120, unit: 'mcg' },
  { nutrient: 'Thiamin', amount: 1.2, unit: 'mg' },
  { nutrient: 'Riboflavin', amount: 1.3, unit: 'mg' },
  { nutrient: 'Niacin', amount: 16, unit: 'mg' },
  { nutrient: 'Vitamin B6', amount: 1.7, unit: 'mg' },
  { nutrient: 'Folate', amount: 400, unit: 'mcg' },
  { nutrient: 'Vitamin B12', amount: 2.4, unit: 'mcg' },
  { nutrient: 'Biotin', amount: 30, unit: 'mcg' },
  { nutrient: 'Pantothenic Acid', amount: 5, unit: 'mg' },

  // Minerals
  { nutrient: 'Calcium', amount: 1300, unit: 'mg' },
  { nutrient: 'Iron', amount: 18, unit: 'mg' },
  { nutrient: 'Phosphorus', amount: 1250, unit: 'mg' },
  { nutrient: 'Iodine', amount: 150, unit: 'mcg' },
  { nutrient: 'Magnesium', amount: 420, unit: 'mg' },
  { nutrient: 'Zinc', amount: 11, unit: 'mg' },
  { nutrient: 'Selenium', amount: 55, unit: 'mcg' },
  { nutrient: 'Copper', amount: 0.9, unit: 'mg' },
  { nutrient: 'Manganese', amount: 2.3, unit: 'mg' },
  { nutrient: 'Chromium', amount: 35, unit: 'mcg' },
  { nutrient: 'Molybdenum', amount: 45, unit: 'mcg' },
  { nutrient: 'Chloride', amount: 2300, unit: 'mg' },
  { nutrient: 'Potassium', amount: 4700, unit: 'mg' },
  { nutrient: 'Choline', amount: 550, unit: 'mg' },

  // Other
  { nutrient: 'Calories', amount: 2000, unit: 'kcal' },
];

/** Lookup map for quick access by lowercase nutrient name */
const dvMap = new Map<string, DailyValue>(
  FDA_DAILY_VALUES.map((dv) => [dv.nutrient.toLowerCase(), dv]),
);

/**
 * Look up the FDA Daily Value for a nutrient by name.
 * Case-insensitive match.
 */
export function getDailyValue(nutrient: string): DailyValue | undefined {
  return dvMap.get(nutrient.toLowerCase());
}

export interface NutrientWithDV {
  nutrient: string;
  amount: number;
  unit: string;
  dailyValuePercent: number | null; // null when no DV established
}

/**
 * Compute %DV for a list of nutrients returned by the AI.
 * Matches nutrient names case-insensitively against FDA reference.
 */
export function computeDailyValuePercents(
  nutrients: { nutrient: string; amount: number; unit: string }[],
): NutrientWithDV[] {
  return nutrients.map((n) => {
    const dv = getDailyValue(n.nutrient);
    let dailyValuePercent: number | null = null;
    if (dv && dv.amount > 0 && dv.unit === n.unit) {
      dailyValuePercent = Math.round((n.amount / dv.amount) * 100);
    }
    return {
      nutrient: n.nutrient,
      amount: n.amount,
      unit: n.unit,
      dailyValuePercent,
    };
  });
}
