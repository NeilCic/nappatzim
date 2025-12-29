import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useApi } from '../ApiProvider';
import axios from 'axios';

const { width: screenWidth } = Dimensions.get("window");

// Helper function to calculate brightness of a color (0-255)
// Returns true if color is light (should use black text), false if dark (should use white text)
const isLightColor = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return false; // Default to dark (white text)
  
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  
  // Calculate relative luminance using the formula from WCAG
  // https://www.w3.org/WAI/GL/wiki/Relative_luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // If luminance is greater than 0.5, it's a light color (use black text)
  return luminance > 0.5;
};

export default function HomeScreen({ navigation, onLogout }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { api } = useApi();

  const fetchCategories = async () => {
    try {
      const res = await api.get("/categories");
      const categoriesWithCounts = res.data.map( category => ({
        ...category,
        workoutCount: category._count.workouts
      }));
      setCategories(categoriesWithCounts);
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error("Error fetching categories:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        await fetchCategories();
        setLoading(false);
      };
      loadData();
    }, [])
  );

  const startNewWorkout = () => {
    navigation.navigate("Create Workout", { categories });
  };

  const renderCategory = ({ item: category, index }) => {
    if (index === categories.length) {
      return (
        <TouchableOpacity
          style={styles.newCategoryCard}
          onPress={() =>
            navigation.navigate("Create Category", {
              onCategoryCreated: fetchCategories,
            })
          }
        >
          <Text style={styles.newCategoryIcon}>+</Text>
          <Text style={styles.newCategoryText}>New Category</Text>
        </TouchableOpacity>
      );
    }
    const cardColor = category.color || "#007AFF";
    const textColor = isLightColor(cardColor) ? "#000000" : "#FFFFFF";
    
    return (
      <View
        style={[
          styles.categoryCard,
          { backgroundColor: cardColor },
        ]}
      >
        <TouchableOpacity
          style={styles.categoryCardContent}
          onPress={() => {
            navigation.navigate("Category Workouts", { category });
          }}
        >
          <Text style={[styles.categoryName, { color: textColor }]}>{category.name}</Text>
          <Text style={[styles.categoryCount, { color: textColor, opacity: 0.8 }]}>
            {category.workoutCount} workouts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            navigation.navigate("Edit Category", {
              category,
              onCategoryUpdated: fetchCategories,
            });
          }}
        >
          <Text style={[styles.editButtonText, { color: textColor }]}>Edit</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topHalf}>

        <TouchableOpacity
          style={[styles.newWorkoutButton, categories.length === 0 && styles.disabledButton]}
          onPress={startNewWorkout}
          disabled={categories.length === 0}
        >
          <Text style={styles.buttonText}>+ New Workout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomHalf}>
        <Text style={styles.categoriesTitle}>Categories</Text>
        <FlatList
          data={[...categories, null]}
          renderItem={renderCategory}
          keyExtractor={(item, index) =>
            item ? item.id : `new-category-${index}`
          }
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
          decelerationRate="fast"
          snapToInterval={screenWidth * 0.35 + 15}
          snapToAlignment="start"
        />
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  topHalf: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  bottomHalf: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
    color: "#333",
  },
  newWorkoutButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 15,
    marginBottom: 20,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  previousWorkoutButton: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  previousWorkoutTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#333",
  },
  previousWorkoutDetails: {
    fontSize: 14,
    color: "#666",
  },
  noPreviousWorkout: {
    backgroundColor: "#f8f8f8",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
  },
  noPreviousText: {
    color: "#999",
    fontSize: 14,
  },
  categoriesTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  categoryCard: {
    backgroundColor: "white",
    width: screenWidth * 0.4,
    marginRight: 15,
    padding: 25,
    paddingBottom: 15,
    borderRadius: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  categoryCardContent: {
    flex: 1,
    alignItems: "center",
    width: "100%",
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  categoryCount: {
    fontSize: 12,
  },
  editButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  logoutButton: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 10,
  },
  logoutText: {
    color: "#007AFF",
    fontSize: 16,
  },
  newCategoryCard: {
    backgroundColor: "#f0f0f0",
    width: screenWidth * 0.4,
    marginRight: 15,
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  newCategoryIcon: {
    fontSize: 32,
    color: "#666",
    marginBottom: 8,
  },
  newCategoryText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  categoriesList: {
    paddingHorizontal: 20,
    paddingBottom: 30, // Extra padding to avoid Android navigation bar overlap
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#999',
  },
});
