import React from "react";
import { View, StyleSheet, Text } from "react-native";
import Svg, { Line, Circle, Path, Rect, Text as SvgText } from "react-native-svg";

export default function GradeProgressionChart({ progression, gradeSystem }) {
  if (!progression || progression.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Log more sessions to see your grade progression</Text>
      </View>
    );
  }

  // Filter out sessions without grade data
  const validSessions = progression.filter(
    (s) => s.averageGradeSentNumeric !== null || s.bestGradeSentNumeric !== null
  );

  if (validSessions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Log routes with grades to see progression</Text>
      </View>
    );
  }

  // Chart dimensions
  const width = 350;
  const height = 250;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate min/max for numeric grades
  const allNumericGrades = validSessions
    .flatMap((s) => [s.averageGradeSentNumeric, s.bestGradeSentNumeric])
    .filter((g) => g !== null);

  const minGrade = Math.floor(Math.min(...allNumericGrades));
  const maxGrade = Math.ceil(Math.max(...allNumericGrades));
  const gradeRange = maxGrade - minGrade || 1;

  // Normalize to chart coordinates
  const normalizeGrade = (grade) => {
    if (grade === null) return null;
    return padding.top + chartHeight - ((grade - minGrade) / gradeRange) * chartHeight;
  };

  const normalizeIndex = (index) => {
    return padding.left + (index / (validSessions.length - 1)) * chartWidth;
  };

  // Build data points for lines
  const averageGradePoints = validSessions
    .map((s, i) => {
      const x = normalizeIndex(i);
      const y = normalizeGrade(s.averageGradeSentNumeric);
      return y !== null ? { x, y, grade: s.averageGradeSent } : null;
    })
    .filter((p) => p !== null);

  const bestGradePoints = validSessions
    .map((s, i) => {
      const x = normalizeIndex(i);
      const y = normalizeGrade(s.bestGradeSentNumeric);
      return y !== null ? { x, y, grade: s.bestGradeSent } : null;
    })
    .filter((p) => p !== null);

  // Build send rate bars (as background area)
  const sendRatePoints = validSessions.map((s, i) => {
    const x = normalizeIndex(i);
    const barHeight = (s.sendRate / 100) * chartHeight;
    const y = padding.top + chartHeight - barHeight;
    return { x, y, height: barHeight, sendRate: s.sendRate };
  });

  // Format date for x-axis labels (show first, middle, last)
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Format grade for y-axis labels
  const formatGrade = (numeric) => {
    if (gradeSystem === "French") {
      // Simplified: just show numeric for now, could enhance later
      return `V${numeric}`;
    }
    return `V${numeric}`;
  };

  // Generate y-axis labels
  const yAxisSteps = 5;
  const yAxisLabels = Array.from({ length: yAxisSteps + 1 }, (_, i) => {
    const grade = minGrade + (gradeRange * i) / yAxisSteps;
    return {
      grade: Math.round(grade),
      y: normalizeGrade(grade),
    };
  });

  // Generate x-axis labels (show first, middle, last if enough points)
  const xAxisLabels = [];
  if (validSessions.length === 1) {
    xAxisLabels.push({ index: 0, date: formatDate(validSessions[0].date) });
  } else if (validSessions.length === 2) {
    xAxisLabels.push(
      { index: 0, date: formatDate(validSessions[0].date) },
      { index: 1, date: formatDate(validSessions[validSessions.length - 1].date) }
    );
  } else {
    xAxisLabels.push(
      { index: 0, date: formatDate(validSessions[0].date) },
      {
        index: Math.floor(validSessions.length / 2),
        date: formatDate(validSessions[Math.floor(validSessions.length / 2)].date),
      },
      {
        index: validSessions.length - 1,
        date: formatDate(validSessions[validSessions.length - 1].date),
      }
    );
  }

  // Build path strings for lines
  const buildPathString = (points) => {
    if (points.length === 0) return "";
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  };
  
  const averageGradePath = buildPathString(averageGradePoints);
  const bestGradePath = buildPathString(bestGradePoints);

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        {/* Grid lines (horizontal) */}
        {yAxisLabels.map((label, i) => (
          <Line
            key={`grid-y-${i}`}
            x1={padding.left}
            y1={label.y}
            x2={padding.left + chartWidth}
            y2={label.y}
            stroke="#E0E0E0"
            strokeWidth={1}
            strokeDasharray={i === yAxisSteps ? "0" : "2,2"}
          />
        ))}

        {/* Grid lines (vertical) */}
        {xAxisLabels.map((label, i) => {
          const x = normalizeIndex(label.index);
          return (
            <Line
              key={`grid-x-${i}`}
              x1={x}
              y1={padding.top}
              x2={x}
              y2={padding.top + chartHeight}
              stroke="#E0E0E0"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
          );
        })}

        {/* Send rate background bars (light fill) */}
        {sendRatePoints.map((p, i) => {
          const barWidth = chartWidth / validSessions.length;
          return (
            <Rect
              key={`sendrate-${i}`}
              x={p.x - barWidth / 2}
              y={p.y}
              width={barWidth}
              height={p.height}
              fill="rgba(76, 175, 80, 0.1)"
            />
          );
        })}

        {/* Average grade line (primary) */}
        {averageGradePoints.length > 0 && averageGradePath && (
          <>
            {averageGradePoints.length > 1 && (
              <Path
                d={averageGradePath}
                fill="none"
                stroke="#1976D2"
                strokeWidth={2.5}
              />
            )}
            {averageGradePoints.map((p, i) => (
              <Circle key={`avg-point-${i}`} cx={p.x} cy={p.y} r={4} fill="#1976D2" />
            ))}
          </>
        )}

        {/* Best grade line (secondary) */}
        {bestGradePoints.length > 0 && bestGradePath && (
          <>
            {bestGradePoints.length > 1 && (
              <Path
                d={bestGradePath}
                fill="none"
                stroke="#E53935"
                strokeWidth={2.5}
                strokeDasharray="5,3"
              />
            )}
            {bestGradePoints.map((p, i) => (
              <Circle key={`best-point-${i}`} cx={p.x} cy={p.y} r={4} fill="#E53935" />
            ))}
          </>
        )}

        {/* Y-axis labels */}
        {yAxisLabels.map((label, i) => (
          <SvgText
            key={`y-label-${i}`}
            x={padding.left - 10}
            y={label.y + 4}
            fill="#666"
            fontSize={11}
            textAnchor="end"
          >
            {formatGrade(label.grade)}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {xAxisLabels.map((label, i) => {
          const x = normalizeIndex(label.index);
          return (
            <SvgText
              key={`x-label-${i}`}
              x={x}
              y={height - padding.bottom + 20}
              fill="#666"
              fontSize={10}
              textAnchor="middle"
            >
              {label.date}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: "#1976D2" }]} />
          <Text style={styles.legendText}>Average Grade Sent</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.legendLineDashed, { borderColor: "#E53935" }]} />
          <Text style={styles.legendText}>Best Grade Sent</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBar, { backgroundColor: "rgba(76, 175, 80, 0.2)" }]} />
          <Text style={styles.legendText}>Send Rate (% routes sent)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  emptyText: {
    color: "#999",
    fontSize: 14,
    textAlign: "center",
    padding: 20,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    flexWrap: "wrap",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendLine: {
    width: 24,
    height: 3,
    borderRadius: 1,
  },
  legendLineDashed: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderStyle: "dashed",
    height: 0,
  },
  legendBar: {
    width: 24,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: "#666",
  },
});
