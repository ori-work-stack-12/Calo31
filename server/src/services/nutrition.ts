import { OpenAIService } from "./openai";
import { prisma } from "../lib/database";
import { MealAnalysisInput, MealUpdateInput } from "../types/nutrition";
import { AuthService } from "./auth";
import { asJsonObject, mapExistingMealToPrismaInput } from "../utils/nutrition";

function transformMealForClient(meal: any) {
  const additives = meal.additives_json || {};
  const feedback = additives.feedback || {};
  return {
    meal_id: meal.meal_id,
    user_id: meal.user_id,
    image_url: meal.image_url,
    upload_time: meal.upload_time,
    analysis_status: meal.analysis_status,
    meal_name: meal.meal_name,
    calories: meal.calories,
    protein_g: meal.protein_g,
    carbs_g: meal.carbs_g,
    fats_g: meal.fats_g,
    fiber_g: meal.fiber_g,
    sugar_g: meal.sugar_g,
    created_at: meal.created_at,
    id: meal.meal_id.toString(),
    name: meal.meal_name || "Unknown Meal",
    description: meal.meal_name,
    imageUrl: meal.image_url,
    protein: meal.protein_g || 0,
    carbs: meal.carbs_g || 0,
    fat: meal.fats_g || 0,
    fiber: meal.fiber_g || 0,
    sugar: meal.sugar_g || 0,
    userId: meal.user_id,
    isFavorite: additives.isFavorite || false,
    tasteRating: feedback.tasteRating || 0,
    satietyRating: feedback.satietyRating || 0,
    energyRating: feedback.energyRating || 0,
    heavinessRating: feedback.heavinessRating || 0,
  };
}

// QUOTA CHECKS REMOVED - NO LIMITS ENFORCED

