import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Dimensions, 
  ScrollView,
  FlatList,
  Switch,
  Alert,
  Pressable as RNPressable
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
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
import RefreshableScrollView from '../components/RefreshableScrollView';
import DESCRIPTORS from '../../../shared/descriptors';
import { VALIDATION } from '../shared/constants';
import {
  generateLocalSessionId,
  getActiveLocalSession,
  saveLocalSession,
  deleteLocalSession,
} from '../utils/localSessionStorage';
import { syncSingleSession } from '../utils/sessionSync';

// Floating scroll to bottom button component
const FloatingScrollButton = ({ onPress, visible }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    // Use withTiming for smooth opacity transitions (no spring bounce)
    // Only animate if the value actually needs to change
    if (visible && opacity.value !== 1) {
      opacity.value = withTiming(1, { duration: 200 });
    } else if (!visible && opacity.value !== 0) {
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, opacity]);

  const handlePressIn = () => {
    scale.value = withSpring(0.5, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View 
      style={[styles.scrollToBottomButton, animatedStyle]} 
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <RNPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.scrollToBottomButtonInner}
      >
        <Text style={styles.scrollToBottomIcon}>↓</Text>
      </RNPressable>
    </Animated.View>
  );
};

// Swipeable route item component for quick adding during active sessions
const SwipeableRouteItem = ({ item, onPress, onSwipeSuccess, onSwipeFailure, loggedClimbIds }) => {
  const translateX = useSharedValue(0);
  const SWIPE_THRESHOLD = 80; // Minimum distance to trigger action
  const MAX_SWIPE = 120; // Maximum swipe distance

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Only activate on horizontal movement
    .failOffsetY([-5, 5]) // Fail if vertical movement exceeds this
    .onUpdate((event) => {
      const swipeDistance = event.translationX;
      // Clamp swipe distance - only use X translation
      if (swipeDistance > 0) {
        // Swipe right (success)
        translateX.value = Math.min(swipeDistance, MAX_SWIPE);
      } else {
        // Swipe left (failure)
        translateX.value = Math.max(swipeDistance, -MAX_SWIPE);
      }
    })
    .onEnd((event) => {
      const swipeDistance = event.translationX;
      
      if (Math.abs(swipeDistance) > SWIPE_THRESHOLD) {
        if (swipeDistance > 0) {
          // Swipe right - success
          runOnJS(onSwipeSuccess)();
        } else {
          // Swipe left - failure
          runOnJS(onSwipeFailure)();
        }
        // Show success briefly then reset
        setTimeout(() => {
          translateX.value = withSpring(0);
        }, 300);
      } else {
        // Not enough swipe, spring back
        translateX.value = withSpring(0);
      }
    });

  const backgroundRightStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD, MAX_SWIPE],
      [0, 0.7, 1],
      Extrapolation.CLAMP
    );
    
    return {
      opacity: translateX.value > 0 ? opacity : 0,
      backgroundColor: '#4CAF50',
    };
  });

  const backgroundLeftStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD, MAX_SWIPE],
      [0, 0.7, 1],
      Extrapolation.CLAMP
    );
    
    return {
      opacity: translateX.value < 0 ? opacity : 0,
      backgroundColor: '#F44336',
    };
  });

  const itemStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const buttonBackgroundOpacity = useAnimatedStyle(() => {
    // Fade out gray background when swiping
    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD / 2, SWIPE_THRESHOLD],
      [1, 0.5, 0],
      Extrapolation.CLAMP
    );
    
    return {
      opacity: opacity,
    };
  });

  return (
    <View style={styles.swipeableContainer}>
      {/* Main item */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[itemStyle, { position: 'relative' }]}>
          <Animated.View style={[styles.listClimbItem, { position: 'relative', overflow: 'hidden' }]}>
            {/* Gray background layer that fades when swiping */}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#f5f5f5', borderRadius: 8 }, buttonBackgroundOpacity]} />
            
            {/* Background indicators */}
            <Animated.View style={[styles.swipeableBackground, styles.swipeableBackgroundRight, backgroundRightStyle]}>
              <Text style={styles.swipeableLabel}>✓ Success</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeableBackground, styles.swipeableBackgroundLeft, backgroundLeftStyle]}>
              <Text style={styles.swipeableLabel}>✗ Failure</Text>
            </Animated.View>
            
            <Pressable
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
              onPress={onPress}
            >
              <View style={[styles.listClimbColorIndicator, { backgroundColor: item.color }]} />
              <View style={styles.listClimbInfo}>
                <Text style={styles.listClimbGrade}>{item.grade}</Text>
                <Text style={styles.listClimbSpot}>{item.spotName}</Text>
                {item.length && (
                  <Text style={styles.listClimbLength}>{item.length}m</Text>
                )}
              </View>
              {loggedClimbIds.has(item.id) && (
                <Image 
                  source={require('../../assets/logbook.png')} 
                  style={styles.logbookIcon}
                  resizeMode="contain"
                />
              )}
            </Pressable>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default function LayoutDetailScreen({ navigation, route }) {
  const { layoutId } = route.params;
  const insets = useSafeAreaInsets();
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
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const videoLoadTimeoutRef = useRef(null);
  const videoUnloadTimeoutRef = useRef(null);
  const errorLoggedRef = useRef(false);
  const hasAutoPlayedRef = useRef(false);
  const { api } = useApi();
  
  // Session state (using LocalSession model)
  const [activeLocalSession, setActiveLocalSession] = useState(null);
  const [sessionRoutes, setSessionRoutes] = useState([]);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [selectedClimbForSession, setSelectedClimbForSession] = useState(null);
  const [quickAddStatus, setQuickAddStatus] = useState(true);
  const [quickAddAttempts, setQuickAddAttempts] = useState(1);
  const [addingRouteToSession, setAddingRouteToSession] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [editingRoutes, setEditingRoutes] = useState([]);
  const [savingSession, setSavingSession] = useState(false);
  const [loggedClimbIds, setLoggedClimbIds] = useState(new Set());
  
  // Filter state
  const [filters, setFilters] = useState({
    minProposedGrade: null,
    maxProposedGrade: null,
    minVoterGrade: null,
    maxVoterGrade: null,
    descriptors: [],
    setterName: null,
    hasVideo: null,
  });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
  const [matchingClimbCount, setMatchingClimbCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const scrollViewRef = useRef(null);
  
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
  

  const isInitialFilterSetRef = useRef(true);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const savedFilters = await AsyncStorage.getItem('routeFilters');
        if (savedFilters) {
          setFilters(JSON.parse(savedFilters));
        }
      } catch (error) {
        // Ignore errors loading filters
      }
    };
    loadFilters();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLayout();
      fetchSpots();
      fetchLoggedClimbIds();
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

  const fetchLoggedClimbIds = async () => {
    try {
      const response = await api.get('/sessions/logged-climbs');
      setLoggedClimbIds(new Set(response.data.climbIds || []));
    } catch (error) {
      // Ignore errors loading logged climbs
    }
  };

  useEffect(() => {
    if (!isInitialFilterSetRef.current) {
      const saveFilters = async () => {
        try {
          await AsyncStorage.setItem('routeFilters', JSON.stringify(filters));
        } catch (error) {
          // Ignore errors saving filters
        }
      };
      saveFilters();
    } else {
      isInitialFilterSetRef.current = false;
    }
    
    fetchSpots();
  }, [filters]);

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

  // Session management (using LocalSession)
  useFocusEffect(() => {
    const loadActiveSession = async () => {
      try {
        const localSession = await getActiveLocalSession();
        
        if (localSession) {
          setActiveLocalSession(localSession);
          // Convert LocalSession routes to format expected by UI
          setSessionRoutes(localSession.routes.map((route, index) => ({
            id: `local_route_${localSession.id}_${index}`,
            climbId: route.climbId,
            status: route.isSuccess ? 'success' : 'failure',
            attempts: route.attempts,
          })));
        } else {
          setActiveLocalSession(null);
          setSessionRoutes([]);
        }
      } catch (error) {
        console.error('Error loading active session:', error);
        setActiveLocalSession(null);
        setSessionRoutes([]);
      }
    };
    
    loadActiveSession();
  });

  const startSession = async () => {
    try {
      const localSessionId = generateLocalSessionId();
      const startTime = new Date().toISOString();
      
      const localSession = {
        id: localSessionId,
        startTime,
        endTime: null,
        notes: null,
        routes: [],
        status: 'active',
        serverSessionId: null,
      };
      
      await saveLocalSession(localSession);
      setActiveLocalSession(localSession);
      setSessionRoutes([]);
      showSuccessAlert('Session started!');
    } catch (error) {
      showError(error, 'Failed to start session');
    }
  };

  const endSession = async () => {
    if (!activeLocalSession) return;

    const confirmed = await new Promise((resolve) => {
      Alert.alert(
        'End Session?',
        'This will save your logged routes.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Review Session', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    setEditingRoutes(sessionRoutes.map(route => ({
      ...route,
      isSuccess: route.status === 'success',
    })));
    setSessionNotes(activeLocalSession.notes || '');
    setShowReviewModal(true);
  };

  const discardSession = async () => {
    if (!activeLocalSession) return;

    const confirmed = await new Promise((resolve) => {
      Alert.alert(
        'Discard Session?',
        'This will permanently delete your session and all logged routes. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Discard', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    // Delete LocalSession
    try {
      await deleteLocalSession(activeLocalSession.id);
    } catch (error) {
      console.error('Error deleting local session:', error);
    }

    // Clear state
    setActiveLocalSession(null);
    setSessionRoutes([]);
    showSuccessAlert('Session discarded');
  };

  const handleSaveSession = async () => {
    if (!activeLocalSession) return;

    // This shouldn't be possible (button is disabled), but safety check
    if (editingRoutes.length === 0) {
      setShowReviewModal(false);
      showErrorAlert('Cannot save session with no routes. Please log at least one route.');
      return;
    }

    setSavingSession(true);
    try {
      // Update routes based on editingRoutes
      const updatedRoutes = editingRoutes.map(route => ({
        climbId: route.climbId,
        isSuccess: route.isSuccess,
        attempts: route.attempts,
      }));

      // Update LocalSession: mark as completed with endTime and notes
      const endTime = new Date().toISOString();
      const updatedSession = {
        ...activeLocalSession,
        endTime,
        notes: sessionNotes.trim() || null,
        routes: updatedRoutes,
        status: 'completed', // Ready for sync
      };

      await saveLocalSession(updatedSession);

      // Clear state
      setActiveLocalSession(null);
      setSessionRoutes([]);
      setShowReviewModal(false);
      setSessionNotes('');
      setEditingRoutes([]);
      
      // Try to sync immediately (non-blocking)
      syncSingleSession(api, updatedSession.id).then((result) => {
        if (result.success) {
          showSuccessAlert('Session saved and synced!');
        } else {
          showSuccessAlert('Session saved! It will sync when you have internet connection.');
        }
      }).catch(() => {
        showSuccessAlert('Session saved! It will sync when you have internet connection.');
      });
    } catch (error) {
      showError(error, 'Failed to save session');
    } finally {
      setSavingSession(false);
    }
  };

  const updateEditingRoute = (routeId, updates) => {
    setEditingRoutes(prev => prev.map(route =>
      route.id === routeId ? { ...route, ...updates } : route
    ));
  };

  const addRouteToSessionHelper = async (climb, isSuccess, attempts = 1, showSuccess = false) => {
    if (!activeLocalSession || !climb) return false;

    const isDuplicate = sessionRoutes.some(
      route => route.climbId === climb.id
    );

    if (isDuplicate) {
      if (showSuccess) {
        showErrorAlert('This route is already in your session.');
      }
      return false; // Return false to indicate it's a duplicate
    }

    try {
      // Add route to LocalSession locally
      const newRoute = {
        climbId: climb.id,
        isSuccess,
        attempts,
      };

      const updatedRoutes = [...activeLocalSession.routes, newRoute];
      const updatedSession = {
        ...activeLocalSession,
        routes: updatedRoutes,
      };

      await saveLocalSession(updatedSession);
      setActiveLocalSession(updatedSession);
      
      // Update UI state
      const routeForUI = {
        id: `local_route_${activeLocalSession.id}_${updatedRoutes.length - 1}`,
        climbId: climb.id,
        status: isSuccess ? 'success' : 'failure',
        attempts,
      };
      setSessionRoutes([...sessionRoutes, routeForUI]);
      
      if (climb.id) {
        setLoggedClimbIds(prev => new Set([...prev, climb.id]));
      }
      
      if (showSuccess) {
        showSuccessAlert('Route added to session!');
      }
      
      return true;
    } catch (error) {
      showError(error, 'Failed to add route to session');
      return false;
    }
  };

  const addRouteToSession = async () => {
    if (!activeLocalSession || !selectedClimbForSession) return;

    setAddingRouteToSession(true);
    const success = await addRouteToSessionHelper(
      selectedClimbForSession,
      quickAddStatus,
      quickAddAttempts,
      true
    );

    if (success) {
      setShowQuickAddModal(false);
      setSelectedClimbForSession(null);
      setQuickAddStatus(true);
      setQuickAddAttempts(1);
    }
    
    setAddingRouteToSession(false);
  };

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
      const params = new URLSearchParams();
      if (filters.minProposedGrade) params.append('minProposedGrade', filters.minProposedGrade);
      if (filters.maxProposedGrade) params.append('maxProposedGrade', filters.maxProposedGrade);
      if (filters.minVoterGrade) params.append('minVoterGrade', filters.minVoterGrade);
      if (filters.maxVoterGrade) params.append('maxVoterGrade', filters.maxVoterGrade);
      if (filters.descriptors && filters.descriptors.length > 0) {
        filters.descriptors.forEach(desc => params.append('descriptors[]', desc));
      }
      if (filters.setterName) params.append('setterName', filters.setterName);
      if (filters.hasVideo !== null) params.append('hasVideo', filters.hasVideo.toString());
      
      const queryString = params.toString();
      const url = `/layouts/${layoutId}/spots${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      const spots = response.data.spots || [];
      setSpots(spots);
      
      // Count matching climbs
      const totalMatching = spots.reduce((sum, spot) => sum + (spot.climbs?.length || 0), 0);
      setMatchingClimbCount(totalMatching);
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
    const trimmedName = newSpotData.name.trim();
    
    if (!trimmedName) {
      showErrorAlert("Spot name is required");
      return;
    }

    if (trimmedName.length > VALIDATION.SPOT_NAME.MAX_LENGTH) {
      showErrorAlert(`Spot name must be ${VALIDATION.SPOT_NAME.MAX_LENGTH} characters or less`);
      return;
    }

    try {
      await api.post(`/layouts/${layoutId}/spots`, {
        name: trimmedName,
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
      // Handle uniqueness error specifically
      if (error.response?.status === 409) {
        showErrorAlert(error.response.data?.error || "A spot with this name already exists in this layout");
      } else {
        showError(error, "Error", "Failed to create spot");
      }
    }
  };

  const handleSpotPress = (spot) => {
    setSelectedSpot(spot);
    setShowSpotDetailModal(true);
  };

  const handleClimbPress = (climb) => {
    if (activeLocalSession) {
      setSelectedClimbForSession(climb);
      setShowQuickAddModal(true);
    } else {
      navigation.navigate('Route', { climbId: climb.id });
    }
  };

  const handleClearFilters = () => {
    setFilters({
      minProposedGrade: null,
      maxProposedGrade: null,
      minVoterGrade: null,
      maxVoterGrade: null,
      descriptors: [],
      setterName: null,
      hasVideo: null,
    });
  };

  const handleApplyFilters = () => {
    setShowFilterModal(false);
    // Filters will trigger fetchSpots via useFocusEffect dependency
  };

  const toggleDescriptor = (descriptor) => {
    setFilters(prev => {
      const current = prev.descriptors || [];
      const updated = current.includes(descriptor)
        ? current.filter(d => d !== descriptor)
        : [...current, descriptor];
      return { ...prev, descriptors: updated };
    });
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

  // Prepare list view data - MUST be before any early returns to avoid hooks order issues
  const listViewData = useMemo(() => {
    if (viewMode !== 'list') return [];
    const climbs = [];
    spots.forEach(spot => {
      (spot.climbs || []).forEach(climb => {
        climbs.push({
          ...climb,
          spotName: spot.name,
          spotId: spot.id,
        });
      });
    });
    return climbs;
  }, [spots, viewMode]);

  const hasActiveFilters = useMemo(() => {
    return filters.minProposedGrade || filters.maxProposedGrade || 
      filters.minVoterGrade || filters.maxVoterGrade || 
      (filters.descriptors && filters.descriptors.length > 0) || 
      filters.setterName || filters.hasVideo !== null;
  }, [filters.minProposedGrade, filters.maxProposedGrade, filters.minVoterGrade, filters.maxVoterGrade, filters.descriptors, filters.setterName, filters.hasVideo]);

  const activeFilterCount = useMemo(() => {
    return [
      filters.minProposedGrade || filters.maxProposedGrade,
      filters.minVoterGrade || filters.maxVoterGrade,
      filters.descriptors?.length > 0,
      filters.setterName,
      filters.hasVideo !== null,
    ].filter(Boolean).length;
  }, [filters.minProposedGrade, filters.maxProposedGrade, filters.minVoterGrade, filters.maxVoterGrade, filters.descriptors, filters.setterName, filters.hasVideo]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        fetchLayout(),
        fetchSpots(),
        fetchLoggedClimbIds(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || !layout) {
    return <LoadingScreen />;
  }

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20; // Threshold for "at bottom" detection
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    setIsAtBottom(isNearBottom);
  };

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <RefreshableScrollView
        ref={scrollViewRef}
        style={styles.container}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
      {viewMode === 'map' ? (
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
            
            // Extract climb colors (up to 4) - filtered climbs are already filtered by backend
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
                ) : hasActiveFilters ? (
                  // Show no-match icon/color when filters are active and no climbs match
                  layout?.noMatchColor ? (
                    <View style={[styles.climbColorSingle, { backgroundColor: layout.noMatchColor }]} />
                  ) : (
                    <Image 
                      source={require('../../assets/not-found.png')} 
                      style={styles.noMatchIcon}
                      resizeMode="contain"
                    />
                  )
                ) : (
                  <View style={[styles.climbColorSingle, styles.noClimbsMarker]} />
                )}
              </Pressable>
            );
          })}
        </Pressable>
      </View>
      ) : (
        <View style={styles.listContainer}>
          {listViewData.length > 0 ? (
            <FlatList
              data={listViewData}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                // Only enable swipe when session is active and route isn't already logged
                if (!activeLocalSession || loggedClimbIds.has(item.id)) {
                  return (
                    <Pressable
                      style={styles.listClimbItem}
                      onPress={() => handleClimbPress(item)}
                    >
                      <View style={[styles.listClimbColorIndicator, { backgroundColor: item.color }]} />
                      <View style={styles.listClimbInfo}>
                        <Text style={styles.listClimbGrade}>{item.grade}</Text>
                        <Text style={styles.listClimbSpot}>{item.spotName}</Text>
                        {item.length && (
                          <Text style={styles.listClimbLength}>{item.length}m</Text>
                        )}
                      </View>
                      {loggedClimbIds.has(item.id) && (
                        <Image 
                          source={require('../../assets/logbook.png')} 
                          style={styles.logbookIcon}
                          resizeMode="contain"
                        />
                      )}
                    </Pressable>
                  );
                }

                // Swipeable component for active session
                return <SwipeableRouteItem 
                  item={item} 
                  onPress={() => handleClimbPress(item)}
                  onSwipeSuccess={() => addRouteToSessionHelper(item, true, 1, true)}
                  onSwipeFailure={() => addRouteToSessionHelper(item, false, 1, true)}
                  loggedClimbIds={loggedClimbIds}
                />;
              }}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyListContainer}>
              <Text style={styles.emptyListText}>No climbs match your filters</Text>
              <Button
                title="Clear Filters"
                onPress={handleClearFilters}
                variant="secondary"
                size="medium"
                style={styles.emptyListButton}
              />
            </View>
          )}
        </View>
      )}

      <View style={[styles.infoContainer, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={styles.layoutName}>{layout.name}</Text>
        <View style={styles.layoutInfoRow}>
          <Text style={styles.spotsCount}>{spots.length} spot{spots.length !== 1 ? 's' : ''}</Text>
          <Text style={styles.gradeSystem}>Grade System: {layout.gradeSystem || 'V-Scale'}</Text>
        </View>
        <Text style={styles.instruction}>Tap on the map to add a new spot</Text>
        
        {/* Filter section */}
        <View style={styles.filterSection}>
          <Pressable 
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Text style={styles.filterButtonText}>🔍 Filter Routes</Text>
          </Pressable>
          
          {/* Active filters indicator */}
          {activeFilterCount > 0 ? (
            <View style={styles.activeFiltersContainer}>
              <Text style={styles.activeFiltersText}>
                {matchingClimbCount} climb{matchingClimbCount !== 1 ? 's' : ''} match
              </Text>
              <Pressable
                style={styles.clearFiltersButton}
                onPress={handleClearFilters}
              >
                <Text style={styles.clearFiltersText}>Clear all</Text>
              </Pressable>
            </View>
          ) : null}
          
          {/* View mode toggle */}
          <View style={styles.viewModeToggle}>
            <Pressable
              style={[styles.viewModeButton, viewMode === 'map' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('map')}
            >
              <Text style={[styles.viewModeText, viewMode === 'map' && styles.viewModeTextActive]}>🗺️ Map</Text>
            </Pressable>
            <Pressable
              style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('list')}
            >
              <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>📋 List</Text>
            </Pressable>
          </View>
          
          {/* Start/End Session button */}
          <View style={styles.sessionButtonContainer}>
            <Pressable
              style={[
                styles.filterButton,
                activeLocalSession && styles.endSessionButton,
                activeLocalSession && sessionRoutes.length === 0 && styles.disabledButton
              ]}
              onPress={activeLocalSession ? endSession : startSession}
              disabled={activeLocalSession && sessionRoutes.length === 0}
            >
              <Text style={[
                styles.filterButtonText,
                activeLocalSession && styles.endSessionButtonText,
                activeLocalSession && sessionRoutes.length === 0 && styles.disabledButtonText
              ]}>
                {activeLocalSession 
                  ? (sessionRoutes.length === 0 ? '⏹️ End Session (log a route first)' : '⏹️ End Session')
                  : '▶️ Start Session'}
              </Text>
            </Pressable>
            
            {/* Discard Session button - only shown when session is active */}
            {activeLocalSession && (
              <Pressable
                style={styles.discardSessionButton}
                onPress={discardSession}
              >
                <Text style={styles.discardSessionButtonText}>
                  🗑️ Discard Session
                </Text>
              </Pressable>
            )}
            
            {/* Session active indicator */}
            {activeLocalSession && (
              <View style={styles.sessionActiveContainer}>
                <Text style={styles.sessionActiveText}>
                  Session Active - {sessionRoutes.length} route{sessionRoutes.length !== 1 ? 's' : ''} logged
                </Text>
                {activeLocalSession.status === 'active' && (
                  <Text style={styles.offlineIndicator}>
                    📱 Offline session (will sync on next app start)
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
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
          onChangeText={(text) => {
            // Limit to max length
            if (text.length <= VALIDATION.SPOT_NAME.MAX_LENGTH) {
              setNewSpotData({ ...newSpotData, name: text });
            }
          }}
          maxLength={VALIDATION.SPOT_NAME.MAX_LENGTH}
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
                        {loggedClimbIds.has(item.id) && (
                          <Image 
                            source={require('../../assets/logbook.png')} 
                            style={styles.logbookIcon}
                            resizeMode="contain"
                          />
                        )}
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

      {/* Filter Modal */}
      <AppModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter Routes"
        style={[styles.modalContent, styles.filterModalContent]}
      >
        <ScrollView style={styles.filterModalScroll} showsVerticalScrollIndicator={true}>
          {/* Proposed Grade Range */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Proposed Grade Range</Text>
            <View style={styles.gradeRangeContainer}>
              <StyledTextInput
                style={styles.gradeInput}
                placeholder="Min (e.g., V4)"
                value={filters.minProposedGrade || ''}
                onChangeText={(text) => setFilters(prev => ({ ...prev, minProposedGrade: text || null }))}
                autoCapitalize="characters"
              />
              <Text style={styles.rangeSeparator}>to</Text>
              <StyledTextInput
                style={styles.gradeInput}
                placeholder="Max (e.g., V6)"
                value={filters.maxProposedGrade || ''}
                onChangeText={(text) => setFilters(prev => ({ ...prev, maxProposedGrade: text || null }))}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Voter Grade Range */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Voter Grade Range (Average)</Text>
            <View style={styles.gradeRangeContainer}>
              <StyledTextInput
                style={styles.gradeInput}
                placeholder="Min (e.g., V4)"
                value={filters.minVoterGrade || ''}
                onChangeText={(text) => setFilters(prev => ({ ...prev, minVoterGrade: text || null }))}
                autoCapitalize="characters"
              />
              <Text style={styles.rangeSeparator}>to</Text>
              <StyledTextInput
                style={styles.gradeInput}
                placeholder="Max (e.g., V6)"
                value={filters.maxVoterGrade || ''}
                onChangeText={(text) => setFilters(prev => ({ ...prev, maxVoterGrade: text || null }))}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Descriptors */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Descriptors (All must match)</Text>
            <View style={styles.descriptorsContainer}>
              {DESCRIPTORS.map(descriptor => (
                <Pressable
                  key={descriptor}
                  style={[
                    styles.descriptorChip,
                    filters.descriptors?.includes(descriptor) && styles.descriptorChipActive
                  ]}
                  onPress={() => toggleDescriptor(descriptor)}
                >
                  <Text style={[
                    styles.descriptorChipText,
                    filters.descriptors?.includes(descriptor) && styles.descriptorChipTextActive
                  ]}>
                    {descriptor}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Setter Name */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Setter Name</Text>
            <StyledTextInput
              style={styles.input}
              placeholder="Search by setter name..."
              value={filters.setterName || ''}
              onChangeText={(text) => setFilters(prev => ({ ...prev, setterName: text || null }))}
            />
          </View>

          {/* Has Video */}
          <View style={styles.filterSection}>
            <View style={styles.switchContainer}>
              <Text style={styles.filterLabel}>Has Video</Text>
              <Switch
                value={filters.hasVideo === true}
                onValueChange={(value) => setFilters(prev => ({ ...prev, hasVideo: value ? true : null }))}
                trackColor={{ false: '#ddd', true: '#007AFF' }}
                thumbColor={filters.hasVideo === true ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.filterActions}>
            <Button
              title="Clear All"
              onPress={handleClearFilters}
              variant="secondary"
              size="medium"
              style={styles.filterActionButton}
            />
            <Button
              title="Apply Filters"
              onPress={handleApplyFilters}
              variant="primary"
              size="medium"
              style={styles.filterActionButton}
            />
          </View>
        </ScrollView>
      </AppModal>

      {/* Quick-Add Route to Session Modal */}
      <AppModal
        visible={showQuickAddModal}
        onClose={() => {
          setShowQuickAddModal(false);
          setSelectedClimbForSession(null);
          setQuickAddStatus(true);
          setQuickAddAttempts(1);
        }}
        title="Add Route to Session"
        style={[styles.modalContent, styles.quickAddModalContent]}
      >
        {selectedClimbForSession && (
          <>
            <View style={styles.quickAddRouteInfo}>
              <Text style={styles.quickAddRouteGrade}>
                Route: {selectedClimbForSession.grade}
              </Text>
              <Text style={styles.quickAddRouteNote}>
                Voter grade and descriptors will be calculated from current votes
              </Text>
            </View>

            <View style={styles.quickAddSection}>
              <Text style={styles.quickAddLabel}>Status</Text>
              <View style={styles.statusToggleContainer}>
                <Pressable
                  style={[
                    styles.statusButton,
                    quickAddStatus && styles.statusButtonActive
                  ]}
                  onPress={() => setQuickAddStatus(true)}
                >
                  <Text style={[
                    styles.statusButtonText,
                    quickAddStatus && styles.statusButtonTextActive
                  ]}>✓ Success</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.statusButton,
                    !quickAddStatus && styles.statusButtonActiveFailure
                  ]}
                  onPress={() => setQuickAddStatus(false)}
                >
                  <Text style={[
                    styles.statusButtonText,
                    !quickAddStatus && styles.statusButtonTextActiveFailure
                  ]}>✗ Failure</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.quickAddSection}>
              <Text style={styles.quickAddLabel}>Attempts</Text>
              <View style={styles.attemptsContainer}>
                <Pressable
                  style={styles.attemptsButton}
                  onPress={() => setQuickAddAttempts(Math.max(1, quickAddAttempts - 1))}
                >
                  <Text style={styles.attemptsButtonText}>−</Text>
                </Pressable>
                <Text style={styles.attemptsCount}>{quickAddAttempts}</Text>
                <Pressable
                  style={styles.attemptsButton}
                  onPress={() => setQuickAddAttempts(quickAddAttempts + 1)}
                >
                  <Text style={styles.attemptsButtonText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowQuickAddModal(false);
                  setSelectedClimbForSession(null);
                  setQuickAddStatus(true);
                  setQuickAddAttempts(1);
                }}
                variant="secondary"
                size="medium"
                style={[styles.button, styles.cancelButton]}
              />
              <Button
                title={addingRouteToSession ? "Adding..." : "Add to Session"}
                onPress={addRouteToSession}
                variant="primary"
                size="medium"
                style={styles.button}
                disabled={addingRouteToSession}
              />
            </View>
          </>
        )}
      </AppModal>

      {/* Review Session Modal */}
      <AppModal
        visible={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSessionNotes('');
          setEditingRoutes([]);
        }}
        title="Review Session"
        style={[styles.modalContent, { paddingBottom: 12 }]}
        dismissOnOverlayPress={!savingSession}
      >
        <ScrollView 
          style={styles.reviewModalScroll} 
          contentContainerStyle={styles.reviewModalScrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Session Duration */}
          {activeLocalSession && (
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Duration</Text>
              <Text style={styles.reviewDuration}>
                {(() => {
                  const start = new Date(activeLocalSession.startTime);
                  const now = new Date();
                  const diffMs = now - start;
                  const diffMins = Math.floor(diffMs / (1000 * 60));
                  const hours = Math.floor(diffMins / 60);
                  const mins = diffMins % 60;
                  if (hours > 0) {
                    return `${hours}h ${mins}m`;
                  }
                  return `${mins}m`;
                })()}
              </Text>
            </View>
          )}

          {/* Routes List */}
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>
              Routes ({editingRoutes.length})
            </Text>
            {editingRoutes.length === 0 ? (
              <Text style={styles.reviewEmptyText}>No routes logged</Text>
            ) : (
              editingRoutes.map((route) => (
                <View key={route.id} style={styles.reviewRouteItem}>
                  <View style={styles.reviewRouteHeader}>
                    <Text style={styles.reviewRouteGrade}>
                      {route.proposedGrade}
                      {route.voterGrade && route.voterGrade !== route.proposedGrade && (
                        <Text style={styles.reviewRouteVoterGrade}> ({route.voterGrade})</Text>
                      )}
                    </Text>
                    {route.descriptors && route.descriptors.length > 0 && (
                      <Text style={styles.reviewRouteDescriptors}>
                        {route.descriptors.join(', ')}
                      </Text>
                    )}
                  </View>

                  <View style={styles.reviewRouteControls}>
                    <View style={styles.statusToggleContainer}>
                      <Pressable
                        style={[
                          styles.statusButton,
                          route.isSuccess && styles.statusButtonActive
                        ]}
                        onPress={() => updateEditingRoute(route.id, { isSuccess: true })}
                      >
                        <Text style={[
                          styles.statusButtonText,
                          route.isSuccess && styles.statusButtonTextActive
                        ]}>✓ Success</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.statusButton,
                          !route.isSuccess && styles.statusButtonActiveFailure
                        ]}
                        onPress={() => updateEditingRoute(route.id, { isSuccess: false })}
                      >
                        <Text style={[
                          styles.statusButtonText,
                          !route.isSuccess && styles.statusButtonTextActiveFailure
                        ]}>✗ Failure</Text>
                      </Pressable>
                    </View>

                    <View style={styles.attemptsContainer}>
                      <Pressable
                        style={styles.attemptsButton}
                        onPress={() => updateEditingRoute(route.id, {
                          attempts: Math.max(1, route.attempts - 1)
                        })}
                      >
                        <Text style={styles.attemptsButtonText}>−</Text>
                      </Pressable>
                      <Text style={styles.attemptsCount}>{route.attempts}</Text>
                      <Pressable
                        style={styles.attemptsButton}
                        onPress={() => updateEditingRoute(route.id, {
                          attempts: route.attempts + 1
                        })}
                      >
                        <Text style={styles.attemptsButtonText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Session Notes */}
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Session Notes (optional)</Text>
            <StyledTextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add notes about this session..."
              value={sessionNotes}
              onChangeText={setSessionNotes}
              multiline
              numberOfLines={4}
              maxLength={1000}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              onPress={() => {
                setShowReviewModal(false);
                setSessionNotes('');
                setEditingRoutes([]);
              }}
              variant="secondary"
              size="medium"
              style={[styles.button, styles.cancelButton]}
              disabled={savingSession}
            />
            <Button
              title={savingSession ? "Saving..." : "Save Session"}
              onPress={handleSaveSession}
              variant="primary"
              size="medium"
              style={styles.button}
              disabled={savingSession}
            />
          </View>
        </ScrollView>
      </AppModal>

      </RefreshableScrollView>
      
      {/* Floating scroll to bottom button - only show in list mode */}
      {viewMode === 'list' && listViewData.length > 0 && (
        <FloatingScrollButton onPress={scrollToBottom} visible={!isAtBottom} />
      )}
    </View>
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
  logbookIcon: {
    width: 24,
    height: 24,
    marginLeft: 8,
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
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  noCommentsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentsList: {
    marginBottom: 16,
  },
  commentItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  commentDate: {
    fontSize: 12,
    color: '#999',
  },
  commentEdited: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  commentContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reactionIcon: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    paddingVertical: 4,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  deleteButtonText: {
    color: '#FF3B30',
  },
  replyForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  replyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  replyButton: {
    flex: 1,
  },
  repliesContainer: {
    marginTop: 12,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#e0e0e0',
  },
  replyItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  replyAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  replyDate: {
    fontSize: 11,
    color: '#999',
  },
  replyContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
    marginBottom: 6,
  },
  editCommentContainer: {
    marginTop: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
  },
  createCommentContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  postCommentButton: {
    marginTop: 8,
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
  
  filterSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  filterButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  endSessionButton: {
    backgroundColor: '#FF3B30',
  },
  endSessionButtonText: {
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#666',
  },
  discardSessionButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  discardSessionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionActiveContainer: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  sessionActiveText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  offlineIndicator: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  quickAddModalContent: {
    maxHeight: '80%',
  },
  reviewModalScroll: {
    maxHeight: '100%',
  },
  reviewModalScrollContent: {
    paddingBottom: 20,
  },
  reviewSection: {
    marginBottom: 24,
  },
  reviewLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  reviewDuration: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  reviewEmptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  reviewRouteItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reviewRouteHeader: {
    marginBottom: 8,
  },
  reviewRouteGrade: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewRouteVoterGrade: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  reviewRouteDescriptors: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  reviewRouteControls: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  quickAddRouteInfo: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  quickAddRouteGrade: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  quickAddRouteNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  quickAddSection: {
    marginBottom: 20,
  },
  quickAddLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  statusToggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  statusButtonActiveFailure: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  statusButtonTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  statusButtonTextActiveFailure: {
    color: '#C62828',
    fontWeight: '600',
  },
  attemptsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  attemptsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attemptsButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  attemptsCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 40,
    textAlign: 'center',
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  activeFiltersText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  clearFiltersButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearFiltersText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  viewModeToggle: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#007AFF',
  },
  viewModeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  viewModeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  sessionButtonContainer: {
    marginTop: 16,
  },
  filterModalContent: {
    maxHeight: '70%',
  },
  filterModalScroll: {
    maxHeight: 500,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  gradeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  rangeSeparator: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 4,
  },
  descriptorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  descriptorChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  descriptorChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  descriptorChipText: {
    fontSize: 14,
    color: '#333',
  },
  descriptorChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  filterActionButton: {
    flex: 1,
    minWidth: 120,
  },
  noMatchIcon: {
    width: '100%',
    height: '100%',
  },
  
  listContainer: {
    padding: 16,
    minHeight: 300,
  },
  listClimbItem: {
    flexDirection: 'row',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  listClimbColorIndicator: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  listClimbInfo: {
    flex: 1,
  },
  listClimbGrade: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  listClimbSpot: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  listClimbLength: {
    fontSize: 12,
    color: '#999',
  },
  emptyListContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyListButton: {
    minWidth: 150,
  },
  swipeableContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  swipeableBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeableBackgroundRight: {
    left: 0,
  },
  swipeableBackgroundLeft: {
    right: 0,
  },
  swipeableLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 70,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollToBottomButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollToBottomIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

