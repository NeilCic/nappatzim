import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useApi } from '../ApiProvider';
import { showError } from '../utils/errorHandler';
import LoadingScreen from '../components/LoadingScreen';
import Button from '../components/Button';
import { showErrorAlert, showSuccessAlert } from '../utils/alert';
import { formatDateDetailed } from '../utils/stringUtils';

export default function SessionDetailScreen({ navigation, route }) {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [updatingAttemptId, setUpdatingAttemptId] = useState(null);
  const { api } = useApi();

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/sessions/${sessionId}`);
      setSession(response.data);
    } catch (error) {
      showError(error, 'Failed to fetch session');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMetadata = async (routeId) => {
    try {
      setUpdatingAttemptId(routeId);
      await api.put(`/sessions/routes/${routeId}/metadata`);
      showSuccessAlert('Route metadata updated');
      fetchSession();
    } catch (error) {
      if (error.response?.status === 404) {
        showErrorAlert('Route no longer exists or has been deleted');
      } else {
        showError(error, 'Failed to update metadata');
      }
    } finally {
      setUpdatingAttemptId(null);
    }
  };

  const handleDelete = async () => {
    const confirmed = await new Promise((resolve) => {
      Alert.alert(
        'Delete Session?',
        'This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    try {
      setDeleting(true);
      await api.delete(`/sessions/${sessionId}`);
      showSuccessAlert('Session deleted');
      navigation.goBack();
    } catch (error) {
      showError(error, 'Failed to delete session');
    } finally {
      setDeleting(false);
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

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Session not found</Text>
      </View>
    );
  }

  const stats = session.statistics || {};
  const attempts = session.attempts || [];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Session Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Details</Text>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Date:</Text>
            <Text style={styles.metadataValue}>{formatDateDetailed(session.startTime)}</Text>
          </View>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Duration:</Text>
            <Text style={styles.metadataValue}>{formatDuration(session.startTime, session.endTime)}</Text>
          </View>
          {stats.averageProposedGrade && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Avg Proposed Grade:</Text>
              <Text style={styles.metadataValue}>{stats.averageProposedGrade}</Text>
            </View>
          )}
          {stats.averageVoterGrade && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Avg Voter Grade:</Text>
              <Text style={styles.metadataValue}>{stats.averageVoterGrade}</Text>
            </View>
          )}
          {session.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText}>{session.notes}</Text>
            </View>
          )}
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalRoutes || 0}</Text>
              <Text style={styles.statLabel}>Total Routes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.successfulRoutes || 0}</Text>
              <Text style={styles.statLabel}>Sends</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.failedRoutes || 0}</Text>
              <Text style={styles.statLabel}>Failed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalAttempts || 0}</Text>
              <Text style={styles.statLabel}>Total Attempts</Text>
            </View>
          </View>
        </View>

        {/* Route Attempts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Routes ({attempts.length})</Text>
          {attempts.length === 0 ? (
            <Text style={styles.emptyText}>No routes logged in this session</Text>
          ) : (
            attempts.map((attempt) => (
              <View key={attempt.id} style={styles.attemptItem}>
                <View style={styles.attemptHeader}>
                  <Text style={styles.attemptGrade}>
                    {attempt.proposedGrade}
                    {attempt.voterGrade && attempt.voterGrade !== attempt.proposedGrade && (
                      <Text style={styles.attemptVoterGrade}> ({attempt.voterGrade})</Text>
                    )}
                  </Text>
                  <View style={[
                    styles.attemptStatus,
                    attempt.status === 'success' ? styles.attemptStatusSuccess : styles.attemptStatusFailure
                  ]}>
                    <Text style={styles.attemptStatusText}>
                      {attempt.status === 'success' ? '✓' : '✗'}
                    </Text>
                  </View>
                </View>
                {attempt.descriptors && attempt.descriptors.length > 0 && (
                  <View style={styles.attemptDescriptors}>
                    {attempt.descriptors.map((desc, idx) => (
                      <View key={idx} style={styles.descriptorTag}>
                        <Text style={styles.descriptorText}>{desc}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.attemptFooter}>
                  <Text style={styles.attemptAttempts}>
                    {attempt.attempts} attempt{attempt.attempts !== 1 ? 's' : ''}
                  </Text>
                  {attempt.climbId && (
                    <Button
                      title={updatingAttemptId === attempt.id ? "Updating..." : "Update route votes"}
                      onPress={() => handleUpdateMetadata(attempt.id)}
                      disabled={updatingAttemptId === attempt.id}
                      variant="secondary"
                      size="small"
                      style={styles.updateButton}
                    />
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Delete Button */}
        <Button
          title={deleting ? "Deleting..." : "Delete Session"}
          onPress={handleDelete}
          disabled={deleting}
          variant="secondary"
          size="large"
          style={styles.deleteButton}
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
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metadataLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
  },
  notesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  notesLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  attemptItem: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  attemptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attemptGrade: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  attemptVoterGrade: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
  attemptStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attemptStatusSuccess: {
    backgroundColor: '#4CAF50',
  },
  attemptStatusFailure: {
    backgroundColor: '#F44336',
  },
  attemptStatusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  attemptDescriptors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  descriptorTag: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  descriptorText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
  },
  attemptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  attemptAttempts: {
    fontSize: 12,
    color: '#666',
  },
  updateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  deleteButton: {
    marginTop: 8,
    marginBottom: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginTop: 40,
  },
});
