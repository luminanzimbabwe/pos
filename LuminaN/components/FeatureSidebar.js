import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(width * 0.75, 350); // Cover up to 75% of screen, max 350px

const FeatureSidebar = ({ isVisible, onClose }) => {
  const navigation = useNavigation();
  const [sidebarX] = useState(new Animated.Value(-SIDEBAR_WIDTH));

  // Animation for opening/closing sidebar
  React.useEffect(() => {
    Animated.timing(sidebarX, {
      toValue: isVisible ? 0 : -SIDEBAR_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  // Pan responder for swipe gestures
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        return evt.nativeEvent.locationX < 50; // Only respond to touches near the left edge
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return evt.nativeEvent.locationX < 50;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0 && isVisible) {
          sidebarX.setValue(-SIDEBAR_WIDTH + gestureState.dx);
        } else if (gestureState.dx < 0 && !isVisible) {
          sidebarX.setValue(-SIDEBAR_WIDTH + gestureState.dx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 100) {
          // Swipe right to open
          onClose();
        } else if (gestureState.dx < -50) {
          // Swipe left to close
          onClose();
        } else {
          // Reset to original position
          Animated.timing(sidebarX, {
            toValue: isVisible ? 0 : -SIDEBAR_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const features = [
    {
      id: 'today-sales',
      title: '📊 Today\'s Sales',
      description: 'View today\'s sales by category & personnel',
      icon: '📊',
      screen: 'OwnerSales',
      color: '#06b6d4',
    },
    {
      id: 'sales-refunds',
      title: '💰 Sales & Refunds',
      description: 'View sales history & manage refunds',
      icon: '💰',
      screen: 'SalesAndRefunds',
      color: '#10b981',
    },
    {
      id: 'pos-price',
      title: '🏷️ POS Price Labels',
      description: 'Print product price tags',
      icon: '🏷️',
      screen: 'POSPrice',
      color: '#f59e0b',
    },
    {
      id: 'stock-valuation',
      title: '💎 Stock Valuation',
      description: 'Calculate inventory value',
      icon: '💎',
      screen: 'StockValuation',
      color: '#22c55e',
    },
    {
      id: 'restock-manager',
      title: '📦 Restock Manager',
      description: 'Manage negative stock transitions',
      icon: '📦',
      screen: 'RestockManager',
      color: '#f59e0b',
    },
    {
      id: 'stock-transfer',
      title: '🔄 Stock Transfer',
      description: 'Transfer & convert stock between products',
      icon: '🔄',
      screen: 'StockTransfer',
      color: '#8b5cf6',
    },
    {
      id: 'stock-transfer-history',
      title: '📊 Transfer History',
      description: 'View financial impact & analysis',
      icon: '📊',
      screen: 'StockTransferHistory',
      color: '#06b6d4',
    },
    {
      id: 'stock-take',
      title: '📋 Stock Take',
      description: 'Physical inventory counting & discrepancy analysis',
      icon: '📋',
      screen: 'StockTake',
      color: '#8b5cf6',
    },
    {
      id: 'expense-management',
      title: '💸 Expense Management',
      description: 'Track expenses and process refunds',
      icon: '💸',
      screen: 'ExpenseManagement',
      color: '#ef4444',
    },
    {
      id: 'inventory-audit',
      title: '📋 Inventory Audit',
      description: 'Track stock changes',
      icon: '📋',
      screen: 'InventoryAuditTrail',
      color: '#3b82f6',
    },
    {
      id: 'low-stock-alerts',
      title: '⚠️ Low Stock Alerts',
      description: 'Monitor critical levels',
      icon: '⚠️',
      screen: 'LowStockAlerts',
      color: '#ef4444',
    },
    {
      id: 'profit-analysis',
      title: '📊 Profit Analysis',
      description: 'Revenue & margin reports',
      icon: '📊',
      screen: 'ProfitAnalysis',
      color: '#8b5cf6',
    },
    {
      id: 'supplier-management',
      title: '🏢 Supplier Management',
      description: 'Manage vendor relationships',
      icon: '🏢',
      screen: 'SupplierManagement',
      color: '#f59e0b',
    },
    {
      id: 'stock-movements',
      title: '📦 Stock Movements',
      description: 'Track inventory flow',
      icon: '📦',
      screen: 'StockMovements',
      color: '#06b6d4',
    },
    {
      id: 'price-comparison',
      title: '💲 Price Comparison',
      description: 'Compare supplier prices',
      icon: '💲',
      screen: 'PriceComparison',
      color: '#84cc16',
    },
    {
      id: 'demand-forecasting',
      title: '🔮 Demand Forecasting',
      description: 'Predict future demand',
      icon: '🔮',
      screen: 'DemandForecasting',
      color: '#ec4899',
    },
  ];

  const handleFeaturePress = (feature) => {
    onClose(); // Close sidebar first
    
    // Navigate to the feature screen
    if (feature.screen === 'OwnerSales') {
      navigation.navigate('OwnerSales');
    } else if (feature.screen === 'StockValuation') {
      navigation.navigate('StockValuation');
    } else if (feature.screen === 'InventoryAuditTrail') {
      navigation.navigate('Reports'); // This navigates to the reports tab
    } else if (feature.screen === 'POSPrice') {
      navigation.navigate('POSPrice');
    } else if (feature.screen === 'SalesAndRefunds') {
      navigation.navigate('SalesAndRefunds');
    } else if (feature.screen === 'RestockManager') {
      navigation.navigate('RestockManager');
    } else if (feature.screen === 'StockTransfer') {
      navigation.navigate('StockTransfer');
    } else if (feature.screen === 'StockTransferHistory') {
      navigation.navigate('StockTransferHistory');
    } else if (feature.screen === 'ExpenseManagement') {
      navigation.navigate('ExpenseManagement');
    } else if (feature.screen === 'StockTake') {
      navigation.navigate('StockTake');
    } else {
      // For other features, show a placeholder message
      console.log(`🚀 Feature "${feature.title}" pressed - Coming soon!`);
    }
  };

  const renderFeatureItem = (feature) => (
    <TouchableOpacity
      key={feature.id}
      style={styles.featureItem}
      onPress={() => handleFeaturePress(feature)}
      activeOpacity={0.8}
    >
      <View style={[styles.featureIcon, { backgroundColor: feature.color }]}>
        <Text style={styles.featureIconText}>{feature.icon}</Text>
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.featureDescription}>{feature.description}</Text>
      </View>
      <Text style={styles.featureArrow}>→</Text>
    </TouchableOpacity>
  );

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: sidebarX }],
            width: SIDEBAR_WIDTH,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Sidebar Header */}
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarTitleContainer}>
            <Text style={styles.sidebarTitle}>🚀 Features</Text>
            <Text style={styles.sidebarSubtitle}>Quick Access Tools</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Features List */}
        <ScrollView style={styles.featuresList} showsVerticalScrollIndicator={false}>
          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>📊 Analytics & Reports</Text>
            {features.slice(0, 2).map(renderFeatureItem)}
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>📦 Inventory Management</Text>
            {features.slice(2, 5).map(renderFeatureItem)}
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>🏢 Business Tools</Text>
            {features.slice(5).map(renderFeatureItem)}
          </View>
        </ScrollView>

        {/* Sidebar Footer */}
        <View style={styles.sidebarFooter}>
          <Text style={styles.footerText}>💡 Pro Tip</Text>
          <Text style={styles.footerDescription}>
            Swipe from the left edge to quickly access features on mobile devices.
          </Text>
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#1a1a1a',
    borderRightWidth: 1,
    borderRightColor: '#333',
    zIndex: 1001,
    ...Platform.select({
      web: {
        boxShadow: '4px 0 20px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sidebarTitleContainer: {
    flex: 1,
  },
  sidebarTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sidebarSubtitle: {
    color: '#999',
    fontSize: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: 'bold',
  },
  featuresList: {
    flex: 1,
    padding: 16,
  },
  featuresSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    marginLeft: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureIconText: {
    fontSize: 18,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDescription: {
    color: '#999',
    fontSize: 12,
  },
  featureArrow: {
    color: '#666',
    fontSize: 16,
    marginLeft: 8,
  },
  sidebarFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#0f0f0f',
  },
  footerText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  footerDescription: {
    color: '#999',
    fontSize: 11,
    lineHeight: 16,
  },
});

export default FeatureSidebar;