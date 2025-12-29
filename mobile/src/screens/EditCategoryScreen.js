import { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, ScrollView } from 'react-native';
import { useApi } from '../ApiProvider';
import axios from 'axios';
import { showError } from '../utils/errorHandler';
import StyledTextInput from '../components/StyledTextInput';
import ColorPicker from '../components/ColorPicker';

export default function EditCategoryScreen({ navigation, route }) {
  const { category, onCategoryUpdated } = route.params;
  const [name, setName] = useState(category.name || '');
  const [color, setColor] = useState(category.color || null);
  const { api } = useApi();

  useEffect(() => {
    setName(category.name || '');
    setColor(category.color || null);
  }, [category]);

  const handleUpdate = async () => {
    if (!name.trim() && !color) {
      showError(new Error('Please update at least one field'), "Error", "Please update the name or color");
      return;
    }

    try {
      const updateData = {};
      if (name.trim()) {
        updateData.name = name.trim();
      }
      if (color !== null) {
        updateData.color = color || undefined;
      }

      await api.put(`/categories/${category.id}`, updateData);
      
      if (onCategoryUpdated) {
        onCategoryUpdated();
      }
      
      navigation.goBack();
    } catch (error) {
      if (axios.isCancel(error)) return;
      showError(error, "Error", "Failed to update category");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Edit Category</Text>
      
      <StyledTextInput
        style={styles.input}
        placeholder="Category name"
        value={name}
        onChangeText={setName}
      />
      
      <ColorPicker
        selectedColor={color}
        onColorSelect={setColor}
      />
      
      <View style={styles.buttonContainer}>
        <View style={styles.buttonWrapper}>
          <Button title="Update Category" onPress={handleUpdate} />
        </View>
        <Button title="Cancel" onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: { 
    borderWidth: 1, 
    padding: 10, 
    marginBottom: 10, 
    borderRadius: 8,
    backgroundColor: 'white',
  },
  buttonContainer: { 
    gap: 12,
    marginTop: 20,
  },
  buttonWrapper: { 
    marginBottom: 12,
  },
});

