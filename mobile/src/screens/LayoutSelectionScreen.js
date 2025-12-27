import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useApi } from '../ApiProvider';
import { showError } from '../utils/errorHandler';

const { width: screenWidth } = Dimensions.get('window');

export default function LayoutSelectionScreen({ navigation }) {
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { api } = useApi();

  useEffect(() => {
    fetchLayouts();
  }, []);

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/layouts');
      setLayouts(response.data.layouts || []);
    } catch (error) {
      showError(error, "Error", "Failed to load layouts");
    } finally {
      setLoading(false);
    }
  };

  const handleLayoutPress = (layout) => {
    // TODO: Navigate to layout detail screen where user can add spots
    navigation.navigate('Layout Detail', { layoutId: layout.id });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a Layout</Text>
      {layouts.length === 0 ? (
        <Text style={styles.emptyText}>No layouts available</Text>
      ) : (
        <FlatList
          data={layouts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.layoutItem}
              onPress={() => handleLayoutPress(item)}
            >
              <Image 
                source={{ uri: item.layoutImageUrl }} 
                style={styles.layoutImage}
                resizeMode="cover"
              />
              <Text style={styles.layoutName}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 32,
  },
  layoutItem: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    borderWidth: 2,
    borderColor: '#d0d0d0',
  },
  layoutImage: {
    width: '100%',
    height: screenWidth * 0.6,
    backgroundColor: '#f5f5f5',
  },
  layoutName: {
    fontSize: 18,
    fontWeight: '500',
    padding: 16,
    color: '#333',
  },
});

