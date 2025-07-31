import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/src/store";
import {
  analyzeMeal,
  postMeal,
  clearPendingMeal,
  updateMeal,
  processImage,
} from "@/src/store/mealSlice";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import {
  Camera as CameraIcon,
  Image as ImageIcon,
  Send,
  X,
  Plus,
  Minus,
  Edit3,
  Check,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react-native";
import { router } from "expo-router";

const { width, height } = Dimensions.get("window");

interface EditableIngredient {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  isUserAdded?: boolean;
}

export default function CameraScreen() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();
  const { pendingMeal, isAnalyzing, isPosting, isUpdating, error } =
    useSelector((state: RootState) => state.meal);

  // Camera states
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Analysis states
  const [preAnalysisComment, setPreAnalysisComment] = useState("");
  const [showPreAnalysisModal, setShowPreAnalysisModal] = useState(false);
  const [editableIngredients, setEditableIngredients] = useState<EditableIngredient[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [postAnalysisComment, setPostAnalysisComment] = useState("");
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  // UI states
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);

  useEffect(() => {
    getCameraPermissions();
  }, []);

  useEffect(() => {
    if (pendingMeal?.analysis) {
      // Convert analysis to editable ingredients
      const ingredients = pendingMeal.analysis.items || [];
      const editableItems: EditableIngredient[] = ingredients.map((item, index) => ({
        id: `ai_${index}`,
        name: item.name || `Item ${index + 1}`,
        calories: parseFloat(item.calories) || 0,
        protein: parseFloat(item.protein) || 0,
        carbs: parseFloat(item.carbs) || 0,
        fat: parseFloat(item.fat) || 0,
        fiber: parseFloat(item.fiber) || 0,
        sugar: parseFloat(item.sugar) || 0,
        sodium: parseFloat(item.sodium_mg) || 0,
        isUserAdded: false,
      }));
      setEditableIngredients(editableItems);
      setShowEditModal(true);
    }
  }, [pendingMeal?.analysis]);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === "granted");
  };

  const handleImageCapture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (photo?.uri) {
        setCapturedImage(photo.uri);
        setShowCamera(false);
        setShowPreAnalysisModal(true);
      }
    } catch (error) {
      console.error("Error capturing image:", error);
      Alert.alert(t("common.error"), "Failed to capture image");
    }
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        setShowPreAnalysisModal(true);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert(t("common.error"), "Failed to select image");
    }
  };

  const handleInitialAnalysis = async () => {
    if (!capturedImage) return;

    try {
      const processedBase64 = await processImage(capturedImage);
      
      await dispatch(
        analyzeMeal({
          imageBase64: processedBase64,
          updateText: preAnalysisComment.trim() || undefined,
          language: isRTL ? "he" : "en",
        })
      ).unwrap();

      setShowPreAnalysisModal(false);
    } catch (error) {
      console.error("Analysis error:", error);
      Alert.alert(t("camera.analysis_failed"), error as string);
    }
  };

  const handleRemoveIngredient = (id: string) => {
    setEditableIngredients(prev => prev.filter(item => item.id !== id));
  };

  const handleAddIngredient = () => {
    if (!newIngredient.name.trim()) {
      Alert.alert(t("common.error"), "Please enter ingredient name");
      return;
    }

    const ingredient: EditableIngredient = {
      id: `user_${Date.now()}`,
      name: newIngredient.name.trim(),
      calories: parseFloat(newIngredient.calories) || 0,
      protein: parseFloat(newIngredient.protein) || 0,
      carbs: parseFloat(newIngredient.carbs) || 0,
      fat: parseFloat(newIngredient.fat) || 0,
      isUserAdded: true,
    };

    setEditableIngredients(prev => [...prev, ingredient]);
    setNewIngredient({
      name: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
    });
    setShowAddIngredientModal(false);
  };

  const handleFinalSubmission = async () => {
    try {
      // Calculate totals from edited ingredients
      const totals = editableIngredients.reduce(
        (acc, ingredient) => ({
          calories: acc.calories + ingredient.calories,
          protein: acc.protein + ingredient.protein,
          carbs: acc.carbs + ingredient.carbs,
          fat: acc.fat + ingredient.fat,
          fiber: acc.fiber + (ingredient.fiber || 0),
          sugar: acc.sugar + (ingredient.sugar || 0),
          sodium: acc.sodium + (ingredient.sodium || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
      );

      // Create updated meal data
      const updatedMealData = {
        ...pendingMeal?.analysis,
        meal_name: pendingMeal?.analysis?.meal_name || "Edited Meal",
        calories: totals.calories,
        protein_g: totals.protein,
        carbs_g: totals.carbs,
        fats_g: totals.fat,
        fiber_g: totals.fiber,
        sugar_g: totals.sugar,
        sodium_mg: totals.sodium,
        items: editableIngredients.map(ing => ({
          name: ing.name,
          calories: ing.calories.toString(),
          protein: ing.protein.toString(),
          carbs: ing.carbs.toString(),
          fat: ing.fat.toString(),
          fiber: ing.fiber?.toString() || "0",
          sugar: ing.sugar?.toString() || "0",
          sodium_mg: ing.sodium || 0,
        })),
        description: postAnalysisComment.trim() || pendingMeal?.analysis?.description,
      };

      // Save the meal
      await dispatch(postMeal()).unwrap();

      Alert.alert(
        t("camera.save_success"),
        t("camera.save_success"),
        [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowEditModal(false);
              setCapturedImage(null);
              setPreAnalysisComment("");
              setPostAnalysisComment("");
              setEditableIngredients([]);
              router.push("/(tabs)/history");
            },
          },
        ]
      );
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert(t("camera.save_failed"), error as string);
    }
  };

  const handleReAnalyze = async () => {
    if (!capturedImage) return;

    try {
      const processedBase64 = await processImage(capturedImage);
      
      await dispatch(
        analyzeMeal({
          imageBase64: processedBase64,
          updateText: postAnalysisComment.trim() || undefined,
          language: isRTL ? "he" : "en",
        })
      ).unwrap();
    } catch (error) {
      console.error("Re-analysis error:", error);
      Alert.alert(t("camera.re_analysis_failed"), error as string);
    }
  };

  const calculateTotalNutrition = () => {
    return editableIngredients.reduce(
      (acc, ingredient) => ({
        calories: acc.calories + ingredient.calories,
        protein: acc.protein + ingredient.protein,
        carbs: acc.carbs + ingredient.carbs,
        fat: acc.fat + ingredient.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text>{t("camera.permission")}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {showCamera ? (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCamera(false)}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleImageCapture}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <View style={styles.placeholder} />
          </View>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t("camera.title")}</Text>
            <Text style={styles.subtitle}>{t("camera.description")}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowCamera(true)}
            >
              <LinearGradient
                colors={["#10b981", "#059669"]}
                style={styles.actionButtonGradient}
              >
                <CameraIcon size={24} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>
                  {t("camera.take_picture")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleImagePicker}
            >
              <LinearGradient
                colors={["#059669", "#047857"]}
                style={styles.actionButtonGradient}
              >
                <ImageIcon size={24} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>
                  {t("camera.choose_gallery")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Current Analysis Display */}
          {pendingMeal && (
            <View style={styles.analysisContainer}>
              <LinearGradient
                colors={["#f0fdf4", "#dcfce7"]}
                style={styles.analysisGradient}
              >
                <View style={styles.analysisHeader}>
                  <Text style={styles.analysisTitle}>
                    {t("camera.analysis_results")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAnalysisDetails(!showAnalysisDetails)}
                  >
                    {showAnalysisDetails ? (
                      <EyeOff size={20} color="#059669" />
                    ) : (
                      <Eye size={20} color="#059669" />
                    )}
                  </TouchableOpacity>
                </View>

                {showAnalysisDetails && (
                  <View style={styles.analysisDetails}>
                    <Text style={styles.mealName}>
                      {pendingMeal.analysis?.meal_name || "Analyzed Meal"}
                    </Text>
                    
                    <View style={styles.nutritionSummary}>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>
                          {t("meals.calories")}
                        </Text>
                        <Text style={styles.nutritionValue}>
                          {Math.round(pendingMeal.analysis?.calories || 0)}
                        </Text>
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>
                          {t("meals.protein")}
                        </Text>
                        <Text style={styles.nutritionValue}>
                          {Math.round(pendingMeal.analysis?.protein_g || 0)}g
                        </Text>
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>
                          {t("meals.carbs")}
                        </Text>
                        <Text style={styles.nutritionValue}>
                          {Math.round(pendingMeal.analysis?.carbs_g || 0)}g
                        </Text>
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>
                          {t("meals.fat")}
                        </Text>
                        <Text style={styles.nutritionValue}>
                          {Math.round(pendingMeal.analysis?.fats_g || 0)}g
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => setShowEditModal(true)}
                    >
                      <Edit3 size={16} color="#FFFFFF" />
                      <Text style={styles.editButtonText}>
                        {t("camera.edit_analysis")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </LinearGradient>
            </View>
          )}

          {/* Tips Section */}
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>{t("camera.optimal_results")}</Text>
            <Text style={styles.tipsText}>{t("camera.tip_description")}</Text>
          </View>
        </ScrollView>
      )}

      {/* Pre-Analysis Modal */}
      <Modal
        visible={showPreAnalysisModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPreAnalysisModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t("camera.add_additional_info")}
              </Text>
              <TouchableOpacity onPress={() => setShowPreAnalysisModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {capturedImage && (
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
            )}

            <TextInput
              style={styles.commentInput}
              placeholder={t("camera.enter_additional_info")}
              value={preAnalysisComment}
              onChangeText={setPreAnalysisComment}
              multiline
              numberOfLines={3}
              textAlign={isRTL ? "right" : "left"}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleInitialAnalysis}
              >
                <Text style={styles.skipButtonText}>
                  {t("camera.analyze_photo")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.analyzeButton}
                onPress={handleInitialAnalysis}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={16} color="#FFFFFF" />
                    <Text style={styles.analyzeButtonText}>
                      {t("camera.analyze_photo")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Analysis Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>
              {t("camera.edit_analysis")}
            </Text>
            <TouchableOpacity onPress={handleFinalSubmission} disabled={isPosting}>
              {isPosting ? (
                <ActivityIndicator color="#10b981" />
              ) : (
                <Check size={24} color="#10b981" />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editModalContent}>
            {/* Total Nutrition Summary */}
            <View style={styles.totalNutritionCard}>
              <Text style={styles.totalNutritionTitle}>
                {t("camera.nutritional_info")}
              </Text>
              <View style={styles.totalNutritionGrid}>
                {Object.entries(calculateTotalNutrition()).map(([key, value]) => (
                  <View key={key} style={styles.totalNutritionItem}>
                    <Text style={styles.totalNutritionValue}>
                      {Math.round(value)}
                      {key === "calories" ? "" : "g"}
                    </Text>
                    <Text style={styles.totalNutritionLabel}>
                      {t(`meals.${key}`)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Ingredients List */}
            <View style={styles.ingredientsSection}>
              <View style={styles.ingredientsHeader}>
                <Text style={styles.ingredientsTitle}>
                  {t("camera.identified_ingredients")}
                </Text>
                <TouchableOpacity
                  style={styles.addIngredientButton}
                  onPress={() => setShowAddIngredientModal(true)}
                >
                  <Plus size={16} color="#10b981" />
                  <Text style={styles.addIngredientText}>{t("common.add")}</Text>
                </TouchableOpacity>
              </View>

              {editableIngredients.map((ingredient) => (
                <View key={ingredient.id} style={styles.ingredientCard}>
                  <View style={styles.ingredientHeader}>
                    <Text style={styles.ingredientName}>{ingredient.name}</Text>
                    <View style={styles.ingredientActions}>
                      {ingredient.isUserAdded && (
                        <View style={styles.userAddedBadge}>
                          <Text style={styles.userAddedText}>Added</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => handleRemoveIngredient(ingredient.id)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.ingredientNutrition}>
                    <Text style={styles.ingredientNutritionText}>
                      {Math.round(ingredient.calories)} cal • {Math.round(ingredient.protein)}g protein • {Math.round(ingredient.carbs)}g carbs • {Math.round(ingredient.fat)}g fat
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Additional Comments */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>
                {t("camera.additional_info")}
              </Text>
              <TextInput
                style={styles.commentsInput}
                placeholder={t("camera.enter_update")}
                value={postAnalysisComment}
                onChangeText={setPostAnalysisComment}
                multiline
                numberOfLines={3}
                textAlign={isRTL ? "right" : "left"}
              />
            </View>

            {/* Re-analyze Button */}
            <TouchableOpacity
              style={styles.reAnalyzeButton}
              onPress={handleReAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <RefreshCw size={16} color="#FFFFFF" />
                  <Text style={styles.reAnalyzeButtonText}>
                    {t("camera.re_analyze")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Ingredient Modal */}
      <Modal
        visible={showAddIngredientModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddIngredientModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addIngredientModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Ingredient</Text>
              <TouchableOpacity onPress={() => setShowAddIngredientModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.addIngredientForm}>
              <TextInput
                style={styles.ingredientInput}
                placeholder="Ingredient name"
                value={newIngredient.name}
                onChangeText={(text) =>
                  setNewIngredient(prev => ({ ...prev, name: text }))
                }
              />
              <View style={styles.nutritionInputs}>
                <TextInput
                  style={styles.nutritionInput}
                  placeholder="Calories"
                  value={newIngredient.calories}
                  onChangeText={(text) =>
                    setNewIngredient(prev => ({ ...prev, calories: text }))
                  }
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.nutritionInput}
                  placeholder="Protein (g)"
                  value={newIngredient.protein}
                  onChangeText={(text) =>
                    setNewIngredient(prev => ({ ...prev, protein: text }))
                  }
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.nutritionInput}
                  placeholder="Carbs (g)"
                  value={newIngredient.carbs}
                  onChangeText={(text) =>
                    setNewIngredient(prev => ({ ...prev, carbs: text }))
                  }
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.nutritionInput}
                  placeholder="Fat (g)"
                  value={newIngredient.fat}
                  onChangeText={(text) =>
                    setNewIngredient(prev => ({ ...prev, fat: text }))
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelAddButton}
                onPress={() => setShowAddIngredientModal(false)}
              >
                <Text style={styles.cancelAddButtonText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddIngredient}
              >
                <Text style={styles.addButtonText}>{t("common.add")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {(isAnalyzing || isPosting || isUpdating) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>
              {isAnalyzing
                ? t("camera.analyzing")
                : isUpdating
                ? t("camera.updating_analysis")
                : t("camera.save_meal")}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 50,
  },
  cancelButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#10b981",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#10b981",
  },
  placeholder: {
    width: 50,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
  },
  actionButtons: {
    gap: 16,
    marginBottom: 32,
  },
  actionButton: {
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  actionButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  analysisContainer: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: "hidden",
  },
  analysisGradient: {
    padding: 20,
  },
  analysisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#065f46",
  },
  analysisDetails: {
    gap: 16,
  },
  mealName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "center",
  },
  nutritionSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  nutritionItem: {
    alignItems: "center",
  },
  nutritionLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#10b981",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  tipsContainer: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: "#1e40af",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    width: width - 40,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  skipButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  skipButtonText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
  analyzeButton: {
    flex: 1,
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  analyzeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  editModalContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  editModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  editModalContent: {
    flex: 1,
    padding: 20,
  },
  totalNutritionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  totalNutritionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 16,
    textAlign: "center",
  },
  totalNutritionGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  totalNutritionItem: {
    alignItems: "center",
  },
  totalNutritionValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#10b981",
    marginBottom: 4,
  },
  totalNutritionLabel: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
  },
  ingredientsSection: {
    marginBottom: 20,
  },
  ingredientsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  ingredientsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  addIngredientButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  addIngredientText: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "600",
  },
  ingredientCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  ingredientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  ingredientActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userAddedBadge: {
    backgroundColor: "#dbeafe",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  userAddedText: {
    fontSize: 10,
    color: "#1e40af",
    fontWeight: "600",
  },
  ingredientNutrition: {
    marginTop: 4,
  },
  ingredientNutritionText: {
    fontSize: 14,
    color: "#6b7280",
  },
  commentsSection: {
    marginBottom: 20,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  commentsInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  reAnalyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 20,
  },
  reAnalyzeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  addIngredientModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    width: width - 40,
    maxHeight: height * 0.7,
  },
  addIngredientForm: {
    marginBottom: 20,
  },
  ingredientInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  nutritionInputs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  nutritionInput: {
    flex: 1,
    minWidth: "45%",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  cancelAddButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelAddButtonText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
  addButton: {
    flex: 1,
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#1f2937",
    fontWeight: "500",
  },
});