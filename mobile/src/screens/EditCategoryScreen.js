import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useApi } from '../ApiProvider';
import axios from 'axios';
import { showError } from '../utils/errorHandler';
import ColorPicker from '../components/ColorPicker';
import Button from '../components/Button';
import FormField from '../components/FormField';

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
      
      <FormField
        inputProps={{
          placeholder: "Category name",
          value: name,
          onChangeText: setName,
        }}
      />
      
      <ColorPicker
        selectedColor={color}
        onColorSelect={setColor}
      />
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Update Category" 
          onPress={handleUpdate}
          variant="primary"
          size="large"
          style={styles.button}
        />
        <Button 
          title="Cancel" 
          onPress={() => navigation.goBack()}
          variant="secondary"
          size="large"
          style={styles.button}
        />
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
  buttonContainer: { 
    gap: 12,
    marginTop: 20,
  },
  button: {
    width: '100%',
  },
});

