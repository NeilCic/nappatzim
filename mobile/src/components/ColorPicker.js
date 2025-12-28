import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const COLOR_PALETTE = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
  '#F8B739', // Orange
  '#52BE80', // Green
  '#EC7063', // Coral
  '#5DADE2', // Light Blue
  '#F1948A', // Pink
  '#73C6B6', // Turquoise
  '#F4D03F', // Gold
  '#AF7AC5', // Lavender
];

export default function ColorPicker({ selectedColor, onColorSelect }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Color (optional)</Text>
      <View style={styles.colorGrid}>
        {COLOR_PALETTE.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              selectedColor === color && styles.selectedColor,
            ]}
            onPress={() => onColorSelect(color)}
          >
            {selectedColor === color && (
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        {/* Option to clear selection */}
        <TouchableOpacity
          style={[
            styles.colorOption,
            styles.clearOption,
            !selectedColor && styles.selectedColor,
          ]}
          onPress={() => onColorSelect(null)}
        >
          {!selectedColor && (
            <View style={styles.checkmark}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
          <Text style={styles.clearText}>None</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearOption: {
    backgroundColor: '#f5f5f5',
    borderStyle: 'dashed',
  },
  clearText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
});

