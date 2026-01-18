import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  Keyboard,
  Platform,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { useApi } from '../ApiProvider';
import { showError } from '../utils/errorHandler';
import StyledTextInput from '../components/StyledTextInput';
import LoadingScreen from '../components/LoadingScreen';
import { showErrorAlert, showSuccessAlert } from '../utils/alert';
import Button from '../components/Button';
import Pressable from '../components/Pressable';
import { getCurrentUserId } from '../utils/jwtUtils';
import KeyboardAvoidingContainer from '../components/KeyboardAvoidingContainer';
import AppModal from '../components/Modal';
import Spinner from '../components/Spinner';
import { isLightColor } from '../utils/colorUtils';
import Svg, { G, Rect, Line, Text as SvgText, Circle, Path } from 'react-native-svg';

export default function ClimbDetailScreen({ navigation, route }) {
  const { climbId } = route.params;
  const [climbDetails, setClimbDetails] = useState(null);
  const [voteStatistics, setVoteStatistics] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [selectedVoteGrade, setSelectedVoteGrade] = useState('');
  const [submittingVote, setSubmittingVote] = useState(false);
  const [userHeight, setUserHeight] = useState(null);
  const [climbComments, setClimbComments] = useState([]);
  const [climbVideos, setClimbVideos] = useState([]);
  const [loadingClimbDetails, setLoadingClimbDetails] = useState(true);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [replyingToCommentId, setReplyingToCommentId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [commentSortBy, setCommentSortBy] = useState('newest');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReaction, setSubmittingReaction] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoDescription, setNewVideoDescription] = useState('');
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [editVideoTitle, setEditVideoTitle] = useState('');
  const [editVideoDescription, setEditVideoDescription] = useState('');
  const [deletingVideoId, setDeletingVideoId] = useState(null);
  const [activeTab, setActiveTab] = useState('votes');
  const [selectedDescriptors, setSelectedDescriptors] = useState([]);
  const scrollViewRef = useRef(null);
  const commentInputContainerRef = useRef(null);
  const videoLoadTimeoutRef = useRef(null);
  const videoUnloadTimeoutRef = useRef(null);
  const errorLoggedRef = useRef(false);
  const hasAutoPlayedRef = useRef(false);
  const { api } = useApi();

  const DESCRIPTOR_OPTIONS = [
    'reachy',
    'balance',
    'slopey',
    'crimpy',
    'slippery',
    'static',
    'technical',
    'dyno',
    'coordination',
    'explosive',
    'endurance',
    'powerful',
    'must-try',
    'dangerous',
    'overhang',
    'pockety',
    'dual-tex',
    'compression',
    'campusy',
    'shouldery',
    'slab',
  ];
  
  const videoPlayer = useVideoPlayer(selectedVideo?.videoUrl || '');

  useEffect(() => {
    const initUserId = async () => {
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
    };
    initUserId();
  }, []);

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(  // todo check if this is how we've done things up until now - make it consistent
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        // Additional scroll when keyboard appears
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      keyboardWillShowListener?.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (climbId) {
        fetchClimbDetails(climbId);
      }
      return () => {
        // Cleanup if needed
      };
    }, [climbId])
  );

  const fetchClimbDetails = async (climbId) => {
    setLoadingClimbDetails(true);
    try {
      const [climbRes, statisticsRes, myVoteRes, commentsRes, videosRes, userRes] = await Promise.all([
        api.get(`/climbs/${climbId}`),
        api.get(`/climbs/${climbId}/votes/statistics`),
        api.get(`/climbs/${climbId}/votes/me`).catch(() => ({ data: { vote: null } })),
        api.get(`/climbs/${climbId}/comments?sortBy=${commentSortBy}`),
        api.get(`/climbs/${climbId}/videos`),
        api.get('/auth/me').catch(() => ({ data: { height: null } })),
      ]);

      setClimbDetails(climbRes.data.climb);
      setVoteStatistics(statisticsRes.data.statistics);
      setMyVote(myVoteRes.data.vote || null);
      setSelectedVoteGrade(myVoteRes.data.vote?.grade || '');
      setSelectedDescriptors(myVoteRes.data.vote?.descriptors || []);
      setUserHeight(userRes.data?.height || null);
      setClimbComments(commentsRes.data.comments || []);
      setClimbVideos(videosRes.data.videos || []);
    } catch (error) {
      showError(error, "Error", "Failed to load climb details");
    } finally {
      setLoadingClimbDetails(false);
    }
  };

  const fetchComments = async (climbId) => {
    try {
      const commentsRes = await api.get(`/climbs/${climbId}/comments?sortBy=${commentSortBy}`);
      setClimbComments(commentsRes.data.comments || []);
    } catch (error) {
      showError(error, "Error", "Failed to load comments");
    }
  };

  const formatCommentDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatVideoDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGradeOptions = (climbGrade, gradeSystem) => {  // todo maybe make utils for grades
    if (!climbGrade) return [];

    if (gradeSystem === 'V-Scale' || gradeSystem === 'V-Scale Range') {
      const rangeMatch = climbGrade.match(/^V(\d+)-V(\d+)$/);
      const singleMatch = climbGrade.match(/^V(\d+)$/);

      if (rangeMatch) {
        const lower = parseInt(rangeMatch[1], 10);
        const upper = parseInt(rangeMatch[2], 10);
        const minGrade = Math.max(0, lower - 1);
        const maxGrade = Math.min(17, upper + 1);
        
        const options = [];
        for (let i = minGrade; i <= maxGrade; i++) {
          options.push(`V${i}`);
        }
        return options;
      } else if (singleMatch) {
        const grade = parseInt(singleMatch[1], 10);
        const minGrade = Math.max(0, grade - 1);
        const maxGrade = Math.min(17, grade + 1);
        
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
        
        const letterIndex = ['a', 'b', 'c'].indexOf(letter);
        const letterValue = letterIndex * 2 + (hasPlus ? 1 : 0);
        const baseValue = (number - 1) * 6;
        const totalValue = baseValue + letterValue;
        
        const minValue = Math.max(0, totalValue - 2);
        const maxValue = Math.min(53, totalValue + 2);
        
        const options = [];
        for (let value = minValue; value <= maxValue; value++) {
          const num = Math.floor(value / 6) + 1;
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
    if (!climbId || !selectedVoteGrade.trim()) {
      showErrorAlert("Please select a grade");
      return;
    }

    setSubmittingVote(true);
    try {
      await api.post(`/climbs/${climbId}/votes`, {
        grade: selectedVoteGrade.trim(),
        descriptors: selectedDescriptors,
      });

      await fetchClimbDetails(climbId);
      showSuccessAlert(myVote ? "Vote updated successfully!" : "Vote submitted successfully!");
    } catch (error) {
      showError(error, "Error", "Failed to submit vote");
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleDeleteVote = async () => {
    if (!climbId || !myVote) return;

    setSubmittingVote(true);
    try {
      await api.delete(`/climbs/${climbId}/votes`);

      await fetchClimbDetails(climbId);
      showSuccessAlert("Vote removed successfully!");
    } catch (error) {
      showError(error, "Error", "Failed to delete vote");
    } finally {
      setSubmittingVote(false);
      setSelectedDescriptors([]);
    }
  };

  const handleSubmitComment = async (commentId = null) => {
    const content = commentId ? editCommentContent : newCommentContent;
    const isReply = !commentId && replyingToCommentId;
    
    if (!climbId || !content.trim()) return;

    setSubmittingComment(true);
    try {
      if (commentId) {
        await api.put(`/climbs/${climbId}/comments/${commentId}`, {
          content: content.trim(),
        });
        setEditingCommentId(null);
        setEditCommentContent('');
        showSuccessAlert("Comment updated!");
      } else {
        await api.post(`/climbs/${climbId}/comments`, {
          content: content.trim(),
          parentCommentId: replyingToCommentId || undefined,
        });
        setNewCommentContent('');
        setReplyingToCommentId(null);
        showSuccessAlert(isReply ? "Reply posted!" : "Comment posted!");
      }

      await fetchComments(climbId);
    } catch (error) {
      showError(error, "Error", commentId ? "Failed to update comment" : "Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!climbId) return;

    setSubmittingComment(true);
    try {
      await api.delete(`/climbs/${climbId}/comments/${commentId}`);

      await fetchComments(climbId);
      showSuccessAlert("Comment deleted!");
    } catch (error) {
      showError(error, "Error", "Failed to delete comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSubmitReaction = async (commentId, reaction) => {
    if (!climbId) return;

    setSubmittingReaction({ ...submittingReaction, [commentId]: true });
    try {
      await api.post(`/climbs/${climbId}/comments/${commentId}/reactions`, {
        reaction,
      });

      await fetchComments(climbId);
    } catch (error) {
      if (error.response?.status === 204 || error.response?.status === 200) {
        // This is actually a success - reaction was toggled off or updated
        await fetchComments(climbId);
      } else {
        console.error('Reaction error:', error.response?.status, error.response?.data, error.message);
        showError(error, "Error", "Failed to submit reaction");
      }
    } finally {
      setSubmittingReaction({ ...submittingReaction, [commentId]: false });
    }
  };

  const handleCommentSortChange = async (sortBy) => {
    setCommentSortBy(sortBy);
    if (climbId) {
      await fetchComments(climbId);
    }
  };

  const handleCommentInputFocus = () => {
    // Delay to ensure keyboard animation starts
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, Platform.OS === 'ios' ? 300 : 100);
  };

  // Video player effects
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
          errorLoggedRef.current = true;
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

  // Video handlers
  const handleVideoPress = (video) => {
    setSelectedVideo(video);
    setShowVideoPlayer(true);
  };

  const handleUploadVideo = async () => {
    if (!climbId) return;

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showErrorAlert('Permission needed', 'Please grant permission to access your media library');
        return;
      }

      // Launch image picker for videos
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const videoAsset = result.assets[0];
      
      // Check file size (backend limit is 100MB)
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
      if (videoAsset.fileSize && videoAsset.fileSize > MAX_FILE_SIZE) {
        const fileSizeMB = (videoAsset.fileSize / (1024 * 1024)).toFixed(2);
        showErrorAlert(
          'File too large',
          `Video file size (${fileSizeMB}MB) exceeds the maximum limit of 100MB. Please choose a smaller video.`
        );
        return;
      }
      
      const uri = videoAsset.uri;
      const fileName = uri.split('/').pop();
      const fileType = `video/${fileName.split('.').pop()}`;

      // Create FormData
      const formData = new FormData();
      formData.append('video', {
        uri,
        name: fileName,
        type: fileType,
      });
      if (newVideoTitle.trim()) {
        formData.append('title', newVideoTitle.trim());
      }
      if (newVideoDescription.trim()) {
        formData.append('description', newVideoDescription.trim());
      }

      setUploadingVideo(true);
      
      // Upload video
      await api.post(`/climbs/${climbId}/videos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Refresh videos list
      await fetchClimbDetails(climbId);
      
      setNewVideoTitle('');
      setNewVideoDescription('');
      showSuccessAlert('Video uploaded successfully!');
    } catch (error) {
      showError(error, 'Error', 'Failed to upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleEditVideo = (video) => {
    setEditingVideoId(video.id);
    setEditVideoTitle(video.title || '');
    setEditVideoDescription(video.description || '');
  };

  const handleUpdateVideo = async () => {
    if (!climbId || !editingVideoId) return;

    try {
      await api.patch(`/videos/${editingVideoId}`, {
        title: editVideoTitle.trim() || null,
        description: editVideoDescription.trim() || null,
      });

      await fetchClimbDetails(climbId);
      setEditingVideoId(null);
      setEditVideoTitle('');
      setEditVideoDescription('');
      showSuccessAlert('Video updated successfully!');
    } catch (error) {
      showError(error, 'Error', 'Failed to update video');
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!climbId || !videoId) return;

    const confirmed = await new Promise((resolve) => {
      Alert.alert(
        'Delete Video?',
        'This will permanently delete the video from Cloudinary and the database. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    setDeletingVideoId(videoId);
    try {
      await api.delete(`/videos/${videoId}`);
      await fetchClimbDetails(climbId);
      showSuccessAlert('Video deleted successfully!');
    } catch (error) {
      showError(error, 'Error', 'Failed to delete video');
    } finally {
      setDeletingVideoId(null);
    }
  };

  if (loadingClimbDetails || !climbDetails) {
    return <LoadingScreen />;
  }

  return (
    <KeyboardAvoidingContainer 
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.climbHeader}>
        <View style={[styles.climbColorIndicatorLarge, { backgroundColor: climbDetails.color }]}>
          <Text 
            style={[
              styles.climbHeaderGrade,
              { color: isLightColor(climbDetails.color) ? '#000' : '#fff' }
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.5}
          >
            {climbDetails.grade}
          </Text>
        </View>
        <View style={styles.climbHeaderInfo}>
          {climbDetails.length && (
            <Text style={styles.climbHeaderLength}>{climbDetails.length}m</Text>
          )}
          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <Pressable
              style={[styles.tab, activeTab === 'votes' && styles.tabActive]}
              onPress={() => setActiveTab('votes')}
            >
              <Text style={[styles.tabText, activeTab === 'votes' && styles.tabTextActive]}>
                Votes
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'comments' && styles.tabActive]}
              onPress={() => setActiveTab('comments')}
            >
              <Text style={[styles.tabText, activeTab === 'comments' && styles.tabTextActive]}>
                Comments
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'videos' && styles.tabActive]}
              onPress={() => setActiveTab('videos')}
            >
              <Text style={[styles.tabText, activeTab === 'videos' && styles.tabTextActive]}>
                Videos
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Votes Section */}
      {activeTab === 'votes' && voteStatistics && climbDetails && (
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

              {/* Height vs Grade Chart */}
              {voteStatistics.gradeByHeight && Object.keys(voteStatistics.gradeByHeight).length > 0 && (() => {
                const screenWidth = Dimensions.get('window').width;
                const chartWidth = screenWidth - 64; // Account for padding
                
                // Process data: get grades sorted, vote counts, and average height indices
                const grades = Object.keys(voteStatistics.gradeByHeight).sort((a, b) => {
                  // Try to sort by grade value (V4, V5, etc. or French grades)
                  const aMatch = a.match(/V(\d+)/);
                  const bMatch = b.match(/V(\d+)/);
                  if (aMatch && bMatch) {
                    return parseInt(aMatch[1]) - parseInt(bMatch[1]);
                  }
                  return a.localeCompare(b);
                });

                const voteCounts = grades.map(grade => {
                  const heightData = voteStatistics.gradeByHeight[grade];
                  return heightData.short + heightData.average + heightData.tall + (heightData.noHeight || 0);
                });

                // Calculate weighted average height index (short=1, average=2, tall=3, noHeight=2)
                const heightIndices = grades.map(grade => {
                  const heightData = voteStatistics.gradeByHeight[grade];
                  const total = heightData.short + heightData.average + heightData.tall + (heightData.noHeight || 0);
                  if (total === 0) return 2; // Default to average
                  
                  const weightedSum = 
                    (heightData.short * 1) + 
                    (heightData.average * 2) + 
                    (heightData.tall * 3) + 
                    ((heightData.noHeight || 0) * 2);
                  
                  return weightedSum / total;
                });

                const chartWidthValue = Math.max(chartWidth, grades.length * 60);
                const chartHeight = 250;

                return (
                  <View style={styles.heightGradeChartContainer}>
                    <Text style={styles.subsectionTitle}>Height vs Grade Visualization</Text>
                    <Text style={styles.legendDescription}>
                      Bars show vote count (left axis), line shows average height index (right axis: 1=Short, 2=Average, 3=Tall)
                    </Text>
                    <ScrollView
                      horizontal={true}
                      showsHorizontalScrollIndicator={true}
                      contentContainerStyle={styles.chartScrollContainer}
                    >
                      <View style={[styles.chartWrapper, { width: chartWidthValue }]}>
                        {(() => {
                          const padding = { top: 20, right: 50, bottom: 60, left: 60 };
                          const graphWidth = chartWidthValue - padding.left - padding.right;
                          const graphHeight = chartHeight - padding.top - padding.bottom;

                          // Calculate scales
                          const maxVotes = Math.max(...voteCounts, 1);
                          const voteScale = graphHeight / maxVotes;
                          const heightScale = graphHeight / 3; // Height index is 0-3
                          const barWidth = Math.min(30, graphWidth / grades.length - 10);
                          const xStep = graphWidth / (grades.length - 1 || 1);

                          // Generate points for line
                          const linePoints = grades.map((grade, index) => {
                            const x = padding.left + (index * xStep);
                            const y = padding.top + graphHeight - (heightIndices[index] * heightScale);
                            return { x, y };
                          });

                          // Generate bars
                          const bars = grades.map((grade, index) => {
                            const x = padding.left + (index * xStep) - barWidth / 2;
                            const barHeight = voteCounts[index] * voteScale;
                            const y = padding.top + graphHeight - barHeight;
                            return { x, y, width: barWidth, height: barHeight, value: voteCounts[index] };
                          });

                          // Y-axis ticks for votes (left)
                          const voteTicks = [];
                          const numVoteTicks = 5;
                          for (let i = 0; i <= numVoteTicks; i++) {
                            const value = Math.round((maxVotes / numVoteTicks) * i);
                            const y = padding.top + graphHeight - (value * voteScale);
                            voteTicks.push({ value, y });
                          }

                          // Y-axis ticks for height (right)
                          const heightTicks = [
                            { label: 'Short', value: 1, y: padding.top + graphHeight - (1 * heightScale) },
                            { label: 'Avg', value: 2, y: padding.top + graphHeight - (2 * heightScale) },
                            { label: 'Tall', value: 3, y: padding.top + graphHeight - (3 * heightScale) },
                          ];

                          return (
                            <Svg width={chartWidthValue} height={chartHeight}>
                              <G>
                                {/* Grid lines for votes */}
                                {voteTicks.map((tick, i) => (
                                  <Line
                                    key={`grid-${i}`}
                                    x1={padding.left}
                                    y1={tick.y}
                                    x2={padding.left + graphWidth}
                                    y2={tick.y}
                                    stroke="#e0e0e0"
                                    strokeWidth="1"
                                  />
                                ))}

                                {/* Left Y-axis (Votes) */}
                                <Line
                                  x1={padding.left}
                                  y1={padding.top}
                                  x2={padding.left}
                                  y2={padding.top + graphHeight}
                                  stroke="#333"
                                  strokeWidth="2"
                                />
                                {voteTicks.map((tick, i) => (
                                  <G key={`vote-tick-${i}`}>
                                    <Line
                                      x1={padding.left - 5}
                                      y1={tick.y}
                                      x2={padding.left}
                                      y2={tick.y}
                                      stroke="#333"
                                      strokeWidth="1"
                                    />
                                    <SvgText
                                      x={padding.left - 10}
                                      y={tick.y + 4}
                                      fontSize="10"
                                      fill="#007AFF"
                                      textAnchor="end"
                                    >
                                      {tick.value}
                                    </SvgText>
                                  </G>
                                ))}
                                <SvgText
                                  x={15}
                                  y={padding.top + graphHeight / 2}
                                  fontSize="12"
                                  fill="#007AFF"
                                  fontWeight="bold"
                                  transform={`rotate(-90, 15, ${padding.top + graphHeight / 2})`}
                                >
                                  Votes
                                </SvgText>

                                {/* Right Y-axis (Height) */}
                                <Line
                                  x1={padding.left + graphWidth}
                                  y1={padding.top}
                                  x2={padding.left + graphWidth}
                                  y2={padding.top + graphHeight}
                                  stroke="#333"
                                  strokeWidth="2"
                                />
                                {heightTicks.map((tick, i) => (
                                  <G key={`height-tick-${i}`}>
                                    <Line
                                      x1={padding.left + graphWidth}
                                      y1={tick.y}
                                      x2={padding.left + graphWidth + 5}
                                      y2={tick.y}
                                      stroke="#333"
                                      strokeWidth="1"
                                    />
                                    <SvgText
                                      x={padding.left + graphWidth + 10}
                                      y={tick.y + 4}
                                      fontSize="10"
                                      fill="#FF9500"
                                      textAnchor="start"
                                    >
                                      {tick.label}
                                    </SvgText>
                                  </G>
                                ))}
                                <SvgText
                                  x={chartWidthValue - 15}
                                  y={padding.top + graphHeight / 2}
                                  fontSize="12"
                                  fill="#FF9500"
                                  fontWeight="bold"
                                  transform={`rotate(90, ${chartWidthValue - 15}, ${padding.top + graphHeight / 2})`}
                                >
                                  Height
                                </SvgText>

                                {/* X-axis */}
                                <Line
                                  x1={padding.left}
                                  y1={padding.top + graphHeight}
                                  x2={padding.left + graphWidth}
                                  y2={padding.top + graphHeight}
                                  stroke="#333"
                                  strokeWidth="2"
                                />

                                {/* Bars */}
                                {bars.map((bar, i) => (
                                  <G key={`bar-${i}`}>
                                    <Rect
                                      x={bar.x}
                                      y={bar.y}
                                      width={bar.width}
                                      height={bar.height}
                                      fill="#007AFF"
                                      fillOpacity="0.7"
                                    />
                                    {bar.value > 0 && (
                                      <SvgText
                                        x={bar.x + bar.width / 2}
                                        y={bar.y - 5}
                                        fontSize="10"
                                        fill="#007AFF"
                                        textAnchor="middle"
                                      >
                                        {bar.value}
                                      </SvgText>
                                    )}
                                  </G>
                                ))}

                                {/* Line for height index */}
                                {linePoints.length > 1 && (
                                  <Path
                                    d={`M ${linePoints.map(p => `${p.x},${p.y}`).join(' L ')}`}
                                    fill="none"
                                    stroke="#FF9500"
                                    strokeWidth="2"
                                  />
                                )}

                                {/* Dots for height index */}
                                {linePoints.map((point, i) => (
                                  <Circle
                                    key={`dot-${i}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r="5"
                                    fill="#FF9500"
                                    stroke="#FF9500"
                                    strokeWidth="2"
                                  />
                                ))}

                                {/* X-axis labels (grades) */}
                                {grades.map((grade, i) => {
                                  const x = padding.left + (i * xStep);
                                  return (
                                    <G key={`grade-${i}`}>
                                      <Line
                                        x1={x}
                                        y1={padding.top + graphHeight}
                                        x2={x}
                                        y2={padding.top + graphHeight + 5}
                                        stroke="#333"
                                        strokeWidth="1"
                                      />
                                      <SvgText
                                        x={x}
                                        y={padding.top + graphHeight + 25}
                                        fontSize="10"
                                        fill="#333"
                                        textAnchor="middle"
                                        transform={`rotate(-45, ${x}, ${padding.top + graphHeight + 25})`}
                                      >
                                        {grade}
                                      </SvgText>
                                    </G>
                                  );
                                })}
                              </G>
                            </Svg>
                          );
                        })()}
                      </View>
                    </ScrollView>
                  </View>
                );
              })()}
            </View>
          )}

          {/* User's Current Vote */}
          {myVote && (
            <View style={styles.myVoteContainer}>
              <Text style={styles.myVoteLabel}>Your Vote: <Text style={styles.myVoteGrade}>{myVote.grade}</Text></Text>
              {myVote.height && (
                <Text style={styles.myVoteHeight}>Height: {myVote.height}cm</Text>
              )}
              {myVote.descriptors && myVote.descriptors.length > 0 && (
                <View style={styles.myVoteDescriptors}>
                  <Text style={styles.myVoteDescriptorsLabel}>Descriptors: </Text>
                  <View style={styles.myVoteDescriptorsList}>
                    {myVote.descriptors.map((desc, idx) => (
                      <Text key={idx} style={styles.myVoteDescriptorTag}>
                        {desc}{idx < myVote.descriptors.length - 1 ? ', ' : ''}
                      </Text>
                    ))}
                  </View>
                </View>
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

            {/* Route Descriptors Selection */}
            <View style={styles.descriptorContainer}>
              <Text style={styles.descriptorLabel}>Route descriptors:</Text>
              <View style={styles.descriptorGrid}>
                {DESCRIPTOR_OPTIONS.map((descriptor) => {
                  const isSelected = selectedDescriptors.includes(descriptor);
                  const count = voteStatistics?.descriptors?.[descriptor] || 0;

                  const selectedChipStyle =
                    descriptor === 'must-try'
                      ? styles.descriptorChipSelectedMustTry
                      : descriptor === 'dangerous'
                      ? styles.descriptorChipSelectedDangerous
                      : styles.descriptorChipSelected;

                  const selectedTextStyle =
                    descriptor === 'must-try'
                      ? styles.descriptorTextSelectedMustTry
                      : descriptor === 'dangerous'
                      ? styles.descriptorTextSelectedDangerous
                      : styles.descriptorTextSelected;

                  return (
                    <Pressable
                      key={descriptor}
                      style={[
                        styles.descriptorChip,
                        isSelected && selectedChipStyle,
                      ]}
                      onPress={() => {
                        setSelectedDescriptors((prev) =>
                          prev.includes(descriptor)
                            ? prev.filter((d) => d !== descriptor)
                            : [...prev, descriptor]
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.descriptorText,
                          isSelected && selectedTextStyle,
                        ]}
                      >
                        {descriptor}
                      </Text>
                      {count > 0 && (
                        <View style={styles.descriptorCountBadge}>
                          <Text style={styles.descriptorCountText}>{count}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
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
                    disabled={
                      submittingVote || 
                      !selectedVoteGrade.trim() || 
                      (selectedVoteGrade === myVote.grade && 
                       JSON.stringify(selectedDescriptors.sort()) === JSON.stringify((myVote.descriptors || []).sort()))
                    }
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
      {activeTab === 'comments' && (
      <View style={styles.section}>
        <View style={styles.commentsHeader}>
          <Text style={styles.sectionTitle}>Comments ({climbComments.length})</Text>
          <View style={styles.sortButtons}>
            <Pressable
              style={[styles.sortButton, commentSortBy === 'newest' && styles.sortButtonActive]}
              onPress={() => handleCommentSortChange('newest')}
            >
              <Text style={[styles.sortButtonText, commentSortBy === 'newest' && styles.sortButtonTextActive]}>Newest</Text>
            </Pressable>
            <Pressable
              style={[styles.sortButton, commentSortBy === 'oldest' && styles.sortButtonActive]}
              onPress={() => handleCommentSortChange('oldest')}
            >
              <Text style={[styles.sortButtonText, commentSortBy === 'oldest' && styles.sortButtonTextActive]}>Oldest</Text>
            </Pressable>
            <Pressable
              style={[styles.sortButton, commentSortBy === 'mostLiked' && styles.sortButtonActive]}
              onPress={() => handleCommentSortChange('mostLiked')}
            >
              <Text style={[styles.sortButtonText, commentSortBy === 'mostLiked' && styles.sortButtonTextActive]}>Most Liked</Text>
            </Pressable>
          </View>
        </View>

        {/* Comments List */}
        {climbComments.length === 0 ? (
          <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
        ) : (
          <View style={styles.commentsList}>
            {climbComments.map((comment) => (
              <View key={comment.id} style={styles.commentItem}>
                {/* Comment Header */}
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>{comment.user?.username || 'Anonymous'}</Text>
                  <Text style={styles.commentDate}>{formatCommentDate(comment.createdAt)}</Text>
                  {comment.editedAt && (
                    <Text style={styles.commentEdited}>(edited)</Text>
                  )}
                </View>

                {/* Comment Content */}
                {editingCommentId === comment.id ? (
                  <View style={styles.editCommentContainer}>
                    <StyledTextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Edit your comment"
                      value={editCommentContent}
                      onChangeText={setEditCommentContent}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={styles.editActions}>
                      <Button
                        title="Cancel"
                        onPress={() => {
                          setEditingCommentId(null);
                          setEditCommentContent('');
                        }}
                        variant="secondary"
                        size="small"
                        style={styles.editButton}
                      />
                        <Button
                          title="Save"
                          onPress={() => handleSubmitComment(comment.id)}
                        variant="primary"
                        size="small"
                        disabled={!editCommentContent.trim() || submittingComment}
                        loading={submittingComment}
                        style={styles.editButton}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={styles.commentContent}>{comment.content}</Text>

                    {/* Comment Actions */}
                    <View style={styles.commentActions}>
                      <Pressable
                        style={styles.reactionButton}
                        onPress={() => handleSubmitReaction(comment.id, 'like')}
                        disabled={submittingReaction[comment.id]}
                      >
                        <Text style={styles.reactionIcon}>👍</Text>
                        <Text style={styles.reactionCount}>{comment.likes || 0}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.reactionButton}
                        onPress={() => handleSubmitReaction(comment.id, 'dislike')}
                        disabled={submittingReaction[comment.id]}
                      >
                        <Text style={styles.reactionIcon}>👎</Text>
                        <Text style={styles.reactionCount}>{comment.dislikes || 0}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => {
                          setReplyingToCommentId(replyingToCommentId === comment.id ? null : comment.id);
                          setEditingCommentId(null);
                        }}
                      >
                        <Text style={styles.actionButtonText}>Reply</Text>
                      </Pressable>
                      {currentUserId === comment.userId && (
                        <>
                          <Pressable
                            style={styles.actionButton}
                            onPress={() => {
                              setEditingCommentId(comment.id);
                              setEditCommentContent(comment.content);
                              setReplyingToCommentId(null);
                            }}
                          >
                            <Text style={styles.actionButtonText}>Edit</Text>
                          </Pressable>
                          <Pressable
                            style={styles.actionButton}
                            onPress={() => handleDeleteComment(comment.id)}
                            disabled={submittingComment}
                          >
                            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                          </Pressable>
                        </>
                      )}
                    </View>

                    {/* Reply Form */}
                    {replyingToCommentId === comment.id && (
                      <View style={styles.replyForm}>
                        <StyledTextInput
                          style={[styles.input, styles.textArea]}
                          placeholder={`Reply to ${comment.user?.username || 'Anonymous'}...`}
                          value={newCommentContent}
                          onChangeText={setNewCommentContent}
                          multiline
                          numberOfLines={3}
                        />
                        <View style={styles.replyActions}>
                          <Button
                            title="Cancel"
                            onPress={() => {
                              setReplyingToCommentId(null);
                              setNewCommentContent('');
                            }}
                            variant="secondary"
                            size="small"
                            style={styles.replyButton}
                          />
                          <Button
                            title="Reply"
                            onPress={() => handleSubmitComment()}
                            variant="primary"
                            size="small"
                            disabled={!newCommentContent.trim() || submittingComment}
                            loading={submittingComment}
                            style={styles.replyButton}
                          />
                        </View>
                      </View>
                    )}

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <View style={styles.repliesContainer}>
                        {comment.replies.map((reply) => (
                          <View key={reply.id} style={styles.replyItem}>
                            <View style={styles.replyHeader}>
                              <Text style={styles.replyAuthor}>{reply.user?.username || 'Anonymous'}</Text>
                              <Text style={styles.replyDate}>{formatCommentDate(reply.createdAt)}</Text>
                              {reply.editedAt && (
                                <Text style={styles.commentEdited}>(edited)</Text>
                              )}
                            </View>
                            {editingCommentId === reply.id ? (
                              <View style={styles.editCommentContainer}>
                                <StyledTextInput
                                  style={[styles.input, styles.textArea]}
                                  placeholder="Edit your reply"
                                  value={editCommentContent}
                                  onChangeText={setEditCommentContent}
                                  multiline
                                  numberOfLines={2}
                                />
                                <View style={styles.editActions}>
                                  <Button
                                    title="Cancel"
                                    onPress={() => {
                                      setEditingCommentId(null);
                                      setEditCommentContent('');
                                    }}
                                    variant="secondary"
                                    size="small"
                                    style={styles.editButton}
                                  />
                                  <Button
                                    title="Save"
                                    onPress={() => handleSubmitComment(reply.id)}
                                    variant="primary"
                                    size="small"
                                    disabled={!editCommentContent.trim() || submittingComment}
                                    loading={submittingComment}
                                    style={styles.editButton}
                                  />
                                </View>
                              </View>
                            ) : (
                              <>
                                <Text style={styles.replyContent}>{reply.content}</Text>
                                <View style={styles.commentActions}>
                                  <Pressable
                                    style={styles.reactionButton}
                                    onPress={() => handleSubmitReaction(reply.id, 'like')}
                                    disabled={submittingReaction[reply.id]}
                                  >
                                    <Text style={styles.reactionIcon}>👍</Text>
                                    <Text style={styles.reactionCount}>{reply.likes || 0}</Text>
                                  </Pressable>
                                  <Pressable
                                    style={styles.reactionButton}
                                    onPress={() => handleSubmitReaction(reply.id, 'dislike')}
                                    disabled={submittingReaction[reply.id]}
                                  >
                                    <Text style={styles.reactionIcon}>👎</Text>
                                    <Text style={styles.reactionCount}>{reply.dislikes || 0}</Text>
                                  </Pressable>
                                  {currentUserId === reply.userId && (
                                    <>
                                      <Pressable
                                        style={styles.actionButton}
                                        onPress={() => {
                                          setEditingCommentId(reply.id);
                                          setEditCommentContent(reply.content);
                                        }}
                                      >
                                        <Text style={styles.actionButtonText}>Edit</Text>
                                      </Pressable>
                                      <Pressable
                                        style={styles.actionButton}
                                        onPress={() => handleDeleteComment(reply.id)}
                                        disabled={submittingComment}
                                      >
                                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                                      </Pressable>
                                    </>
                                  )}
                                </View>
                              </>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Create Comment Form */}
        {!replyingToCommentId && (
          <View 
            ref={commentInputContainerRef}
            style={styles.createCommentContainer}
          >
            <StyledTextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write a comment..."
              value={newCommentContent}
              onChangeText={setNewCommentContent}
              onFocus={handleCommentInputFocus}
              multiline
              numberOfLines={4}
            />
            <Button
              title="Post Comment"
              onPress={() => handleSubmitComment()}
              variant="primary"
              size="medium"
              disabled={!newCommentContent.trim() || submittingComment}
              loading={submittingComment}
              style={styles.postCommentButton}
            />
          </View>
        )}
      </View>
      )}

      {/* Videos Section */}
      {activeTab === 'videos' && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Videos ({climbVideos.length})</Text>
        
        {climbVideos.length > 0 ? (
          <View style={styles.videosList}>
            {climbVideos.map((video) => (
              <View key={video.id}>
                {editingVideoId === video.id ? (
                  <View style={styles.editVideoContainer}>
                    <StyledTextInput
                      style={styles.input}
                      placeholder="Video title (optional)"
                      value={editVideoTitle}
                      onChangeText={setEditVideoTitle}
                    />
                    <StyledTextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Video description (optional)"
                      value={editVideoDescription}
                      onChangeText={setEditVideoDescription}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={styles.editActions}>
                      <Pressable
                        style={styles.actionButton}
                        onPress={handleUpdateVideo}
                      >
                        <Text style={styles.actionButtonText}>Save</Text>
                      </Pressable>
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => {
                          setEditingVideoId(null);
                          setEditVideoTitle('');
                          setEditVideoDescription('');
                        }}
                      >
                        <Text style={styles.actionButtonText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.videoItemContainer}>
                    <Pressable
                      style={styles.videoItem}
                      onPress={() => handleVideoPress(video)}
                    >
                      <View style={styles.thumbnailContainer}>
                        {video.thumbnailUrl ? (
                          <Image
                            source={{ uri: video.thumbnailUrl }}
                            style={styles.videoThumbnail}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.videoThumbnail, styles.thumbnailPlaceholder]}>
                            <Text style={styles.thumbnailPlaceholderText}>▶</Text>
                          </View>
                        )}
                        <View style={styles.playIconOverlay}>
                          <Text style={styles.playIcon}>▶</Text>
                        </View>
                        {video.duration && (
                          <View style={styles.durationBadge}>
                            <Text style={styles.durationText}>{formatVideoDuration(video.duration)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.videoInfo}>
                        <Text style={styles.videoTitle} numberOfLines={2}>
                          {video.title || 'Untitled Video'}
                        </Text>
                        {video.description && (
                          <Text style={styles.videoDescription} numberOfLines={2}>
                            {video.description}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                    {currentUserId && video.userId === currentUserId && (
                      <View style={styles.videoActions}>
                        <Pressable
                          style={styles.actionButton}
                          onPress={() => handleEditVideo(video)}
                        >
                          <Text style={styles.actionButtonText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionButton}
                          onPress={() => handleDeleteVideo(video.id)}
                          disabled={deletingVideoId === video.id}
                        >
                          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                            {deletingVideoId === video.id ? 'Deleting...' : 'Delete'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noVideosText}>No videos yet</Text>
        )}

        {/* Upload Video Form */}
        <View style={styles.uploadVideoContainer}>
          <Text style={styles.uploadVideoTitle}>Upload Video</Text>
          <StyledTextInput
            style={styles.input}
            placeholder="Video title (optional)"
            value={newVideoTitle}
            onChangeText={setNewVideoTitle}
          />
          <StyledTextInput
            style={[styles.input, styles.textArea]}
            placeholder="Video description (optional)"
            value={newVideoDescription}
            onChangeText={setNewVideoDescription}
            multiline
            numberOfLines={3}
          />
          <Button
            title="Choose Video"
            onPress={handleUploadVideo}
            variant="primary"
            size="medium"
            loading={uploadingVideo}
            disabled={uploadingVideo}
            style={styles.uploadButton}
          />
        </View>
      </View>
      )}
      </ScrollView>

      {/* Video Player Modal */}
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
    </KeyboardAvoidingContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  climbHeaderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  climbHeaderGrade: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  climbHeaderLength: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginRight: 4,
    borderRadius: 7,
  },
  tabActive: {
    backgroundColor: '#E3F2FD',
  },
  tabText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#999',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
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
  myVoteDescriptors: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  myVoteDescriptorsLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  myVoteDescriptorsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  myVoteDescriptorTag: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
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
  button: {
    marginTop: 8,
  },
  descriptorContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  descriptorLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  descriptorGrid: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  descriptorChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
  },
  descriptorChipSelected: {
    backgroundColor: '#FFE0B2',
    borderColor: '#FF9500',
  },
  descriptorChipSelectedMustTry: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  descriptorChipSelectedDangerous: {
    backgroundColor: '#FFEBEE',
    borderColor: '#C62828',
  },
  descriptorText: {
    fontSize: 13,
    color: '#555',
  },
  descriptorTextSelected: {
    color: '#BF6600',
    fontWeight: '600',
  },
  descriptorTextSelectedMustTry: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  descriptorTextSelectedDangerous: {
    color: '#C62828',
    fontWeight: '600',
  },
  descriptorCountBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  descriptorCountText: {
    fontSize: 11,
    color: '#555',
    fontWeight: '500',
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
    backgroundColor: '#FF6B6B',
  },
  gradeByHeightAverage: {
    backgroundColor: '#4ECDC4',
  },
  gradeByHeightTall: {
    backgroundColor: '#45B7D1',
  },
  gradeByHeightNoHeight: {
    backgroundColor: '#95A5A6',
  },
  gradeByHeightCount: {
    fontSize: 14,
    color: '#666',
    width: 30,
    textAlign: 'right',
  },
  heightGradeChartContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  chartWrapper: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    marginVertical: 8,
  },
  chartScrollContainer: {
    paddingRight: 16,
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
  videosList: {
    marginTop: 12,
    marginBottom: 16,
  },
  videoItemContainer: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  videoItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  videoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  editVideoContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 12,
  },
  videoThumbnail: {
    width: 120,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#ddd',
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  thumbnailPlaceholderText: {
    fontSize: 32,
    color: '#999',
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
    borderRadius: 8,
  },
  playIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  videoInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  videoDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noVideosText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  uploadVideoContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  uploadVideoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  uploadButton: {
    marginTop: 8,
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
    backgroundColor: '#000',
    borderRadius: 8,
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
    marginTop: 8,
  },
});
