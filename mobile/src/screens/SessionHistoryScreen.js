import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApi } from '../ApiProvider';
import { showError } from '../utils/errorHandler';
import LoadingScreen from '../components/LoadingScreen';
import Pressable from '../components/Pressable';

export default function SessionHistoryScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const { api } = useApi();

  useFocusEffect(
    useCallback(() => {
      fetchSessions();
    }, [])
  );

  const fetchSessions = async (cursor = null) => {
    try {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams();
      if (cursor) {
        params.append('cursor', cursor);
      }
      params.append('limit', '20');

      const response = await api.get(`/sessions?${params.toString()}`);
      const data = response.data;

      if (cursor) {
        setSessions(prev => [...prev, ...data.sessions]);
      } else {
        setSessions(data.sessions);
      }

      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      showError(error, 'Failed to fetch sessions');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (hasMore && nextCursor && !loadingMore) {
      fetchSessions(nextCursor);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatDuration = (startTime, endTime) => {
    if (!endTime) return 'Ongoing';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const renderSessionItem = ({ item }) => {
    const stats = item.statistics || {};
    const successfulRoutes = stats.successfulRoutes || 0;
    const totalRoutes = stats.totalRoutes || 0;
    const duration = formatDuration(item.startTime, item.endTime);

    return (
      <Pressable
        style={styles.sessionItem}
        onPress={() => navigation.navigate('Session Details', { sessionId: item.id })}
      >
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionDate}>{formatDate(item.startTime)}</Text>
          <Text style={styles.sessionDuration}>{duration}</Text>
        </View>
        <View style={styles.sessionStats}>
          <Text style={styles.sessionStatsText}>
            {totalRoutes} route{totalRoutes !== 1 ? 's' : ''}, {successfulRoutes} send{successfulRoutes !== 1 ? 's' : ''}
          </Text>
          {stats.averageProposedGrade && (
            <Text style={styles.sessionGrade}>
              Avg: {stats.averageProposedGrade}
              {stats.averageVoterGrade && stats.averageVoterGrade !== stats.averageProposedGrade && (
                <Text style={styles.sessionGradeVoter}> ({stats.averageVoterGrade})</Text>
              )}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No sessions yet</Text>
          <Text style={styles.emptySubtext}>Start a session to track your climbing progress</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderSessionItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
  },
  sessionItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sessionDuration: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  sessionStats: {
    marginTop: 4,
  },
  sessionStatsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  sessionGrade: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  sessionGradeVoter: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
