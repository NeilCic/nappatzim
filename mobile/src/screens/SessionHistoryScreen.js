import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApi } from '../ApiProvider';
import { showError } from '../utils/errorHandler';
import LoadingScreen from '../components/LoadingScreen';
import Pressable from '../components/Pressable';
import AppModal from '../components/Modal';
import Button from '../components/Button';
import { formatDateRelative } from '../utils/stringUtils';

export default function SessionHistoryScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(null); // 'start' | 'end' | null
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    minDuration: null,
    maxDuration: null,
    minAvgProposedGrade: null,
    maxAvgProposedGrade: null,
    minAvgVoterGrade: null,
    maxAvgVoterGrade: null,
  });
  const [filterInputs, setFilterInputs] = useState({
    minDuration: '',
    maxDuration: '',
    minAvgProposedGrade: '',
    maxAvgProposedGrade: '',
    minAvgVoterGrade: '',
    maxAvgVoterGrade: '',
  });
  const { api } = useApi();

  useFocusEffect(
    useCallback(() => {
      fetchSessions();
    }, [])
  );

  const fetchSessionsWithFilters = async (filterOverrides = null, cursor = null) => {
    const activeFilters = filterOverrides || filters;
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

      // Add filter parameters
      if (activeFilters.startDate) {
        params.append('startDate', activeFilters.startDate.toISOString());
      }
      if (activeFilters.endDate) {
        params.append('endDate', activeFilters.endDate.toISOString());
      }
      if (activeFilters.minDuration !== null && activeFilters.minDuration !== undefined) {
        params.append('minDuration', activeFilters.minDuration.toString());
      }
      if (activeFilters.maxDuration !== null && activeFilters.maxDuration !== undefined) {
        params.append('maxDuration', activeFilters.maxDuration.toString());
      }
      if (activeFilters.minAvgProposedGrade) {
        params.append('minAvgProposedGrade', activeFilters.minAvgProposedGrade);
      }
      if (activeFilters.maxAvgProposedGrade) {
        params.append('maxAvgProposedGrade', activeFilters.maxAvgProposedGrade);
      }
      if (activeFilters.minAvgVoterGrade) {
        params.append('minAvgVoterGrade', activeFilters.minAvgVoterGrade);
      }
      if (activeFilters.maxAvgVoterGrade) {
        params.append('maxAvgVoterGrade', activeFilters.maxAvgVoterGrade);
      }

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

  const fetchSessions = async (cursor = null) => {
    return fetchSessionsWithFilters(null, cursor);
  };

  const applyFilters = () => {
    const newFilters = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      minDuration: filterInputs.minDuration ? parseInt(filterInputs.minDuration, 10) : null,
      maxDuration: filterInputs.maxDuration ? parseInt(filterInputs.maxDuration, 10) : null,
      minAvgProposedGrade: filterInputs.minAvgProposedGrade?.trim() || null,
      maxAvgProposedGrade: filterInputs.maxAvgProposedGrade?.trim() || null,
      minAvgVoterGrade: filterInputs.minAvgVoterGrade?.trim() || null,
      maxAvgVoterGrade: filterInputs.maxAvgVoterGrade?.trim() || null,
    };
    setFilters(newFilters);
    setShowFilterModal(false);
    setNextCursor(null);
    setHasMore(false);
    fetchSessionsWithFilters(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters = {
      startDate: null,
      endDate: null,
      minDuration: null,
      maxDuration: null,
      minAvgProposedGrade: null,
      maxAvgProposedGrade: null,
      minAvgVoterGrade: null,
      maxAvgVoterGrade: null,
    };
    setFilters(emptyFilters);
    setFilterInputs({
      minDuration: '',
      maxDuration: '',
      minAvgProposedGrade: '',
      maxAvgProposedGrade: '',
      minAvgVoterGrade: '',
      maxAvgVoterGrade: '',
    });
    setShowFilterModal(false);
    setNextCursor(null);
    setHasMore(false);
    fetchSessionsWithFilters(emptyFilters);
  };

  const hasActiveFilters = () => {
    return filters.startDate || filters.endDate || filters.minDuration !== null || filters.maxDuration !== null ||
           filters.minAvgProposedGrade || filters.maxAvgProposedGrade || filters.minAvgVoterGrade || filters.maxAvgVoterGrade;
  };

  const loadMore = () => {
    if (hasMore && nextCursor && !loadingMore) {
      fetchSessions(nextCursor);
    }
  };

  const formatDate = (dateString) => {
    return formatDateRelative(dateString, { showDaysAgo: true, locale: 'en-US' });
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sessions</Text>
        <Pressable
          style={[styles.filterButton, hasActiveFilters() && styles.filterButtonActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={[styles.filterButtonText, hasActiveFilters() && styles.filterButtonTextActive]}>
            Filter{hasActiveFilters() ? ' (Active)' : ''}
          </Text>
        </Pressable>
      </View>
      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No sessions found</Text>
          <Text style={styles.emptySubtext}>
            {hasActiveFilters() 
              ? 'Try adjusting your filters or clear them to see all sessions'
              : 'Start a session to track your climbing progress'}
          </Text>
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

      <AppModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter Sessions"
        style={styles.modalContent}
      >
        <ScrollView style={styles.modalScroll}>
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Date Range</Text>
            <View style={styles.dateInputs}>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker('start')}
              >
                <Text style={styles.dateButtonText}>
                  {filters.startDate
                    ? filters.startDate.toLocaleDateString()
                    : 'Start Date'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker('end')}
              >
                <Text style={styles.dateButtonText}>
                  {filters.endDate
                    ? filters.endDate.toLocaleDateString()
                    : 'End Date'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Duration (minutes)</Text>
            <View style={styles.durationInputs}>
              <View style={styles.durationInput}>
                <Text style={styles.durationLabel}>Min</Text>
                <TextInput
                  style={styles.durationTextInput}
                  value={filterInputs.minDuration}
                  onChangeText={(text) => setFilterInputs(prev => ({ ...prev, minDuration: text }))}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.durationInput}>
                <Text style={styles.durationLabel}>Max</Text>
                <TextInput
                  style={styles.durationTextInput}
                  value={filterInputs.maxDuration}
                  onChangeText={(text) => setFilterInputs(prev => ({ ...prev, maxDuration: text }))}
                  placeholder="∞"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Average Proposed Grade</Text>
            <View style={styles.gradeInputs}>
              <View style={styles.gradeInput}>
                <Text style={styles.gradeLabel}>Min</Text>
                <TextInput
                  style={styles.gradeTextInput}
                  value={filterInputs.minAvgProposedGrade}
                  onChangeText={(text) => setFilterInputs(prev => ({ ...prev, minAvgProposedGrade: text }))}
                  placeholder="e.g., V4"
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.gradeInput}>
                <Text style={styles.gradeLabel}>Max</Text>
                <TextInput
                  style={styles.gradeTextInput}
                  value={filterInputs.maxAvgProposedGrade}
                  onChangeText={(text) => setFilterInputs(prev => ({ ...prev, maxAvgProposedGrade: text }))}
                  placeholder="e.g., V7"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Average Voter Grade</Text>
            <View style={styles.gradeInputs}>
              <View style={styles.gradeInput}>
                <Text style={styles.gradeLabel}>Min</Text>
                <TextInput
                  style={styles.gradeTextInput}
                  value={filterInputs.minAvgVoterGrade}
                  onChangeText={(text) => setFilterInputs(prev => ({ ...prev, minAvgVoterGrade: text }))}
                  placeholder="e.g., V4"
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.gradeInput}>
                <Text style={styles.gradeLabel}>Max</Text>
                <TextInput
                  style={styles.gradeTextInput}
                  value={filterInputs.maxAvgVoterGrade}
                  onChangeText={(text) => setFilterInputs(prev => ({ ...prev, maxAvgVoterGrade: text }))}
                  placeholder="e.g., V7"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>

          <View style={styles.filterActions}>
            <Button
              title="Apply Filters"
              onPress={applyFilters}
              variant="primary"
              size="medium"
              style={styles.applyButton}
            />
            {hasActiveFilters() && (
              <Button
                title="Clear Filters"
                onPress={clearFilters}
                variant="outline"
                size="medium"
                style={styles.clearButton}
              />
            )}
          </View>
        </ScrollView>
      </AppModal>

      {showDatePicker && (
        <DateTimePicker
          value={
            showDatePicker === 'start'
              ? filters.startDate || new Date()
              : filters.endDate || new Date()
          }
          mode="date"
          display="default"
          onChange={(_, selectedDate) => {
            setShowDatePicker(null);
            if (selectedDate) {
              setFilters((prev) => ({
                ...prev,
                [showDatePicker === 'start' ? 'startDate' : 'endDate']: selectedDate,
              }));
            }
          }}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
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
  modalContent: {
    maxHeight: '80%',
  },
  modalScroll: {
    maxHeight: 500,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dateInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  durationInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  durationInput: {
    flex: 1,
  },
  durationLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  durationTextInput: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    fontSize: 16,
    color: '#333',
  },
  gradeInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  gradeInput: {
    flex: 1,
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  gradeTextInput: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    fontSize: 16,
    color: '#333',
  },
  filterActions: {
    marginTop: 8,
    gap: 12,
  },
  applyButton: {
    marginBottom: 0,
  },
  clearButton: {
    marginBottom: 0,
  },
});
