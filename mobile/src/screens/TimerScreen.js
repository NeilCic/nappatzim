import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { playSound, stopSound } from "../utils/soundUtils";
import StyledTextInput from "../components/StyledTextInput";

const { width } = Dimensions.get("window");

// todo add laps functionality in stopwatch -> and probably can make up and log a workout out of such data
export default function TimerScreen() {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timerType, setTimerType] = useState("countdown"); // todo 'countdown' or 'stopwatch' enumify
  const [customMinutes, setCustomMinutes] = useState("");
  const [customSeconds, setCustomSeconds] = useState("");
  const soundRef = useRef();
  const intervalRef = useRef(null);

  const completionSound = require("../../assets/contador-385321.mp3");

  useEffect(() => {
    if (timerType === "countdown" && isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            playSound(completionSound, soundRef);
            Alert.alert("Timer Complete!", "Time's up!", [
              { text: "OK", onPress: () => stopSound(soundRef) },
            ]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerType === "stopwatch" && isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [isRunning, timeLeft]);

  useEffect(() => {
    return () => {
      stopSound(soundRef);
    };
  }, []);

  const startTimer = (seconds) => {
    setTimeLeft(seconds);
    setIsRunning(true);
  };

  const startCustomTimer = () => {
    const minutes = parseInt(customMinutes) || 0;
    const seconds = parseInt(customSeconds) || 0;
    const totalSeconds = minutes * 60 + seconds;

    if (timerType === "countdown" && totalSeconds <= 0) {
      Alert.alert("Invalid Time", "Please enter a valid time");
      return;
    }

    startTimer(totalSeconds);
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(0);
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Timer</Text>
          <View style={styles.timerTypeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                timerType === "countdown" && styles.activeType,
              ]}
              onPress={() => setTimerType("countdown")}
            >
              <Text
                style={[
                  styles.typeText,
                  timerType === "countdown" && styles.activeTypeText,
                ]}
              >
                Countdown
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                timerType === "stopwatch" && styles.activeType,
              ]}
              onPress={() => {
                setTimerType("stopwatch");
                setCustomMinutes(0);
                setCustomSeconds(0);
              }}
            >
              <Text
                style={[
                  styles.typeText,
                  timerType === "stopwatch" && styles.activeTypeText,
                ]}
              >
                Stopwatch
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.timerDisplay}>
          <View
            style={[styles.timerCircle, { borderColor: getProgressColor() }]}
          >
            <Text style={[styles.timerText, { color: getProgressColor() }]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        </View>

        <View style={styles.customTimerContainer}>
          <Text style={styles.sectionTitle}>Custom Timer</Text>
          <View style={styles.customInputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Minutes</Text>
              <StyledTextInput
                style={[
                  styles.input,
                  timerType === "stopwatch" && styles.disabledInput,
                ]}
                value={customMinutes}
                onChangeText={setCustomMinutes}
                keyboardType="numeric"
                placeholder="0"
                maxLength={2}
                editable={timerType !== "stopwatch"}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Seconds</Text>
              <StyledTextInput
                style={[
                  styles.input,
                  timerType === "stopwatch" && styles.disabledInput,
                ]}
                value={customSeconds}
                onChangeText={setCustomSeconds}
                keyboardType="numeric"
                placeholder="0"
                maxLength={2}
                editable={timerType !== "stopwatch"}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.customStartButton,
              isRunning && styles.disabledButton,
            ]}
            onPress={startCustomTimer}
            disabled={isRunning}
          >
            <Text
              style={[styles.customStartText, isRunning && styles.disabledText]}
            >
              Start Custom Timer
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              styles.startButton,
              !isRunning && !timeLeft && styles.disabledButton,
            ]}
            onPress={toggleTimer}
            disabled={!isRunning && !timeLeft}
          >
            <Text style={styles.controlButtonText}>
              {isRunning ? "Pause" : "Continue"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, styles.resetButton]}
            onPress={resetTimer}
          >
            <Text style={styles.controlButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  timerTypeSelector: {
    flexDirection: "row",
    backgroundColor: "#e0e0e0",
    borderRadius: 25,
    padding: 4,
  },
  typeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  activeType: {
    backgroundColor: "#007AFF",
  },
  typeText: {
    fontSize: 16,
    color: "#666",
  },
  activeTypeText: {
    color: "#fff",
    fontWeight: "bold",
  },
  timerDisplay: {
    alignItems: "center",
    marginBottom: 40,
  },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 8,
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
    fontSize: 48,
    fontWeight: "bold",
  },
  presetContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  presetButton: {
    width: (width - 60) / 2,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  presetText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
  },
  customTimerContainer: {
    marginBottom: 30,
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
  controlButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingBottom: 30,
  },
  controlButton: {
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
  controlButtonText: {
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
  disabledInput: {
    backgroundColor: "#f0f0f0",
    color: "#999",
    opacity: 0.6,
  },
  scrollContent: {
    paddingBottom: 100,
  },
});
