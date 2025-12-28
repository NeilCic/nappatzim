import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useApi } from "../ApiProvider";
import { playSound, stopSound } from "../utils/soundUtils";
import { showError } from "../utils/errorHandler";

export default function WorkoutExecutionScreen({ navigation, route }) {
  const [workoutData, setWorkoutData] = useState(route.params.workoutData);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [completedExercises, setCompletedExercises] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0); // time left in seconds - rename
  const [isRunning, setIsRunning] = useState(false);
  const [currentSet, setCurrentSet] = useState(0);  // current set index - rename
  const [totalSets, setTotalSets] = useState(0);
  const intervalRef = useRef(null);
  const { api } = useApi();
  const soundRef = useRef();
  const scrollViewRef = useRef(null);

  const exercises = workoutData.exercises || [];
  const currentExercise = exercises[currentExerciseIndex];
  const isLastExercise = currentExerciseIndex === exercises.length - 1;

  const completionSound = require("../../assets/contador-385321.mp3");

  useEffect(() => {
    if (completedExercises.length === exercises.length) {
      handleCreateWorkout(workoutData);
    }
  }, [completedExercises]);

  useEffect(() => {
    if (currentExercise) {
      setTotalSets(currentExercise.setsDetail?.length || 1);
      setCurrentSet(0);
    }
  }, [currentExerciseIndex]);

  useEffect(() => {
    if (currentExercise && !isRunning) {
      const currentSetData = currentExercise.setsDetail?.[currentSet];
      setTimeLeft((currentSetData?.restMinutes || 0) * 60);
    }
  }, [currentExerciseIndex, currentSet]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (exercises.length === completedExercises.length) {
        setTimeLeft(0);
      }
    }

    return () => {
      clearInterval(intervalRef.current);
      stopSound(soundRef);
    };
  }, [isRunning, timeLeft]);

  const handleTimerComplete = () => {
    playSound(completionSound, soundRef);
    Alert.alert("Timer Complete!", "Time's up!", [
      { text: "OK", onPress: () => stopSound(soundRef) },
    ]);

    completeSet()
    toggleTimer();
  };

  const finishRestNow = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setTimeLeft(0);

    completeSet()
  };

  const completeSet = () => {
    if (currentSet + 1 < totalSets) {
      setCurrentSet((prev) => prev + 1);
    } else {
      setCompletedExercises([...completedExercises, currentExercise.name]);
      if (!isLastExercise) {
        setCurrentExerciseIndex((prev) => prev + 1);
      }
    }
  }

  const handleStopSound = () => {
    stopSound(soundRef);
  };

  const toggleTimer = () => {
    if (isLastExercise && currentSet === totalSets - 1) {
      finishRestNow();
    } else {
      setIsRunning(!isRunning);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getProgressColor = () => {
    if (timeLeft === 0) return "#4CAF50";
    if (timeLeft <= 10) return "#F44336";
    if (timeLeft <= 30) return "#FF9800";
    return "#2196F3";
  };

  const getExerciseStatus = (exercise, index) => {
    if (completedExercises.includes(exercise.name)) return "completed";
    if (index === currentExerciseIndex) return "current";
    return "pending";
  };

  const handleCreateWorkout = async (workoutData) => {
    try {
      const cleanData = {
        ...workoutData,
        exercises: workoutData.exercises.map((exercise) => {
          const {
            sets,
            basicWeight,
            basicRestMinutes,
            basicReps,
            ...clean
          } = exercise;
          return clean;
        }),
      };
      await api.post("/workouts", cleanData);
      Alert.alert("Success!", "The workout has been logged.");
    } catch (error) {
      showError(error, "Error", "Failed to create workout");
    }
  };

  const renderExerciseItem = (exercise, index) => {
    const status = getExerciseStatus(exercise, index);
    const isCompleted = status === "completed";
    const isCurrent = status === "current";

    return (
      <View
        style={[
          styles.exerciseItem,
          isCompleted && styles.completedExercise,
          isCurrent && styles.currentExercise,
        ]}
      >
        <View style={styles.exerciseStatus}>
          {isCompleted && <Text style={styles.statusIcon}>✓</Text>}
          {isCurrent && <Text style={styles.statusIcon}>🔄</Text>}
          {status === "pending" && <Text style={styles.statusIcon}>⏳</Text>}
        </View>
        <View style={styles.exerciseInfo}>
          <Text
            style={[
              styles.exerciseName,
              isCompleted && styles.completedText,
              isCurrent && styles.currentText,
            ]}
          >
            {exercise.name}
          </Text>
          <Text style={styles.exerciseDetails}>
            {exercise.setsDetail?.length || 0} sets
            {exercise.setsDetail?.length > 0 && (
              <>
                ×{" "}
                {exercise.setsDetail.reduce(
                  (sum, set) => sum + Number(set.reps || 0),
                  0
                )}{" "}
                total reps
              </>
            )}
          </Text>
        </View>
      </View>
    );
  };

  if (!currentExercise) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No Exercises Found</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const EditableStat = ({ label, field, suffix = '' }) => {
    const value = currentExercise.setsDetail?.[currentSet]?.[field] || 0;
    const [inputValue, setInputValue] = useState(String(value));
    const [isFocused, setIsFocused] = useState(false);
    const [selection, setSelection] = useState(null);
    const inputKey = `${currentExerciseIndex}-${currentSet}-${field}`;
    const inputRef = useRef(null);
    const hasSelectedOnThisFocus = useRef(false);

    useEffect(() => {
      if (!isFocused) {
        setInputValue(String(value));
        hasSelectedOnThisFocus.current = false;
        setSelection(null);
      }
    }, [value, inputKey, isFocused]);

    const handleChange = (newValue) => {
      const cleaned = newValue.replace(/[^0-9.]/g, '');
      setInputValue(cleaned);
      if (hasSelectedOnThisFocus.current) {
        setSelection(null);
        hasSelectedOnThisFocus.current = false;
      }
    };

    useEffect(() => {
      if (!isFocused) return;

      const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });

      return () => {
        keyboardDidShowListener.remove();
      };
    }, [isFocused]);

    const handleFocus = () => {
      setIsFocused(true);
      hasSelectedOnThisFocus.current = false;
      const numericOnly = inputValue.replace(/[^0-9.]/g, '');
      if (numericOnly !== inputValue) {
        setInputValue(numericOnly);
      }
      const valueToSelect = numericOnly || inputValue;
      const length = valueToSelect.length;
      
      if (length > 0) {
        setSelection({ start: 0, end: length });
        hasSelectedOnThisFocus.current = true;
      }
    };

    const handleBlur = () => {
      setIsFocused(false);
      
      const numericValue = parseFloat(inputValue) || 0;
      
      setWorkoutData(prev => {
        const newData = structuredClone(prev);
        newData.exercises[currentExerciseIndex].setsDetail[currentSet][field] = numericValue;
        return newData;
      });

      if (field === 'restMinutes' && !isRunning) {
        setTimeLeft(numericValue * 60);
      }

      // Update local value to show the parsed result (numeric only)
      setInputValue(String(numericValue));
    };

    return (
      <View style={styles.statItem}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statValueContainer}>
          <TextInput
            ref={inputRef}
            key={inputKey}
            style={styles.statValue}
            value={inputValue}
            selection={selection}
            onChangeText={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            keyboardType="numeric"
          />
          {suffix ? <Text style={styles.statSuffix}>{suffix}</Text> : null}
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.header}>
        <Text style={styles.title}>Workout Execution</Text>
        <Text style={styles.progress}>
          {currentExerciseIndex + 1} of {exercises.length}
        </Text>
      </View>

      <TouchableOpacity
        onPress={!isRunning && timeLeft === 0 ? handleStopSound : toggleTimer}
      >
        {/*clock functionality*/}
        <View style={styles.timerSection}>
          <View style={styles.timerDisplay}>
            <View
              style={[
                styles.timerCircle,
                {
                  borderColor:
                    !isRunning && timeLeft === 0
                      ? "#4CAF50"
                      : getProgressColor(),
                },
                isRunning && styles.timerCircleRunning,
              ]}
            >
              <Text
                style={[
                  styles.timerText,
                  {
                    color:
                      !isRunning && timeLeft === 0
                        ? "#4CAF50"
                        : getProgressColor(),
                  },
                ]}
              >
                {(() => {
                  if (timeLeft === 0) {
                    return "DONE";
                  } else if (!isRunning && isLastExercise && currentSet === totalSets - 1) {
                    return "FINISH";
                  } else {
                    return formatTime(timeLeft);
                  }
                })()}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {isRunning && timeLeft > 0 && (
        <TouchableOpacity
          style={[styles.timerButton, styles.resetButton]}
          onPress={finishRestNow}
        >
          <Text style={styles.timerButtonText}>Finish Rest</Text>
        </TouchableOpacity>
      )}

      <View style={styles.currentExerciseSection}>
        <Text style={styles.sectionTitle}>
          {exercises.length !== completedExercises.length
            ? "Current Exercise"
            : "Workout complete!"}
        </Text>
        <View style={styles.currentExerciseCard}>
          {exercises.length !== completedExercises.length ? (
            <>
              <Text style={styles.currentExerciseName}>
                {currentExercise.name}
              </Text>
              <View style={styles.setProgress}>
                <Text style={styles.setProgressText}>
                  Completed {currentSet} of {totalSets} sets
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${(currentSet / totalSets) * 100}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.exerciseStats}>
                <EditableStat label="Reps" field="reps" />
                <EditableStat label="Weight" field="value" suffix={currentExercise.unit} />
                <EditableStat label="Rest" field="restMinutes" suffix="m" />
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={styles.timerButton}
              onPress={() => handleCreateWorkout(workoutData)}
            >
              <Image
                source={require("../../assets/green-done.jpg")}
                style={styles.doneIcon}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.exerciseListSection}>
          <Text style={styles.sectionTitle}>Exercise Progress</Text>
          {exercises.map((exercise, index) => (
            <View key={exercise.id || index}>
              {renderExerciseItem(exercise, index)}
            </View>
          ))}
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  progress: {
    fontSize: 16,
    color: "#666",
    marginTop: 5,
  },
  timerSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  timerDisplay: {
    alignItems: "center",
    marginBottom: 20,
  },
  timerCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timerText: {
    fontSize: 36,
    fontWeight: "bold",
  },
  timerControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  timerButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  resetButton: {
    backgroundColor: "#F44336",
  },
  timerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  currentExerciseSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  currentExerciseCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentExerciseName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  exerciseStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
  },
  statValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  statSuffix: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#666",
  },
  completeButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  completeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  quickRestSection: {
    marginBottom: 20,
  },
  quickRestButton: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  quickRestButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  customTimerSection: {
    marginBottom: 20,
  },
  customInputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  inputGroup: {
    flex: 1,
    marginHorizontal: 5,
  },
  inputLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    textAlign: "center",
    fontSize: 16,
  },
  customStartButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  customStartText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#ccc",
    opacity: 0.5,
  },
  disabledText: {
    color: "#666",
  },
  exerciseListSection: {
    marginBottom: 20,
    paddingTop: 20,
  },
  exerciseItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  completedExercise: {
    backgroundColor: "#e8f5e8",
    borderColor: "#4CAF50",
  },
  currentExercise: {
    backgroundColor: "#fff3cd",
    borderColor: "#ffc107",
  },
  exerciseStatus: {
    width: 30,
    alignItems: "center",
  },
  statusIcon: {
    fontSize: 20,
  },
  exerciseInfo: {
    flex: 1,
    marginLeft: 10,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  completedText: {
    color: "#4CAF50",
  },
  currentText: {
    color: "#ffc107",
  },
  exerciseDetails: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  restInfo: {
    fontSize: 12,
    color: "#999",
  },
  timerCircleRunning: {
    backgroundColor: "#f0fff0",
  },
  setProgress: {
    marginBottom: 15,
  },
  setProgressText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 4,
  },
  doneIcon: {
    width: "100%",
    height: 150,
    resizeMode: "contain",
  },
});
