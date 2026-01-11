import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Dimensions, 
  ScrollView,
  FlatList
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useApi } from '../ApiProvider';
import { showError } from '../utils/errorHandler';
import StyledTextInput from '../components/StyledTextInput';
import LoadingScreen from '../components/LoadingScreen';
import { showErrorAlert, showSuccessAlert } from '../utils/alert';
import AppModal from '../components/Modal';
import Button from '../components/Button';
import Pressable from '../components/Pressable';
import Spinner from '../components/Spinner';
import ColorPicker from '../components/ColorPicker';

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
  const [creatingClimb, setCreatingClimb] = useState(false);
  const [newClimbGrade, setNewClimbGrade] = useState('');
  const [newClimbColor, setNewClimbColor] = useState('#FF6B6B');
  const [selectedClimb, setSelectedClimb] = useState(null);
  const [showClimbDetailModal, setShowClimbDetailModal] = useState(false);
  const [climbDetails, setClimbDetails] = useState(null);
  const [voteStatistics, setVoteStatistics] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [selectedVoteGrade, setSelectedVoteGrade] = useState('');
  const [submittingVote, setSubmittingVote] = useState(false);
  const [userHeight, setUserHeight] = useState(null);
  const [climbComments, setClimbComments] = useState([]);
  const [climbVideos, setClimbVideos] = useState([]);
  const [loadingClimbDetails, setLoadingClimbDetails] = useState(false);
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
            // Auto-play failed, user can manually play
          }
        }
      } else if (status === 'error') {
        const errorDetails = videoPlayer.error;
        
        if (!errorLoggedRef.current) {
          errorLoggedRef.current = true;  // todo need to make this mechanism more robust
        }
        
        if (!videoLoadTimeoutRef.current) {
          const errorMessage = errorDetails?.message || errorDetails?.localizedDescription || 'Failed to load video';
          setVideoError(errorMessage);
          setIsVideoLoaded(false);
        }
      }
    };
    
    // TODO: Refactor to use expo-video event handlers instead of polling (onLoadStart, onLoad, onError)
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
        setNewClimbGrade('');
        setNewClimbColor('#FF6B6B');
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
          // Image size calculation failed, use default
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
      showErrorAlert("Spot name is required");
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
    setSelectedSpot(spot);
    setShowSpotDetailModal(true);
  };

  const handleClimbPress = async (climb) => {
    setSelectedClimb(climb);
    setShowClimbDetailModal(true);
    await fetchClimbDetails(climb.id);
  };

  const fetchClimbDetails = async (climbId) => {
    setLoadingClimbDetails(true);
    try {
      const [climbRes, statisticsRes, myVoteRes, commentsRes, videosRes, userRes] = await Promise.all([
        api.get(`/climbs/${climbId}`),
        api.get(`/climbs/${climbId}/votes/statistics`),
        api.get(`/climbs/${climbId}/votes/me`).catch(() => ({ data: { vote: null } })),
        api.get(`/climbs/${climbId}/comments`),
        api.get(`/climbs/${climbId}/videos`),
        api.get('/auth/me').catch(() => ({ data: { height: null } })),
      ]);

      setClimbDetails(climbRes.data.climb);
      setVoteStatistics(statisticsRes.data.statistics);
      setMyVote(myVoteRes.data.vote || null);
      setSelectedVoteGrade(myVoteRes.data.vote?.grade || '');
      setUserHeight(userRes.data?.height || null);
      setClimbComments(commentsRes.data.comments || []);
      setClimbVideos(videosRes.data.videos || []);
    } catch (error) {
      showError(error, "Error", "Failed to load climb details");
    } finally {
      setLoadingClimbDetails(false);
    }
  };

  const getGradeOptions = (climbGrade, gradeSystem) => {  // todo we can make a util to handle grade options, conversions, etc.. (something already exists)
    if (!climbGrade) return [];

    if (gradeSystem === 'V-Scale' || gradeSystem === 'V-Scale Range') {
      const rangeMatch = climbGrade.match(/^V(\d+)-V(\d+)$/);
      const singleMatch = climbGrade.match(/^V(\d+)$/);

      if (rangeMatch) {
        // Range: V4-6 → allow V3, V4, V5, V6, V7
        const lower = parseInt(rangeMatch[1], 10);
        const upper = parseInt(rangeMatch[2], 10);
        const minGrade = Math.max(0, lower - 1); // One below lower bound, but not below 0
        const maxGrade = Math.min(17, upper + 1); // One above upper bound, but not above 17
        
        const options = [];
        for (let i = minGrade; i <= maxGrade; i++) {
          options.push(`V${i}`);
        }
        return options;
      } else if (singleMatch) {
        // Specific grade: V4 → allow V3, V4, V5
        const grade = parseInt(singleMatch[1], 10);
        const minGrade = Math.max(0, grade - 1); // One below, but not below 0
        const maxGrade = Math.min(17, grade + 1); // One above, but not above 17
        
        const options = [];
        for (let i = minGrade; i <= maxGrade; i++) {
          options.push(`V${i}`);
        }
        return options;
      }
      return [];
      } else if (gradeSystem === 'French') {
        const frenchMatch = climbGrade.match(/^([1-9])([a-c])(\+?)$/);
        if (frenchMatch) {
          const number = parseInt(frenchMatch[1], 10);
          const letter = frenchMatch[2];
          const hasPlus = frenchMatch[3] === '+';
          
          // Convert to numeric value: each number has 6 sub-grades (a, a+, b, b+, c, c+)
          // a=0, a+=1, b=2, b+=3, c=4, c+=5
          const letterIndex = ['a', 'b', 'c'].indexOf(letter);
          const letterValue = letterIndex * 2 + (hasPlus ? 1 : 0);
          const baseValue = (number - 1) * 6;
          const totalValue = baseValue + letterValue;
          
          // Allow ±2 ticks (2 sub-grades in each direction)
          const minValue = Math.max(0, totalValue - 2);
          const maxValue = Math.min(53, totalValue + 2); // 9c+ = 8*6 + 5 = 53
          
          const options = [];
          for (let value = minValue; value <= maxValue; value++) {
            const num = Math.floor(value / 6) + 1; // +1 because 1a starts at 0
            const letterVal = value % 6;
            const hasPlusLocal = letterVal % 2 === 1;
            const letterIndexLocal = Math.floor(letterVal / 2);
            const letterLocal = ['a', 'b', 'c'][letterIndexLocal];
            options.push(`${num}${letterLocal}${hasPlusLocal ? '+' : ''}`);
          }
          
          return options;
        }
        return [];
      }
    return [];
  };

  const handleSubmitVote = async () => {
    if (!selectedClimb || !selectedVoteGrade.trim()) {
      showErrorAlert("Please select a grade");
      return;
    }

    setSubmittingVote(true);
    try {
      await api.post(`/climbs/${selectedClimb.id}/votes`, {
        grade: selectedVoteGrade.trim(),
      });

      await fetchClimbDetails(selectedClimb.id);
      showSuccessAlert(myVote ? "Vote updated successfully!" : "Vote submitted successfully!");
    } catch (error) {
      showError(error, "Error", "Failed to submit vote");
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleDeleteVote = async () => {
    if (!selectedClimb || !myVote) return;

    setSubmittingVote(true);
    try {
      await api.delete(`/climbs/${selectedClimb.id}/votes`);

      // Refresh climb details
      await fetchClimbDetails(selectedClimb.id);
      showSuccessAlert("Vote removed successfully!");
    } catch (error) {
      showError(error, "Error", "Failed to delete vote");
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleCreateClimb = async () => {
    if (!selectedSpot || !layout) return;

    if (!newClimbGrade.trim()) {
      showErrorAlert("Grade is required");
      return;
    }

    if (!newClimbColor) {
      showErrorAlert("Color is required");
      return;
    }

    setCreatingClimb(true);
    try {
      await api.post(`/spots/${selectedSpot.id}/climbs`, {
        grade: newClimbGrade.trim(),
        gradeSystem: layout.gradeSystem,
        color: newClimbColor,
      });

      setNewClimbGrade('');
      setNewClimbColor('#FF6B6B');
      showSuccessAlert("Climb created successfully!");
      
      await fetchSpots();
      
      if (selectedSpot) {
        const response = await api.get(`/spots/${selectedSpot.id}`);
        if (response.data.spot) {
          setSelectedSpot(response.data.spot);
        }
      }
    } catch (error) {
      showError(error, "Error", "Failed to create climb");
    } finally {
      setCreatingClimb(false);
    }
  };


  if (loading || !layout) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <Pressable 
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
            
            // Extract climb colors (up to 4)
            const climbs = spot.climbs || [];
            const climbColors = climbs.slice(0, 4).map(climb => climb.color);
            const remainingCount = Math.max(0, climbs.length - 4);
            
            return (
              <Pressable
                key={spot.id}
                style={[
                  styles.spotMarker,
                  {
                    left: left,
                    top: top,
                  },
                ]}
                onPress={() => handleSpotPress(spot)}
              >
                {climbColors.length > 0 ? (
                  <View style={styles.climbColorsContainer}>
                    {climbColors.length === 1 ? (
                      <View style={[styles.climbColorSingle, { backgroundColor: climbColors[0] }]} />
                    ) : climbColors.length === 2 ? (
                      <View style={styles.climbColorsRow}>
                        <View style={[styles.climbColorHalf, { backgroundColor: climbColors[0] }]} />
                        <View style={[styles.climbColorHalf, { backgroundColor: climbColors[1] }]} />
                      </View>
                    ) : climbColors.length === 3 ? (
                      <View style={styles.climbColorsRow}>
                        <View style={[styles.climbColorThird, { backgroundColor: climbColors[0] }]} />
                        <View style={[styles.climbColorThird, { backgroundColor: climbColors[1] }]} />
                        <View style={[styles.climbColorThird, { backgroundColor: climbColors[2] }]} />
                      </View>
                    ) : (
                      <View style={styles.climbColorsGrid}>
                        <View style={[styles.climbColorQuarter, { backgroundColor: climbColors[0] }]} />
                        <View style={[styles.climbColorQuarter, { backgroundColor: climbColors[1] }]} />
                        <View style={[styles.climbColorQuarter, styles.climbColorBottom, { backgroundColor: climbColors[2] }]} />
                        <View style={[styles.climbColorQuarter, styles.climbColorBottom, { backgroundColor: climbColors[3] }]} />
                      </View>
                    )}
                    {remainingCount > 0 && (
                      <View style={styles.climbCountOverlay}>
                        <Text style={styles.climbCountText}>+{remainingCount}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[styles.climbColorSingle, styles.noClimbsMarker]} />
                )}
              </Pressable>
            );
          })}
        </Pressable>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.layoutName}>{layout.name}</Text>
        <View style={styles.layoutInfoRow}>
          <Text style={styles.spotsCount}>{spots.length} spot{spots.length !== 1 ? 's' : ''}</Text>
          <Text style={styles.gradeSystem}>Grade System: {layout.gradeSystem || 'V-Scale'}</Text>
        </View>
        <Text style={styles.instruction}>Tap on the map to add a new spot</Text>
      </View>

      <AppModal
        visible={showAddSpotModal}
        onClose={() => setShowAddSpotModal(false)}
        title="Add New Spot"
        style={[styles.modalContent, { paddingBottom: 12 }]}
      >
        <StyledTextInput
          style={styles.input}
          placeholder="Spot name *"
          value={newSpotData.name}
          onChangeText={(text) => setNewSpotData({ ...newSpotData, name: text })}
        />
        
        <StyledTextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description (optional)"
          value={newSpotData.description}
          onChangeText={(text) => setNewSpotData({ ...newSpotData, description: text })}
          multiline
          numberOfLines={3}
        />
        
        <View style={styles.buttonRow}>
          <Button
            title="Cancel"
            onPress={() => setShowAddSpotModal(false)}
            variant="secondary"
            size="medium"
            style={[styles.button, styles.cancelButton]}
          />
          
          <Button
            title="Create"
            onPress={handleCreateSpot}
            variant="primary"
            size="medium"
            style={[styles.button, styles.createButton]}
          />
        </View>
      </AppModal>

      <AppModal
        visible={showSpotDetailModal}
        onClose={() => {
          setShowSpotDetailModal(false);
          setSelectedSpot(null);
          setNewClimbGrade('');
          setNewClimbColor('#FF6B6B');
        }}
        style={[styles.modalContent, { paddingBottom: 12 }]}
      >
        <ScrollView 
          style={styles.spotDetailScroll}
          contentContainerStyle={styles.spotDetailScrollContent}
          showsVerticalScrollIndicator={true}
        >
          {selectedSpot && (
            <>
              <Text style={styles.modalTitle}>{selectedSpot.name}</Text>
              {selectedSpot.description && (
                <Text style={styles.spotDescription}>{selectedSpot.description}</Text>
              )}

              <View style={styles.climbsSection}>
                <Text style={styles.sectionTitle}>
                  Climbs ({(selectedSpot.climbs || []).length})
                </Text>

                {(selectedSpot.climbs || []).length > 0 ? (
                  <FlatList
                    data={selectedSpot.climbs || []}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.climbItem}
                        onPress={() => handleClimbPress(item)}
                      >
                        <View style={[styles.climbColorIndicator, { backgroundColor: item.color }]} />
                        <View style={styles.climbInfo}>
                          <Text style={styles.climbGrade}>{item.grade}</Text>
                          {item.length && (
                            <Text style={styles.climbLength}>{item.length}m</Text>
                          )}
                        </View>
                      </Pressable>
                    )}
                    scrollEnabled={false}
                  />
                ) : (
                  <Text style={styles.noClimbsText}>No climbs yet</Text>
                )}

                <View style={styles.addClimbSection}>
                  <Text style={styles.sectionTitle}>Add New Climb</Text>
                  <StyledTextInput
                    style={styles.input}
                    placeholder={`Grade (e.g., ${layout?.gradeSystem === 'V-Scale' ? 'V4' : layout?.gradeSystem === 'French' ? '6a+' : 'V4-6'})`}
                    value={newClimbGrade}
                    onChangeText={setNewClimbGrade}
                    autoCapitalize="characters"
                  />
                  <ColorPicker
                    selectedColor={newClimbColor}
                    onColorSelect={setNewClimbColor}
                  />
                  <Button
                    title="Add Climb"
                    onPress={handleCreateClimb}
                    disabled={creatingClimb}
                    loading={creatingClimb}
                    variant="primary"
                    size="medium"
                    style={[
                      styles.button,
                      styles.addButton,
                      creatingClimb && styles.buttonDisabled,
                    ]}
                  />
                </View>
              </View>
            </>
          )}

          <Button
            title="Close"
            onPress={() => {
              setShowSpotDetailModal(false);
              setSelectedSpot(null);
              setNewClimbGrade('');
              setNewClimbColor('#FF6B6B');
            }}
            variant="secondary"
            size="medium"
            style={[styles.button, styles.cancelButton]}
          />
        </ScrollView>
      </AppModal>

      <AppModal
        visible={showVideoPlayer}
        onClose={() => {
          setShowVideoPlayer(false);
          setSelectedVideo(null);
          setIsVideoLoaded(false);
          setVideoError(null);
        }}
        animationType="fade"
        dismissOnOverlayPress={false}
        overlayStyle={styles.videoPlayerOverlay}
        style={styles.videoPlayerContainer}
      >
            {selectedVideo && (
              <>
                <Pressable
                  style={styles.videoPlayerCloseButton}
                  onPress={() => {
                    setShowVideoPlayer(false);
                    setSelectedVideo(null);
                    setIsVideoLoaded(false);
                    setVideoError(null);
                  }}
                >
                  <Text style={styles.videoPlayerCloseText}>✕</Text>
                </Pressable>
                {videoError ? (
                  <View style={styles.videoErrorContainer}>
                    <Text style={styles.videoErrorText}>⚠️ Error loading video</Text>
                    <Text style={styles.videoErrorDetails}>{videoError}</Text>
                    <Button
                      title="Retry"
                      onPress={() => {
                        setVideoError(null);
                        setIsVideoLoaded(false);
                        errorLoggedRef.current = false;
                        if (videoPlayer && selectedVideo?.videoUrl) {
                          try {
                            videoPlayer.replace(selectedVideo.videoUrl);
                          } catch (error) {
                            setVideoError('Failed to retry loading video');
                          }
                        }
                      }}
                      variant="primary"
                      size="medium"
                      style={styles.videoRetryButton}
                    />
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
                          const errorMessage = error?.message || error?.localizedDescription || 'Failed to load video';
                          setVideoError(errorMessage);
                          setIsVideoLoaded(false);
                        }}
                      />
                    {!isVideoLoaded && !videoError && (
                      <View style={styles.videoLoadingContainer}>
                        <Spinner size="large" color="#fff" />
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
      </AppModal>

      {/* Climb Detail Modal */}
      <AppModal
        visible={showClimbDetailModal}
        onClose={() => {
          setShowClimbDetailModal(false);
          setSelectedClimb(null);
          setClimbDetails(null);
          setVoteStatistics(null);
          setMyVote(null);
          setSelectedVoteGrade('');
          setClimbComments([]);
          setClimbVideos([]);
        }}
        style={[styles.modalContent, { paddingBottom: 12 }]}
      >
        {loadingClimbDetails ? (
          <LoadingScreen />
        ) : selectedClimb && climbDetails ? (
          <ScrollView
            style={styles.climbDetailScroll}
            contentContainerStyle={styles.climbDetailScrollContent}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.climbHeader}>
              <View style={[styles.climbColorIndicatorLarge, { backgroundColor: climbDetails.color }]} />
              <View style={styles.climbHeaderInfo}>
                <Text style={styles.climbHeaderGrade}>{climbDetails.grade}</Text>
                {climbDetails.length && (
                  <Text style={styles.climbHeaderLength}>{climbDetails.length}m</Text>
                )}
              </View>
            </View>

            {/* Votes Section */}
            {voteStatistics && climbDetails && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Votes ({voteStatistics.totalVotes})</Text>
                
                {/* Statistics */}
                {voteStatistics.totalVotes > 0 && (
                  <View style={styles.statisticsContainer}>
                    {voteStatistics.averageGrade && (
                      <View style={styles.statisticRow}>
                        <Text style={styles.statisticLabel}>Average:</Text>
                        <Text style={styles.statisticValue}>{voteStatistics.averageGrade}</Text>
                      </View>
                    )}
                    
                    {/* Grade Distribution */}
                    {Object.keys(voteStatistics.gradeDistribution || {}).length > 0 && (
                      <View style={styles.gradeDistributionContainer}>
                        <Text style={styles.subsectionTitle}>Grade Distribution</Text>
                        {Object.entries(voteStatistics.gradeDistribution)
                          .sort((a, b) => b[1] - a[1])
                          .map(([grade, count]) => (
                            <View key={grade} style={styles.distributionRow}>
                              <Text style={styles.distributionGrade}>{grade}</Text>
                              <View style={styles.distributionBarContainer}>
                                <View 
                                  style={[
                                    styles.distributionBar, 
                                    { 
                                      width: `${(count / voteStatistics.totalVotes) * 100}%` 
                                    }
                                  ]} 
                                />
                              </View>
                              <Text style={styles.distributionCount}>{count}</Text>
                            </View>
                          ))}
                      </View>
                    )}

                    {/* Grade by Height Visualization */}
                    {voteStatistics.gradeByHeight && Object.keys(voteStatistics.gradeByHeight).length > 0 && (
                      <View style={styles.gradeByHeightContainer}>
                        <Text style={styles.subsectionTitle}>Votes by Height</Text>
                        <Text style={styles.legendDescription}>
                          Shows how different height groups voted for each grade
                        </Text>
                        {Object.entries(voteStatistics.gradeByHeight)
                          .sort((a, b) => {
                            // Sort by total votes (sum of all height categories)
                            const totalA = Object.values(a[1]).reduce((sum, val) => sum + val, 0);
                            const totalB = Object.values(b[1]).reduce((sum, val) => sum + val, 0);
                            return totalB - totalA;
                          })
                          .map(([grade, heightData]) => {
                            const total = heightData.short + heightData.average + heightData.tall + heightData.noHeight;
                            if (total === 0) return null;
                            
                            return (
                              <View key={grade} style={styles.gradeByHeightRow}>
                                <Text style={styles.gradeByHeightGrade}>{grade}</Text>
                                <View style={styles.gradeByHeightBarContainer}>
                                  {/* Stacked bar showing height breakdown */}
                                  {heightData.short > 0 && (
                                    <View 
                                      style={[
                                        styles.gradeByHeightSegment,
                                        styles.gradeByHeightShort,
                                        { width: `${(heightData.short / total) * 100}%` }
                                      ]} 
                                    />
                                  )}
                                  {heightData.average > 0 && (
                                    <View 
                                      style={[
                                        styles.gradeByHeightSegment,
                                        styles.gradeByHeightAverage,
                                        { width: `${(heightData.average / total) * 100}%` }
                                      ]} 
                                    />
                                  )}
                                  {heightData.tall > 0 && (
                                    <View 
                                      style={[
                                        styles.gradeByHeightSegment,
                                        styles.gradeByHeightTall,
                                        { width: `${(heightData.tall / total) * 100}%` }
                                      ]} 
                                    />
                                  )}
                                  {heightData.noHeight > 0 && (
                                    <View 
                                      style={[
                                        styles.gradeByHeightSegment,
                                        styles.gradeByHeightNoHeight,
                                        { width: `${(heightData.noHeight / total) * 100}%` }
                                      ]} 
                                    />
                                  )}
                                </View>
                                <Text style={styles.gradeByHeightCount}>{total}</Text>
                              </View>
                            );
                          })}
                        {/* Legend */}
                        <View style={styles.heightLegend}>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendColor, styles.gradeByHeightShort]} />
                            <Text style={styles.legendText}>Short (&lt;165cm)</Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendColor, styles.gradeByHeightAverage]} />
                            <Text style={styles.legendText}>Average (165-180cm)</Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendColor, styles.gradeByHeightTall]} />
                            <Text style={styles.legendText}>Tall (&gt;180cm)</Text>
                          </View>
                          {voteStatistics.heightBreakdown?.withoutHeight > 0 && (
                            <View style={styles.legendItem}>
                              <View style={[styles.legendColor, styles.gradeByHeightNoHeight]} />
                              <Text style={styles.legendText}>No height</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* User's Current Vote */}
                {myVote && (
                  <View style={styles.myVoteContainer}>
                    <Text style={styles.myVoteLabel}>Your Vote: <Text style={styles.myVoteGrade}>{myVote.grade}</Text></Text>
                    {myVote.height && (
                      <Text style={styles.myVoteHeight}>Height: {myVote.height}cm</Text>
                    )}
                  </View>
                )}

                {/* Vote Interface */}
                <View style={styles.voteInterfaceContainer}>
                  <Text style={styles.subsectionTitle}>
                    {myVote ? 'Update Your Vote' : 'Vote on Difficulty'}
                  </Text>
                  
                  {/* Grade Selection */}
                  <View style={styles.gradeSelectorContainer}>
                    <Text style={styles.gradeSelectorLabel}>Select Grade:</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.gradeOptionsScroll}
                      contentContainerStyle={styles.gradeOptionsContent}
                    >
                      {getGradeOptions(climbDetails.grade, climbDetails.gradeSystem).map((grade) => (
                        <Pressable
                          key={grade}
                          style={[
                            styles.gradeOptionButton,
                            selectedVoteGrade === grade && styles.gradeOptionButtonSelected,
                          ]}
                          onPress={() => setSelectedVoteGrade(grade)}
                        >
                          <Text
                            style={[
                              styles.gradeOptionText,
                              selectedVoteGrade === grade && styles.gradeOptionTextSelected,
                            ]}
                          >
                            {grade}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Height Info */}
                  {userHeight && (
                    <Text style={styles.heightInfo}>
                      Your height ({userHeight}cm) will be included with your vote
                    </Text>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.voteActionsContainer}>
                    {myVote ? (
                      <>
                        <Button
                          title="Update Vote"
                          onPress={handleSubmitVote}
                          disabled={submittingVote || !selectedVoteGrade.trim() || selectedVoteGrade === myVote.grade}
                          loading={submittingVote}
                          variant="primary"
                          size="medium"
                          style={[styles.button, styles.voteButton]}
                        />
                        <Button
                          title="Remove Vote"
                          onPress={handleDeleteVote}
                          disabled={submittingVote}
                          loading={submittingVote}
                          variant="secondary"
                          size="medium"
                          style={[styles.button, styles.deleteVoteButton]}
                        />
                      </>
                    ) : (
                      <Button
                        title="Submit Vote"
                        onPress={handleSubmitVote}
                        disabled={submittingVote || !selectedVoteGrade.trim()}
                        loading={submittingVote}
                        variant="primary"
                        size="medium"
                        style={[styles.button, styles.voteButton]}
                      />
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Comments Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Comments ({climbComments.length})</Text>
              {/* TODO: Add comments list and create comment form */}
            </View>

            {/* Videos Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Videos ({climbVideos.length})</Text>
              {/* TODO: Add videos list */}
            </View>

            <Button
              title="Close"
              onPress={() => {
                setShowClimbDetailModal(false);
                setSelectedClimb(null);
                setClimbDetails(null);
                setVoteStatistics(null);
                setMyVote(null);
                setSelectedVoteGrade('');
                setClimbComments([]);
                setClimbVideos([]);
              }}
              variant="secondary"
              size="medium"
              style={[styles.button, styles.cancelButton]}
            />
          </ScrollView>
        ) : null}
      </AppModal>
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
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  climbColorsContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  climbColorSingle: {
    width: '100%',
    height: '100%',
  },
  noClimbsMarker: {
    backgroundColor: '#ccc',
  },
  climbColorsRow: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  climbColorHalf: {
    width: '50%',
    height: '100%',
  },
  climbColorThird: {
    width: '33.333%',
    height: '100%',
  },
  climbColorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
  },
  climbColorQuarter: {
    width: '50%',
    height: '50%',
  },
  climbColorBottom: {
    marginTop: 0,
  },
  climbCountOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderTopLeftRadius: 4,
  },
  climbCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoContainer: {
    padding: 16,
  },
  layoutName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  layoutInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  spotsCount: {
    fontSize: 16,
    color: '#666',
  },
  gradeSystem: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
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
    minHeight: 300,
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
    maxHeight: '100%',
  },
  spotDetailScrollContent: {
    paddingBottom: 20,
  },
  spotDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  climbsSection: {
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  climbItem: {
    flexDirection: 'row',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  climbColorIndicator: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  climbInfo: {
    flex: 1,
  },
  climbGrade: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  climbLength: {
    fontSize: 14,
    color: '#666',
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
  noClimbsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  addClimbSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  addButton: {
    marginTop: 12,
  },
  climbDetailScroll: {
    maxHeight: '100%',
  },
  climbDetailScrollContent: {
    paddingBottom: 20,
  },
  climbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  climbColorIndicatorLarge: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 16,
    borderWidth: 3,
    borderColor: '#ddd',
  },
  climbHeaderInfo: {
    flex: 1,
  },
  climbHeaderGrade: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  climbHeaderLength: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  averageGrade: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    fontWeight: '500',
  },
  statisticsContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  statisticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statisticLabel: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
    fontWeight: '500',
  },
  statisticValue: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  gradeDistributionContainer: {
    marginTop: 12,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  distributionGrade: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    width: 50,
  },
  distributionBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  distributionBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 10,
  },
  distributionCount: {
    fontSize: 14,
    color: '#666',
    width: 30,
    textAlign: 'right',
  },
  myVoteContainer: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  myVoteLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  myVoteGrade: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  myVoteHeight: {
    fontSize: 14,
    color: '#666',
  },
  voteInterfaceContainer: {
    marginTop: 8,
  },
  gradeSelectorContainer: {
    marginBottom: 12,
  },
  gradeSelectorLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  gradeOptionsScroll: {
    maxHeight: 50,
  },
  gradeOptionsContent: {
    paddingRight: 8,
  },
  gradeOptionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gradeOptionButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#0051D5',
  },
  gradeOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  gradeOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  heightInfo: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  voteActionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  voteButton: {
    flex: 1,
  },
  deleteVoteButton: {
    flex: 1,
  },
  gradeByHeightContainer: {
    marginTop: 16,
  },
  gradeByHeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  gradeByHeightGrade: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    width: 50,
  },
  gradeByHeightBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    marginHorizontal: 8,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  gradeByHeightSegment: {
    height: '100%',
  },
  gradeByHeightShort: {
    backgroundColor: '#FF6B6B', // Red for short
  },
  gradeByHeightAverage: {
    backgroundColor: '#4ECDC4', // Teal for average
  },
  gradeByHeightTall: {
    backgroundColor: '#45B7D1', // Blue for tall
  },
  gradeByHeightNoHeight: {
    backgroundColor: '#95A5A6', // Gray for no height
  },
  gradeByHeightCount: {
    fontSize: 14,
    color: '#666',
    width: 30,
    textAlign: 'right',
  },
  heightLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  legendDescription: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
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

