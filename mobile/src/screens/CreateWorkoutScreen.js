import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useApi } from "../ApiProvider";
import ExerciseAdvancedModal from "../components/ExerciseAdvancedModal";
import { showError } from "../utils/errorHandler";
import StyledTextInput from "../components/StyledTextInput";
import Button from "../components/Button";
import KeyboardAvoidingContainer from "../components/KeyboardAvoidingContainer";
import { showAlert, showErrorAlert, showConfirmAlert } from "../utils/alert";
import Pressable from "../components/Pressable";

export default function CreateWorkoutScreen({ navigation, route }) {
  const { initialCategoryId } = route.params || {};
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [showCategoryList, setShowCategoryList] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null);
  const [advancedSets, setAdvancedSets] = useState([]);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [hasLoadedPrevious, setHasLoadedPrevious] = useState(false);
  const [hasPreviousWorkout, setHasPreviousWorkout] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [appliedBasicSetup, setAppliedBasicSetup] = useState({});
  const { api } = useApi();

  const unitOptionsMap = {
    weight: ["kg", "g"],
    time: ["seconds", "minutes"],
    distance: ["km", "m"],
  };

  const toggleExercise = (index) => {
    const newExpanded = new Set(expandedExercises);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedExercises(newExpanded);
  };

  const fetchPreviousWorkout = async (categoryId) => {
    setExpandedExercises(new Set());
    setIsLoadingPrevious(true);
    try {
      const url = `/workouts/category/${categoryId}?limit=1&sortBy=createdAt&sortOrder=desc`;

      const res = await api.get(url);
      const workout = res.data?.workouts[0] || null;

      if (workout) {
        setNotes(workout.notes || "");
        const loadedExercises = (workout.exercises || []).map((ex, idx) => ({
          type: ex.type || "weight",
          name:
            ex.name && ex.name.trim() !== ""
              ? ex.name
              : `Exercise ${idx + 1}`,
          unit: ex.unit || "",
          sets: ex.setsDetail ? ex.setsDetail.length : "",
          reps: ex.setsDetail.every(
            (set) => set.reps === ex.setsDetail[0].reps
          )
            ? String(ex.setsDetail[0].reps)
            : "",
          weight: ex.setsDetail.every(
            (set) => set.value === ex.setsDetail[0].value
          )
            ? String(ex.setsDetail[0].value)
            : "",
          restMinutes: ex.setsDetail.every(
            (set) => set.restMinutes === ex.setsDetail[0].restMinutes
          )
            ? String(ex.setsDetail[0].restMinutes)
            : "",
          notes: ex.notes || "",
          order: idx + 1,
          setsDetail: ex.setsDetail || [
            { order: 1, reps: 1, value: 0, restMinutes: 1 },
          ],
        }));
        setExercises(loadedExercises);
        setHasLoadedPrevious(true);
      } else {
        showAlert(
          "No Previous Workout",
          "No previous workout found for this category."
        );
      }
    } catch (error) {
      showError(error, "Error", "Failed to load previous workout");
    } finally {
      setIsLoadingPrevious(false);
    }
  };

  const handleDataChange = () => {
    setHasLoadedPrevious(false);
  };

  const checkForPreviousWorkout = async (categoryId) => {
    try {
      const res = await api.get(
        `/workouts/category/${categoryId}/check-previous`
      );
      setHasPreviousWorkout(res.data.hasPrevious || false);
    } catch (error) {
      setHasPreviousWorkout(false);
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get("/categories");
        setCategories(res.data || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const { sharedWorkout } = route.params || {};
    if (sharedWorkout) {
      if (sharedWorkout.exercises && sharedWorkout.exercises.length > 0) {
        setExercises(sharedWorkout.exercises);
        setExpandedExercises(new Set(sharedWorkout.exercises.map((_, idx) => idx)));
      }
      
      if (sharedWorkout.notes) {
        setNotes(sharedWorkout.notes);
      }

      showAlert(
        "Workout Imported",
        "Shared workout has been imported. Review and adjust as needed, then select a category and save."
      );
    }
  }, [route.params?.sharedWorkout]);

  useEffect(() => {
    if (categories && categories.length > 0) {
      let categoryToSelect = null;
      
      if (initialCategoryId) {
        categoryToSelect = categories.find(cat => cat.id === initialCategoryId);
      }
      
      if (!categoryToSelect && categories.length === 1) {
        categoryToSelect = categories[0];
      }
      
      if (categoryToSelect) {
        setSelectedCategoryId(categoryToSelect.id);
        checkForPreviousWorkout(categoryToSelect.id);
      }
    }
  }, [categories, initialCategoryId]);

  const addExercise = () => {
    handleDataChange();
    const newExercise = {
      type: "weight",
      name: `Exercise ${exercises.length + 1}`,
      unit: unitOptionsMap["weight"][0],
      notes: "",
      order: exercises.length + 1,
      sets: "1",
      reps: "1",
      weight: "0",
      restMinutes: "1",
      setsDetail: [{ order: 1, reps: 1, value: 0, restMinutes: 1 }],
    };
    const newIndex = exercises.length;
    setExercises([...exercises, newExercise]);
    setExpandedExercises((prev) => {
      const next = new Set(prev);
      next.add(newIndex);
      return next;
    });
  };

  const updateExercise = (index, field, value) => {
    handleDataChange();
    const updatedExercises = [...exercises];
    updatedExercises[index] = {
      ...updatedExercises[index],
      [field]: value,
    };

    if (field === "type") {
      updatedExercises[index].unit = unitOptionsMap[value]?.[0] || "";
    }

    setExercises(updatedExercises);
  };

  const removeExercise = (index) => {
    handleDataChange();
    const updatedExercises = exercises.filter((_, i) => i !== index);
    setExercises(updatedExercises);
    // Clean up applied state for removed exercise and reindex remaining ones
    setAppliedBasicSetup((prev) => {
      const newState = {};
      updatedExercises.forEach((_, i) => {
        const oldIndex = i < index ? i : i + 1;
        if (prev[oldIndex]) {
          newState[i] = prev[oldIndex];
        }
      });
      return newState;
    });
  };

  const hasUnappliedBasicSetup = (index) => {
    const exercise = exercises[index];
    if (!exercise) return false;
    
    if (!(index in appliedBasicSetup)) {
      return true;
    }
    
    const applied = appliedBasicSetup[index];
    // Compare current values with applied values - show red if out of sync
    return (
      exercise.sets !== applied.sets ||
      exercise.reps !== applied.reps ||
      exercise.weight !== applied.weight ||
      exercise.restMinutes !== applied.restMinutes
    );
  };

  const applyBasicSetup = (index) => {
    handleDataChange();
    const exercise = exercises[index];
    if (!exercise.sets || !exercise.reps) {
      showErrorAlert("Please enter both sets and reps");
      return;
    }

    const newSetsDetail = [];
    for (let i = 0; i < exercise.sets; i++) {
      newSetsDetail.push({
        order: i + 1,
        reps: exercise.reps,
        value: exercise.weight || 0,
        restMinutes: exercise.restMinutes || 0,
      });
    }

    setAppliedBasicSetup((prev) => ({
      ...prev,
      [index]: {
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        restMinutes: exercise.restMinutes,
      },
    }));

    updateExercise(index, "setsDetail", newSetsDetail);
  };

  const cleanExercises = (exercises) => {
    return exercises.map((exercise) => {
      const {
        reps,
        restMinutes,
        sets,
        weight,
        ...cleanExercise
      } = exercise;
      return cleanExercise;
    });
  };

  const handleCreateWorkout = async () => {
    if (isSubmittingRef.current) return;

    if (!selectedCategoryId) {
      showErrorAlert("Please select a category");
      return;
    }

    if (!exercises || exercises.length === 0) {
      showErrorAlert(
        "Workout must have at least one exercise. Please add at least one exercise before saving.",
        "Validation Error"
      );
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const workoutData = {
        categoryId: selectedCategoryId,
        notes: notes.trim() || undefined,
        exercises: cleanExercises(exercises),
      };

      await api.post("/workouts", workoutData);
      navigation.goBack();
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Failed to create workout";
      showErrorAlert(errorMessage);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const selectedCategory = categories.find(
    (cat) => cat.id === selectedCategoryId
  );

  const openAdvancedForIndex = (index) => {
    const ex = exercises[index];

    const initial =
      ex.setsDetail?.length > 0
        ? ex.setsDetail.map((s) => ({
            value: Number(s.value) || 0,
            reps: Number(s.reps) || 0,
            restMinutes: Number(s.restMinutes) || 0,
          }))
        : [{ value: 0, reps: 1, restMinutes: 1 }];

    setSelectedExerciseIndex(index);
    setAdvancedSets(initial);
    setShowAdvancedModal(true);
  };

  return (
    <KeyboardAvoidingContainer
      keyboardVerticalOffset={100}
    >
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Create Workout</Text>
        <View style={styles.section}>
          <Text style={styles.label}>Category *</Text>
          <Pressable
            style={styles.categoryButton}
            onPress={() => setShowCategoryList(!showCategoryList)}
          >
            <Text style={styles.categoryButtonText}>
              {selectedCategory
                ? selectedCategory.name
                : "Select a category..."}
            </Text>
            <Text style={styles.arrow}>{showCategoryList ? "▲" : "▼"}</Text>
          </Pressable>

          {showCategoryList && (
            <View style={styles.categoryList}>
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  style={styles.categoryItem}
                  onPress={() => {
                    setSelectedCategoryId(category.id);
                    setShowCategoryList(false);
                    // Reset state when category changes
                    if (category.id !== selectedCategoryId) {
                      setHasLoadedPrevious(false);
                      setNotes("");
                      setExercises([]);
                      setHasPreviousWorkout(false);
                      setAppliedBasicSetup({});
                      // Check for previous workout
                      checkForPreviousWorkout(category.id);
                    }
                  }}
                >
                  <Text style={styles.categoryItemText}>{category.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {categories.length > 0 &&
          selectedCategoryId &&
          !hasLoadedPrevious &&
          hasPreviousWorkout && (
            <View style={styles.section}>
              <Button
                title={isLoadingPrevious ? "Loading..." : "Load Previous Workout"}
                onPress={() => fetchPreviousWorkout(selectedCategoryId)}
                disabled={isLoadingPrevious}
                loading={isLoadingPrevious}
                variant="secondary"
                size="medium"
                style={styles.loadPreviousButton}
              />
              {isLoadingPrevious && (
                <Text style={styles.loadingText}>
                  Loading previous workout...
                </Text>
              )}
            </View>
          )}

        {hasLoadedPrevious && (
          <View style={styles.section}>
            <Button
              title="Start Fresh"
              onPress={() => {
                setNotes("");
                setExercises([]);
                setHasLoadedPrevious(false);
                setAppliedBasicSetup({});
              }}
              variant="outline"
              size="medium"
              style={styles.clearButton}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <StyledTextInput
            style={styles.textInput}
            value={notes}
            onChangeText={(text) => {
              handleDataChange();
              setNotes(text);
            }}
            placeholder="Add workout notes..."
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.label}>Exercises</Text>
            <Button
              title="+ Add Exercise"
              onPress={addExercise}
              variant="outline"
              size="small"
              style={styles.addButton}
            />
          </View>

          {exercises.map((exercise, index) => {
            const isExpanded = expandedExercises.has(index);
            return (
              <View key={index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <StyledTextInput
                    style={styles.exerciseNumber}
                    value={exercise.name}
                    onChangeText={(value) =>
                      updateExercise(index, "name", value)
                    }
                    placeholder={`Exercise ${index + 1}`}
                    multiline={false}
                    selectTextOnFocus={true}
                  />
                  <View style={styles.exerciseActions}>
                    <Button
                      title="Remove"
                      onPress={() => removeExercise(index)}
                      variant="outline"
                      size="small"
                      style={styles.removeButton}
                    />
                    <Pressable onPress={() => toggleExercise(index)}>
                      <Text style={styles.expandButton}>
                        {isExpanded ? "▼" : "▶"}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {isExpanded && (
                  <>
                    <View style={[
                      styles.basicSetupSection,
                      hasUnappliedBasicSetup(index) ? styles.basicSetupSectionUnapplied : null
                    ]}>
                      <Text style={styles.sectionTitle}>Basic Setup</Text>

                      <View style={styles.exerciseRow}>
                        <View style={styles.exerciseField}>
                          <Text style={styles.fieldLabel}>Sets</Text>
                          <StyledTextInput
                            style={styles.smallInput}
                            value={exercise.sets}
                            onChangeText={(value) =>
                              updateExercise(
                                index,
                                "sets",
                                String(parseInt(value) || "")
                              )
                            }
                            keyboardType="numeric"
                            placeholder={"1"}
                            selectTextOnFocus={true}
                          />
                        </View>

                        <View style={styles.exerciseField}>
                          <Text style={styles.fieldLabel}>Reps</Text>
                          <StyledTextInput
                            style={styles.smallInput}
                            value={exercise.reps}
                            onChangeText={(value) =>
                              updateExercise(
                                index,
                                "reps",
                                String(parseInt(value) || "")
                              )
                            }
                            keyboardType="numeric"
                            placeholder={"1"}
                            selectTextOnFocus={true}
                          />
                        </View>

                        <View style={styles.exerciseField}>
                          <Text style={styles.fieldLabel}>Weight</Text>
                          <StyledTextInput
                            style={styles.smallInput}
                            value={exercise.weight}
                            onChangeText={(value) =>
                              updateExercise(
                                index,
                                "weight",
                                String(value)
                              )
                            }
                            keyboardType="numeric"
                            placeholder={"12.5"}
                            selectTextOnFocus={true}
                          />
                        </View>

                        <View style={styles.exerciseField}>
                          <Text style={styles.fieldLabel}>Rest (mins)</Text>
                          <StyledTextInput
                            style={styles.smallInput}
                            value={exercise.restMinutes}
                            onChangeText={(value) =>
                              updateExercise(
                                index,
                                "restMinutes",
                                String(value)
                              )
                            }
                            keyboardType="numeric"
                            placeholder={"2.5"}
                            selectTextOnFocus={true}
                          />
                        </View>
                      </View>

                      <Button
                        title="Apply Basic Setup"
                        onPress={() => applyBasicSetup(index)}
                        variant="secondary"
                        size="small"
                        style={styles.applyBasicButton}
                      />
                    </View>
                    <View style={styles.exerciseRow}>
                      <View style={styles.exerciseField}>
                        <Text style={styles.fieldLabel}>
                          {exercise.setsDetail?.length > 0
                            ? `Total Reps: ${exercise.setsDetail.reduce(
                                (sum, set) => sum + Number(set.reps || 0),
                                0
                              )}`
                            : "No sets configured"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.exerciseRow}>
                      <View style={styles.exerciseField}>
                        <Text style={styles.fieldLabel}>Unit</Text>
                        <View style={styles.typeButtons}>
                          {unitOptionsMap[exercise.type]?.map((unit) => (
                            <Pressable
                              key={unit}
                              style={[
                                styles.typeButton,
                                exercise.unit === unit &&
                                  styles.typeButtonSelected,
                              ]}
                              onPress={() =>
                                updateExercise(index, "unit", unit)
                              }
                            >
                              <Text
                                style={[
                                  styles.typeButtonText,
                                  exercise.unit === unit &&
                                    styles.typeButtonTextSelected,
                                ]}
                              >
                                {unit}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>

                    <StyledTextInput
                      style={styles.exerciseNotes}
                      value={exercise.notes}
                      onChangeText={(value) =>
                        updateExercise(index, "notes", value)
                      }
                      placeholder="Exercise notes..."
                      multiline
                    />
                    <Button
                      title="Advanced setup"
                      onPress={() => openAdvancedForIndex(index)}
                      variant="outline"
                      size="medium"
                      style={[styles.startWorkout, { marginTop: 12, backgroundColor: 'transparent' }]}
                    />
                  </>
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.buttonContainer}>
          <Button
            title="Start Workout"
            onPress={() => {
              if (!selectedCategoryId || selectedCategoryId === "") {
                showErrorAlert("Please select a category before starting the workout");
                return;
              }
              if (exercises.length > 0) {
                navigation.navigate("Workout Execution", {
                  workoutData: {
                    categoryId: selectedCategoryId,
                    notes: notes.trim() || undefined,
                    exercises: cleanExercises(exercises),
                  },
                });
              }
            }}
            disabled={exercises.length === 0}
            variant="primary"
            size="large"
            style={[
              styles.startWorkout,
              exercises.length === 0 && styles.disabledButton,
            ]}
          />
        </View>
        <View style={[styles.buttonContainer, { paddingBottom: 35 }]}>
          <Button
            title={isSubmitting ? "Creating..." : "Create Workout"}
            onPress={handleCreateWorkout}
            disabled={isSubmitting}
            loading={isSubmitting}
            variant="primary"
            size="small"
            style={[
              styles.createButton,
              isSubmitting && styles.disabledButton,
            ]}
          />
          <Button
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="outline"
            size="small"
            style={styles.cancelButton}
          />
        </View>
      </ScrollView>
      <ExerciseAdvancedModal
        visible={showAdvancedModal}
        exerciseName={exercises[selectedExerciseIndex]?.name}
        initialSets={advancedSets}
        units={unitOptionsMap[exercises[selectedExerciseIndex]?.type]?.[0]}
        onClose={() => setShowAdvancedModal(false)}
        onSave={(detailed) => {
          if (selectedExerciseIndex == null) return;
          handleDataChange();
          const updated = [...exercises];
          updated[selectedExerciseIndex] = {
            ...updated[selectedExerciseIndex],
            setsDetail: detailed,
          };
          updated.forEach((ex) => {
            ex.sets = ex.setsDetail ? ex.setsDetail.length : "";
            ex.reps = ex.setsDetail.every(
              (set) => set.reps === ex.setsDetail[0].reps
            )
              ? String(ex.setsDetail[0].reps)
              : "";
            ex.weight = ex.setsDetail.every(
              (set) => set.value === ex.setsDetail[0].value
            )
              ? String(ex.setsDetail[0].value)
              : "";
            ex.restMinutes = ex.setsDetail.every(
              (set) => set.restMinutes === ex.setsDetail[0].restMinutes
            )
              ? String(ex.setsDetail[0].restMinutes)
              : "";
          });

          // Update applied state since advanced setup also updates basic setup fields
          setAppliedBasicSetup((prev) => ({
            ...prev,
            [selectedExerciseIndex]: {
              sets: updated[selectedExerciseIndex].sets,
              reps: updated[selectedExerciseIndex].reps,
              weight: updated[selectedExerciseIndex].weight,
              restMinutes: updated[selectedExerciseIndex].restMinutes,
            },
          }));

          setExercises(updated);
          setShowAdvancedModal(false);
        }}
      />
    </KeyboardAvoidingContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  section: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 8, color: "#333" },

  categoryButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryButtonText: { fontSize: 16 },
  arrow: { fontSize: 16, color: "#666" },
  categoryList: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginTop: 4,
  },
  categoryItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  categoryItemText: { fontSize: 16 },

  textInput: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },

  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addButton: {
    // Button component handles styling
  },

  exerciseCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  exerciseNumber: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 8,
  },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  exerciseField: { flex: 1, marginRight: 8 },
  fieldLabel: { fontSize: 12, color: "#666", marginBottom: 4 },

  typeButtons: { flexDirection: "row", flexWrap: "wrap" },
  typeButton: {
    backgroundColor: "#f8f8f8",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    flex: 1,
    alignItems: "center",
  },
  typeButtonSelected: { backgroundColor: "#007AFF" },
  typeButtonText: { fontSize: 12, color: "#666" },
  typeButtonTextSelected: { color: "white", fontWeight: "600" },

  smallInput: {
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
  },
  exerciseNotes: {
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    marginTop: 8,
    textAlignVertical: "top",
  },

  removeButton: {
    backgroundColor: "#ff4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  removeButtonText: { color: "white", fontSize: 12, fontWeight: "600" },

  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 20,
  },
  cancelButton: {
    backgroundColor: "#6c757d",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  createButton: {
    backgroundColor: "#28a745",
    flex: 1,
    marginRight: 8,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
  },
  startWorkout: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    flex: 1,
  },
  applyBasicButton: {
    backgroundColor: "#28a745",
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  applyBasicButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 12,
  },
  basicSetupSection: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  basicSetupSectionUnapplied: {
    backgroundColor: "#ffe0e0",
    borderRadius: 8,
    // Same padding as base - no dimension changes
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginTop: 4,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  loadPreviousButton: {
    backgroundColor: "#28a745",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  loadPreviousButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: "#ffc107",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
  exerciseActions: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  expandButton: {
    fontSize: 16,
    color: "#007AFF",
    marginRight: 8,
  },
  disabledButton: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  disabledText: {
    color: "#999",
  },
});
