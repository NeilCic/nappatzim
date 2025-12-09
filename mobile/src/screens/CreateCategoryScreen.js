import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useApi } from '../ApiProvider';
import axios from 'axios';
import { showError } from '../utils/errorHandler';

export default function CreateCategoryScreen({ navigation, route }) {
  const onCategoryCreated = route.params.onCategoryCreated;
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const { api } = useApi();

  const handleCreate = async () => {
  try {
    const res = await api.post('/categories', { name, color });
    
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
    <View style={styles.container}>
      <Text style={styles.title}>Create Category</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Category name"
        value={name}
        onChangeText={setName}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Color (optional)"
        value={color}
        onChangeText={setColor}
      />
      
      <Button title="Create Category" onPress={handleCreate} />
      <Button title="Cancel" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, marginBottom: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10, borderRadius: 8 }
});