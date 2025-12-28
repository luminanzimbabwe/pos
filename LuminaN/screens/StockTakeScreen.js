import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { shopAPI } from '../services/api';
import { shopStorage } from '../services/storage';
import { ROUTES } from '../constants/navigation';

const StockTakeScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState([]);
  const [shopCredentials, setShopCredentials] = useState(null);
  const [currentStockTake, setCurrentStockTake] = useState(null);
  
  // Stock take data
  const [stockTakeName, setStockTakeName] = useState('');
  const [stockTakeNotes, setStockTakeNotes] = useState('');
  const [stockTakeType, setStockTakeType] = useState('weekly'); // 'weekly' or 'monthly'
  const [countedQuantities, setCountedQuantities] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isActiveStockTake, setIsActiveStockTake] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showApplyConfirmationModal, setShowApplyConfirmationModal] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [isApplyingInventory, setIsApplyingInventory] = useState(false);
  const [inventoryApplied, setInventoryApplied] = useState(false);
  
  // Summary data
  const [summary, setSummary] = useState({
    totalProducts: 0,
    countedProducts: 0,
    totalDiscrepancy: 0,
    overstockCount: 0,
    understockCount: 0,
    exactCount: 0
  });

  useEffect(() => {
    loadShopCredentials();
  }, []);

  useEffect(() => {
    if (shopCredentials) {
      loadProducts();
    }
  }, [shopCredentials]);

  useEffect(() => {
    calculateSummary();
  }, [countedQuantities, products]);

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

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await shopAPI.getProducts();
      const productsData = response.data || [];
      
      // Sort products by name for consistent ordering
      const sortedProducts = productsData.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(sortedProducts);
      
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleCreateStockTake = async () => {
    if (!stockTakeName.trim()) {
      Alert.alert('Error', 'Stock take name is required.');
      return;
    }

    try {
      const data = {
        name: stockTakeName.trim(),
        stock_take_type: stockTakeType, // Include the stock take type
        notes: stockTakeNotes.trim(),
        password: shopCredentials.shop_owner_master_password,
      };

      const response = await shopAPI.createStockTake(data);
      setCurrentStockTake(response.data);
      setIsActiveStockTake(true);
      
      Alert.alert('Success', `${stockTakeType === 'weekly' ? 'Weekly' : 'Monthly'} stock take started! Begin counting your products.`);
      setShowCreateModal(false);
      setStockTakeName('');
      setStockTakeNotes('');
      
      // Initialize counted quantities with zeros
      const initialQuantities = {};
      products.forEach(product => {
        initialQuantities[product.id] = 0;
      });
      setCountedQuantities(initialQuantities);
      
      // Reset inventory application status
      setInventoryApplied(false);
      
    } catch (error) {
      console.error('Error creating stock take:', error);
      Alert.alert('Error', 'Failed to create stock take.');
    }
  };

  const handleQuantityChange = (productId, value) => {
    const quantity = parseFloat(value) || 0;
    setCountedQuantities(prev => ({
      ...prev,
      [productId]: quantity
    }));
  };

  const handleNext = () => {
    if (currentIndex < products.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleJumpTo = (index) => {
    setCurrentIndex(index);
  };

  const handleWeeklyStockTakeCompletion = async () => {
    // Mark as completed but don't update inventory for weekly stock takes
    setInventoryApplied(true);
    setShowResultsModal(false);
    
    Alert.alert(
      '📋 Weekly Stock Take Saved',
      'Weekly stock take has been saved for investigation.\n\n' +
      '⚠️ Important Notes:\n' +
      '• Inventory was NOT updated\n' +
      '• This data is for monitoring and investigation only\n' +
      '• No changes were made to actual stock levels\n' +
      '• Use monthly stock takes to update inventory\n\n' +
      'The discrepancies will be available for review in the history.',
      [
        {
          text: 'OK',
          onPress: async () => {
            // Reset the stock take to allow starting a new one
            setIsActiveStockTake(false);
            setCurrentStockTake(null);
            setCountedQuantities({});
            setIsCompleted(false);
            setIsFinalized(false);
            setResultsData(null);
            setCurrentIndex(0);
          }
        }
      ]
    );
  };

  const confirmInventoryApplication = async () => {
    setShowApplyConfirmationModal(false);
    
    if (!currentStockTake || (!isCompleted && !isFinalized)) {
      Alert.alert('Error', 'Stock take must be completed before applying to inventory.');
      return;
    }

    // Check if this is a weekly stock take with discrepancies
    const hasDiscrepancies = resultsData && (resultsData.overstock.length > 0 || resultsData.understock.length > 0);
    const isWeeklyStockTake = currentStockTake.stock_take_type === 'weekly';
    
    if (isWeeklyStockTake && hasDiscrepancies) {
      Alert.alert(
        'ℹ️ Weekly Stock Take Saved',
        'Weekly stock take has been saved for investigation.\n\n' +
        'Note: Inventory was NOT updated. Weekly stock takes are for monitoring only.\n\n' +
        'Monthly stock takes will update actual inventory.',
        [
          {
            text: 'OK',
            onPress: async () => {
              setInventoryApplied(true);
              setShowResultsModal(false);
              
              // Reset the stock take to allow starting a new one
              setIsActiveStockTake(false);
              setCurrentStockTake(null);
              setCountedQuantities({});
              setIsCompleted(false);
              setIsFinalized(false);
              setResultsData(null);
              setCurrentIndex(0);
            }
          }
        ]
      );
      return;
    }

    // Only apply inventory for monthly stock takes
    if (currentStockTake.stock_take_type === 'weekly') {
      Alert.alert(
        'ℹ️ Weekly Stock Take Saved',
        'Weekly stock take has been saved for investigation.\n\n' +
        'Note: Inventory was NOT updated. Weekly stock takes are for monitoring only.\n\n' +
        'Monthly stock takes will update actual inventory.',
        [
          {
            text: 'OK',
            onPress: async () => {
              setInventoryApplied(true);
              setShowResultsModal(false);
              
              // Reset the stock take to allow starting a new one
              setIsActiveStockTake(false);
              setCurrentStockTake(null);
              setCountedQuantities({});
              setIsCompleted(false);
              setIsFinalized(false);
              setResultsData(null);
              setCurrentIndex(0);
            }
          }
        ]
      );
      return;
    }

    try {
      setIsApplyingInventory(true);
      
      let appliedCount = 0;
      let totalAdjustmentValue = 0;
      const adjustments = [];

      // Apply each product's counted quantity to inventory (MONTHLY STOCK TAKE ONLY)
      for (const product of products) {
        const countedQty = parseFloat(countedQuantities[product.id]) || 0;
        const systemQty = parseFloat(product.stock_quantity) || 0;
        
        if (countedQty !== systemQty) {
          // Calculate the adjustment needed
          const adjustment = countedQty - systemQty;
          const newQuantity = countedQty;
          
          try {
            // Update the product stock via API
            await shopAPI.updateProduct(product.id, {
              stock_quantity: newQuantity
            });
            
            appliedCount++;
            totalAdjustmentValue += Math.abs(adjustment) * parseFloat(product.cost_price || 0);
            
            adjustments.push({
              name: product.name,
              lineCode: product.line_code,
              oldQuantity: systemQty,
              newQuantity: newQuantity,
              adjustment: adjustment
            });
            
          } catch (productError) {
            console.error(`Error updating product ${product.name}:`, productError);
          }
        }
      }

      // Calculate comprehensive financial summary
      const shrinkageLoss = resultsData?.shrinkageValue || 0;
      const overstockValue = resultsData?.overstockValue || 0;
      const netImpact = resultsData?.totalFinancialImpact || 0;
      const accuracyRate = resultsData ? Math.round((resultsData.exactMatches.length / resultsData.totalProducts) * 100) : 100;
      const exactMatches = resultsData?.exactMatches?.length || 0;
      const totalProducts = resultsData?.totalProducts || products.length;
      
      // Show comprehensive success message with financial summary
      const successMessage = appliedCount > 0 
        ? `✅ INVENTORY SUCCESSFULLY UPDATED!\n\n` +
          `📊 Products Updated: ${appliedCount} of ${totalProducts}\n` +
          `💸 Shrinkage Loss Identified: ${formatCurrency(shrinkageLoss)}\n` +
          `📈 Overstock Value: ${formatCurrency(overstockValue)}\n` +
          `⚖️ Net Financial Impact: ${formatCurrency(netImpact)}\n` +
          `🎯 Inventory Accuracy: ${accuracyRate}%\n\n` +
          `🔄 Your inventory has been updated with the counted values.\n` +
          `📋 These new quantities will be used for future operations.`
        : `✅ PERFECT STOCK TAKE!\n\n` +
          `🎯 All ${totalProducts} products counted exactly as expected\n` +
          `💰 No inventory adjustments needed\n` +
          `✨ Your stock levels are perfectly accurate!\n\n` +
          `✅ System inventory is up to date and accurate.`;
      
      Alert.alert(
        '🎉 SUCCESS! Inventory Applied', 
        successMessage, 
        [
          {
            text: '✅ Perfect!',
            onPress: async () => {
              setInventoryApplied(true);
              setShowResultsModal(false);
              
              // Refresh products to get updated stock quantities
              await loadProducts();
              
              // Reset the stock take to allow starting a new one
              setIsActiveStockTake(false);
              setCurrentStockTake(null);
              setCountedQuantities({});
              setIsCompleted(false);
              setIsFinalized(false);
              setResultsData(null);
              setCurrentIndex(0);
            },
            style: 'default'
          }
        ],
        { 
          cancelable: false,
          onDismiss: () => {
            // This ensures the alert can't be dismissed by tapping outside
            setInventoryApplied(true);
            setShowResultsModal(false);
            
            // Refresh products to get updated stock quantities
            loadProducts();
            
            // Reset the stock take to allow starting a new one
            setIsActiveStockTake(false);
            setCurrentStockTake(null);
            setCountedQuantities({});
            setIsCompleted(false);
            setIsFinalized(false);
            setResultsData(null);
            setCurrentIndex(0);
          }
        }
      );
      
    } catch (error) {
      console.error('Error applying to inventory:', error);
      
      // Show user-friendly error modal
      Alert.alert(
        '❌ Inventory Application Failed',
        `Failed to apply stock take results to inventory:\n\n` +
        `• Error: ${error.message}\n` +
        `• Please check your internet connection and try again.\n` +
        `• If the problem persists, contact support.`,
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Retry', onPress: () => confirmInventoryApplication() }
        ]
      );
    } finally {
      setIsApplyingInventory(false);
    }
  };

  const handleApplyToInventory = async () => {
    if (!currentStockTake || (!isCompleted && !isFinalized)) {
      Alert.alert('Error', 'Stock take must be completed before applying to inventory.');
      return;
    }

    // Check if this is a weekly stock take with discrepancies
    const hasDiscrepancies = resultsData && (resultsData.overstock.length > 0 || resultsData.understock.length > 0);
    const isWeeklyStockTake = currentStockTake.stock_take_type === 'weekly';
    
    if (isWeeklyStockTake && hasDiscrepancies) {
      // Show warning for weekly stock take with discrepancies
      Alert.alert(
        '⚠️ Weekly Stock Take Warning',
        `This is a WEEKLY stock take with discrepancies:\n\n` +
        `• ${resultsData.understock.length} items with stock shortages\n` +
        `• ${resultsData.overstock.length} items with excess stock\n` +
        `• Weekly stock takes should balance perfectly\n\n` +
        `Do you want to:\n` +
        `• Continue and save for investigation (recommended)\n` +
        `• Cancel and recount`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue & Save', 
            onPress: () => handleWeeklyStockTakeCompletion()
          }
        ]
      );
      return;
    }

    // Show confirmation screen for inventory application
    setShowApplyConfirmationModal(true);
    return;
  };

  const handleCompleteStockTake = async () => {
    try {
      // First, add all counted quantities as stock take items
      const itemsToAdd = [];
      
      for (const product of products) {
        const countedQty = parseFloat(countedQuantities[product.id]) || 0;
        if (countedQty >= 0) { // Only add items with valid counted quantities
          itemsToAdd.push({
            product_id: product.id,
            counted_quantity: countedQty
          });
        }
      }

      // Add items in bulk
      if (itemsToAdd.length > 0) {
        await shopAPI.bulkAddStockTakeItems(currentStockTake.id, {
          items: itemsToAdd
        });
      }

      // Complete the stock take via backend API
      const completeData = {
        action: 'complete',
        cashier_id: shopCredentials.cashier_id || null
      };

      await shopAPI.completeStockTake(currentStockTake.id, completeData);

      // Generate local results data for display
      const results = {
        totalProducts: products.length,
        countedProducts: Object.keys(countedQuantities).filter(id => countedQuantities[id] > 0).length,
        exactMatches: [],
        overstock: [],
        understock: [],
        totalFinancialImpact: 0,
        shrinkageValue: 0,
        overstockValue: 0
      };

      products.forEach(product => {
        const systemQty = parseFloat(product.stock_quantity) || 0;
        const countedQty = parseFloat(countedQuantities[product.id]) || 0;
        const discrepancy = countedQty - systemQty;
        const costPrice = parseFloat(product.cost_price) || 0;
        const financialImpact = discrepancy * costPrice;
        
        const itemResult = {
          id: product.id,
          name: product.name,
          category: product.category,
          lineCode: product.line_code,
          systemQty,
          countedQty,
          discrepancy,
          costPrice,
          financialImpact,
          status: discrepancy > 0 ? 'overstock' : discrepancy < 0 ? 'understock' : 'exact'
        };

        if (discrepancy === 0) {
          results.exactMatches.push(itemResult);
        } else if (discrepancy > 0) {
          results.overstock.push(itemResult);
          results.overstockValue += financialImpact;
        } else {
          results.understock.push(itemResult);
          results.shrinkageValue += Math.abs(financialImpact);
        }
        
        results.totalFinancialImpact += financialImpact;
      });

      setResultsData(results);
      setIsCompleted(true);
      setIsFinalized(true);
      setShowResultsModal(true);
      
      // Refresh the stock take data to get updated status
      const updatedStockTake = await shopAPI.getStockTakeDetail(currentStockTake.id);
      setCurrentStockTake(updatedStockTake.data);
      
    } catch (error) {
      console.error('Error completing stock take:', error);
      Alert.alert('Error', 'Failed to complete stock take. Please try again.');
    }
  };

  const calculateSummary = () => {
    let totalProducts = products.length;
    let countedProducts = 0;
    let totalDiscrepancy = 0;
    let overstockCount = 0;
    let understockCount = 0;
    let exactCount = 0;

    products.forEach(product => {
      const systemQty = parseFloat(product.stock_quantity) || 0;
      const countedQty = parseFloat(countedQuantities[product.id]) || 0;
      
      if (countedQty > 0) {
        countedProducts++;
      }
      
      const discrepancy = countedQty - systemQty;
      totalDiscrepancy += discrepancy;
      
      if (discrepancy > 0) {
        overstockCount++;
      } else if (discrepancy < 0) {
        understockCount++;
      } else {
        exactCount++;
      }
    });

    setSummary({
      totalProducts,
      countedProducts,
      totalDiscrepancy: Math.abs(totalDiscrepancy),
      overstockCount,
      understockCount,
      exactCount
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getDiscrepancyColor = (systemQty, countedQty) => {
    const discrepancy = countedQty - systemQty;
    if (discrepancy > 0) return '#10b981'; // Green for overstock
    if (discrepancy < 0) return '#ef4444'; // Red for understock
    return '#6b7280'; // Gray for exact
  };

  const getDiscrepancyText = (systemQty, countedQty) => {
    const discrepancy = countedQty - systemQty;
    if (discrepancy > 0) return `+${discrepancy}`;
    if (discrepancy < 0) return `${discrepancy}`;
    return '0';
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>📋 Stock Take Counting</Text>
      <TouchableOpacity 
        onPress={onRefresh} 
        style={[styles.headerActionButton, styles.refreshButton]}
        disabled={refreshing}
      >
        <Text style={styles.headerActionText}>{refreshing ? '⏳' : '🔄'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>📋 Start Stock Take</Text>
          
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Stock Take Type *</Text>
            <View style={styles.typeSelection}>
              <TouchableOpacity
                style={[styles.typeButton, stockTakeType === 'weekly' && styles.typeButtonActive]}
                onPress={() => setStockTakeType('weekly')}
              >
                <Text style={[styles.typeButtonText, stockTakeType === 'weekly' && styles.typeButtonTextActive]}>
                  📅 Weekly Stock Take
                </Text>
                <Text style={styles.typeDescription}>
                  Simple counting - no system quantities shown. Blind counting.
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.typeButton, stockTakeType === 'monthly' && styles.typeButtonActive]}
                onPress={() => setStockTakeType('monthly')}
              >
                <Text style={[styles.typeButtonText, stockTakeType === 'monthly' && styles.typeButtonTextActive]}>
                  🗓️ Monthly Stock Take
                </Text>
                <Text style={styles.typeDescription}>
                  Same as weekly - simple counting, no system quantities shown.
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Stock Take Name *</Text>
            <TextInput
              style={styles.formInput}
              value={stockTakeName}
              onChangeText={setStockTakeName}
              placeholder={`e.g., ${stockTakeType === 'weekly' ? 'Weekly' : 'Monthly'} Count - Dec 2024`}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
              value={stockTakeNotes}
              onChangeText={setStockTakeNotes}
              placeholder="Any notes about this stock take..."
              multiline
              numberOfLines={3}
            />
          </View>
          
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={handleCreateStockTake}
            >
              <Text style={styles.confirmButtonText}>Start Counting</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressInfo}>
        <Text style={styles.progressText}>
          Product {currentIndex + 1} of {products.length}
        </Text>
        <Text style={styles.progressPercentage}>
          {Math.round(((currentIndex + 1) / products.length) * 100)}%
        </Text>
      </View>
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${((currentIndex + 1) / products.length) * 100}%` }
          ]} 
        />
      </View>
    </View>
  );

  const renderProductRow = (product, index) => {
    const systemQty = parseFloat(product.stock_quantity) || 0;
    const countedQty = parseFloat(countedQuantities[product.id]) || 0;
    const discrepancy = countedQty - systemQty;
    const isCounted = countedQty > 0;
    
    return (
      <View 
        key={product.id} 
        style={[
          styles.productRow,
          index === currentIndex && styles.currentRow,
          index % 2 === 0 ? styles.rowEven : styles.rowOdd,
          isCounted && styles.countedRow
        ]}
      >
        <View style={styles.rowNumber}>
          <Text style={styles.rowNumberText}>{index + 1}</Text>
          {isCounted && (
            <View style={styles.countedBadge}>
              <Text style={styles.countedBadgeText}>✓</Text>
            </View>
          )}
        </View>
        
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productDetails}>
            {product.category} | {product.line_code}
          </Text>
        </View>
        
        <View style={styles.quantitySection}>
          {isFinalized ? (
            // Show all info after finalization
            <>
              <View style={styles.systemQuantity}>
                <Text style={styles.quantityLabel}>System</Text>
                <Text style={styles.systemQtyText}>{systemQty}</Text>
              </View>
              
              <View style={styles.countedQuantity}>
                <Text style={styles.quantityLabel}>Counted</Text>
                <Text style={styles.countedDisplay}>{countedQty}</Text>
              </View>
              
              <View style={styles.discrepancy}>
                <Text style={styles.quantityLabel}>Diff</Text>
                <Text style={[
                  styles.discrepancyText,
                  { color: getDiscrepancyColor(systemQty, countedQty) }
                ]}>
                  {getDiscrepancyText(systemQty, countedQty)}
                </Text>
              </View>
            </>
          ) : (
            // Simple counting - only show input
            <View style={styles.countedQuantityOnly}>
              <Text style={styles.quantityLabel}>Count</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.countedInput,
                    isCounted && styles.countedInputCompleted
                  ]}
                  value={countedQty.toString()}
                  onChangeText={(value) => handleQuantityChange(product.id, value)}
                  keyboardType="numeric"
                  placeholder="0"
                  autoFocus={index === currentIndex}
                />
                {isCounted && (
                  <View style={styles.statusIndicator}>
                    <Text style={styles.statusText}>✓</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderNavigation = () => (
    <View style={styles.navigation}>
      <TouchableOpacity 
        style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
        onPress={handlePrevious}
        disabled={currentIndex === 0}
      >
        <Text style={styles.navButtonText}>← Previous</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.jumpButton, isFinalized && styles.jumpButtonDisabled]}
        onPress={() => {
          if (!isFinalized) {
            setShowCompleteModal(true);
          } else {
            setShowResultsModal(true);
          }
        }}
        disabled={isFinalized}
      >
        <Text style={styles.jumpButtonText}>{isFinalized ? '📊 Results' : '📊 Finalize'}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navButton, currentIndex === products.length - 1 && styles.navButtonDisabled]}
        onPress={handleNext}
        disabled={currentIndex === products.length - 1}
      >
        <Text style={styles.navButtonText}>Next →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderQuickJump = () => (
    <View style={styles.quickJumpContainer}>
      <Text style={styles.quickJumpTitle}>Quick Jump:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickJumpScroll}>
        {products.map((product, index) => {
          const countedQty = parseFloat(countedQuantities[product.id]) || 0;
          const isCounted = countedQty > 0;
          
          return (
            <TouchableOpacity
              key={product.id}
              style={[
                styles.quickJumpButton,
                index === currentIndex && styles.quickJumpButtonActive,
                isCounted && styles.quickJumpButtonCounted
              ]}
              onPress={() => handleJumpTo(index)}
            >
              <Text style={[
                styles.quickJumpText,
                index === currentIndex && styles.quickJumpTextActive,
                isCounted && styles.quickJumpTextCounted
              ]}>
                {index + 1}
              </Text>
              {isCounted && (
                <View style={styles.quickJumpCountedDot} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderResultsModal = () => {
    if (!resultsData) return null;

    return (
      <Modal
        visible={showResultsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResultsModal(false)}
      >
        <View style={styles.resultsModalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: '95%', width: '95%', maxHeight: '90%' }]}>
            <View style={styles.resultsHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>📊 Stock Take Results</Text>
                {inventoryApplied && (
                  <View style={styles.successBanner}>
                    <Text style={styles.successBannerText}>🎉 SUCCESS! Inventory Updated Successfully</Text>
                    <Text style={styles.successBannerSubtext}>Your stock levels have been updated with the counted values</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowResultsModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.resultsContent} showsVerticalScrollIndicator={true}>
              {/* Overall Summary */}
              <View style={styles.resultsSummary}>
                <Text style={styles.resultsSectionTitle}>📈 Overall Summary</Text>
                <View style={styles.summaryStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{resultsData.totalProducts}</Text>
                    <Text style={styles.statLabel}>Total Products</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{resultsData.exactMatches.length}</Text>
                    <Text style={styles.statLabel}>✅ Exact Match</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{resultsData.overstock.length}</Text>
                    <Text style={styles.statLabel}>📈 Overstock</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{resultsData.understock.length}</Text>
                    <Text style={styles.statLabel}>📉 Understock</Text>
                  </View>
                </View>

                {/* Complete Financial Summary */}
                <View style={styles.financialImpact}>
                  <Text style={styles.financialSectionTitle}>💰 Complete Financial Summary</Text>
                  
                  {/* Core Financial Impact */}
                  <View style={styles.financialGroup}>
                    <Text style={styles.groupTitle}>📊 Core Financial Impact</Text>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>💸 Shrinkage Loss:</Text>
                      <Text style={[styles.impactValue, { color: '#ef4444' }]}>
                        {formatCurrency(resultsData.shrinkageValue)}
                      </Text>
                    </View>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>📈 Overstock Value:</Text>
                      <Text style={[styles.impactValue, { color: '#10b981' }]}>
                        {formatCurrency(resultsData.overstockValue)}
                      </Text>
                    </View>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>⚖️ Net Financial Impact:</Text>
                      <Text style={[
                        styles.impactValue,
                        { color: resultsData.totalFinancialImpact >= 0 ? '#10b981' : '#ef4444' }
                      ]}>
                        {formatCurrency(resultsData.totalFinancialImpact)}
                      </Text>
                    </View>
                  </View>

                  {/* Business Intelligence */}
                  <View style={styles.financialGroup}>
                    <Text style={styles.groupTitle}>🎯 Business Intelligence</Text>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>📦 Items Affected:</Text>
                      <Text style={styles.impactValue}>
                        {resultsData.understock.length + resultsData.overstock.length} products
                      </Text>
                    </View>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>✅ Accuracy Rate:</Text>
                      <Text style={styles.impactValue}>
                        {Math.round((resultsData.exactMatches.length / resultsData.totalProducts) * 100)}%
                      </Text>
                    </View>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>🔍 Investigation Needed:</Text>
                      <Text style={styles.impactValue}>
                        {resultsData.understock.length} shrinkage items
                      </Text>
                    </View>
                  </View>

                  {/* Sales & Profit Impact */}
                  <View style={styles.financialGroup}>
                    <Text style={styles.groupTitle}>💼 Sales & Profit Analysis</Text>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>💵 Potential Revenue Loss:</Text>
                      <Text style={[styles.impactValue, { color: '#ef4444' }]}>
                        {formatCurrency(resultsData.shrinkageValue)}
                      </Text>
                    </View>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>💰 Excess Inventory Value:</Text>
                      <Text style={[styles.impactValue, { color: '#f59e0b' }]}>
                        {formatCurrency(resultsData.overstockValue)}
                      </Text>
                    </View>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>📈 Profit Margin Impact:</Text>
                      <Text style={[
                        styles.impactValue,
                        { color: resultsData.totalFinancialImpact >= 0 ? '#10b981' : '#ef4444' }
                      ]}>
                        {resultsData.totalFinancialImpact >= 0 ? 'Improved' : 'Reduced'}
                      </Text>
                    </View>
                  </View>

                  {/* Wastage & Shrinkage Analysis */}
                  <View style={styles.financialGroup}>
                    <Text style={styles.groupTitle}>🗑️ Wastage & Shrinkage Analysis</Text>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>📉 Shrinkage Items:</Text>
                      <Text style={styles.impactValue}>
                        {resultsData.understock.length} products ({formatCurrency(resultsData.shrinkageValue)})
                      </Text>
                    </View>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>🔍 Investigation Priority:</Text>
                      <Text style={styles.impactValue}>
                        {resultsData.understock.length > 0 ? 'HIGH' : 'LOW'}
                      </Text>
                    </View>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactLabel}>⚠️ Risk Level:</Text>
                      <Text style={[
                        styles.impactValue,
                        { 
                          color: resultsData.shrinkageValue > 100 ? '#ef4444' : 
                                 resultsData.shrinkageValue > 50 ? '#f59e0b' : '#10b981' 
                        }
                      ]}>
                        {resultsData.shrinkageValue > 100 ? 'HIGH' : 
                         resultsData.shrinkageValue > 50 ? 'MEDIUM' : 'LOW'}
                      </Text>
                    </View>
                  </View>

                  {/* Recommendations */}
                  <View style={styles.financialGroup}>
                    <Text style={styles.groupTitle}>💡 Recommendations</Text>
                    {resultsData.understock.length > 0 && (
                      <View style={styles.recommendationItem}>
                        <Text style={styles.recommendationText}>
                          🔍 Investigate {resultsData.understock.length} shrinkage items immediately
                        </Text>
                      </View>
                    )}
                    {resultsData.overstock.length > 0 && (
                      <View style={styles.recommendationItem}>
                        <Text style={styles.recommendationText}>
                          📊 Review {resultsData.overstock.length} overstock items for pricing/marketing
                        </Text>
                      </View>
                    )}
                    {resultsData.exactMatches.length === resultsData.totalProducts && (
                      <View style={styles.recommendationItem}>
                        <Text style={styles.recommendationText}>
                          ✅ Perfect stock accuracy - maintain current procedures
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Shrinkage Items (Understock) */}
              {resultsData.understock.length > 0 && (
                <View style={styles.resultsSection}>
                  <Text style={styles.resultsSectionTitle}>📉 Shrinkage Items ({resultsData.understock.length})</Text>
                  <Text style={styles.sectionDescription}>Items with stock shortages - needs investigation</Text>
                  {resultsData.understock.map((item, index) => (
                    <View key={item.id} style={styles.resultItem}>
                      <View style={styles.resultItemHeader}>
                        <Text style={styles.resultItemName}>{item.name}</Text>
                        <View style={styles.resultBadges}>
                          <Text style={styles.discrepancyBadge}>{item.discrepancy}</Text>
                          <Text style={styles.valueBadge}>{formatCurrency(item.financialImpact)}</Text>
                        </View>
                      </View>
                      <Text style={styles.resultItemDetails}>
                        {item.category} | {item.lineCode} | System: {item.systemQty} → Counted: {item.countedQty}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Overstock Items */}
              {resultsData.overstock.length > 0 && (
                <View style={styles.resultsSection}>
                  <Text style={styles.resultsSectionTitle}>📈 Overstock Items ({resultsData.overstock.length})</Text>
                  <Text style={styles.sectionDescription}>Items with excess stock</Text>
                  {resultsData.overstock.map((item, index) => (
                    <View key={item.id} style={styles.resultItem}>
                      <View style={styles.resultItemHeader}>
                        <Text style={styles.resultItemName}>{item.name}</Text>
                        <View style={styles.resultBadges}>
                          <Text style={styles.discrepancyBadge}>{item.discrepancy}</Text>
                          <Text style={styles.valueBadge}>{formatCurrency(item.financialImpact)}</Text>
                        </View>
                      </View>
                      <Text style={styles.resultItemDetails}>
                        {item.category} | {item.lineCode} | System: {item.systemQty} → Counted: {item.countedQty}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Exact Matches */}
              {resultsData.exactMatches.length > 0 && (
                <View style={styles.resultsSection}>
                  <Text style={styles.resultsSectionTitle}>✅ Exact Matches ({resultsData.exactMatches.length})</Text>
                  <Text style={styles.sectionDescription}>Items counted correctly</Text>
                  {resultsData.exactMatches.slice(0, 5).map((item, index) => (
                    <View key={item.id} style={styles.resultItem}>
                      <View style={styles.resultItemHeader}>
                        <Text style={styles.resultItemName}>{item.name}</Text>
                        <Text style={styles.exactBadge}>✓ Exact</Text>
                      </View>
                      <Text style={styles.resultItemDetails}>
                        {item.category} | {item.lineCode} | {item.systemQty} units
                      </Text>
                    </View>
                  ))}
                  {resultsData.exactMatches.length > 5 && (
                    <Text style={styles.moreItemsText}>
                      +{resultsData.exactMatches.length - 5} more exact matches
                    </Text>
                  )}
                </View>
              )}

              {/* Priority Actions */}
              {(resultsData.understock.length > 0 || resultsData.overstock.length > 5) && (
                <View style={styles.priorityActions}>
                  <Text style={styles.priorityTitle}>🚨 Priority Actions Required</Text>
                  
                  {resultsData.understock.slice(0, 3).map((item, index) => (
                    <View key={item.id} style={styles.priorityItem}>
                      <Text style={styles.priorityItemText}>
                        🔍 {item.name}: {item.discrepancy} units missing ({formatCurrency(item.financialImpact)} loss)
                      </Text>
                    </View>
                  ))}
                  
                  {resultsData.understock.length > 3 && (
                    <Text style={styles.priorityMore}>
                      +{resultsData.understock.length - 3} more shrinkage items need investigation
                    </Text>
                  )}
                  
                  {resultsData.overstock.length > 5 && (
                    <Text style={styles.priorityMore}>
                      📈 {resultsData.overstock.length} overstock items may need pricing review
                    </Text>
                  )}
                </View>
              )}


              {/* Executive Summary */}
              <View style={styles.executiveSummary}>
                <Text style={styles.executiveTitle}>📋 Executive Summary</Text>
                <View style={styles.summaryStatsRow}>
                  <View style={styles.summaryStat}>
                    <Text style={[
                      styles.summaryStatValue,
                      { color: resultsData.exactMatches.length === resultsData.totalProducts ? '#10b981' : '#f59e0b' }
                    ]}>
                      {Math.round((resultsData.exactMatches.length / resultsData.totalProducts) * 100)}%
                    </Text>
                    <Text style={styles.summaryStatLabel}>Accuracy</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text style={[
                      styles.summaryStatValue,
                      { color: resultsData.shrinkageValue > 100 ? '#ef4444' : '#10b981' }
                    ]}>
                      {formatCurrency(resultsData.shrinkageValue)}
                    </Text>
                    <Text style={styles.summaryStatLabel}>Shrinkage Loss</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text style={[
                      styles.summaryStatValue,
                      { color: resultsData.totalFinancialImpact >= 0 ? '#10b981' : '#ef4444' }
                    ]}>
                      {resultsData.totalFinancialImpact >= 0 ? '+' : ''}{formatCurrency(resultsData.totalFinancialImpact)}
                    </Text>
                    <Text style={styles.summaryStatLabel}>Net Impact</Text>
                  </View>
                </View>
                <View style={styles.healthIndicator}>
                  <Text style={styles.healthText}>
                    {resultsData.shrinkageValue === 0 && resultsData.overstockValue === 0 
                      ? '🎉 Perfect Inventory Health - All systems optimal'
                      : resultsData.shrinkageValue <= 50 && resultsData.overstockValue <= 50
                      ? '✅ Good Inventory Health - Minor adjustments needed'
                      : resultsData.shrinkageValue <= 100
                      ? '⚠️ Fair Inventory Health - Investigation recommended'
                      : '🚨 Poor Inventory Health - Immediate action required'
                    }
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.resultsActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowResultsModal(false)}
              >
                <Text style={styles.cancelButtonText}>Close Results</Text>
              </TouchableOpacity>
              
              <View>
                <TouchableOpacity 
                  style={[
                    styles.applyButton, 
                    (isApplyingInventory || inventoryApplied) && styles.applyButtonDisabled
                  ]}
                  onPress={handleApplyToInventory}
                  disabled={isApplyingInventory || inventoryApplied}
                >
                  <Text style={styles.applyButtonText}>
                    {isApplyingInventory ? '⏳ Applying to Inventory...' : 
                     inventoryApplied ? '✅ Applied to Inventory' : 
                     currentStockTake?.stock_take_type === 'weekly' ? '✅ Save Weekly Count' : '✅ Apply to Inventory'}
                  </Text>
                </TouchableOpacity>
                
                {/* Loading indicator */}
                {isApplyingInventory && (
                  <View style={styles.loadingOverlay}>
                    <Text style={styles.loadingText}>🔄 Updating inventory... Please wait</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderSummaryModal = () => (
    <Modal
      visible={showCompleteModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowCompleteModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxWidth: '90%', width: '90%' }]}>
          <Text style={styles.modalTitle}>📊 Finalize Stock Take</Text>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summary.totalProducts}</Text>
              <Text style={styles.summaryLabel}>Total Products</Text>
            </View>
            
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summary.countedProducts}</Text>
              <Text style={styles.summaryLabel}>Counted</Text>
            </View>
            
            <View style={[styles.summaryCard, styles.exactCard]}>
              <Text style={styles.summaryValue}>{summary.exactCount}</Text>
              <Text style={styles.summaryLabel}>Exact Match</Text>
            </View>
            
            <View style={[styles.summaryCard, styles.overstockCard]}>
              <Text style={styles.summaryValue}>{summary.overstockCount}</Text>
              <Text style={styles.summaryLabel}>Overstock</Text>
            </View>
            
            <View style={[styles.summaryCard, styles.understockCard]}>
              <Text style={styles.summaryValue}>{summary.understockCount}</Text>
              <Text style={styles.summaryLabel}>Understock</Text>
            </View>
            
            <View style={[styles.summaryCard, styles.discrepancyCard]}>
              <Text style={styles.summaryValue}>{summary.totalDiscrepancy}</Text>
              <Text style={styles.summaryLabel}>Total Discrepancy</Text>
            </View>
          </View>
          
          <View style={styles.summaryActions}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowCompleteModal(false)}
            >
              <Text style={styles.cancelButtonText}>Continue Counting</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.completeButton}
              onPress={() => {
                setShowCompleteModal(false);
                handleCompleteStockTake();
              }}
            >
              <Text style={styles.completeButtonText}>📊 Finalize & Analyze</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderApplyConfirmationModal = () => {
    if (!resultsData) return null;

    const shrinkageLoss = resultsData?.shrinkageValue || 0;
    const overstockValue = resultsData?.overstockValue || 0;
    const netImpact = resultsData?.totalFinancialImpact || 0;
    const accuracyRate = Math.round((resultsData.exactMatches.length / resultsData.totalProducts) * 100);
    const itemsAffected = resultsData.understock.length + resultsData.overstock.length;

    return (
      <Modal
        visible={showApplyConfirmationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowApplyConfirmationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: '90%', width: '90%' }]}>
            <Text style={styles.modalTitle}>📊 Confirm Inventory Application</Text>
            
            <Text style={styles.confirmationDescription}>
              This will apply your counted values to the actual inventory system.
            </Text>

            <View style={styles.confirmationStats}>
              <View style={styles.confirmationStat}>
                <Text style={styles.confirmationStatValue}>{itemsAffected}</Text>
                <Text style={styles.confirmationStatLabel}>Items to Update</Text>
              </View>
              <View style={styles.confirmationStat}>
                <Text style={styles.confirmationStatValue}>{accuracyRate}%</Text>
                <Text style={styles.confirmationStatLabel}>Accuracy</Text>
              </View>
            </View>

            <View style={styles.financialPreview}>
              <Text style={styles.financialPreviewTitle}>💰 Financial Impact</Text>
              
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel}>Shrinkage Loss:</Text>
                <Text style={[styles.impactValue, { color: '#ef4444' }]}>
                  {formatCurrency(shrinkageLoss)}
                </Text>
              </View>
              
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel}>Overstock Value:</Text>
                <Text style={[styles.impactValue, { color: '#10b981' }]}>
                  {formatCurrency(overstockValue)}
                </Text>
              </View>
              
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel}>Net Impact:</Text>
                <Text style={[
                  styles.impactValue, 
                  { color: netImpact >= 0 ? '#10b981' : '#ef4444' }
                ]}>
                  {netImpact >= 0 ? '+' : ''}{formatCurrency(netImpact)}
                </Text>
              </View>
            </View>

            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ This action cannot be undone. Your counted values will become the new system inventory.
              </Text>
            </View>
            
            <View style={styles.confirmationActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowApplyConfirmationModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.recountButton}
                onPress={() => {
                  setShowApplyConfirmationModal(false);
                  Alert.alert(
                    '🔄 Recount Stock Take',
                    'You have chosen to recount the stock take.\n\n' +
                    'This will take you back to the counting interface where you can adjust your quantities.',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          // Just close the results modal to allow recounting
                          setShowResultsModal(false);
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.recountButtonText}>🔄 Recount</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmApplyButton}
                onPress={confirmInventoryApplication}
                disabled={isApplyingInventory}
              >
                <Text style={styles.confirmApplyButtonText}>
                  {isApplyingInventory ? '⏳ Applying...' : '✅ Apply Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading products for counting...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {renderHeader()}

      {!isActiveStockTake ? (
        // Start Screen
        <View style={styles.startContainer}>
          <Text style={styles.startTitle}>📋 Stock Take</Text>
          <Text style={styles.startDescription}>
            Choose Weekly or Monthly stock take with different purposes:
          </Text>
          
          <View style={styles.startFeatures}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📅</Text>
              <Text style={styles.featureText}>Weekly Stock Take - Must balance, saves for investigation only</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🗓️</Text>
              <Text style={styles.featureText}>Monthly Stock Take - Can have discrepancies, updates actual inventory</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🎯</Text>
              <Text style={styles.featureText}>Weekly: Count → Warning (if issues) → Save</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📈</Text>
              <Text style={styles.featureText}>Monthly: Count → Finalize → Apply (updates inventory)</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.startButtonText}>📋 Start Stock Take</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.historyButton}
            onPress={() => navigation.navigate(ROUTES.STOCK_TAKE_HISTORY)}
          >
            <Text style={styles.historyButtonText}>📊 View History</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Active Stock Take
        <View style={styles.stockTakeContainer}>
          {isCompleted && (
            <View style={styles.completedBanner}>
              <Text style={styles.completedBannerText}>📊 Stock Take Finalized - Click "View Results" for Analysis</Text>
              <TouchableOpacity 
                style={styles.viewResultsButton}
                onPress={() => setShowResultsModal(true)}
              >
                <Text style={styles.viewResultsButtonText}>📊 View Results</Text>
              </TouchableOpacity>
            </View>
          )}
          {renderProgressBar()}
          {renderQuickJump()}
          {renderNavigation()}
          
          <ScrollView 
            style={styles.productsList}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {products.map((product, index) => renderProductRow(product, index))}
          </ScrollView>
          
          {renderNavigation()}
        </View>
      )}

      {renderCreateModal()}
      {renderSummaryModal()}
      {renderResultsModal()}
      {renderApplyConfirmationModal()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    ...Platform.select({
      web: {
        height: '100vh',
        overflow: 'auto',
        WebkitOverflowScrolling: 'auto',
        scrollBehavior: 'smooth',
      },
    }),
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
  startContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  startTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  startDescription: {
    color: '#cccccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  startFeatures: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 30,
  },
  featureText: {
    color: '#ffffff',
    fontSize: 14,
  },
  startButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  historyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  stockTakeContainer: {
    flex: 1,
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercentage: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  quickJumpContainer: {
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  quickJumpTitle: {
    color: '#cccccc',
    fontSize: 12,
    marginBottom: 8,
  },
  quickJumpScroll: {
    flexGrow: 0,
  },
  quickJumpButton: {
    width: 32,
    height: 32,
    backgroundColor: '#333',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  quickJumpButtonActive: {
    backgroundColor: '#3b82f6',
  },
  quickJumpButtonCounted: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  quickJumpText: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickJumpTextActive: {
    color: '#ffffff',
  },
  quickJumpTextCounted: {
    color: '#10b981',
    fontWeight: 'bold',
  },
  quickJumpCountedDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  navButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  navButtonDisabled: {
    backgroundColor: '#333',
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  jumpButton: {
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  jumpButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  productsList: {
    flex: 1,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    minHeight: 60,
  },
  currentRow: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  countedRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  rowEven: {
    backgroundColor: '#0f0f0f',
  },
  rowOdd: {
    backgroundColor: '#1a1a1a',
  },
  rowNumber: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowNumberText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: 'bold',
  },
  countedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    backgroundColor: '#10b981',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  countedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  productName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  productDetails: {
    color: '#999999',
    fontSize: 12,
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
  },
  systemQuantity: {
    alignItems: 'center',
    marginRight: 12,
    minWidth: 50,
  },
  countedQuantity: {
    alignItems: 'center',
    marginRight: 12,
    minWidth: 60,
  },
  discrepancy: {
    alignItems: 'center',
    minWidth: 40,
  },
  quantityLabel: {
    color: '#999999',
    fontSize: 10,
    marginBottom: 2,
  },
  systemQtyText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  countedInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 6,
    padding: 8,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 60,
    flex: 1,
  },
  countedInputCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
    borderWidth: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    backgroundColor: '#10b981',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  countedDisplay: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: 'bold',
  },
  discrepancyText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    color: '#cccccc',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  typeSelection: {
    marginBottom: 16,
  },
  typeButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#444',
  },
  typeButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  typeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  typeButtonTextActive: {
    color: '#3b82f6',
  },
  typeDescription: {
    color: '#999999',
    fontSize: 12,
    lineHeight: 16,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#6b7280',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    width: '31%',
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  exactCard: {
    borderColor: '#6b7280',
  },
  overstockCard: {
    borderColor: '#10b981',
  },
  understockCard: {
    borderColor: '#ef4444',
  },
  discrepancyCard: {
    borderColor: '#f59e0b',
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    color: '#cccccc',
    fontSize: 12,
    textAlign: 'center',
  },
  summaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  completeButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Results Modal Styles
  resultsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  resultsContent: {
    maxHeight: '60vh',
  },
  resultsSummary: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultsSectionTitle: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    color: '#999999',
    fontSize: 12,
    marginBottom: 12,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#cccccc',
    fontSize: 11,
    textAlign: 'center',
  },
  financialImpact: {
    borderTopWidth: 1,
    borderTopColor: '#444',
    paddingTop: 12,
  },
  financialSectionTitle: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  financialGroup: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  groupTitle: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  recommendationItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  recommendationText: {
    color: '#cccccc',
    fontSize: 12,
    lineHeight: 16,
  },
  executiveSummary: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  executiveTitle: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  summaryStat: {
    alignItems: 'center',
    flex: 1,
  },
  summaryStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryStatLabel: {
    color: '#cccccc',
    fontSize: 11,
    textAlign: 'center',
  },
  healthIndicator: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  healthText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  priorityActions: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  priorityTitle: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  priorityItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  priorityItemText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  priorityMore: {
    color: '#f59e0b',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  impactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  impactLabel: {
    color: '#cccccc',
    fontSize: 14,
  },
  impactValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  resultItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  resultItemName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  resultBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  discrepancyBadge: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  valueBadge: {
    backgroundColor: '#f59e0b',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  exactBadge: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resultItemDetails: {
    color: '#999999',
    fontSize: 12,
  },
  moreItemsText: {
    color: '#666666',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  resultsActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  applyButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  applyButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  inventoryAppliedBadge: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  successBanner: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#059669',
  },
  successBannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  successBannerSubtext: {
    color: '#ffffff',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.9,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  loadingText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Completed Banner Styles
  completedBanner: {
    backgroundColor: '#10b981',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#059669',
  },
  completedBannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  viewResultsButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  viewResultsButtonText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Apply Confirmation Modal Styles
  confirmationDescription: {
    color: '#cccccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmationStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  confirmationStat: {
    alignItems: 'center',
  },
  confirmationStatValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  confirmationStatLabel: {
    color: '#cccccc',
    fontSize: 12,
    textAlign: 'center',
  },
  financialPreview: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  financialPreviewTitle: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  impactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  warningText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  recountButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  recountButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  confirmApplyButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  confirmApplyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default StockTakeScreen;