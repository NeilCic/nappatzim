import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useApi } from "../ApiProvider";
import ExerciseAdvancedModal from "../components/ExerciseAdvancedModal";

export default function CreateWorkoutScreen({ navigation, route }) {
  const { categories } = route.params || {};
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
  const { api } = useApi();

  const unitOptionsMap = {
    weight: ["kg", "g"],
    time: ["seconds", "minutes", "hours"],
    distance: ["km", "m"],
  };

  useEffect(() => {
    setExpandedExercises(new Set(exercises.map((_, i) => i)));
  }, [exercises]);

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
    setIsLoadingPrevious(true);
    try {
      const url = `/workouts/category/${categoryId}?limit=1&sortBy=createdAt&sortOrder=desc`;

      const res = await api.get(url);
      const workout = res.data?.workouts[0] || null;

      if (workout) {
        setNotes(workout.notes || "");
        setExercises(
          (workout.exercises || []).map((ex, idx) => ({
            type: ex.type || "weight",
            name:
              ex.name && ex.name.trim() !== ""
                ? ex.name
                : `Exercise ${idx + 1}`,
            unit: ex.unit || "",
            basicSets: ex.setsDetail ? ex.setsDetail.length : "",
            basicReps: ex.setsDetail.every(
              (set) => set.reps === ex.setsDetail[0].reps
            )
              ? String(ex.setsDetail[0].reps)
              : "adv",
            basicWeight: ex.setsDetail.every(
              (set) => set.value === ex.setsDetail[0].value
            )
              ? String(ex.setsDetail[0].value)
              : "adv",
            basicRestMinutes: ex.setsDetail.every(
              (set) => set.restMinutes === ex.setsDetail[0].restMinutes
            )
              ? String(ex.setsDetail[0].restMinutes)
              : "adv",
            notes: ex.notes || "",
            order: idx + 1,
            setsDetail: ex.setsDetail || [
              { order: 1, reps: 1, value: 0, restMinutes: 1 },
            ],
          }))
        );
        setHasLoadedPrevious(true);
      } else {
        Alert.alert(
          "No Previous Workout",
          "No previous workout found for this category."
        );
      }
    } catch (error) {
      console.error("Error fetching previous workout:", error);
      Alert.alert("Error", "Failed to load previous workout");
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
      console.error("Error checking for previous workout:", error);
      setHasPreviousWorkout(false);
    }
  };

  const addExercise = () => {
    handleDataChange();
    const newExercise = {
      type: "weight",
      name: `Exercise ${exercises.length + 1}`,
      unit: unitOptionsMap["weight"][0],
      notes: "",
      order: exercises.length + 1,
      basicSets: "1",
      basicReps: "1",
      basicWeight: "0",
      basicRestMinutes: "1",
      setsDetail: [{ order: 1, reps: 1, value: 0, restMinutes: 1 }],
    };
    setExercises([...exercises, newExercise]);
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
  };

  const applyBasicSetup = (index) => {
    handleDataChange();
    const exercise = exercises[index];
    if (!exercise.basicSets || !exercise.basicReps) {
      Alert.alert("Error", "Please enter both sets and reps");
      return;
    }

    const newSetsDetail = [];
    for (let i = 0; i < exercise.basicSets; i++) {
      newSetsDetail.push({
        order: i + 1,
        reps: exercise.basicReps,
        value: exercise.basicWeight || 0,
        restMinutes: exercise.basicRestMinutes || 0,
      });
    }

    updateExercise(index, "setsDetail", newSetsDetail);
  };

  const cleanExercises = (exercises) => {
    return exercises.map((exercise) => {
      const {
        basicReps,
        basicRestMinutes,
        basicSets,
        basicWeight,
        ...cleanExercise
      } = exercise;
      return cleanExercise;
    });
  };

  const handleCreateWorkout = async () => {
    if (!selectedCategoryId) {
      Alert.alert("Error", "Please select a category");
      return;
    }

    try {
      const workoutData = {
        categoryId: selectedCategoryId,
        notes: notes.trim() || undefined,
        exercises: exercises.length > 0 ? cleanExercises(exercises) : undefined,
      };

      await api.post("/workouts", workoutData);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to create workout: " + error.message);
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Create Workout</Text>
        <View style={styles.section}>
          <Text style={styles.label}>Category *</Text>
          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() => setShowCategoryList(!showCategoryList)}
          >
            <Text style={styles.categoryButtonText}>
              {selectedCategory
                ? selectedCategory.name
                : "Select a category..."}
            </Text>
            <Text style={styles.arrow}>{showCategoryList ? "▲" : "▼"}</Text>
          </TouchableOpacity>

          {showCategoryList && (
            <View style={styles.categoryList}>
              {categories.map((category) => (
                <TouchableOpacity
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
                      // Check for previous workout
                      checkForPreviousWorkout(category.id);
                    }
                  }}
                >
                  <Text style={styles.categoryItemText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {categories.length > 0 &&
          selectedCategoryId &&
          !hasLoadedPrevious &&
          hasPreviousWorkout && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.loadPreviousButton}
                onPress={() => fetchPreviousWorkout(selectedCategoryId)}
                disabled={isLoadingPrevious}
              >
                <Text style={styles.loadPreviousButtonText}>
                  {isLoadingPrevious ? "Loading..." : "Load Previous Workout"}
                </Text>
              </TouchableOpacity>
              {isLoadingPrevious && (
                <Text style={styles.loadingText}>
                  Loading previous workout...
                </Text>
              )}
            </View>
          )}

        {hasLoadedPrevious && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setNotes("");
                setExercises([]);
                setHasLoadedPrevious(false);
              }}
            >
              <Text style={styles.clearButtonText}>Start Fresh</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
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
            <TouchableOpacity style={styles.addButton} onPress={addExercise}>
              <Text style={styles.addButtonText}>+ Add Exercise</Text>
            </TouchableOpacity>
          </View>

          {exercises.map((exercise, index) => {
            const isExpanded = expandedExercises.has(index);
            return (
              <View key={index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <TextInput
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
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeExercise(index)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleExercise(index)}>
                      <Text style={styles.expandButton}>
                        {isExpanded ? "▼" : "▶"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {isExpanded && (
                  <>
                    <View style={styles.exerciseRow}>
                      <View style={styles.exerciseField}>
                        <Text style={styles.fieldLabel}>Type</Text>
                        <View style={styles.typeButtons}>
                          {["weight", "time", "distance"].map((type) => (
                            <TouchableOpacity
                              key={type}
                              style={[
                                styles.typeButton,
                                exercise.type === type &&
                                  styles.typeButtonSelected,
                              ]}
                              onPress={() =>
                                updateExercise(index, "type", type)
                              }
                            >
                              <Text
                                style={[
                                  styles.typeButtonText,
                                  exercise.type === type &&
                                    styles.typeButtonTextSelected,
                                ]}
                              >
                                {type.charAt(0).toUpperCase() + type.slice(1)}{" "}
                                {/* i have a util for this */}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>

                    <View style={styles.basicSetupSection}>
                      <Text style={styles.sectionTitle}>Basic Setup</Text>

                      <View style={styles.exerciseRow}>
                        <View style={styles.exerciseField}>
                          <Text style={styles.fieldLabel}>Sets</Text>
                          <TextInput
                            style={styles.smallInput}
                            value={exercise.basicSets} // todo get rid of basic sets, its just the number of sets, no basic/advanced
                            onChangeText={(value) =>
                              updateExercise(
                                index,
                                "basicSets",
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
                          <TextInput
                            style={styles.smallInput}
                            value={exercise.basicReps}
                            onChangeText={(value) =>
                              updateExercise(
                                index,
                                "basicReps",
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
                          <TextInput
                            style={styles.smallInput}
                            value={exercise.basicWeight}
                            onChangeText={(value) =>
                              updateExercise(
                                index,
                                "basicWeight",
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
                          <TextInput
                            style={styles.smallInput}
                            value={exercise.basicRestMinutes}
                            onChangeText={(value) =>
                              updateExercise(
                                index,
                                "basicRestMinutes",
                                String(value)
                              )
                            }
                            keyboardType="numeric"
                            placeholder={"2.5"}
                            selectTextOnFocus={true}
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.applyBasicButton}
                        onPress={() => applyBasicSetup(index)}
                      >
                        <Text style={styles.applyBasicButtonText}>
                          Apply Basic Setup
                        </Text>
                      </TouchableOpacity>
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
                            <TouchableOpacity
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
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>

                    <TextInput
                      style={styles.exerciseNotes}
                      value={exercise.notes}
                      onChangeText={(value) =>
                        updateExercise(index, "notes", value)
                      }
                      placeholder="Exercise notes..."
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.startWorkout, { marginTop: 12 }]}
                      onPress={() => openAdvancedForIndex(index)}
                    >
                      <Text style={[styles.buttonText]}>Advanced setup</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.startWorkout,
              exercises.length === 0 && styles.disabledButton,
            ]}
            onPress={() => {
              if (!selectedCategoryId || selectedCategoryId === "") {
                Alert.alert(
                  "Error",
                  "Please select a category before starting the workout"
                );
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
          >
            <Text
              style={[
                styles.buttonText,
                exercises.length === 0 && styles.disabledText,
              ]}
            >
              Start Workout
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.buttonContainer, { paddingBottom: 35 }]}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateWorkout}
          >
            <Text style={styles.buttonText}>Create Workout</Text>
          </TouchableOpacity>
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
            ex.basicSets = ex.setsDetail ? ex.setsDetail.length : "";
            ex.basicReps = ex.setsDetail.every(
              (set) => set.reps === ex.setsDetail[0].reps
            )
              ? String(ex.setsDetail[0].reps)
              : "adv";
            ex.basicWeight = ex.setsDetail.every(
              (set) => set.value === ex.setsDetail[0].value
            )
              ? String(ex.setsDetail[0].value)
              : "adv";
            ex.basicRestMinutes = ex.setsDetail.every(
              (set) => set.restMinutes === ex.setsDetail[0].restMinutes
            )
              ? String(ex.setsDetail[0].restMinutes)
              : "adv";
          });

          setExercises(updated);
          setShowAdvancedModal(false);
        }}
      />
    </KeyboardAvoidingView>
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
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: { color: "white", fontWeight: "600" },

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
    marginRight: 8,
  },
  createButton: {
    backgroundColor: "#28a745",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
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
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
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
});
