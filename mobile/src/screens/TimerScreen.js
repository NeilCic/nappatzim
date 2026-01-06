import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { playSound, stopSound } from "../utils/soundUtils";
import StyledTextInput from "../components/StyledTextInput";
import KeyboardAvoidingContainer from "../components/KeyboardAvoidingContainer";
import { showAlert, showErrorAlert } from "../utils/alert";
import Button from "../components/Button";

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
            showAlert("Timer Complete!", "Time's up!", [
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
      showErrorAlert("Please enter a valid time", "Invalid Time");
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
    <KeyboardAvoidingContainer
      style={styles.container}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Timer</Text>
          <View style={styles.timerTypeSelector}>
            <Button
              title="Countdown"
              onPress={() => setTimerType("countdown")}
              variant="text"
              size="medium"
              style={[
                styles.typeButton,
                timerType === "countdown" && styles.activeType,
              ]}
              textStyle={[
                styles.typeText,
                timerType === "countdown" && styles.activeTypeText,
              ]}
            />
            <Button
              title="Stopwatch"
              onPress={() => {
                setTimerType("stopwatch");
                setCustomMinutes(0);
                setCustomSeconds(0);
              }}
              variant="text"
              size="medium"
              style={[
                styles.typeButton,
                timerType === "stopwatch" && styles.activeType,
              ]}
              textStyle={[
                styles.typeText,
                timerType === "stopwatch" && styles.activeTypeText,
              ]}
            />
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
          <Button
            title="Start Custom Timer"
            onPress={startCustomTimer}
            disabled={isRunning}
            variant="primary"
            size="large"
            style={styles.customStartButton}
          />
        </View>

        <View style={styles.controlButtons}>
          <Button
            title={isRunning ? "Pause" : "Continue"}
            onPress={toggleTimer}
            disabled={!isRunning && !timeLeft}
            variant="primary"
            size="large"
            style={[styles.controlButton, styles.startButton]}
            textStyle={styles.controlButtonText}
          />
          <Button
            title="Reset"
            onPress={resetTimer}
            variant="primary"
            size="large"
            style={[styles.controlButton, styles.resetButton]}
            textStyle={styles.controlButtonText}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingContainer>
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
    // Button component handles styling
  },
  controlButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingBottom: 30,
  },
  controlButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  resetButton: {
    backgroundColor: "#F44336",
  },
  controlButtonText: {
    // Button component handles text styling, but we override color here
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
