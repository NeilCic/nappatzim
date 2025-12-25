import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useApi } from '../ApiProvider';
import { showError } from '../utils/errorHandler';

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
      setLayouts(response.data || []);
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
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 12,
  },
  layoutName: {
    fontSize: 18,
    fontWeight: '500',
  },
});

