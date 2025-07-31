import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/src/store";
import {
  fetchMeals,
  saveMealFeedback,
  toggleMealFavorite,
  duplicateMeal,
} from "@/src/store/mealSlice";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import {
  Search,
  Filter,
  Heart,
  Star,
  Copy,
  Calendar,
  Clock,
  Flame,
  Zap,
  Droplets,
  Target,
  TrendingUp,
  Award,
  ChevronDown,
  X,
} from "lucide-react-native";
import LoadingScreen from "@/components/LoadingScreen";

const { width } = Dimensions.get("window");

interface Meal {
  id: string;
  meal_id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  created_at: string;
  image_url?: string;
  is_favorite?: boolean;
  taste_rating?: number;
  satiety_rating?: number;
  energy_rating?: number;
  heaviness_rating?: number;
  food_category?: string;
  health_score?: number;
}

interface FilterOptions {
  category: string;
  dateRange: string;
  minCalories: number;
  maxCalories: number;
  showFavoritesOnly: boolean;
}

const CATEGORIES = [
  { key: "all", label: "All Categories", color: "#10b981" },
  { key: "high_protein", label: "High Protein", color: "#8b5cf6" },
  { key: "high_carb", label: "High Carb", color: "#f59e0b" },
  { key: "high_fat", label: "High Fat", color: "#ef4444" },
  { key: "balanced", label: "Balanced", color: "#06b6d4" },
  { key: "low_calorie", label: "Low Calorie", color: "#84cc16" },
];

