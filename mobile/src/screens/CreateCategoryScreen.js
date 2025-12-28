import { useState } from 'react';
import { View, Text, Button, StyleSheet, ScrollView } from 'react-native';
import { useApi } from '../ApiProvider';
import axios from 'axios';
import { showError } from '../utils/errorHandler';
import StyledTextInput from '../components/StyledTextInput';
import ColorPicker from '../components/ColorPicker';

export default function CreateCategoryScreen({ navigation, route }) {
  const onCategoryCreated = route.params.onCategoryCreated;
  const [name, setName] = useState('');
  const [color, setColor] = useState(null);
  const { api } = useApi();

  const handleCreate = async () => {
    if (!name.trim()) {
      showError(new Error('Category name is required'), "Error", "Please enter a category name");
      return;
    }

    try {
      const res = await api.post('/categories', { 
        name: name.trim(), 
        color: color || undefined 
      });
      
      if (onCategoryCreated) {
        onCategoryCreated();
      }
      
      navigation.goBack();
    } catch (error) {
      if (axios.isCancel(error)) return;
      showError(error, "Error", "Failed to create category");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Create Category</Text>
      
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
          <Button title="Create Category" onPress={handleCreate} />
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