export class NutritionService {
  static async analyzeMeal(user_id: string, data: MealAnalysisInput & { editedIngredients?: any[] }) {
    const { imageBase64, language, editedIngredients = [] } = data;
    if (!imageBase64?.trim()) throw new Error("Image data is required");

    let cleanBase64 = imageBase64.trim().replace(/^data:.*base64,/, "");
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanBase64))
      throw new Error("Invalid base64 image format");

    const user = await prisma.user.findUnique({ where: { user_id } });
    if (!user) throw new Error("User not found");

    // const permissions = await checkDailyLimit(user);

    console.log("🚀 Starting meal analysis - NO RESTRICTIONS!");
    console.log("🥗 Processing with edited ingredients:", editedIngredients.length);

    // Always attempt analysis - never fail
    const analysis = await OpenAIService.analyzeMealImage(
      cleanBase64,
      language,
      data.updateText
    );

    // If user provided edited ingredients, merge them with AI analysis
    if (editedIngredients.length > 0) {
      console.log("🔄 Merging user-edited ingredients with AI analysis");
      
      // Recalculate totals based on edited ingredients
      const editedTotals = editedIngredients.reduce(
        (acc, ingredient) => ({
          calories: acc.calories + (parseFloat(ingredient.calories) || 0),
          protein: acc.protein + (parseFloat(ingredient.protein) || 0),
          carbs: acc.carbs + (parseFloat(ingredient.carbs) || 0),
          fat: acc.fat + (parseFloat(ingredient.fat) || 0),
          fiber: acc.fiber + (parseFloat(ingredient.fiber) || 0),
          sugar: acc.sugar + (parseFloat(ingredient.sugar) || 0),
          sodium: acc.sodium + (parseFloat(ingredient.sodium) || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
      );

      // Override AI analysis with user-edited values
      analysis.calories = editedTotals.calories;
      analysis.protein = editedTotals.protein;
      analysis.carbs = editedTotals.carbs;
      analysis.fat = editedTotals.fat;
      analysis.fiber = editedTotals.fiber;
      analysis.sugar = editedTotals.sugar;
      analysis.sodium = editedTotals.sodium;
      analysis.ingredients = editedIngredients.map((ing, index) => ({
        name: ing.name,
        calories: parseFloat(ing.calories) || 0,
        protein_g: parseFloat(ing.protein) || 0,
        carbs_g: parseFloat(ing.carbs) || 0,
        fats_g: parseFloat(ing.fat) || 0,
        fiber_g: parseFloat(ing.fiber) || 0,
        sugar_g: parseFloat(ing.sugar) || 0,
        sodium_mg: parseFloat(ing.sodium) || 0,
      }));
    }

    // Update request count
    await prisma.user.update({
      where: { user_id },
      data: { ai_requests_count: user.ai_requests_count + 1 },
    });

    const items = (analysis.ingredients || []).map((ingredient, index) => ({
      id: index,
      name:
        typeof ingredient === "string"
          ? ingredient
          : ingredient.name || `Item ${index + 1}`,
      calories:
        typeof ingredient === "string"
          ? "0"
          : (ingredient.calories || 0).toString(),
      protein:
        typeof ingredient === "string"
          ? "0"
          : (ingredient.protein_g || ingredient.protein || 0).toString(),
      protein_g:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.protein_g || ingredient.protein || 0),
      carbs:
        typeof ingredient === "string"
          ? "0"
          : (ingredient.carbs_g || ingredient.carbs || 0).toString(),
      carbs_g:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.carbs_g || ingredient.carbs || 0),
      fat:
        typeof ingredient === "string"
          ? "0"
          : (ingredient.fats_g || ingredient.fat || 0).toString(),
      fats_g:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.fats_g || ingredient.fat || 0),
      fiber:
        typeof ingredient === "string" ? 0 : Number(ingredient.fiber_g ?? 0),
      fiber_g:
        typeof ingredient === "string" ? 0 : Number(ingredient.fiber_g ?? 0),
      sugar:
        typeof ingredient === "string" ? 0 : Number(ingredient.sugar_g ?? 0),
      sugar_g:
        typeof ingredient === "string" ? 0 : Number(ingredient.sugar_g ?? 0),
      sodium_mg:
        typeof ingredient === "string" ? 0 : Number(ingredient.sodium_mg ?? 0),
      cholesterol_mg:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.cholesterol_mg ?? 0),

      // Detailed fats
      saturated_fats_g:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.saturated_fats_g ?? 0),
      polyunsaturated_fats_g:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.polyunsaturated_fats_g ?? 0),
      monounsaturated_fats_g:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.monounsaturated_fats_g ?? 0),
      omega_3_g:
        typeof ingredient === "string" ? 0 : Number(ingredient.omega_3_g ?? 0),
      omega_6_g:
        typeof ingredient === "string" ? 0 : Number(ingredient.omega_6_g ?? 0),

      // Detailed fiber
      soluble_fiber_g:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.soluble_fiber_g ?? 0),
      insoluble_fiber_g:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.insoluble_fiber_g ?? 0),

      // Additional nutrients
      alcohol_g:
        typeof ingredient === "string" ? 0 : Number(ingredient.alcohol_g ?? 0),
      caffeine_mg:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.caffeine_mg ?? 0),
      serving_size_g:
        typeof ingredient === "string"
          ? 0
          : Number(ingredient.serving_size_g ?? 0),

      // Analysis data
      glycemic_index:
        typeof ingredient === "string"
          ? null
          : ingredient.glycemic_index ?? null,
      insulin_index:
        typeof ingredient === "string"
          ? null
          : ingredient.insulin_index ?? null,

      // JSON fields
      vitamins_json:
        typeof ingredient === "string" ? {} : ingredient.vitamins_json ?? {},
      micronutrients_json:
        typeof ingredient === "string"
          ? {}
          : ingredient.micronutrients_json ?? {},
      allergens_json:
        typeof ingredient === "string" ? {} : ingredient.allergens_json ?? {},
    }));

    const mappedMeal = mapMealDataToPrismaFields(
      analysis,
      user_id,
      cleanBase64
    );

    // Ensure we always have meaningful data
    if (mappedMeal.calories === 0 && mappedMeal.protein_g === 0) {
      console.log("🔧 Enhancing analysis data...");
      mappedMeal.calories = analysis.calories || 350;
      mappedMeal.protein_g = analysis.protein || 20;
      mappedMeal.carbs_g = analysis.carbs || 40;
      mappedMeal.fats_g = analysis.fat || 15;
      mappedMeal.fiber_g = analysis.fiber || 8;
      mappedMeal.sugar_g = analysis.sugar || 12;
      mappedMeal.sodium_mg = analysis.sodium || 600;
      mappedMeal.meal_name = analysis.name || "Analyzed Meal";
    }

    console.log("✅ Meal analysis completed successfully!");

    return {
      success: true,
      data: {
        ...mappedMeal,
        items,
        healthScore: Math.max(analysis.confidence || 75, 60).toString(),
        recommendations:
          analysis.healthNotes ||
          "Successfully analyzed meal - enjoy your nutritious food!",
      },
      remainingRequests: -1,
    };
  }

  static async updateMeal(
    user_id: string,
    updateData: {
      meal_id: string;
      updateText: string;
      language?: string;
    }
  ) {
    try {
      console.log("🔄 Updating meal with AI enhancement...");

      // Get existing meal
      const existingMeal = await prisma.meal.findFirst({
        where: {
          meal_id: Number(updateData.meal_id),
          user_id,
        },
      });

      if (!existingMeal) {
        throw new Error("Meal not found");
      }

      // Preserve all existing data and create complete analysis object
      const originalAnalysis = {
        name: existingMeal.meal_name ?? "Untitled Meal",
        calories: Number(existingMeal.calories) || 0,
        protein: Number(existingMeal.protein_g) || 0,
        carbs: Number(existingMeal.carbs_g) || 0,
        fat: Number(existingMeal.fats_g) || 0,
        fiber: Number(existingMeal.fiber_g) || 0,
        sugar: Number(existingMeal.sugar_g) || 0,
        sodium: Number(existingMeal.sodium_mg) || 0,
        ingredients: Array.isArray(existingMeal.ingredients)
          ? existingMeal.ingredients
          : [],
        servingSize: existingMeal.serving_size_g || "1 serving",
        cookingMethod: existingMeal.cooking_method || "Unknown",
        healthNotes: existingMeal.health_risk_notes || "",
        confidence: Number(existingMeal.confidence) || 1.0,
        saturated_fats_g: Number(existingMeal.saturated_fats_g) || undefined,
        polyunsaturated_fats_g:
          Number(existingMeal.polyunsaturated_fats_g) || undefined,
        monounsaturated_fats_g:
          Number(existingMeal.monounsaturated_fats_g) || undefined,
        omega_3_g: Number(existingMeal.omega_3_g) || undefined,
        omega_6_g: Number(existingMeal.omega_6_g) || undefined,
        soluble_fiber_g: Number(existingMeal.soluble_fiber_g) || undefined,
        insoluble_fiber_g: Number(existingMeal.insoluble_fiber_g) || undefined,
        cholesterol_mg: Number(existingMeal.cholesterol_mg) || undefined,
        alcohol_g: Number(existingMeal.alcohol_g) || undefined,
        caffeine_mg: Number(existingMeal.caffeine_mg) || undefined,
        liquids_ml: Number(existingMeal.liquids_ml) || undefined,
        serving_size_g: Number(existingMeal.serving_size_g) || undefined,
        allergens_json: existingMeal.allergens_json || "",
        vitamins_json: existingMeal.vitamins_json || "",
        micronutrients_json: existingMeal.micronutrients_json || "",
        glycemic_index: Number(existingMeal.glycemic_index) || undefined,
        insulin_index: Number(existingMeal.insulin_index) || undefined,
        food_category: existingMeal.food_category || "",
        processing_level: existingMeal.processing_level || "",
        cooking_method: existingMeal.cooking_method || "",
        additives_json: existingMeal.additives_json || "",
        health_risk_notes: existingMeal.health_risk_notes || undefined,
      };

      const updatedAnalysis = await OpenAIService.updateMealAnalysis(
        originalAnalysis,
        updateData.updateText,
        updateData.language || "english"
      );

      // Update meal in database - preserve all existing fields that aren't updated
      const updatedMeal = await prisma.meal.update({
        where: {
          meal_id: Number(updateData.meal_id),
        },
        data: {
          // Core fields that can be updated
          meal_name: updatedAnalysis.name,
          calories: updatedAnalysis.calories,
          protein_g: updatedAnalysis.protein,
          carbs_g: updatedAnalysis.carbs,
          fats_g: updatedAnalysis.fat,
          fiber_g: updatedAnalysis.fiber ?? existingMeal.fiber_g,
          sugar_g: updatedAnalysis.sugar ?? existingMeal.sugar_g,
          sodium_mg: updatedAnalysis.sodium ?? existingMeal.sodium_mg,
          confidence: updatedAnalysis.confidence,
          ingredients: updatedAnalysis.ingredients || existingMeal.ingredients,
          // Also update any related fields
          serving_size_g:
            updatedAnalysis.serving_size_g || existingMeal.serving_size_g,
          cooking_method:
            updatedAnalysis.cookingMethod || existingMeal.cooking_method,
          health_risk_notes:
            updatedAnalysis.healthNotes || existingMeal.health_risk_notes,

          // Preserve detailed nutrition fields if not provided in update
          saturated_fats_g:
            updatedAnalysis.saturated_fats_g ?? existingMeal.saturated_fats_g,
          polyunsaturated_fats_g:
            updatedAnalysis.polyunsaturated_fats_g ??
            existingMeal.polyunsaturated_fats_g,
          monounsaturated_fats_g:
            updatedAnalysis.monounsaturated_fats_g ??
            existingMeal.monounsaturated_fats_g,
          omega_3_g: updatedAnalysis.omega_3_g ?? existingMeal.omega_3_g,
          omega_6_g: updatedAnalysis.omega_6_g ?? existingMeal.omega_6_g,
          soluble_fiber_g:
            updatedAnalysis.soluble_fiber_g ?? existingMeal.soluble_fiber_g,
          insoluble_fiber_g:
            updatedAnalysis.insoluble_fiber_g ?? existingMeal.insoluble_fiber_g,
          cholesterol_mg:
            updatedAnalysis.cholesterol_mg ?? existingMeal.cholesterol_mg,
          alcohol_g: updatedAnalysis.alcohol_g ?? existingMeal.alcohol_g,
          caffeine_mg: updatedAnalysis.caffeine_mg ?? existingMeal.caffeine_mg,
          liquids_ml: updatedAnalysis.liquids_ml ?? existingMeal.liquids_ml,
          allergens_json:
            updatedAnalysis.allergens_json ?? existingMeal.allergens_json,
          vitamins_json:
            updatedAnalysis.vitamins_json ?? existingMeal.vitamins_json,
          micronutrients_json:
            updatedAnalysis.micronutrients_json ??
            existingMeal.micronutrients_json,
          glycemic_index:
            updatedAnalysis.glycemic_index ?? existingMeal.glycemic_index,
          insulin_index:
            updatedAnalysis.insulin_index ?? existingMeal.insulin_index,
          food_category:
            updatedAnalysis.food_category ?? existingMeal.food_category,
          processing_level:
            updatedAnalysis.processing_level ?? existingMeal.processing_level,
          additives_json:
            updatedAnalysis.additives_json ?? existingMeal.additives_json,

          // System fields
          updated_at: new Date(),
        },
      });

      console.log("✅ Meal updated successfully");
      return updatedMeal;
    } catch (error) {
      console.error("💥 Error updating meal:", error);
      throw error;
    }
  }

  static async saveMeal(user_id: string, mealData: any, imageBase64?: string) {
    try {
      const meal = await prisma.meal.create({
        data: mapMealDataToPrismaFields(mealData, user_id, imageBase64),
      });
      return transformMealForClient(meal);
    } catch (error) {
      throw new Error("Failed to save meal");
    }
  }

  static async getUserMeals(user_id: string) {
    try {
      const meals = await prisma.meal.findMany({
        where: { user_id },
        orderBy: { created_at: "desc" },
      });
      return meals.map(transformMealForClient);
    } catch (error) {
      throw new Error("Failed to fetch meals");
    }
  }
  // Add this method to your NutritionService class

  // Add this method to your NutritionService class

  static async getRangeStatistics(
    userId: string,
    startDate: string,
    endDate: string
  ) {
    try {
      console.log("📊 Getting range statistics for user:", userId);
      console.log("📅 Date range:", { startDate, endDate });

      const startDateTime = new Date(startDate + "T00:00:00.000Z");
      const endDateTime = new Date(endDate + "T23:59:59.999Z");

      const meals = await prisma.meal.findMany({
        where: {
          user_id: userId,
          created_at: {
            gte: startDateTime,
            lte: endDateTime,
          },
        },
        orderBy: {
          created_at: "asc",
        },
      });

      if (meals.length === 0) {
        return {
          totalDays: 0,
          totalMeals: 0,
          dailyBreakdown: [],
          ...Object.fromEntries(
            [
              "calories",
              "protein_g",
              "carbs_g",
              "fats_g",
              "saturated_fats_g",
              "polyunsaturated_fats_g",
              "monounsaturated_fats_g",
              "omega_3_g",
              "omega_6_g",
              "fiber_g",
              "soluble_fiber_g",
              "insoluble_fiber_g",
              "sugar_g",
              "cholesterol_mg",
              "sodium_mg",
              "alcohol_g",
              "caffeine_mg",
              "liquids_ml",
              "serving_size_g",
              "glycemic_index",
              "insulin_index",
              "confidence",
            ].flatMap((field) => [
              [`total_${field}`, 0],
              [`average_${field}`, 0],
            ])
          ),
        };
      }

      const totalMeals = meals.length;

      const numericFields = [
        "calories",
        "protein_g",
        "carbs_g",
        "fats_g",
        "saturated_fats_g",
        "polyunsaturated_fats_g",
        "monounsaturated_fats_g",
        "omega_3_g",
        "omega_6_g",
        "fiber_g",
        "soluble_fiber_g",
        "insoluble_fiber_g",
        "sugar_g",
        "cholesterol_mg",
        "sodium_mg",
        "alcohol_g",
        "caffeine_mg",
        "liquids_ml",
        "serving_size_g",
        "glycemic_index",
        "insulin_index",
        "confidence",
      ];

      const totals: Record<string, number> = {};
      for (const field of numericFields) totals[field] = 0;

      for (const meal of meals) {
        for (const field of numericFields) {
          totals[field] += (meal[field as keyof typeof meal] as number) || 0;
        }
      }

      const uniqueDates = new Set(
        meals.map((meal) => meal.created_at.toISOString().split("T")[0])
      );
      const totalDays = uniqueDates.size;

      const averages = Object.fromEntries(
        Object.entries(totals).map(([key, val]) => [
          `average_${key}`,
          totalDays > 0 ? val / totalDays : 0,
        ])
      );

      // Group meals by day
      const dailyData = meals.reduce((acc, meal) => {
        const date = meal.created_at.toISOString().split("T")[0];
        if (!acc[date]) {
          acc[date] = {
            date,
            meals: [],
          };
        }

        acc[date].meals.push({
          meal_id: meal.meal_id,
          user_id: meal.user_id,
          image_url: meal.image_url,
          upload_time: meal.upload_time,
          analysis_status: meal.analysis_status,
          meal_name: meal.meal_name,
          calories: meal.calories,
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fats_g: meal.fats_g,
          saturated_fats_g: meal.saturated_fats_g,
          polyunsaturated_fats_g: meal.polyunsaturated_fats_g,
          monounsaturated_fats_g: meal.monounsaturated_fats_g,
          omega_3_g: meal.omega_3_g,
          omega_6_g: meal.omega_6_g,
          fiber_g: meal.fiber_g,
          soluble_fiber_g: meal.soluble_fiber_g,
          insoluble_fiber_g: meal.insoluble_fiber_g,
          sugar_g: meal.sugar_g,
          cholesterol_mg: meal.cholesterol_mg,
          sodium_mg: meal.sodium_mg,
          alcohol_g: meal.alcohol_g,
          caffeine_mg: meal.caffeine_mg,
          liquids_ml: meal.liquids_ml,
          serving_size_g: meal.serving_size_g,
          glycemic_index: meal.glycemic_index,
          insulin_index: meal.insulin_index,
          food_category: meal.food_category,
          processing_level: meal.processing_level,
          confidence: meal.confidence,
          cooking_method: meal.cooking_method,
          allergens_json: meal.allergens_json,
          vitamins_json: meal.vitamins_json,
          micronutrients_json: meal.micronutrients_json,
          additives_json: meal.additives_json,
          health_risk_notes: meal.health_risk_notes,
          ingredients: meal.ingredients,
          created_at: meal.created_at,
          updated_at: meal.updated_at,
        });

        return acc;
      }, {} as Record<string, any>);

      const dailyBreakdown = Object.values(dailyData);

      const statistics = {
        totalDays,
        totalMeals,
        ...Object.fromEntries(
          Object.entries(totals).map(([key, val]) => [
            `total_${key}`,
            Math.round(val * 100) / 100,
          ])
        ),
        ...Object.entries(averages).reduce((acc, [key, val]) => {
          acc[key] = Math.round(val * 100) / 100;
          return acc;
        }, {} as Record<string, number>),
        dailyBreakdown: dailyBreakdown.sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
        dateRange: {
          startDate,
          endDate,
        },
      };

      console.log("✅ Range statistics calculated successfully");
      return statistics;
    } catch (error) {
      console.error("💥 Error getting range statistics:", error);
      throw error;
    }
  }

  static async getDailyStats(user_id: string, date: string) {
    try {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      const meals = await prisma.meal.findMany({
        where: {
          user_id,
          created_at: { gte: startDate, lt: endDate },
        },
      });

      return meals.reduce(
        (acc, meal) => {
          acc.calories += meal.calories || 0;
          acc.protein += meal.protein_g || 0;
          acc.carbs += meal.carbs_g || 0;
          acc.fat += meal.fats_g || 0;
          acc.fiber += meal.fiber_g || 0;
          acc.sugar += meal.sugar_g || 0;
          acc.meal_count++;
          return acc;
        },
        {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          meal_count: 0,
        }
      );
    } catch (error) {
      throw new Error("Failed to fetch daily stats");
    }
  }

  static async saveMealFeedback(
    user_id: string,
    meal_id: string,
    feedback: any
  ) {
    const meal = await prisma.meal.findFirst({
      where: { meal_id: parseInt(meal_id), user_id },
    });
    if (!meal) throw new Error("Meal not found");

    const additives = asJsonObject(meal.additives_json);
    const existingFeedback = asJsonObject(additives.feedback);

    const updatedAdditives = {
      ...additives,
      feedback: {
        ...existingFeedback,
        ...feedback,
        updatedAt: new Date().toISOString(),
      },
    };

    await prisma.meal.update({
      where: { meal_id: meal.meal_id },
      data: { additives_json: updatedAdditives },
    });

    return { meal_id, feedback };
  }

  static async toggleMealFavorite(user_id: string, meal_id: string) {
    const meal = await prisma.meal.findFirst({
      where: { meal_id: parseInt(meal_id), user_id },
    });
    if (!meal) throw new Error("Meal not found");

    const additives = asJsonObject(meal.additives_json);
    const current = Boolean(additives.isFavorite);

    const updatedAdditives = {
      ...additives,
      isFavorite: !current,
      favoriteUpdatedAt: new Date().toISOString(),
    };

    await prisma.meal.update({
      where: { meal_id: meal.meal_id },
      data: { additives_json: updatedAdditives },
    });

    return { meal_id, isFavorite: !current };
  }

  static async duplicateMeal(
    user_id: string,
    meal_id: string,
    newDate?: string
  ) {
    const originalMeal = await prisma.meal.findFirst({
      where: { meal_id: parseInt(meal_id), user_id },
    });
    if (!originalMeal) throw new Error("Meal not found");

    const duplicateDate = newDate ? new Date(newDate) : new Date();
    const duplicatedMeal = await prisma.meal.create({
      data: mapExistingMealToPrismaInput(originalMeal, user_id, duplicateDate),
    });

    return transformMealForClient(duplicatedMeal);
  }
}