const DATE_RANGES = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();
  const { meals, isLoading } = useSelector((state: RootState) => state.meal);

  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    category: "all",
    dateRange: "all",
    minCalories: 0,
    maxCalories: 2000,
    showFavoritesOnly: false,
  });

  const [ratings, setRatings] = useState({
    taste: 0,
    satiety: 0,
    energy: 0,
    heaviness: 0,
  });

  useEffect(() => {
    dispatch(fetchMeals());
  }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchMeals());
    setRefreshing(false);
  }, [dispatch]);

  // Filter and search meals
  const filteredMeals = useMemo(() => {
    if (!meals) return [];

    return meals.filter((meal: any) => {
      // Search filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          meal.name?.toLowerCase().includes(query) ||
          meal.meal_name?.toLowerCase().includes(query) ||
          meal.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (filters.category !== "all") {
        const calories = meal.calories || 0;
        const protein = meal.protein || meal.protein_g || 0;
        const carbs = meal.carbs || meal.carbs_g || 0;
        const fat = meal.fat || meal.fats_g || 0;
        const total = protein + carbs + fat;

        switch (filters.category) {
          case "high_protein":
            if (total === 0 || protein / total < 0.3) return false;
            break;
          case "high_carb":
            if (total === 0 || carbs / total < 0.5) return false;
            break;
          case "high_fat":
            if (total === 0 || fat / total < 0.35) return false;
            break;
          case "balanced":
            if (total === 0) return false;
            const proteinRatio = protein / total;
            const carbRatio = carbs / total;
            const fatRatio = fat / total;
            if (
              proteinRatio < 0.2 ||
              proteinRatio > 0.4 ||
              carbRatio < 0.3 ||
              carbRatio > 0.6 ||
              fatRatio < 0.15 ||
              fatRatio > 0.4
            )
              return false;
            break;
          case "low_calorie":
            if (calories > 300) return false;
            break;
        }
      }

      // Calorie range filter
      const calories = meal.calories || 0;
      if (calories < filters.minCalories || calories > filters.maxCalories) {
        return false;
      }

      // Favorites filter
      if (filters.showFavoritesOnly && !meal.is_favorite) {
        return false;
      }

      // Date range filter
      if (filters.dateRange !== "all") {
        const mealDate = new Date(meal.created_at || meal.upload_time);
        const now = new Date();

        switch (filters.dateRange) {
          case "today":
            if (mealDate.toDateString() !== now.toDateString()) return false;
            break;
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (mealDate < weekAgo) return false;
            break;
          case "month":
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (mealDate < monthAgo) return false;
            break;
        }
      }

      return true;
    });
  }, [meals, searchQuery, filters]);

  // Calculate insights
  const insights = useMemo(() => {
    if (!filteredMeals.length) return null;

    const totalCalories = filteredMeals.reduce(
      (sum, meal) => sum + (meal.calories || 0),
      0
    );
    const avgCalories = Math.round(totalCalories / filteredMeals.length);

    const highestCalorieMeal = filteredMeals.reduce((highest, meal) =>
      (meal.calories || 0) > (highest.calories || 0) ? meal : highest
    );

    const favoriteMeals = filteredMeals.filter((meal) => meal.is_favorite);
    const ratedMeals = filteredMeals.filter(
      (meal) => meal.taste_rating && meal.taste_rating > 0
    );
    const avgRating =
      ratedMeals.length > 0
        ? ratedMeals.reduce((sum, meal) => sum + (meal.taste_rating || 0), 0) /
          ratedMeals.length
        : 0;

    return {
      totalMeals: filteredMeals.length,
      avgCalories,
      highestCalorieMeal,
      favoriteMeals: favoriteMeals.length,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  }, [filteredMeals]);

  const handleRateMeal = (meal: any) => {
    setSelectedMeal(meal);
    setRatings({
      taste: meal.taste_rating || 0,
      satiety: meal.satiety_rating || 0,
      energy: meal.energy_rating || 0,
      heaviness: meal.heaviness_rating || 0,
    });
    setShowRatingModal(true);
  };

  const submitRating = async () => {
    if (!selectedMeal) return;

    try {
      await dispatch(
        saveMealFeedback({
          mealId: selectedMeal.id,
          feedback: {
            tasteRating: ratings.taste,
            satietyRating: ratings.satiety,
            energyRating: ratings.energy,
            heavinessRating: ratings.heaviness,
          },
        })
      );

      Alert.alert("Success", "Rating saved successfully!");
      setShowRatingModal(false);
      dispatch(fetchMeals()); // Refresh meals
    } catch (error) {
      Alert.alert("Error", "Failed to save rating");
    }
  };

  const handleToggleFavorite = async (meal: any) => {
    try {
      await dispatch(toggleMealFavorite(meal.id));
      dispatch(fetchMeals()); // Refresh meals
    } catch (error) {
      Alert.alert("Error", "Failed to update favorite status");
    }
  };

  const handleDuplicateMeal = async (meal: any) => {
    Alert.alert("Duplicate Meal", "Add this meal to today's log?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Duplicate",
        onPress: async () => {
          try {
            await dispatch(
              duplicateMeal({
                mealId: meal.id,
                newDate: new Date().toISOString().split("T")[0],
              })
            );
            Alert.alert("Success", "Meal duplicated successfully!");
            dispatch(fetchMeals());
          } catch (error) {
            Alert.alert("Error", "Failed to duplicate meal");
          }
        },
      },
    ]);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getCategoryColor = (meal: any) => {
    const calories = meal.calories || 0;
    const protein = meal.protein || meal.protein_g || 0;
    const carbs = meal.carbs || meal.carbs_g || 0;
    const fat = meal.fat || meal.fats_g || 0;
    const total = protein + carbs + fat;

    if (total === 0) return "#6b7280";

    const proteinRatio = protein / total;
    const carbRatio = carbs / total;
    const fatRatio = fat / total;

    if (proteinRatio > 0.3) return "#8b5cf6"; // High protein
    if (carbRatio > 0.5) return "#f59e0b"; // High carb
    if (fatRatio > 0.35) return "#ef4444"; // High fat
    if (calories < 300) return "#84cc16"; // Low calorie
    return "#10b981"; // Balanced
  };

  const renderStarRating = (
    rating: number,
    onPress: (rating: number) => void
  ) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onPress(star)}
            style={styles.starButton}
          >
            <Star
              size={24}
              color={star <= rating ? "#fbbf24" : "#d1d5db"}
              fill={star <= rating ? "#fbbf24" : "transparent"}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderMealCard = ({ item: meal }: { item: any }) => {
    const categoryColor = getCategoryColor(meal);

    return (
      <View style={[styles.mealCard, { borderLeftColor: categoryColor }]}>
        <View style={[styles.mealCard, { borderLeftColor: categoryColor }]}>
          <LinearGradient
            colors={["#ffffff", "#f8fafc"]}
            style={styles.mealCardGradient}
          >
            {/* Meal Header */}
            <View style={styles.mealHeader}>
              <View style={styles.mealImageContainer}>
                {meal.image_url ? (
                  <Image
                    source={{ uri: meal.image_url }}
                    style={styles.mealImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.mealImagePlaceholder,
                      { backgroundColor: categoryColor + "20" },
                    ]}
                  >
                    <Target size={24} color={categoryColor} />
                  </View>
                )}
                {meal.is_favorite && (
                  <View style={styles.favoriteIcon}>
                    <Heart size={12} color="#ef4444" fill="#ef4444" />
                  </View>
                )}
              </View>

              <View style={styles.mealInfo}>
                <Text style={styles.mealName} numberOfLines={2}>
                  {meal.name || meal.meal_name || "Unknown Meal"}
                </Text>
                <View style={styles.mealMeta}>
                  <View style={styles.metaItem}>
                    <Clock size={12} color="#6b7280" />
                    <Text style={styles.metaText}>
                      {formatTime(meal.created_at || meal.upload_time)}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Calendar size={12} color="#6b7280" />
                    <Text style={styles.metaText}>
                      {formatDate(meal.created_at || meal.upload_time)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.mealActions}>
                <TouchableOpacity
                  style={styles.actionIcon}
                  onPress={() => handleToggleFavorite(meal)}
                >
                  <Heart
                    size={20}
                    color={meal.is_favorite ? "#ef4444" : "#d1d5db"}
                    fill={meal.is_favorite ? "#ef4444" : "transparent"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Nutrition Summary */}
            <View style={styles.nutritionSummary}>
              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionCard}>
                  <Flame size={16} color="#ef4444" />
                  <Text style={styles.nutritionValue}>
                    {Math.round(meal.calories || 0)}
                  </Text>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                </View>
                <View style={styles.nutritionCard}>
                  <Zap size={16} color="#8b5cf6" />
                  <Text style={styles.nutritionValue}>
                    {Math.round(meal.protein || meal.protein_g || 0)}g
                  </Text>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                </View>
                <View style={styles.nutritionCard}>
                  <Target size={16} color="#f59e0b" />
                  <Text style={styles.nutritionValue}>
                    {Math.round(meal.carbs || meal.carbs_g || 0)}g
                  </Text>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                </View>
                <View style={styles.nutritionCard}>
                  <Droplets size={16} color="#06b6d4" />
                  <Text style={styles.nutritionValue}>
                    {Math.round(meal.fat || meal.fats_g || 0)}g
                  </Text>
                  <Text style={styles.nutritionLabel}>Fat</Text>
                </View>
              </View>
            </View>

            {/* Ratings Display */}
            {(meal.taste_rating || meal.satiety_rating || meal.energy_rating) && (
              <View style={styles.ratingsDisplay}>
                <Text style={styles.ratingsTitle}>Your Ratings</Text>
                <View style={styles.ratingsGrid}>
                  {meal.taste_rating > 0 && (
                    <View style={styles.ratingItem}>
                      <Text style={styles.ratingLabel}>Taste</Text>
                      <View style={styles.ratingStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={12}
                            color={
                              star <= meal.taste_rating ? "#fbbf24" : "#d1d5db"
                            }
                            fill={
                              star <= meal.taste_rating
                                ? "#fbbf24"
                                : "transparent"
                            }
                          />
                        ))}
                      </View>
                    </View>
                  )}
                  {meal.satiety_rating > 0 && (
                    <View style={styles.ratingItem}>
                      <Text style={styles.ratingLabel}>Satiety</Text>
                      <View style={styles.ratingStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={12}
                            color={
                              star <= meal.satiety_rating ? "#fbbf24" : "#d1d5db"
                            }
                            fill={
                              star <= meal.satiety_rating
                                ? "#fbbf24"
                                : "transparent"
                            }
                          />
                        ))}
                      </View>
                    </View>
                  )}
                  {meal.energy_rating > 0 && (
                    <View style={styles.ratingItem}>
                      <Text style={styles.ratingLabel}>Energy</Text>
                      <View style={styles.ratingStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={12}
                            color={
                              star <= meal.energy_rating ? "#fbbf24" : "#d1d5db"
                            }
                            fill={
                              star <= meal.energy_rating
                                ? "#fbbf24"
                                : "transparent"
                            }
                          />
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.mealCardActions}>
              <TouchableOpacity
                style={[styles.cardActionButton, styles.rateButton]}
                onPress={() => handleRateMeal(meal)}
              >
                <Star size={16} color="#fbbf24" />
                <Text style={styles.cardActionText}>Rate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cardActionButton, styles.duplicateButton]}
                onPress={() => handleDuplicateMeal(meal)}
              >
                <Copy size={16} color="#10b981" />
                <Text style={styles.cardActionText}>Duplicate</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Nutrition Summary */}
          <View style={styles.nutritionSummary}>
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionCard}>
                <Flame size={16} color="#ef4444" />
                <Text style={styles.nutritionValue}>
                  {Math.round(meal.calories || 0)}
                </Text>
                <Text style={styles.nutritionLabel}>Calories</Text>
              </View>
              <View style={styles.nutritionCard}>
                <Zap size={16} color="#8b5cf6" />
                <Text style={styles.nutritionValue}>
                  {Math.round(meal.protein || meal.protein_g || 0)}g
                </Text>
                <Text style={styles.nutritionLabel}>Protein</Text>
              </View>
              <View style={styles.nutritionCard}>
                <Target size={16} color="#f59e0b" />
                <Text style={styles.nutritionValue}>
                  {Math.round(meal.carbs || meal.carbs_g || 0)}g
                </Text>
                <Text style={styles.nutritionLabel}>Carbs</Text>
              </View>
              <View style={styles.nutritionCard}>
                <Droplets size={16} color="#06b6d4" />
                <Text style={styles.nutritionValue}>
                  {Math.round(meal.fat || meal.fats_g || 0)}g
                </Text>
                <Text style={styles.nutritionLabel}>Fat</Text>
              </View>
            </View>
          </View>

          {/* Ratings Display */}
          {(meal.taste_rating || meal.satiety_rating || meal.energy_rating) && (
            <View style={styles.ratingsDisplay}>
              <Text style={styles.ratingsTitle}>Your Ratings</Text>
              <View style={styles.ratingsGrid}>
                {meal.taste_rating > 0 && (
                  <View style={styles.ratingItem}>
                    <Text style={styles.ratingLabel}>Taste</Text>
                    <View style={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={12}
                          color={
                            star <= meal.taste_rating ? "#fbbf24" : "#d1d5db"
                          }
                          fill={
                            star <= meal.taste_rating
                              ? "#fbbf24"
                              : "transparent"
                          }
                        />
                      ))}
                    </View>
                  </View>
                )}
                {meal.satiety_rating > 0 && (
                  <View style={styles.ratingItem}>
                    <Text style={styles.ratingLabel}>Satiety</Text>
                    <View style={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={12}
                          color={
                            star <= meal.satiety_rating ? "#fbbf24" : "#d1d5db"
                          }
                          fill={
                            star <= meal.satiety_rating
                              ? "#fbbf24"
                              : "transparent"
                          }
                        />
                      ))}
                    </View>
                  </View>
                )}
                {meal.energy_rating > 0 && (
                  <View style={styles.ratingItem}>
                    <Text style={styles.ratingLabel}>Energy</Text>
                    <View style={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={12}
                          color={
                            star <= meal.energy_rating ? "#fbbf24" : "#d1d5db"
                          }
                          fill={
                            star <= meal.energy_rating
                              ? "#fbbf24"
                              : "transparent"
                          }
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.mealCardActions}>
            <TouchableOpacity
              style={[styles.cardActionButton, styles.rateButton]}
              onPress={() => handleRateMeal(meal)}
            >
              <Star size={16} color="#fbbf24" />
              <Text style={styles.cardActionText}>Rate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cardActionButton, styles.duplicateButton]}
              onPress={() => handleDuplicateMeal(meal)}
            >
              <Copy size={16} color="#10b981" />
              <Text style={styles.cardActionText}>Duplicate</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  };

  if (isLoading && !meals.length) {
    return (
      <LoadingScreen text={isRTL ? "טוען היסטוריה..." : "Loading history..."} />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("history.title")}</Text>
          <Text style={styles.subtitle}>Track your nutrition journey</Text>
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Filter size={20} color="#10b981" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search meals..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <X size={20} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Insights Card */}
      {insights && (
        <View style={styles.insightsCard}>
          <LinearGradient
            colors={["#ecfdf5", "#f0fdf4"]}
            style={styles.insightsGradient}
          >
            <View style={styles.insightsHeader}>
              <TrendingUp size={20} color="#10b981" />
              <Text style={styles.insightsTitle}>Your Insights</Text>
            </View>
            <View style={styles.insightsGrid}>
              <View style={styles.insightItem}>
                <Text style={styles.insightValue}>{insights.totalMeals}</Text>
                <Text style={styles.insightLabel}>Total Meals</Text>
              </View>
              <View style={styles.insightItem}>
                <Text style={styles.insightValue}>{insights.avgCalories}</Text>
                <Text style={styles.insightLabel}>Avg Calories</Text>
              </View>
              <View style={styles.insightItem}>
                <Text style={styles.insightValue}>
                  {insights.favoriteMeals}
                </Text>
                <Text style={styles.insightLabel}>Favorites</Text>
              </View>
              <View style={styles.insightItem}>
                <Text style={styles.insightValue}>{insights.avgRating}</Text>
                <Text style={styles.insightLabel}>Avg Rating</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Meals List */}
      {filteredMeals.length > 0 ? (
        <FlatList
          data={filteredMeals}
          keyExtractor={(item) => item.id || item.meal_id?.toString()}
          renderItem={renderMealCard}
          contentContainerStyle={styles.mealsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#10b981"]}
              tintColor="#10b981"
            />
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Award size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No meals found</Text>
          <Text style={styles.emptyText}>
            {searchQuery ||
            filters.category !== "all" ||
            filters.showFavoritesOnly
              ? "Try adjusting your search or filters"
              : "Start logging meals to see your history"}
          </Text>
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Meals</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterContent}>
              {/* Category Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Category</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category.key}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor:
                            filters.category === category.key
                              ? category.color + "20"
                              : "#f9fafb",
                          borderColor:
                            filters.category === category.key
                              ? category.color
                              : "#e5e7eb",
                        },
                      ]}
                      onPress={() =>
                        setFilters((prev) => ({
                          ...prev,
                          category: category.key,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          {
                            color:
                              filters.category === category.key
                                ? category.color
                                : "#6b7280",
                          },
                        ]}
                      >
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Date Range Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Date Range</Text>
                <View style={styles.dateRangeGrid}>
                  {DATE_RANGES.map((range) => (
                    <TouchableOpacity
                      key={range.key}
                      style={[
                        styles.dateRangeChip,
                        {
                          backgroundColor:
                            filters.dateRange === range.key
                              ? "#ecfdf5"
                              : "#f9fafb",
                          borderColor:
                            filters.dateRange === range.key
                              ? "#10b981"
                              : "#e5e7eb",
                        },
                      ]}
                      onPress={() =>
                        setFilters((prev) => ({
                          ...prev,
                          dateRange: range.key,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.dateRangeChipText,
                          {
                            color:
                              filters.dateRange === range.key
                                ? "#10b981"
                                : "#6b7280",
                          },
                        ]}
                      >
                        {range.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Favorites Toggle */}
              <View style={styles.filterSection}>
                <TouchableOpacity
                  style={styles.favoritesToggle}
                  onPress={() =>
                    setFilters((prev) => ({
                      ...prev,
                      showFavoritesOnly: !prev.showFavoritesOnly,
                    }))
                  }
                >
                  <Heart
                    size={20}
                    color={filters.showFavoritesOnly ? "#ef4444" : "#d1d5db"}
                    fill={filters.showFavoritesOnly ? "#ef4444" : "transparent"}
                  />
                  <Text style={styles.favoritesToggleText}>
                    Show Favorites Only
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Reset Filters */}
              <TouchableOpacity
                style={styles.resetFiltersButton}
                onPress={() =>
                  setFilters({
                    category: "all",
                    dateRange: "all",
                    minCalories: 0,
                    maxCalories: 2000,
                    showFavoritesOnly: false,
                  })
                }
              >
                <Text style={styles.resetFiltersText}>Reset All Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate Your Meal</Text>
              <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.ratingMealName}>
              {selectedMeal?.name || selectedMeal?.meal_name}
            </Text>

            <View style={styles.ratingCategories}>
              <View style={styles.ratingCategory}>
                <Text style={styles.ratingCategoryTitle}>Taste</Text>
                {renderStarRating(ratings.taste, (rating) =>
                  setRatings((prev) => ({ ...prev, taste: rating }))
                )}
              </View>

              <View style={styles.ratingCategory}>
                <Text style={styles.ratingCategoryTitle}>Satiety</Text>
                {renderStarRating(ratings.satiety, (rating) =>
                  setRatings((prev) => ({ ...prev, satiety: rating }))
                )}
              </View>

              <View style={styles.ratingCategory}>
                <Text style={styles.ratingCategoryTitle}>Energy</Text>
                {renderStarRating(ratings.energy, (rating) =>
                  setRatings((prev) => ({ ...prev, energy: rating }))
                )}
              </View>

              <View style={styles.ratingCategory}>
                <Text style={styles.ratingCategoryTitle}>Heaviness</Text>
                {renderStarRating(ratings.heaviness, (rating) =>
                  setRatings((prev) => ({ ...prev, heaviness: rating }))
                )}
              </View>
            </View>

            <View style={styles.ratingModalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitRatingButton}
                onPress={submitRating}
              >
                <Text style={styles.submitRatingText}>Save Rating</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 4,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ecfdf5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1fae5",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
  },
  insightsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  insightsGradient: {
    padding: 20,
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#065f46",
  },
  insightsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  insightItem: {
    alignItems: "center",
  },
  insightValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#10b981",
  },
  insightLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  mealsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  mealCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mealCardGradient: {
    padding: 16,
  },
  mealHeader: {
    flexDirection: "row",
    marginBottom: 16,
  },
  mealImageContainer: {
    position: "relative",
    marginRight: 12,
  },
  mealImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  mealImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  favoriteIcon: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 2,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  mealMeta: {
    flexDirection: "row",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#6b7280",
  },
  mealActions: {
    justifyContent: "center",
  },
  actionIcon: {
    padding: 8,
  },
  nutritionSummary: {
    marginBottom: 16,
  },
  nutritionGrid: {
    flexDirection: "row",
    gap: 8,
  },
  nutritionCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    gap: 4,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
  },
  nutritionLabel: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: "500",
  },
  ratingsDisplay: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  ratingsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  ratingsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ratingItem: {
    alignItems: "center",
  },
  ratingLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 4,
  },
  ratingStars: {
    flexDirection: "row",
    gap: 2,
  },
  mealCardActions: {
    flexDirection: "row",
    gap: 8,
  },
  cardActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  rateButton: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  duplicateButton: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  filterModal: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  ratingModal: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  filterContent: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  dateRangeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dateRangeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  dateRangeChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  favoritesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  favoritesToggleText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  resetFiltersButton: {
    backgroundColor: "#10b981",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  resetFiltersText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  ratingMealName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 24,
  },
  ratingCategories: {
    gap: 20,
    marginBottom: 24,
  },
  ratingCategory: {
    alignItems: "center",
  },
  ratingCategoryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  starContainer: {
    flexDirection: "row",
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingModalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  cancelButtonText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
  submitRatingButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#10b981",
    alignItems: "center",
  },
  submitRatingText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
