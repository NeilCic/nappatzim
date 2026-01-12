import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useApi } from '../ApiProvider';
import axios from 'axios';
import Button from '../components/Button';
import LoadingScreen from '../components/LoadingScreen';
import Pressable from '../components/Pressable';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated';

import { isLightColor } from '../utils/colorUtils';

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
      // Silently fail - categories might be empty
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
    navigation.navigate("Create Workout");
  };

  const AnimatedCard = ({ category, onPress }) => {
    const scale = useSharedValue(1);
    const cardColor = category.color || "#007AFF";
    const textColor = isLightColor(cardColor) ? "#000000" : "#FFFFFF";
    
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    };

    return (
      <Animated.View style={[styles.categoryCard, { backgroundColor: cardColor }, animatedStyle]}>
        <Pressable
          style={styles.categoryCardContent}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Text style={[styles.categoryName, { color: textColor }]}>{category.name}</Text>
          <Text style={[styles.categoryCount, { color: textColor, opacity: 0.8 }]}>
            {category.workoutCount} workouts
          </Text>
        </Pressable>
        <Button
          title="Edit"
          onPress={() => {
            navigation.navigate("Edit Category", {
              category,
              onCategoryUpdated: fetchCategories,
            });
          }}
          variant="text"
          size="small"
          style={styles.editButton}
          textStyle={[styles.editButtonText, { color: textColor }]}
        />
      </Animated.View>
    );
  };

  const renderCategory = ({ item: category, index }) => {
    if (index === categories.length) {
      return (
        <Pressable
          style={styles.newCategoryCard}
          onPress={() =>
            navigation.navigate("Create Category", {
              onCategoryCreated: fetchCategories,
            })
          }
        >
          <Text style={styles.newCategoryIcon}>+</Text>
          <Text style={styles.newCategoryText}>New Category</Text>
        </Pressable>
      );
    }
    
    return (
      <AnimatedCard
        category={category}
        onPress={() => {
          navigation.navigate("Category Workouts", { category });
        }}
      />
    );
  };

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <LinearGradient
      colors={['#F8F9FA', '#E8ECF0', '#F8F9FA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.topHalf}>
        <View style={styles.buttonWrapper}>
          <Button
            title="+ New Workout"
            onPress={startNewWorkout}
            disabled={categories.length === 0}
            variant="gradient"
            size="large"
            style={styles.newWorkoutButton}
          />
        </View>
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

      <Button
        title="Logout"
        onPress={onLogout}
        variant="text"
        size="small"
        style={styles.logoutButton}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  topHalf: {
    flex: 0.8, // Reduced from flex: 1 to give more space to bottomHalf
    padding: 20,
    paddingTop: 140,
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
  buttonWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  newWorkoutButton: {
    borderRadius: 15,
    marginBottom: 20,
    width: '100%',
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
    paddingBottom: 30,
  },
});
