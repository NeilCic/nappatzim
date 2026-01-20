import { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Svg, { Polygon, Line, Circle, Text as SvgText } from "react-native-svg";
import { useApi } from "../ApiProvider";
import { getCurrentUserId } from "../utils/jwtUtils";
import handleApiCall from "../utils/apiUtils";
import { showError } from "../utils/errorHandler";
import Button from "../components/Button";
import LoadingScreen from "../components/LoadingScreen";
import FormField from "../components/FormField";
import Section from "../components/Section";
import RefreshableScrollView from "../components/RefreshableScrollView";
import { showSuccessAlert } from "../utils/alert";
import Pressable from "../components/Pressable";
import { Text } from "react-native";

export default function ProfileScreen({ navigation }) {
  const [username, setUsername] = useState("");
  const [height, setHeight] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const { api } = useApi();

  useEffect(() => {
    fetchCurrentUser();
    fetchInsights();
  }, []);

  const fetchCurrentUser = async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    const data = await handleApiCall(
      () => api.get(`/auth/me`),
      setLoading,
      "Error fetching user info"
    );

    if (data) {
      setUsername(data.username || "");
      setHeight(data.height ? String(data.height) : "");
    }
  };

  const fetchInsights = async () => {
    try {
      setLoadingInsights(true);
      const response = await api.get("/sessions/insights");
      setInsights(response.data);
    } catch (error) {
      // Silently fail - insights are optional
      console.error("Failed to fetch insights:", error);
      setInsights(null);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleRefreshInsights = async () => {
    try {
      setRefreshingInsights(true);
      await fetchInsights();
    } finally {
      setRefreshingInsights(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updateData = {
        username: username.trim() || undefined,
        height: height.trim() === "" ? null : parseFloat(height.trim()),
      };

      const res = await api.patch("/auth/profile", updateData);

      if (res.data) {
        setUsername(res.data.username || "");
        setHeight(res.data.height ? String(res.data.height) : "");
      }
      showSuccessAlert("Profile updated successfully");
    } catch (error) {
      showError(error, "Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const StyleRadarChart = ({ axes }) => {
    if (!axes || axes.length === 0) return null;

    const vertices = axes;
    const count = vertices.length;
    if (count === 0) return null;

    const size = 200;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.4;

    const angleStep = (2 * Math.PI) / count;
    const levelCount = 4; // number of concentric circles (excluding center)

    const basePoints = vertices.map((_, index) => {
      const angle = -Math.PI / 2 + index * angleStep; // start at top
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      return { x, y };
    });

    const valuePoints = vertices.map((v, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      const norm = Math.max(0, Math.min(1, v.normalizedValue || 0));
      const r = radius * norm;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      return { x, y };
    });

    const basePointsStr = basePoints.map((p) => `${p.x},${p.y}`).join(" ");
    const valuePointsStr = valuePoints.map((p) => `${p.x},${p.y}`).join(" ");

    return (
      <View style={styles.radarContainer}>
        <Svg width={size} height={size}>
          {/* Concentric circles */}
          {Array.from({ length: levelCount }).map((_, i) => {
            const r = radius * ((i + 1) / levelCount);
            return (
              <Circle
                key={`grid-${i}`}
                cx={centerX}
                cy={centerY}
                r={r}
                stroke="#D0D0D0"
                strokeWidth={1}
                fill="none"
              />
            );
          })}

          {/* Radial grid lines */}
          {basePoints.map((p, index) => (
            <Line
              key={`axis-${index}`}
              x1={centerX}
              y1={centerY}
              x2={p.x}
              y2={p.y}
              stroke="#D0D0D0"
              strokeWidth={1}
            />
          ))}

          {/* Value polygon */}
          <Polygon
            points={valuePointsStr}
            stroke="#E53935"
            strokeWidth={2}
            fill="rgba(229, 57, 53, 0.25)"
          />

          {/* Data points */}
          {valuePoints.map((p, index) => (
            <Circle
              key={`point-${index}`}
              cx={p.x}
              cy={p.y}
              r={3}
              fill="#E53935"
            />
          ))}

          {/* Axis labels */}
          {vertices.map((v, index) => {
            const angle = -Math.PI / 2 + index * angleStep;
            const labelRadius = radius * 1.1;
            const x = centerX + labelRadius * Math.cos(angle);
            const y = centerY + labelRadius * Math.sin(angle);
            return (
              <SvgText
                key={`label-${v.descriptor}`}
                x={x}
                y={y}
                fill="#333"
                fontSize={11}
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {v.descriptor}
              </SvgText>
            );
          })}
        </Svg>

        <Text style={styles.radarHint}>
          Radar shows your balance across top styles (closer to edge = stronger
          preference/success).
        </Text>
      </View>
    );
  };

  const renderProgressCard = () => {
    if (!insights || insights.hasEnoughData) return null;
    
    const sessionCount = insights.sessionCount || 0;
    const minSessions = insights.minSessionsRequired || 5;
    
    return (
      <Section>
        <Text style={styles.insightsTitle}>📊 Session Insights</Text>
        <Text style={styles.progressText}>
          Log {minSessions} sessions to unlock your climbing insights!
        </Text>
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>
            Progress: {sessionCount}/{minSessions} sessions
          </Text>
          <View style={styles.progressBarContainer}>
            {Array.from({ length: minSessions }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressBarSegment,
                  i < sessionCount ? styles.progressBarFilled : styles.progressBarEmpty,
                ]}
              />
            ))}
          </View>
        </View>
      </Section>
    );
  };

  const renderGradeProfile = () => {
    if (!insights?.gradeProfile) return null;
    
    const { gradeProfile } = insights;
    const zones = [
      { name: "Comfort Zone", grades: gradeProfile.comfortZone || [], color: "#4CAF50", icon: "✅" },
      { name: "Challenging", grades: gradeProfile.challengingZone || [], color: "#FF9800", icon: "⚡" },
      { name: "Project", grades: gradeProfile.projectZone || [], color: "#FF5722", icon: "🎯" },
      { name: "Too Hard", grades: gradeProfile.tooHard || [], color: "#F44336", icon: "💪" },
    ];

    return (
      <Section>
        <Text style={styles.insightsTitle}>📈 Grade Profile</Text>
        {zones.map((zone) => {
          if (zone.grades.length === 0) return null;
          return (
            <View key={zone.name} style={styles.zoneContainer}>
              <Text style={styles.zoneLabel}>
                {zone.icon} {zone.name}
              </Text>
              <View style={styles.gradeChipsContainer}>
                {zone.grades.map((gradeData) => {
                  const grade = typeof gradeData === 'string' ? gradeData : gradeData.grade;
                  const successRate = typeof gradeData === 'object' && gradeData.successRate 
                    ? gradeData.successRate 
                    : null;
                  return (
                    <View
                      key={grade}
                      style={[styles.gradeChip, { borderColor: zone.color }]}
                    >
                      <Text style={styles.gradeChipText}>{grade}</Text>
                      {successRate !== null && (
                        <Text style={[styles.gradeChipRate, { color: zone.color }]}>
                          {Math.round(successRate)}%
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
        {gradeProfile.idealProgressionGrade && (
          <View style={styles.progressionTip}>
            <Text style={styles.progressionTipText}>
              💡 Next: Try {gradeProfile.idealProgressionGrade} routes
            </Text>
          </View>
        )}
      </Section>
    );
  };

  const renderStyleAnalysis = () => {
    if (!insights?.styleAnalysis) return null;

    const { styleAnalysis } = insights;

    const radarAxes = (() => {
      const allStyles = [
        ...(styleAnalysis.strengths || []).map((s) => ({
          descriptor: s.descriptor,
          rawValue: s.successRate,
          type: "strength",
        })),
        ...(styleAnalysis.weaknesses || []).map((w) => ({
          descriptor: w.descriptor,
          rawValue: 100 - w.successRate,
          type: "weakness",
        })),
        ...(styleAnalysis.preferences || []).map((p) => ({
          descriptor: p.descriptor,
          rawValue: Math.min(p.totalRoutes * 10, 100),
          type: "preference",
        })),
      ];

      if (allStyles.length === 0) return null;

      const top = [...allStyles]
        .sort((a, b) => b.rawValue - a.rawValue)
        .slice(0, 5);

      const maxValue = top.reduce((max, s) => Math.max(max, s.rawValue), 0) || 1;

      return top.map((s) => ({
        ...s,
        normalizedValue: s.rawValue / maxValue,
      }));
    })();

    return (
      <Section>
        <Text style={styles.insightsTitle}>🎯 Style Analysis</Text>

        {radarAxes && <StyleRadarChart axes={radarAxes} />}

        {styleAnalysis.strengths && styleAnalysis.strengths.length > 0 && (
          <View style={styles.styleSection}>
            <Text style={styles.styleLabel}>💪 Strengths</Text>
            <View style={styles.descriptorChipsContainer}>
              {styleAnalysis.strengths.map((item) => (
                <View
                  key={item.descriptor}
                  style={[styles.descriptorChip, styles.strengthChip]}
                >
                  <Text style={styles.descriptorChipText}>{item.descriptor}</Text>
                  <Text style={styles.descriptorChipRate}>
                    {item.successRate}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {styleAnalysis.weaknesses && styleAnalysis.weaknesses.length > 0 && (
          <View style={styles.styleSection}>
            <Text style={styles.styleLabel}>🔧 Weaknesses</Text>
            <View style={styles.descriptorChipsContainer}>
              {styleAnalysis.weaknesses.map((item) => (
                <View
                  key={item.descriptor}
                  style={[styles.descriptorChip, styles.weaknessChip]}
                >
                  <Text style={styles.descriptorChipText}>{item.descriptor}</Text>
                  <Text style={styles.descriptorChipRate}>
                    {item.successRate}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {styleAnalysis.preferences && styleAnalysis.preferences.length > 0 && (
          <View style={styles.styleSection}>
            <Text style={styles.styleLabel}>❤️ Preferences</Text>
            <View style={styles.descriptorChipsContainer}>
              {styleAnalysis.preferences.slice(0, 5).map((item) => (
                <View key={item.descriptor} style={styles.descriptorChip}>
                  <Text style={styles.descriptorChipText}>
                    {item.descriptor}
                  </Text>
                  <Text style={styles.descriptorChipCount}>
                    {item.totalRoutes} routes
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Section>
    );
  };

  const renderRouteSuggestions = () => {
    if (!insights?.routeSuggestions) return null;
    
    const { routeSuggestions } = insights;
    const categories = [
      { key: "enjoyable", title: "Enjoyable Routes", icon: "😊" },
      { key: "improve", title: "Improve Your Skills", icon: "📈" },
      { key: "progression", title: "Push Your Limits", icon: "🚀" },
    ];

    const hasAnySuggestions = categories.some(
      (cat) => routeSuggestions[cat.key] && routeSuggestions[cat.key].length > 0
    );

    if (!hasAnySuggestions) {
      return (
        <Section>
          <Text style={styles.insightsTitle}>💡 Route Suggestions</Text>
          <Text style={styles.emptyText}>Keep climbing to get personalized route suggestions!</Text>
        </Section>
      );
    }

    return (
      <Section>
        <Text style={styles.insightsTitle}>💡 Route Suggestions</Text>
        {categories.map((category) => {
          const routes = routeSuggestions[category.key] || [];
          if (routes.length === 0) return null;

          return (
            <View key={category.key} style={styles.suggestionCategory}>
              <Text style={styles.suggestionCategoryTitle}>
                {category.icon} {category.title}
              </Text>
              {routes.map((route) => (
                <Pressable
                  key={route.id}
                  style={styles.routeCard}
                  onPress={() => navigation.navigate("Climb Detail", { climbId: route.id })}
                >
                  <View style={styles.routeCardContent}>
                    <Text style={styles.routeGrade}>
                      {route.voterGrade || route.grade}
                    </Text>
                    {route.descriptors && route.descriptors.length > 0 && (
                      <View style={styles.routeDescriptors}>
                        {route.descriptors.slice(0, 3).map((desc, idx) => (
                          <View key={idx} style={styles.routeDescriptorTag}>
                            <Text style={styles.routeDescriptorText}>{desc}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <Text style={styles.routeLocation}>
                      {route.layoutName || "Unknown Layout"} - {route.spotName || "Unknown Spot"}
                    </Text>
                  </View>
                  <Text style={styles.routeArrow}>→</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </Section>
    );
  };

  return (
    <RefreshableScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshing={refreshingInsights}
      onRefresh={handleRefreshInsights}
    >
      <Section>
        <FormField
          label="Username"
          description="Choose a username that others can use to find and message you"
          inputProps={{
            placeholder: "Enter username",
            value: username,
            onChangeText: setUsername,
            autoCapitalize: "none",
            autoCorrect: false,
            maxLength: 20,
          }}
        />
      </Section>

      <Section>
        <FormField
          label="Height"
          description="Your height (optional)"
          inputProps={{
            placeholder: "Height (cm)",
            value: height,
            onChangeText: setHeight,
            keyboardType: "numeric",
          }}
        />
      </Section>

      <Button
        title="Save All Changes"
        onPress={saveProfile}
        disabled={saving}
        loading={saving}
        variant="primary"
        size="large"
        style={styles.saveButton}
      />

      <Section>
        <Pressable
          style={styles.sessionsButton}
          onPress={() => navigation.navigate("Sessions")}
        >
          <Text style={styles.sessionsButtonText}>📊 View Climbing Sessions</Text>
          <Text style={styles.sessionsButtonSubtext}>Track your progress and view session history</Text>
        </Pressable>
      </Section>

      {/* Insights Section */}
      {loadingInsights ? (
        <Section>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </Section>
      ) : (
        <>
          {renderProgressCard()}
          {insights?.hasEnoughData && (
            <>
              {renderGradeProfile()}
              {renderStyleAnalysis()}
              {renderRouteSuggestions()}
            </>
          )}
        </>
      )}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    padding: 16,
  },
  saveButton: {
    marginTop: 0,
    marginBottom: 16,
  },
  inputMargin: {
    marginTop: 12,
  },
  sessionsButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  sessionsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  sessionsButtonSubtext: {
    fontSize: 14,
    color: "#666",
  },
  // Insights styles
  insightsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  // Progress card styles
  progressText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  progressBarContainer: {
    flexDirection: "row",
    gap: 4,
  },
  progressBarSegment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  progressBarFilled: {
    backgroundColor: "#4CAF50",
  },
  progressBarEmpty: {
    backgroundColor: "#E0E0E0",
  },
  // Grade profile styles
  zoneContainer: {
    marginBottom: 16,
  },
  zoneLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  gradeChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gradeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 2,
    gap: 6,
  },
  gradeChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  gradeChipRate: {
    fontSize: 12,
    fontWeight: "500",
  },
  progressionTip: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  progressionTipText: {
    fontSize: 14,
    color: "#1976D2",
    fontWeight: "500",
  },
  // Style analysis styles
  styleSection: {
    marginBottom: 16,
  },
  styleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  descriptorChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  descriptorChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
    gap: 6,
  },
  strengthChip: {
    backgroundColor: "#E8F5E9",
    borderColor: "#4CAF50",
  },
  weaknessChip: {
    backgroundColor: "#FFF3E0",
    borderColor: "#FF9800",
  },
  descriptorChipText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },
  descriptorChipRate: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600",
  },
  descriptorChipCount: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  radarContainer: {
    marginBottom: 16,
    alignItems: "center",
  },
  radarHint: {
    fontSize: 11,
    color: "#555",
    marginTop: 4,
    textAlign: "center",
  },
  // Route suggestions styles
  suggestionCategory: {
    marginBottom: 20,
  },
  suggestionCategoryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  routeCardContent: {
    flex: 1,
  },
  routeGrade: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  routeDescriptors: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  routeDescriptorTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
  },
  routeDescriptorText: {
    fontSize: 11,
    color: "#666",
  },
  routeLocation: {
    fontSize: 12,
    color: "#666",
  },
  routeArrow: {
    fontSize: 20,
    color: "#007AFF",
    marginLeft: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
});
