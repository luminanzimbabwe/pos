import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { shopAPI } from '../services/api';
import { shopStorage } from '../services/storage';
import { ROUTES } from '../constants/navigation';

const StockTakeHistoryScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stockTakes, setStockTakes] = useState([]);
  const [shopCredentials, setShopCredentials] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'completed', 'failed', 'weekly', 'monthly'

  useEffect(() => {
    loadShopCredentials();
  }, []);

  useEffect(() => {
    if (shopCredentials) {
      loadStockTakes();
    }
  }, [shopCredentials]);

  const loadShopCredentials = async () => {
    try {
      const credentials = await shopStorage.getCredentials();
      if (credentials) {
        setShopCredentials(credentials);
      } else {
        Alert.alert('Error', 'Shop credentials not found. Please log in again.');
        navigation.navigate(ROUTES.LOGIN);
      }
    } catch (error) {
      console.error('Error loading shop credentials:', error);
      Alert.alert('Error', 'Failed to load shop credentials.');
    }
  };

  const loadStockTakes = async () => {
    try {
      setLoading(true);
      const response = await shopAPI.getStockTakes();
      const takesData = response.data || [];
      
      // Sort by started_at descending (newest first)
      const sortedTakes = takesData.sort((a, b) => 
        new Date(b.started_at) - new Date(a.started_at)
      );
      
      setStockTakes(sortedTakes);
      
    } catch (error) {
      console.error('Error loading stock takes:', error);
      Alert.alert('Error', 'Failed to load stock take history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStockTakes();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (startDate, endDate) => {
    if (!endDate) return 'In Progress';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationMs = end - start;
    
    const minutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const getStatusColor = (status, balanceStatus) => {
    if (status === 'completed') {
      return balanceStatus === 'balanced' ? '#10b981' : '#f59e0b'; // Green for balanced, orange for unbalanced
    }
    if (status === 'failed') {
      return '#ef4444'; // Red for failed
    }
    if (status === 'in_progress') {
      return '#3b82f6'; // Blue for in progress
    }
    return '#6b7280'; // Gray for cancelled
  };

  const getStatusIcon = (status, balanceStatus) => {
    if (status === 'completed') {
      return balanceStatus === 'balanced' ? '✅' : '⚠️';
    }
    if (status === 'failed') {
      return '❌';
    }
    if (status === 'in_progress') {
      return '⏳';
    }
    return '🚫';
  };

  const getTypeIcon = (stockTakeType) => {
    return stockTakeType === 'weekly' ? '📅' : '🗓️';
  };

  const filteredStockTakes = stockTakes.filter(stockTake => {
    if (filter === 'all') return true;
    if (filter === 'completed') return stockTake.status === 'completed';
    if (filter === 'failed') return stockTake.status === 'failed';
    if (filter === 'weekly') return stockTake.stock_take_type === 'weekly';
    if (filter === 'monthly') return stockTake.stock_take_type === 'monthly';
    return true;
  });

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>📊 Stock Take History</Text>
      <TouchableOpacity 
        onPress={onRefresh} 
        style={[styles.headerActionButton, styles.refreshButton]}
        disabled={refreshing}
      >
        <Text style={styles.headerActionText}>{refreshing ? '⏳' : '🔄'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {[
          { key: 'all', label: 'All', icon: '📋' },
          { key: 'completed', label: 'Completed', icon: '✅' },
          { key: 'failed', label: 'Failed', icon: '❌' },
          { key: 'weekly', label: 'Weekly', icon: '📅' },
          { key: 'monthly', label: 'Monthly', icon: '🗓️' },
        ].map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.filterButton, filter === item.key && styles.filterButtonActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={styles.filterIcon}>{item.icon}</Text>
            <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderStockTakeItem = (stockTake) => (
    <View key={stockTake.id} style={styles.stockTakeCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleSection}>
          <Text style={styles.cardTitle}>
            {getTypeIcon(stockTake.stock_take_type)} {stockTake.name}
          </Text>
          <Text style={styles.cardSubtitle}>
            {stockTake.stock_take_type_display}
          </Text>
        </View>
        
        <View style={styles.statusContainer}>
          <Text style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(stockTake.status, stockTake.balance_status) }
          ]}>
            {getStatusIcon(stockTake.status, stockTake.balance_status)} {stockTake.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Started:</Text>
          <Text style={styles.infoValue}>{formatDate(stockTake.started_at)}</Text>
        </View>
        
        {stockTake.completed_at && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Completed:</Text>
            <Text style={styles.infoValue}>{formatDate(stockTake.completed_at)}</Text>
          </View>
        )}
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Duration:</Text>
          <Text style={styles.infoValue}>
            {formatDuration(stockTake.started_at, stockTake.completed_at)}
          </Text>
        </View>

        {stockTake.total_products_counted > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Products Counted:</Text>
            <Text style={styles.infoValue}>{stockTake.total_products_counted}</Text>
          </View>
        )}

        {stockTake.status !== 'in_progress' && (
          <View style={styles.discrepancyInfo}>
            <View style={styles.discrepancyRow}>
              <Text style={styles.discrepancyLabel}>Exact Match:</Text>
              <Text style={styles.exactCount}>{stockTake.exact_match_count}</Text>
            </View>
            <View style={styles.discrepancyRow}>
              <Text style={styles.discrepancyLabel}>Overstock:</Text>
              <Text style={styles.overstockCount}>{stockTake.overstock_count}</Text>
            </View>
            <View style={styles.discrepancyRow}>
              <Text style={styles.discrepancyLabel}>Understock:</Text>
              <Text style={styles.understockCount}>{stockTake.understock_count}</Text>
            </View>
          </View>
        )}

        {stockTake.failure_reason && (
          <View style={styles.failureReason}>
            <Text style={styles.failureReasonLabel}>Failure Reason:</Text>
            <Text style={styles.failureReasonText}>{stockTake.failure_reason}</Text>
          </View>
        )}

        {stockTake.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes:</Text>
            <Text style={styles.notesText}>{stockTake.notes}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>No Stock Takes Found</Text>
      <Text style={styles.emptyDescription}>
        {filter === 'all' 
          ? "Start your first stock take to see history here."
          : `No ${filter} stock takes found.`
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading stock take history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderFilters()}
      
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredStockTakes.length === 0 ? (
          renderEmptyState()
        ) : (
          filteredStockTakes.map(renderStockTakeItem)
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#333',
    borderRadius: 6,
  },
  refreshButton: {
    backgroundColor: '#10b981',
  },
  headerActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  filterText: {
    color: '#cccccc',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  stockTakeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  cardTitleSection: {
    flex: 1,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#999999',
    fontSize: 12,
  },
  statusContainer: {
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cardContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#999999',
    fontSize: 14,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  discrepancyInfo: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  discrepancyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  discrepancyLabel: {
    color: '#cccccc',
    fontSize: 12,
  },
  exactCount: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  overstockCount: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  understockCount: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  failureReason: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  failureReasonLabel: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  failureReasonText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
  },
  notesSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  notesLabel: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notesText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyDescription: {
    color: '#999999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default StockTakeHistoryScreen;