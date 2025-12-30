import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useApi } from "../ApiProvider";
import { showError } from "../utils/errorHandler";
import {formatDate} from "../utils/stringUtils";
import axios from "axios";
import handleApiCall from "../utils/apiUtils";

export default function CategoryWorkoutsScreen({ navigation, route }) {
  const { category } = route.params;
  const [workouts, setWorkouts] = useState([]);
  const [progressData, setProgressData] = useState({});
  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(false);
  const [expandedWorkouts, setExpandedWorkouts] = useState(new Set());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [sharing, setSharing] = useState(false);
  const { api } = useApi();

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async (includeProgress = false) => {
    try {
      setLoading(true);
      let url = `/workouts/category/${category.id}`;
      if (includeProgress) {
        url += "?includeProgress=true";

        const params = new URLSearchParams();
        if (dateRange.startDate) {
          params.append("startDate", dateRange.startDate.toISOString());
        }
        if (dateRange.endDate) {
          params.append("endDate", dateRange.endDate.toISOString());
        }

        if (params.toString()) {
          url += `&${params.toString()}`;
        }
      }

      const res = await api.get(url);
      setWorkouts(res.data.workouts || []);
      setProgressData(res.data.progress || {});
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error("Error fetching workouts:", error);
      showError(error, "Error", "Failed to fetch workouts");
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkout = (workoutId) => {
    const newExpanded = new Set(expandedWorkouts);
    if (newExpanded.has(workoutId)) {
      newExpanded.delete(workoutId);
    } else {
      newExpanded.add(workoutId);
    }
    setExpandedWorkouts(newExpanded);
  };

  const fetchConversations = async () => {
    const data = await handleApiCall(
      () => api.get("/chat/conversations/summary"),
      null,
      "Error fetching conversations"
    );
    if (data) {
      setConversations(data);
    }
  };

  const handleShareWorkout = (workout) => {
    setSelectedWorkout(workout);
    fetchConversations();
    setShowShareModal(true);
  };

  const formatWorkoutAsText = (workout) => {
    let text = `💪 ${category.name} Workout\n\n`;
    
    if (workout.notes) {
      text += `${workout.notes}\n\n`;
    }

    workout.exercises?.forEach((exercise, index) => {
      text += `${index + 1}. ${exercise.name}`;
      if (exercise.type) {
        text += ` (${exercise.type})`;
      }
      text += `\n`;

      if (exercise.setsDetail && exercise.setsDetail.length > 0) {
        exercise.setsDetail.forEach((set, setIndex) => {
          const parts = [];
          if (set.value !== null && set.value !== undefined) {
            parts.push(`${set.value}${exercise.unit || ""}`);
          }
          if (set.reps !== null && set.reps !== undefined) {
            parts.push(`${set.reps} reps`);
          }
          if (set.restMinutes !== null && set.restMinutes !== undefined) {
            parts.push(`${set.restMinutes}min rest`);
          }
          if (parts.length > 0) {
            text += `   Set ${setIndex + 1}: ${parts.join(" × ")}\n`;
          }
        });
      }

      if (exercise.notes) {
        text += `   Note: ${exercise.notes}\n`;
      }
      text += `\n`;
    });

    return text.trim();
  };

  const shareToConversation = async (conversationId) => {
    if (!selectedWorkout) return;

    setSharing(true);
    try {
      const workoutText = formatWorkoutAsText(selectedWorkout);
      
      // Prepare structured workout data for importing
      const workoutData = {
        exercises: (selectedWorkout.exercises || []).map((ex, idx) => ({
          type: ex.type || "weight",
          name: ex.name || `Exercise ${idx + 1}`,
          unit: ex.unit || "",
          sets: ex.setsDetail ? ex.setsDetail.length : 1,
          reps: ex.setsDetail && ex.setsDetail.length > 0 && ex.setsDetail.every(
            (set) => set.reps === ex.setsDetail[0].reps
          )
            ? String(ex.setsDetail[0].reps)
            : "",
          weight: ex.setsDetail && ex.setsDetail.length > 0 && ex.setsDetail.every(
            (set) => set.value === ex.setsDetail[0].value
          )
            ? String(ex.setsDetail[0].value)
            : "",
          restMinutes: ex.setsDetail && ex.setsDetail.length > 0 && ex.setsDetail.every(
            (set) => set.restMinutes === ex.setsDetail[0].restMinutes
          )
            ? String(ex.setsDetail[0].restMinutes)
            : "",
          notes: ex.notes || "",
          order: idx + 1,
          setsDetail: ex.setsDetail || [{ order: 1, reps: 1, value: 0, restMinutes: 1 }],
        })),
        notes: selectedWorkout.notes || "",
      };
      
      await api.post(`/chat/conversations/${conversationId}/messages`, {
        content: workoutText,
        workoutData: workoutData,
      });

      Alert.alert("Success", "Workout shared successfully!");
      setShowShareModal(false);
      setSelectedWorkout(null);
    } catch (error) {
      console.error("Error sharing workout:", error);
      showError(error, "Error", "Failed to share workout");
    } finally {
      setSharing(false);
    }
  };

  const renderWorkout = ({ item: workout }) => {
    const isExpanded = expandedWorkouts.has(workout.id);

    return (
      <View style={styles.workoutCard}>
        <TouchableOpacity
          style={styles.workoutHeader}
          onPress={() => toggleWorkout(workout.id)}
        >
          <View style={styles.workoutHeaderContent}>
            <Text style={styles.workoutTitle}>
              {workout.exercises?.length || 0} Exercises
            </Text>
            <Text style={styles.workoutDate}>
              {new Date(workout.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.workoutHeaderActions}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={(e) => {
                e.stopPropagation();
                handleShareWorkout(workout);
              }}
            >
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
            <Text style={styles.expandIcon}>{isExpanded ? "▼" : "▶"}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.exercisesContainer}>
            {workout.exercises?.map((exercise, index) => (
              <View key={index} style={styles.exerciseItem}>
                <Text style={styles.exerciseName}>
                  {exercise.name || `Exercise ${index + 1}`}
                </Text>
                <Text style={styles.exerciseDetails}>
                  {exercise.type} • {exercise.setsDetail?.length || 0} sets
                </Text>
                {exercise.setsDetail && exercise.setsDetail.length > 0 && (
                  <Text style={styles.exerciseValue}>
                    {exercise.setsDetail
                      .map(set => `${set.value} ${exercise.unit || ""}`)
                      .join(", ")}
                  </Text>
                )}
                {exercise.notes && (
                  <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const DateRangeSelector = () => (
    <View style={styles.dateRangeContainer}>
      <Text style={styles.dateRangeTitle}>Filter by Date Range:</Text>
      <View style={styles.dateInputs}>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker("start")}
        >
          <Text style={styles.dateButtonText}>
            {dateRange.startDate
              ? dateRange.startDate.toLocaleDateString()
              : formatDate(workouts.at(-1)?.createdAt)}{" "}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker("end")}
        >
          <Text style={styles.dateButtonText}>
            {dateRange.endDate
              ? dateRange.endDate.toLocaleDateString()
              : formatDate(workouts[0]?.createdAt)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dateActions}>
        <TouchableOpacity
          style={styles.applyFilterButton}
          onPress={() => fetchWorkouts(true)}
        >
          <Text style={styles.applyFilterButtonText}>Apply Filter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.clearFilterButton}
          onPress={() => {
            setDateRange({ startDate: null, endDate: null });
            setShowDatePicker(false);
          }}
        >
          <Text style={styles.clearFilterButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading workouts...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{category.name}</Text>
      </View>

      <DateRangeSelector />

      {workouts.length > 0 && (
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => {
            const newShowChart = !showChart;
            setShowChart(newShowChart);
            if (newShowChart) {
              fetchWorkouts(true);
            }
          }}
        >
          <Text style={styles.toggleButtonText}>
            {showChart ? "Hide Charts" : "Show Progress"}
          </Text>
        </TouchableOpacity>
      )}

      {workouts.length > 0 && showChart && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Exercise Progress</Text>
          {Object.keys(progressData).length === 0 ? (
            <Text style={styles.noChartDataText}>
              No progress data available for the selected date range.
            </Text>
          ) : (
            Object.keys(progressData).map((exerciseKey) => {
              const exercise = progressData[exerciseKey];
              if (!exercise.progress || exercise.progress.length === 0)
                return null;

              const sortedProgress = [...exercise.progress];
              const chartData = {
                labels: sortedProgress.map((p, index) =>
                  index %
                    Math.max(1, Math.floor(sortedProgress.length / 4)) ===
                  0
                    ? new Date(p.date).toLocaleDateString()
                    : ""
                ),
                datasets: [
                  {
                    data: sortedProgress.map((p) => p.volume),
                    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                    strokeWidth: 2,
                  },
                ],
              };

              return (
                <View key={exerciseKey} style={styles.chartBox}>
                  <Text style={styles.chartExerciseName}>
                    {exercise.name} ({exercise.type})
                  </Text>
                  <LineChart
                    data={chartData}
                    width={Dimensions.get("window").width - 40}
                    height={220}
                    chartConfig={{
                      backgroundColor: "#fff",
                      backgroundGradientFrom: "#fff",
                      backgroundGradientTo: "#fff",
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      style: { borderRadius: 16 },
                      propsForDots: {
                        r: "4",
                        strokeWidth: "2",
                        stroke: "#007AFF",
                      },
                    }}
                    bezier
                    style={styles.chart}
                  />
                  <Text style={styles.chartSubtitle}>
                    Volume = Sets × Reps × Weight
                  </Text>
                </View>
              );
            })
          )}
        </View>
      )}

      {workouts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Let's create your first workout! 💪
          </Text>
          <TouchableOpacity
            style={styles.createFirstButton}
            onPress={() => {
              navigation.navigate("Create Workout", {
                categories: [category],
                initialCategoryId: category.id,
              });
            }}
          >
            <Text style={styles.createFirstButtonText}>
              Create First Workout
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={workouts}
          renderItem={renderWorkout}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.workoutsList}
          scrollEnabled={false}
          nestedScrollEnabled={true}
        />
      )}

      {showDatePicker && (
        <DateTimePicker
          value={
            showDatePicker === "start"
              ? dateRange.startDate || new Date()
              : dateRange.endDate || new Date()
          }
          mode="date"
          display="default"
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setDateRange((prev) => ({
                ...prev,
                [showDatePicker === "start" ? "startDate" : "endDate"]:
                  selectedDate,
              }));
            }
          }}
        />
      )}

      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share Workout</Text>
            <Text style={styles.modalSubtitle}>Select a conversation</Text>
            
            {conversations.length === 0 ? (
              <View style={styles.emptyConversations}>
                <Text style={styles.emptyText}>No conversations yet</Text>
                <TouchableOpacity
                  style={styles.newConversationButton}
                  onPress={() => {
                    setShowShareModal(false);
                    navigation.navigate("Conversations");
                  }}
                >
                  <Text style={styles.newConversationButtonText}>
                    Start a Conversation
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                renderItem={({ item: conversation }) => {
                  const participants = conversation.participants || [];
                  const usernames = participants
                    .map(p => p.user?.username)
                    .filter(Boolean)
                    .join(", ");
                  
                  return (
                    <TouchableOpacity
                      style={styles.conversationItem}
                      onPress={() => shareToConversation(conversation.id)}
                      disabled={sharing}
                    >
                      <Text style={styles.conversationName}>
                        {usernames || "Conversation"}
                      </Text>
                      {sharing && (
                        <ActivityIndicator size="small" color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowShareModal(false);
                setSelectedWorkout(null);
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  workoutCard: {
    backgroundColor: "white",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    overflow: "hidden",
  },
  workoutHeader: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  workoutHeaderContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  workoutHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginRight: 10,
  },
  workoutDate: {
    fontSize: 14,
    color: "#666",
  },
  expandIcon: {
    fontSize: 16,
    color: "#666",
  },
  exercisesContainer: {
    backgroundColor: "#f8f8f8",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  exerciseItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  exerciseItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  exerciseDetails: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  exerciseValue: {
    fontSize: 12,
    color: "#007AFF",
    marginBottom: 2,
  },
  exerciseNotes: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 20,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  createFirstButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createFirstButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 18,
    color: "#333",
    marginBottom: 20,
    fontWeight: "600",
    textAlign: "center",
  },

  // NEW STYLES FOR CHARTS AND DATE FILTERING
  dateRangeContainer: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  dateRangeTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  dateInputs: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dateButton: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    flex: 1,
    marginHorizontal: 4,
  },
  dateButtonText: {
    color: "#007AFF",
    textAlign: "center",
    fontWeight: "500",
  },
  dateActions: {
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
  applyFilterButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  applyFilterButtonText: {
    color: "white",
    fontWeight: "600",
  },
  clearFilterButton: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  clearFilterButtonText: {
    color: "white",
    fontWeight: "600",
  },
  toggleButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 10,
    alignSelf: "center",
  },
  toggleButtonText: {
    color: "white",
    fontWeight: "600",
  },
  chartContainer: {
    marginBottom: 20,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  chartExerciseName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  chartBox: {
    backgroundColor: "white",
    borderRadius: 8,
    marginBottom: 16,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartSubtitle: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },
  noChartDataText: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    fontStyle: "italic",
  },
  shareButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  shareButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "80%",
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  emptyConversations: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  newConversationButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  newConversationButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  conversationItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  conversationName: {
    fontSize: 16,
    color: "#333",
  },
  modalCloseButton: {
    marginTop: 16,
    padding: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
});