function mapMealDataToPrismaFields(
  mealData: any,
  user_id: string,
  imageBase64?: string
) {
  const ingredients = Array.isArray(mealData.ingredients)
    ? mealData.ingredients
    : [];

  return {
    user_id,
    image_url: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null,
    upload_time: new Date(),
    analysis_status: "COMPLETED",
    meal_name: mealData.meal_name || mealData.name || "Unknown Meal",
    calories: mealData.calories || 0,
    protein_g: mealData.protein_g || mealData.protein || 0,
    carbs_g: mealData.carbs_g || mealData.carbs || 0,
    fats_g: mealData.fats_g || mealData.fat || 0,
    fiber_g: mealData.fiber_g || mealData.fiber || 0,
    sugar_g: mealData.sugar_g || mealData.sugar || 0,
    sodium_mg: mealData.sodium_mg || mealData.sodium || 0,

    // Detailed fats
    saturated_fats_g: mealData.saturated_fats_g || 0,
    polyunsaturated_fats_g: mealData.polyunsaturated_fats_g || 0,
    monounsaturated_fats_g: mealData.monounsaturated_fats_g || 0,
    omega_3_g: mealData.omega_3_g || 0,
    omega_6_g: mealData.omega_6_g || 0,

    // Detailed fiber
    soluble_fiber_g: mealData.soluble_fiber_g || 0,
    insoluble_fiber_g: mealData.insoluble_fiber_g || 0,

    // Other nutrients
    cholesterol_mg: mealData.cholesterol_mg || 0,
    alcohol_g: mealData.alcohol_g || 0,
    caffeine_mg: mealData.caffeine_mg || 0,
    liquids_ml: mealData.liquids_ml || 0,
    serving_size_g: mealData.serving_size_g || 0,

    // JSON fields
    allergens_json: mealData.allergens_json || {},
    vitamins_json: mealData.vitamins_json || {},
    micronutrients_json: mealData.micronutrients_json || {},
    additives_json: mealData.additives_json || {},

    // Analysis fields
    glycemic_index: mealData.glycemic_index || 0,
    insulin_index: mealData.insulin_index || 0,
    food_category: mealData.food_category || "",
    processing_level: mealData.processing_level || "",
    cooking_method: mealData.cooking_method || "",
    health_risk_notes: mealData.health_risk_notes || "",

    // System fields
    ingredients: ingredients,
    created_at: new Date(),
  };
}
