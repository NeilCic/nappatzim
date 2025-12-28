import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Alert,
  FlatList
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
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
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [showSpotDetailModal, setShowSpotDetailModal] = useState(false);
  const [spotVideos, setSpotVideos] = useState([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoDescription, setNewVideoDescription] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const videoLoadTimeoutRef = useRef(null);
  const videoUnloadTimeoutRef = useRef(null);
  const errorLoggedRef = useRef(false);
  const hasAutoPlayedRef = useRef(false);
  const { api } = useApi();
  
  const videoPlayer = useVideoPlayer(selectedVideo?.videoUrl || '');
  
  useEffect(() => {
    if (!videoPlayer || !showVideoPlayer || !selectedVideo?.videoUrl) return;
    
    try {
      videoPlayer.replace(selectedVideo.videoUrl);
      setVideoError(null);
      setIsVideoLoaded(false);
      errorLoggedRef.current = false;
      hasAutoPlayedRef.current = false;
    } catch (error) {
      console.error('Error replacing video source:', error);
      setVideoError('Failed to load video source');
    }
  }, [selectedVideo?.videoUrl, videoPlayer, showVideoPlayer]);
  
  useEffect(() => {
    if (!videoPlayer || !showVideoPlayer || !selectedVideo) {
      errorLoggedRef.current = false;
      hasAutoPlayedRef.current = false;
      return;
    }
    
    const checkStatus = () => {
      if (!selectedVideo) return;
      
      const status = videoPlayer.status;
      
      if (status === 'readyToPlay') {
        setIsVideoLoaded(true);
        setVideoError(null);

        if (videoLoadTimeoutRef.current) {
          clearTimeout(videoLoadTimeoutRef.current);
          videoLoadTimeoutRef.current = null;
        }

        if (!hasAutoPlayedRef.current) {
          try {
            videoPlayer.play();
            hasAutoPlayedRef.current = true;
          } catch (error) {
            console.error('Error auto-playing video:', error);
          }
        }
      } else if (status === 'error') {
        const errorDetails = videoPlayer.error;
        
        // Only log error details once to avoid spam
        if (!errorLoggedRef.current) {
          console.error('Video player error:', errorDetails?.message || 'Unknown error');
          errorLoggedRef.current = true;  // todo need to make this mechanism more robust
        }
        
        if (!videoLoadTimeoutRef.current) {
          const errorMessage = errorDetails?.message || errorDetails?.localizedDescription || 'Failed to load video';
          setVideoError(errorMessage);
          setIsVideoLoaded(false);
        }
      }
    };
    
    // Check status periodically (every 500ms)
    const interval = setInterval(checkStatus, 500);
    
    return () => clearInterval(interval);
  }, [videoPlayer, showVideoPlayer, selectedVideo]);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (!showVideoPlayer) {
      if (videoPlayer) {
        videoPlayer.pause();
        if (videoUnloadTimeoutRef.current) {
          clearTimeout(videoUnloadTimeoutRef.current);
        }
        videoUnloadTimeoutRef.current = setTimeout(() => {
          if (videoPlayer && !showVideoPlayer) {
            videoUnloadTimeoutRef.current = null;
          }
        }, 30000);
      }
      setIsVideoLoaded(false);
      setVideoError(null);
      // Clear any pending load timeout
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current);
        videoLoadTimeoutRef.current = null;
      }
    } else {
      if (videoUnloadTimeoutRef.current) {
        clearTimeout(videoUnloadTimeoutRef.current);
        videoUnloadTimeoutRef.current = null;
      }
    }
  }, [showVideoPlayer, videoPlayer]);

  useEffect(() => {
    if (showVideoPlayer && selectedVideo && videoPlayer) {
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current);
        videoLoadTimeoutRef.current = null;
      }
      
      setVideoError(null);
      setIsVideoLoaded(false);
      errorLoggedRef.current = false;
      
      videoLoadTimeoutRef.current = setTimeout(() => {
        if (videoPlayer && videoPlayer.status !== 'readyToPlay') {
          console.warn('Video loading timeout after 10 seconds');
          setVideoError('Video is taking too long to load. Please check your internet connection and try again.');
        }
        videoLoadTimeoutRef.current = null;
      }, 10000);

      return () => {
        if (videoLoadTimeoutRef.current) {
          clearTimeout(videoLoadTimeoutRef.current);
          videoLoadTimeoutRef.current = null;
        }
      };
    }
  }, [showVideoPlayer, selectedVideo, videoPlayer]);

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
      return () => {
        setSelectedSpot(null);
        setShowSpotDetailModal(false);
        setSpotVideos([]);
        setNewVideoTitle('');
        setNewVideoDescription('');
        setShowVideoPlayer(false);
        setSelectedVideo(null);
      };
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

  const handleSpotPress = async (spot) => {
    setSelectedSpot(spot);
    setShowSpotDetailModal(true);
    await fetchSpotVideos(spot.id);
  };

  const fetchSpotVideos = async (spotId) => {
    try {
      const response = await api.get(`/layouts/spots/${spotId}/videos`);
      setSpotVideos(response.data.videos || []);
    } catch (error) {
      showError(error, "Error", "Failed to load videos");
    }
  };

  const requestVideoPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        "Permission Required",
        "We need access to your media library to upload videos."
      );
      return false;
    }
    return true;
  };

  const handlePickVideo = async () => {
    const hasPermission = await requestVideoPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        allowsEditing: false,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length === 1) {
        await uploadVideo(result.assets[0]);
      }
    } catch (error) {
      showError(error, "Error", "Failed to pick video");
    }
  };

  const uploadVideo = async (videoAsset) => {
    if (!selectedSpot) return;

    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('video', {
        uri: videoAsset.uri,
        type: videoAsset.mimeType || 'video/mp4',
        name: videoAsset.fileName || `video_${Date.now()}.mp4`,
      });
      formData.append('title', newVideoTitle || '');
      formData.append('description', newVideoDescription || '');

      await api.post(`/layouts/spots/${selectedSpot.id}/videos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Reset form and refresh videos
      setNewVideoTitle('');
      setNewVideoDescription('');
      await fetchSpotVideos(selectedSpot.id);
      Alert.alert("Success", "Video uploaded successfully!");
    } catch (error) {
      showError(error, "Error", "Failed to upload video");
    } finally {
      setUploadingVideo(false);
    }
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

      <Modal
        visible={showSpotDetailModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowSpotDetailModal(false);
          setSelectedSpot(null);
          setSpotVideos([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView 
              style={styles.spotDetailScroll}
              contentContainerStyle={styles.spotDetailScrollContent}
            >
              {selectedSpot && (
                <>
                  <Text style={styles.modalTitle}>{selectedSpot.name}</Text>
                  {selectedSpot.description && (
                    <Text style={styles.spotDescription}>{selectedSpot.description}</Text>
                  )}

                  <View style={styles.videosSection}>
                    <Text style={styles.sectionTitle}>
                      Videos ({spotVideos.length})
                    </Text>

                    {spotVideos.length > 0 ? (
                      <FlatList
                        data={spotVideos}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={styles.videoItem}
                            onPress={() => {
                              setSelectedVideo(item);
                              setShowVideoPlayer(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.thumbnailContainer}>
                              {item.thumbnailUrl ? (
                                <Image
                                  source={{ uri: item.thumbnailUrl }}
                                  style={styles.videoThumbnail}
                                />
                              ) : (
                                <View style={[styles.videoThumbnail, styles.thumbnailPlaceholder]}>
                                  <Text style={styles.thumbnailPlaceholderText}>📹</Text>
                                </View>
                              )}
                              <View style={styles.playIconOverlay}>
                                <Text style={styles.playIcon}>▶</Text>
                              </View>
                            </View>
                            <View style={styles.videoInfo}>
                              <Text style={styles.videoTitle}>
                                {item.title || 'Untitled Video'}
                              </Text>
                              {item.duration && (
                                <Text style={styles.videoDuration}>
                                  {Math.floor(item.duration)}s
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        )}
                        scrollEnabled={false}
                      />
                    ) : (
                      <Text style={styles.noVideosText}>No videos yet</Text>
                    )}

                    <View style={styles.addVideoSection}>
                      <Text style={styles.sectionTitle}>Add New Video</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Video title (optional)"
                        value={newVideoTitle}
                        onChangeText={setNewVideoTitle}
                      />
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Description (optional)"
                        value={newVideoDescription}
                        onChangeText={setNewVideoDescription}
                        multiline
                        numberOfLines={2}
                      />
                      <TouchableOpacity
                        style={[
                          styles.button,
                          styles.uploadButton,
                          uploadingVideo && styles.buttonDisabled,
                        ]}
                        onPress={handlePickVideo}
                        disabled={uploadingVideo}
                      >
                        {uploadingVideo ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.uploadButtonText}>
                            📹 Pick Video
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowSpotDetailModal(false);
                  setSelectedSpot(null);
                  setSpotVideos([]);
                  setNewVideoTitle('');
                  setNewVideoDescription('');
                }}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showVideoPlayer}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowVideoPlayer(false);
          setSelectedVideo(null);
          setIsVideoLoaded(false);
          setVideoError(null);
        }}
      >
        <View style={styles.videoPlayerOverlay}>
          <View style={styles.videoPlayerContainer}>
            {selectedVideo && (
              <>
                <TouchableOpacity
                  style={styles.videoPlayerCloseButton}
                  onPress={() => {
                    setShowVideoPlayer(false);
                    setSelectedVideo(null);
                    setIsVideoLoaded(false);
                    setVideoError(null);
                  }}
                >
                  <Text style={styles.videoPlayerCloseText}>✕</Text>
                </TouchableOpacity>
                {videoError ? (
                  <View style={styles.videoErrorContainer}>
                    <Text style={styles.videoErrorText}>⚠️ Error loading video</Text>
                    <Text style={styles.videoErrorDetails}>{videoError}</Text>
                    <TouchableOpacity
                      style={styles.videoRetryButton}
                      onPress={() => {
                        setVideoError(null);
                        setIsVideoLoaded(false);
                        errorLoggedRef.current = false;
                        if (videoPlayer && selectedVideo?.videoUrl) {
                          try {
                            videoPlayer.replace(selectedVideo.videoUrl);
                          } catch (error) {
                            console.error('Error retrying video:', error);
                            setVideoError('Failed to retry loading video');
                          }
                        }
                      }}
                    >
                      <Text style={styles.videoRetryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                      <VideoView
                        player={videoPlayer}
                        style={styles.videoPlayer}
                        nativeControls={true}
                        contentFit="contain"
                        fullscreenOptions={{ enterFullscreenButton: false }}
                        onLoadStart={() => {
                          setVideoError(null);
                        }}
                        onError={(error) => {
                          console.error('VideoView error:', error?.message || 'Failed to load video');
                          const errorMessage = error?.message || error?.localizedDescription || 'Failed to load video';
                          setVideoError(errorMessage);
                          setIsVideoLoaded(false);
                        }}
                      />
                    {!isVideoLoaded && !videoError && (
                      <View style={styles.videoLoadingContainer}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.videoLoadingText}>Loading video...</Text>
                        <Text style={styles.videoUrlText} numberOfLines={1}>
                          {selectedVideo.videoUrl}
                        </Text>
                      </View>
                    )}
                  </>
                )}
                <View style={styles.videoPlayerInfo}>
                  <Text style={styles.videoPlayerTitle}>
                    {selectedVideo.title || 'Untitled Video'}
                  </Text>
                  {selectedVideo.description && (
                    <Text style={styles.videoPlayerDescription}>
                      {selectedVideo.description}
                    </Text>
                  )}
                </View>
              </>
            )}
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
    paddingBottom: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
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
  spotDetailScroll: {
    flexGrow: 0,
  },
  spotDetailScrollContent: {
    flexGrow: 0,
    paddingBottom: 0,
  },
  spotDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  videosSection: {
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  videoItem: {
    flexDirection: 'row',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 12,
  },
  videoThumbnail: {
    width: 80,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  thumbnailPlaceholderText: {
    fontSize: 24,
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
  },
  playIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  videoDuration: {
    fontSize: 14,
    color: '#666',
  },
  noVideosText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  addVideoSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    marginTop: 12,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  videoPlayerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  videoPlayer: {
    width: '100%',
    height: '60%',
    maxHeight: 400,
  },
  videoPlayerCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerCloseText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  videoPlayerInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    width: '100%',
  },
  videoPlayerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  videoPlayerDescription: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
  videoLoadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
    zIndex: 5,
  },
  videoLoadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  videoUrlText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 10,
    opacity: 0.6,
    maxWidth: '90%',
  },
  videoErrorContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    borderRadius: 8,
    alignItems: 'center',
  },
  videoErrorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  videoErrorDetails: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 16,
  },
  videoRetryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  videoRetryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

