export type ParsedComponent = {
  canonical_name: string;
  display_label: string;
  weight_g_mean: number | null;
  weight_g_min: number | null;
  weight_g_max: number | null;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  confidence_reasons: string[] | null;
  barcode: string | null;
  user_kcal_per_100g: number | null;
  user_protein_per_100g: number | null;
  user_fat_per_100g: number | null;
  user_carbs_per_100g: number | null;
};

export type ParseResult = {
  items: ParsedComponent[];
  overall_confidence: number;
  notes: string | null;
};

export type EstimateResult = {
  kcal: number;
  kcal_min: number;
  kcal_max: number;
  protein: number;
  protein_min: number;
  protein_max: number;
  fat: number;
  fat_min: number;
  fat_max: number;
  carbs: number;
  carbs_min: number;
  carbs_max: number;
  uncertainty_band: number;
};

export type DraftReplyResult = {
  reply: string | null;
};

export type MealTitleResult = {
  title: string | null;
};

export type FoodReferenceItem = {
  name: string;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
  confidence: "LOW" | "MEDIUM" | "HIGH" | null;
  notes: string | null;
};

export type FoodReferenceResult = {
  items: FoodReferenceItem[];
};

/** Результат диалогового разбора черновика: ответ пользователю + текущий разбор продуктов */
export type DraftChatResult = {
  reply: string | null;
  items: ParsedComponent[];
  overall_confidence: number;
  notes: string | null;
};
