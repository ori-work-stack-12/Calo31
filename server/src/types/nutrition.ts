import { z } from "zod";

export const mealAnalysisSchema = z.object({
  imageBase64: z.string().min(1, "Image is required"),
  language: z.enum(["english", "hebrew"]).default("english"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  updateText: z.string().optional(), // For meal updates
  editedIngredients: z.array(z.any()).default([]), // For user-edited ingredients
});

export const mealUpdateSchema = z.object({
  meal_id: z.string().min(1, "Meal ID is required"),
  updateText: z.string().min(1, "Update text is required"),
  language: z.enum(["english", "hebrew"]).default("english"),
});

export const mealSchema = z.object({
  meal_id: z.string(),
  user_id: z.string(),
  image_url: z.string(),
  meal_name: z.string().nullable(),
  calories: z.number().nullable(),
  protein_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fats_g: z.number().nullable(),
  fiber_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  analysis_status: z.enum(["PENDING", "COMPLETED"]),
  upload_time: z.date(),
  created_at: z.date(),
});

export type MealAnalysisInput = z.infer<typeof mealAnalysisSchema>;
export type MealUpdateInput = z.infer<typeof mealUpdateSchema>;
export type Meal = z.infer<typeof mealSchema>;

export const directMealUpdateSchema = z.object({
  meal_name: z.string().optional(),
  calories: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  protein_g: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  carbs_g: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  fats_g: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  fiber_g: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  sugar_g: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  sodium_mg: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  saturated_fats_g: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  polyunsaturated_fats_g: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  monounsaturated_fats_g: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  cholesterol_mg: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  serving_size_g: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? (typeof val === "string" ? parseFloat(val) : val) : undefined
    ),
  ingredients: z.any().optional(),
  food_category: z.string().optional(),
  cooking_method: z.string().optional(),
});

export type DirectMealUpdateInput = z.infer<typeof directMealUpdateSchema>;
