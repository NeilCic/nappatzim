import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Dimensions, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApi } from '../ApiProvider';
import { showError } from '../utils/errorHandler';

export default function LayoutDetailScreen({ navigation, route }) {
  const { layoutId } = route.params;
  const [layout, setLayout] = useState(null);
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [imageAspectRatio, setImageAspectRatio] = useState(null);
  const [showAddSpotModal, setShowAddSpotModal] = useState(false);
  const [newSpotData, setNewSpotData] = useState({ name: '', description: '', color: '#FF0000' });
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
  const { api } = useApi();

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    setImageDimensions({ width: 0, height: 0, x: 0, y: 0 });
  }, [screenDimensions.width, screenDimensions.height]);

  const calculatedImageDimensions = useMemo(() => {
    if (!imageAspectRatio) return {};
    
    const maxWidth = screenDimensions.width;
    const maxHeight = screenDimensions.height * 0.8; // Leave room for header/info
    
    let width = maxWidth;  // todo maybe get rid of let and use const
    let height = maxWidth / imageAspectRatio;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = maxHeight * imageAspectRatio;
    }
    
    return { width, height };
  }, [screenDimensions.width, screenDimensions.height, imageAspectRatio]);
  const effectiveImageDimensions = imageDimensions.width && imageDimensions.height
    ? imageDimensions
    : calculatedImageDimensions;
  

  useFocusEffect(
    useCallback(() => {
      fetchLayout();
      fetchSpots();
    }, [layoutId])
  );

  useEffect(() => {
    if (layout?.layoutImageUrl) {
      Image.getSize(
        layout.layoutImageUrl,
        (width, height) => {
          const aspectRatio = width / height;
          setImageAspectRatio(aspectRatio);
        },
        (error) => {
          console.error('Error getting image size:', error);
        }
      );
    }
  }, [layout]);

  const fetchLayout = async () => {
    try {
      const response = await api.get(`/layouts/${layoutId}`);
      setLayout(response.data.layout);
    } catch (error) {
      showError(error, "Error", "Failed to load layout");
    }
  };

  const fetchSpots = async () => {
    try {
      const response = await api.get(`/layouts/${layoutId}/spots`);
      setSpots(response.data.spots || []);
    } catch (error) {
      showError(error, "Error", "Failed to load spots");
    } finally {
      setLoading(false);
    }
  };


  const handleImageLayout = (event) => {
    const { width, height, x, y } = event.nativeEvent.layout;
    setImageDimensions({ width, height, x, y });
  };

  const handleImagePress = (event) => {
    const dims = effectiveImageDimensions;
    if (!dims.width || !dims.height) return;
    
    const { locationX, locationY } = event.nativeEvent;
    
    const xPercent = (locationX / dims.width) * 100;
    const yPercent = (locationY / dims.height) * 100;
    
    setTapPosition({ x: xPercent, y: yPercent });
    setShowAddSpotModal(true);
  };

  const handleCreateSpot = async () => {
    if (!newSpotData.name.trim()) {
      Alert.alert("Error", "Spot name is required");
      return;
    }

    try {
      await api.post(`/layouts/${layoutId}/spots`, {
        name: newSpotData.name,
        description: newSpotData.description || null,
        color: newSpotData.color,
        x: tapPosition.x,
        y: tapPosition.y,
        layoutId: layoutId,
      });
      
      setShowAddSpotModal(false);
      setNewSpotData({ name: '', description: '', color: '#FF0000' });
      fetchSpots();  // keeping this "extra" API call to ensure we get realtime updates instead of using the data we already have
    } catch (error) {
      showError(error, "Error", "Failed to create spot");
    }
  };

  const handleSpotPress = (spot) => {
    // TODO: Navigate to spot detail screen or show spot info
    Alert.alert(spot.name, spot.description || "No description");
  };

  if (loading || !layout) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <TouchableOpacity 
          activeOpacity={1}
          onPress={handleImagePress}
          style={styles.imageTouchable}
        >
          <Image
            source={{ uri: layout.layoutImageUrl }}
            style={[
              styles.layoutImage,
              calculatedImageDimensions,
            ]}
            resizeMode="contain"
            onLayout={handleImageLayout}
          />
          
          {/* Render spots as overlays */}
          {spots.map((spot) => {
            const imageLeft = (spot.x / 100) * effectiveImageDimensions.width;
            const imageTop = (spot.y / 100) * effectiveImageDimensions.height;
            
            const offsetX = imageDimensions.x || (screenDimensions.width - effectiveImageDimensions.width) / 2;
            const offsetY = imageDimensions.y || 0;
            
            const markerSize = 30;  // todo think of an acceptable size, standartize it and take it out to constants file
            const left = offsetX + imageLeft - (markerSize / 2);
            const top = offsetY + imageTop - (markerSize / 2);
            
            return (
              <TouchableOpacity
                key={spot.id}
                style={[
                  styles.spotMarker,
                  {
                    left: left,
                    top: top,
                    backgroundColor: spot.color || '#FF0000',
                  },
                ]}
                onPress={() => handleSpotPress(spot)}
              >
                <Text style={styles.spotMarkerText}>📍</Text>
              </TouchableOpacity>
            );
          })}
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.layoutName}>{layout.name}</Text>
        <Text style={styles.spotsCount}>{spots.length} spot{spots.length !== 1 ? 's' : ''}</Text>
        <Text style={styles.instruction}>Tap on the map to add a new spot</Text>
      </View>

      <Modal
        visible={showAddSpotModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddSpotModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Spot</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Spot name *"
              value={newSpotData.name}
              onChangeText={(text) => setNewSpotData({ ...newSpotData, name: text })}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              value={newSpotData.description}
              onChangeText={(text) => setNewSpotData({ ...newSpotData, description: text })}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowAddSpotModal(false)}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.createButton]}
                onPress={handleCreateSpot}
              >
                <Text style={[styles.buttonText, styles.createButtonText]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  imageContainer: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageTouchable: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  layoutImage: {
    minHeight: 200,
    alignSelf: 'center',
  },
  spotMarker: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  spotMarkerText: {
    fontSize: 16,
  },
  infoContainer: {
    padding: 16,
  },
  layoutName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  spotsCount: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  instruction: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#333',
  },
  createButtonText: {
    color: '#fff',
  },
});

