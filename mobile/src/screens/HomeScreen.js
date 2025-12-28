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
    return (
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={() => {
          navigation.navigate("Category Workouts", { category });
        }}
      >
        <View
          style={[
            styles.categoryColor,
            { backgroundColor: category.color || "#007AFF" },
          ]}
        />
        <Text style={styles.categoryName}>{category.name}</Text>
        <Text style={styles.categoryCount}>
          {category.workoutCount} workouts
        </Text>
      </TouchableOpacity>
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
          snapToInterval={screenWidth * 0.4 + 15}
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
  categoriesList: {
    paddingHorizontal: 10,
  },
  categoryCard: {
    backgroundColor: "white",
    width: screenWidth * 0.4,
    marginRight: 15,
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  categoryColor: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#333",
  },
  categoryCount: {
    fontSize: 12,
    color: "#666",
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
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#999',
  },
});
