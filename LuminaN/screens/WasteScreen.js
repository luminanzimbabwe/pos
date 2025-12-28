import React, { useEffect, useState, useCallback } from 'react';
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
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { shopAPI } from '../services/api';
import { shopStorage } from '../services/storage';
import { ROUTES } from '../constants/navigation';

const WasteScreen = () => {
  const navigation = useNavigation();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [shopCredentials, setShopCredentials] = useState(null);
  const [wastes, setWastes] = useState([]);
  const [wasteSummary, setWasteSummary] = useState(null);
  const [wasteBatches, setWasteBatches] = useState([]);
  
  // Mode management
  const [wasteMode, setWasteMode] = useState('single'); // 'single' or 'batch'
  
  // Single waste form data
  const [identifier, setIdentifier] = useState(''); // line code or barcode
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('EXPIRED');
  const [reasonDetails, setReasonDetails] = useState('');
  
  // Batch waste form data
  const [currentBatch, setCurrentBatch] = useState(null);
  const [batchItems, setBatchItems] = useState([]);
  const [batchReason, setBatchReason] = useState('EXPIRED');
  const [batchReasonDetails, setBatchReasonDetails] = useState('');
  const [batchIdentifier, setBatchIdentifier] = useState('');
  const [batchProduct, setBatchProduct] = useState(null);
  const [batchQuantity, setBatchQuantity] = useState('');
  
  // Search states
  const [searching, setSearching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showBatchItems, setShowBatchItems] = useState(false);

  useEffect(() => {
    loadShopCredentials();
    
    // Add web-specific scrolling CSS
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        .waste-screen-scroll {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          height: 100vh !important;
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  const loadShopCredentials = async () => {
    try {
      const credentials = await shopStorage.getCredentials();
      if (credentials) {
        setShopCredentials(credentials);
        loadWastes();
        loadWasteSummary();
        loadWasteBatches();
      } else {
        navigation.replace(ROUTES.LOGIN);
      }
    } catch (error) {
      console.error('❌ Error loading credentials:', error);
      navigation.replace(ROUTES.LOGIN);
    }
  };

  const getAuthHeaders = async () => {
    const credentials = await shopStorage.getCredentials();
    if (!credentials) {
      throw new Error('Shop credentials not found. Please log in again.');
    }
    
    const isShopOwner = !credentials.cashier_info;
    const shopId = credentials.shop_info?.shop_id || credentials.shop_id;
    const cashierId = credentials.cashier_info?.id;
    
    const headers = {
      'X-Shop-ID': shopId
    };
    
    if (!isShopOwner && cashierId) {
      headers['X-Cashier-ID'] = cashierId;
    }
    
    return { headers, isShopOwner, credentials };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const loadWastes = async () => {
    try {
      const { headers } = await getAuthHeaders();
      const response = await shopAPI.getWastes({ headers });
      
      if (response.data.success) {
        setWastes(response.data.wastes);
      } else {
        console.error('Failed to load wastes:', response.data.error);
      }
    } catch (error) {
      console.error('❌ Error loading wastes:', error);
    }
  };

  const loadWasteSummary = async () => {
    try {
      const { headers } = await getAuthHeaders();
      const response = await shopAPI.getWasteSummary({ headers });
      
      if (response.data.success) {
        setWasteSummary(response.data);
      } else {
        console.error('Failed to load waste summary:', response.data.error);
      }
    } catch (error) {
      console.error('❌ Error loading waste summary:', error);
    }
  };

  const loadWasteBatches = async () => {
    try {
      const { headers } = await getAuthHeaders();
      const response = await shopAPI.getWasteBatches({ headers });
      
      if (response.data.success) {
        setWasteBatches(response.data.batches);
      } else {
        console.error('Failed to load waste batches:', response.data.error);
      }
    } catch (error) {
      console.error('❌ Error loading waste batches:', error);
    }
  };

  const loadBatchItems = async (batchId) => {
    try {
      const { headers } = await getAuthHeaders();
      const response = await shopAPI.getWasteBatchDetail(batchId, { headers });
      
      if (response.data.success) {
        const batch = response.data.batch;
        setCurrentBatch(batch);
        
        // Convert batch items to the format expected by the UI
        const items = batch.items.map(item => ({
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          reason: item.reason,
          reason_display: item.reason_display,
          waste_value: item.waste_value,
          created_at: item.created_at
        }));
        setBatchItems(items);
      } else {
        console.error('Failed to load batch details:', response.data.error);
        Alert.alert('Error', 'Failed to load batch details');
      }
    } catch (error) {
      console.error('❌ Error loading batch items:', error);
      Alert.alert('Error', 'Failed to load batch items');
    }
  };

  const searchProduct = async (isBatch = false) => {
    const searchIdentifier = isBatch ? batchIdentifier : identifier;
    if (!searchIdentifier.trim()) return;
    
    setSearching(true);
    
    try {
      const { headers } = await getAuthHeaders();
      
      const response = await shopAPI.searchWasteProduct({
        identifier: searchIdentifier.trim()
      }, {
        headers: headers
      });
      
      if (response.data.success) {
        if (isBatch) {
          setBatchProduct(response.data.product);
        } else {
          setProduct(response.data.product);
        }
      } else {
        // Product not found - show alert and clear product state
        Alert.alert(
          'Product Not Found',
          `No product found with code: ${searchIdentifier.trim()}\n\nPlease check the code and try again, or contact your administrator to add this product.`,
          [{ text: 'OK' }]
        );
        if (isBatch) {
          setBatchProduct(null);
        } else {
          setProduct(null);
        }
      }
    } catch (error) {
      console.error('❌ Error finding product:', error);
      Alert.alert(
        'Search Error', 
        'Failed to search for product. Please check your connection and try again.'
      );
      if (isBatch) {
        setBatchProduct(null);
      } else {
        setProduct(null);
      }
    } finally {
      setSearching(false);
    }
  };

  const createWaste = async () => {
    if (!product || !quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    
    try {
      const { headers } = await getAuthHeaders();
      
      const response = await shopAPI.createWaste({
        identifier: identifier.trim(),
        quantity: parseFloat(quantity),
        reason: reason,
        reason_details: reasonDetails
      }, {
        headers: headers
      });
      
      if (response.data.success) {
        Alert.alert(
          'Success',
          `Waste recorded successfully!\n\nProduct: ${response.data.waste.product_name}\nQuantity: ${response.data.waste.quantity}\nValue: ${formatCurrency(response.data.waste.waste_value)}\nNew Stock: ${response.data.waste.new_stock}`,
          [
            {
              text: 'OK',
              onPress: () => {
                resetSingleForm();
                setShowForm(false);
                loadWastes();
                loadWasteSummary();
              }
            }
          ]
        );
      } else {
        Alert.alert('Failed', response.data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Error creating waste:', error);
      Alert.alert('Error', 'Failed to record waste. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createWasteBatch = async () => {
    setLoading(true);
    
    try {
      const { headers } = await getAuthHeaders();
      
      const response = await shopAPI.createWasteBatch({
        reason: batchReason,
        reason_details: batchReasonDetails
      }, {
        headers: headers
      });
      
      if (response.data.success) {
        setCurrentBatch(response.data.batch);
        setBatchItems([]);
        Alert.alert('Success', `Waste batch ${response.data.batch.batch_number} created successfully!`);
        loadWasteBatches();
      } else {
        Alert.alert('Failed', response.data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Error creating waste batch:', error);
      Alert.alert('Error', 'Failed to create waste batch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addProductToBatch = async () => {
    console.log('🔍 Adding product to batch:');
    console.log('- batchProduct:', batchProduct);
    console.log('- batchQuantity:', batchQuantity);
    console.log('- batchIdentifier:', batchIdentifier);
    console.log('- currentBatch:', currentBatch);
    
    // Validate required fields
    if (!batchProduct) {
      Alert.alert('Validation Error', 'Please search for a product first');
      return;
    }
    
    if (!batchQuantity || parseFloat(batchQuantity) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid quantity greater than 0');
      return;
    }
    
    if (!batchIdentifier.trim()) {
      Alert.alert('Validation Error', 'Product identifier is missing');
      return;
    }
    
    // Check if batch is still valid for adding items
    if (!currentBatch || currentBatch.status !== 'DRAFT') {
      Alert.alert('Cannot Add Items', 'This batch has been completed and cannot accept new items.');
      return;
    }
    
    setLoading(true);
    
    try {
      const { headers } = await getAuthHeaders();
      
      const response = await shopAPI.addWasteToBatch(currentBatch.id, {
        identifier: batchIdentifier.trim(),
        quantity: parseFloat(batchQuantity),
        specific_reason: batchReason
      }, {
        headers: headers
      });
      
      if (response.data.success) {
        // Add to local batch items
        const newItem = {
          id: response.data.item.id,
          product_name: response.data.item.product_name,
          quantity: response.data.item.quantity,
          reason: response.data.item.reason,
          reason_display: response.data.item.reason_display,
          waste_value: response.data.item.waste_value,
          created_at: new Date().toISOString()
        };
        setBatchItems([...batchItems, newItem]);
        
        // Update current batch totals
        setCurrentBatch({
          ...currentBatch,
          total_waste_value: response.data.batch.total_waste_value,
          total_waste_quantity: response.data.batch.total_waste_quantity,
          item_count: response.data.batch.item_count
        });
        
        Alert.alert('Success', `${batchProduct.name} added to batch!`);
        
        // Clear form fields for next product
        setBatchIdentifier('');
        setBatchProduct(null);
        setBatchQuantity('');
        
        console.log('✅ Form cleared for next product');
      } else {
        Alert.alert('Failed', response.data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Error adding product to batch:', error);
      Alert.alert('Error', 'Failed to add product to batch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const completeWasteBatch = async () => {
    if (!currentBatch || batchItems.length === 0) {
      Alert.alert('Validation Error', 'Batch must have at least one item');
      return;
    }
    
    // Check if batch is already completed
    if (currentBatch.status === 'COMPLETED') {
      Alert.alert('Batch Already Completed', 'This batch has already been completed and cannot be modified.');
      return;
    }
    
    setLoading(true);
    
    try {
      const { headers } = await getAuthHeaders();
      
      const response = await shopAPI.updateWasteBatch(currentBatch.id, {
        action: 'complete'
      }, {
        headers: headers
      });
      
      if (response.data.success) {
        Alert.alert(
          'Success',
          `Waste batch ${response.data.batch.batch_number} completed successfully!\n\nTotal Value: ${formatCurrency(response.data.batch.total_waste_value)}\nTotal Items: ${response.data.batch.item_count}`,
          [
            {
              text: 'OK',
              onPress: () => {
                resetBatch();
                setShowBatchForm(false);
                loadWastes();
                loadWasteSummary();
                loadWasteBatches();
              }
            }
          ]
        );
      } else {
        Alert.alert('Failed', response.data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Error completing waste batch:', error);
      Alert.alert('Error', 'Failed to complete waste batch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetSingleForm = () => {
    setIdentifier('');
    setProduct(null);
    setQuantity('');
    setReason('EXPIRED');
    setReasonDetails('');
  };

  const resetBatchForm = () => {
    setBatchIdentifier('');
    setBatchProduct(null);
    setBatchQuantity('');
  };

  const resetBatch = () => {
    setCurrentBatch(null);
    setBatchItems([]);
    setBatchReason('EXPIRED');
    setBatchReasonDetails('');
    resetBatchForm();
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Reset all forms and states
      resetSingleForm();
      resetBatch();
      setShowForm(false);
      setShowBatchForm(false);
      setShowBatchItems(false);
      setShowSummary(false);
      
      // Reload all data
      await loadWastes();
      await loadWasteSummary();
      await loadWasteBatches();
      
      console.log('✅ Waste screen refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing waste screen:', error);
      Alert.alert('Refresh Error', 'Failed to refresh data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>🗑️ Waste Management</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={handleRefresh} disabled={loading}>
          <Text style={[styles.refreshButton, { opacity: loading ? 0.5 : 1 }]}>
            {loading ? '⟳' : '🔄'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSummary(!showSummary)}>
          <Text style={styles.summaryButton}>📊</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          if (wasteMode === 'single') {
            setShowForm(!showForm);
          } else {
            if (!currentBatch) {
              setShowBatchForm(true);
            } else {
              setShowBatchItems(!showBatchItems);
            }
          }
        }}>
          <Text style={styles.addButton}>+ Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderModeSelector = () => (
    <View style={styles.modeSelector}>
      <TouchableOpacity
        style={[styles.modeButton, wasteMode === 'single' && styles.modeButtonActive]}
        onPress={() => setWasteMode('single')}
      >
        <Text style={[styles.modeButtonText, wasteMode === 'single' && styles.modeButtonTextActive]}>
          Single Product
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.modeButton, wasteMode === 'batch' && styles.modeButtonActive]}
        onPress={() => setWasteMode('batch')}
      >
        <Text style={[styles.modeButtonText, wasteMode === 'batch' && styles.modeButtonTextActive]}>
          Batch Mode
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSummary = () => (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>📊 Waste Summary (Last 30 Days)</Text>
      {wasteSummary ? (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Wastes</Text>
            <Text style={styles.summaryValue}>{wasteSummary.summary.waste_count}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Quantity</Text>
            <Text style={styles.summaryValue}>{wasteSummary.summary.total_waste_quantity.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
              {formatCurrency(wasteSummary.summary.total_waste_value)}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.loadingText}>Loading summary...</Text>
      )}
    </View>
  );

  const renderSingleWasteForm = () => (
    <Modal
      visible={showForm}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowForm(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🗑️ Record Single Waste</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowForm(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {/* Product Search */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Product Search:</Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="Enter line code or barcode"
                  onBlur={() => identifier && searchProduct()}
                />
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={() => searchProduct()}
                  disabled={searching || !identifier.trim()}
                >
                  {searching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.searchButtonText}>🔍</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Product Info */}
            {product && (
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productDetails}>
                  Current Stock: {product.current_stock} | Cost: {formatCurrency(product.cost_price)}
                </Text>
              </View>
            )}

            {/* Quantity */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quantity to Waste:</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="Enter quantity"
                keyboardType="numeric"
              />
            </View>

            {/* Reason */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason:</Text>
              <View style={styles.reasonContainer}>
                {[
                  { value: 'EXPIRED', label: '🗓️ Expired' },
                  { value: 'DAMAGED', label: '💥 Damaged' },
                  { value: 'SPOILED', label: '🦠 Spoiled' },
                  { value: 'STALE', label: '🍞 Stale' },
                  { value: 'CONTAMINATED', label: '☣️ Contaminated' },
                  { value: 'DEFECTIVE', label: '❌ Defective' },
                  { value: 'OTHER', label: '📝 Other' }
                ].map((reasonOption) => (
                  <TouchableOpacity
                    key={reasonOption.value}
                    style={[
                      styles.reasonButton,
                      reason === reasonOption.value && styles.reasonButtonActive
                    ]}
                    onPress={() => setReason(reasonOption.value)}
                  >
                    <Text style={[
                      styles.reasonButtonText,
                      reason === reasonOption.value && styles.reasonButtonTextActive
                    ]}>
                      {reasonOption.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reason Details */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Details (Optional):</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={reasonDetails}
                onChangeText={setReasonDetails}
                placeholder="Additional details about the waste..."
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
          
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowForm(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!product || !quantity || loading) && styles.submitButtonDisabled
              ]}
              onPress={createWaste}
              disabled={!product || !quantity || loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Recording...' : '🗑️ Record Waste'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderBatchWasteForm = () => (
    <Modal
      visible={showBatchForm}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowBatchForm(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📦 Create Waste Batch</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowBatchForm(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {/* Batch Reason */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Batch Reason:</Text>
              <View style={styles.reasonContainer}>
                {[
                  { value: 'EXPIRED', label: '🗓️ Expired' },
                  { value: 'DAMAGED', label: '💥 Damaged' },
                  { value: 'SPOILED', label: '🦠 Spoiled' },
                  { value: 'STALE', label: '🍞 Stale' },
                  { value: 'CONTAMINATED', label: '☣️ Contaminated' },
                  { value: 'DEFECTIVE', label: '❌ Defective' },
                  { value: 'OTHER', label: '📝 Other' }
                ].map((reasonOption) => (
                  <TouchableOpacity
                    key={reasonOption.value}
                    style={[
                      styles.reasonButton,
                      batchReason === reasonOption.value && styles.reasonButtonActive
                    ]}
                    onPress={() => setBatchReason(reasonOption.value)}
                  >
                    <Text style={[
                      styles.reasonButtonText,
                      batchReason === reasonOption.value && styles.reasonButtonTextActive
                    ]}>
                      {reasonOption.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Batch Details */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Batch Details (Optional):</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={batchReasonDetails}
                onChangeText={setBatchReasonDetails}
                placeholder="Details about this batch..."
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
          
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowBatchForm(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.submitButton}
              onPress={createWasteBatch}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Creating...' : '📦 Create Batch'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderBatchItems = () => (
    <Modal
      visible={showBatchItems}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowBatchItems(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              📦 {currentBatch?.batch_number} - Add Products
            </Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowBatchItems(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {/* Current Batch Info */}
            {currentBatch && (
              <View style={styles.batchInfo}>
                <Text style={styles.batchInfoTitle}>Current Batch Status</Text>
                <Text style={styles.batchInfoText}>
                  Items: {currentBatch.item_count} | Total Value: {formatCurrency(currentBatch.total_waste_value || 0)}
                </Text>
                <Text style={styles.batchInfoSubText}>
                  Add products below to this batch
                </Text>
              </View>
            )}

            {/* STEP 1: Product Search */}
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>STEP 1: Search Product</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Enter line code or barcode:</Text>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={batchIdentifier}
                    onChangeText={setBatchIdentifier}
                    placeholder="Enter line code or barcode"
                    onBlur={() => batchIdentifier && searchProduct(true)}
                  />
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={() => searchProduct(true)}
                    disabled={searching || !batchIdentifier.trim()}
                  >
                    {searching ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.searchButtonText}>🔍</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* STEP 2: Product Info */}
            {batchProduct && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>STEP 2: Product Found</Text>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{batchProduct.name}</Text>
                  <Text style={styles.productDetails}>
                    Current Stock: {batchProduct.current_stock} | Cost: {formatCurrency(batchProduct.cost_price)}
                  </Text>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Quantity to waste:</Text>
                  <TextInput
                    style={styles.input}
                    value={batchQuantity}
                    onChangeText={setBatchQuantity}
                    placeholder="Enter quantity"
                    keyboardType="numeric"
                  />
                </View>

                {/* Add to Batch Button */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (!batchProduct || !batchQuantity || loading) && styles.submitButtonDisabled
                  ]}
                  onPress={addProductToBatch}
                  disabled={!batchProduct || !batchQuantity || loading}
                >
                  <Text style={styles.submitButtonText}>
                    {loading ? 'Adding...' : '➕ Add to Batch'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 3: Current Batch Items */}
            {batchItems.length > 0 && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>STEP 3: Batch Items ({batchItems.length})</Text>
                <View style={styles.batchItemsContainer}>
                  {batchItems.map((item, index) => (
                    <View key={index} style={styles.batchItem}>
                      <Text style={styles.batchItemName}>{item.product_name}</Text>
                      <Text style={styles.batchItemDetails}>
                        Qty: {item.quantity} | {formatCurrency(item.waste_value)}
                      </Text>
                    </View>
                  ))}
                  
                  {/* Complete Batch Button */}
                  <View style={styles.completeBatchSection}>
                    <Text style={styles.batchTotalText}>
                      Total Value: {formatCurrency(batchItems.reduce((sum, item) => sum + item.waste_value, 0))}
                    </Text>
                    <TouchableOpacity
                      style={styles.completeBatchButton}
                      onPress={completeWasteBatch}
                      disabled={loading}
                    >
                      <Text style={styles.completeBatchButtonText}>
                        {loading ? 'Completing Batch...' : '✅ Complete Batch'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Help Text */}
            {!batchProduct && (
              <View style={styles.helpContainer}>
                <Text style={styles.helpTitle}>📝 How to add products:</Text>
                <Text style={styles.helpText}>1. Enter product line code or barcode above</Text>
                <Text style={styles.helpText}>2. Enter quantity to waste</Text>
                <Text style={styles.helpText}>3. Click "Add to Batch"</Text>
                <Text style={styles.helpText}>4. Repeat for more products</Text>
                <Text style={styles.helpText}>5. Click "Complete Batch" when done</Text>
                
                <View style={styles.troubleshootingContainer}>
                  <Text style={styles.troubleshootingTitle}>🔧 If product not found:</Text>
                  <Text style={styles.helpText}>• Check that the line code/barcode is correct</Text>
                  <Text style={styles.helpText}>• Make sure the product exists in your system</Text>
                  <Text style={styles.helpText}>• Contact administrator to add missing products</Text>
                  <Text style={styles.helpText}>• Try different product codes if available</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderWastesList = () => (
    <ScrollView 
      style={styles.wastesContainer} 
      showsVerticalScrollIndicator={Platform.OS === 'web'}
      showsHorizontalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>📋 Recent Wastes</Text>
      {wastes.length === 0 ? (
        <Text style={styles.emptyText}>No waste records found</Text>
      ) : (
        wastes.map((waste) => (
          <View key={waste.id} style={styles.wasteItem}>
            <View style={styles.wasteHeader}>
              <Text style={styles.wasteProductName}>{waste.product_name}</Text>
              <Text style={[
                styles.wasteSeverity,
                waste.severity_level === 'HIGH' && styles.severityHigh,
                waste.severity_level === 'MEDIUM' && styles.severityMedium
              ]}>
                {waste.severity_level}
              </Text>
            </View>
            <View style={styles.wasteDetails}>
              <Text style={styles.wasteDetail}>
                Quantity: {waste.quantity} | Value: {formatCurrency(waste.waste_value)}
              </Text>
              <Text style={styles.wasteDetail}>
                Reason: {waste.reason_display}
              </Text>
              {waste.recorded_by && (
                <Text style={styles.wasteDetail}>
                  By: {waste.recorded_by}
                </Text>
              )}
              <Text style={styles.wasteDate}>
                {new Date(waste.created_at).toLocaleDateString()}
              </Text>
            </View>
            {waste.reason_details && (
              <Text style={styles.wasteNotes}>
                Notes: {waste.reason_details}
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderWasteBatchesList = () => (
    <ScrollView 
      style={styles.batchesContainer} 
      showsVerticalScrollIndicator={Platform.OS === 'web'}
      showsHorizontalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>📦 Waste Batches</Text>
      {wasteBatches.length === 0 ? (
        <Text style={styles.emptyText}>No waste batches found</Text>
      ) : (
        wasteBatches.map((batch) => (
          <TouchableOpacity 
            key={batch.id} 
            style={[
              styles.batchItem,
              currentBatch?.id === batch.id && styles.batchItemSelected
            ]}
            onPress={() => {
              setCurrentBatch(batch);
              // Load batch items if batch has items
              if (batch.item_count > 0) {
                loadBatchItems(batch.id);
              } else {
                setBatchItems([]);
              }
            }}
          >
            <View style={styles.batchHeader}>
              <Text style={styles.batchNumber}>{batch.batch_number}</Text>
              <Text style={[
                styles.batchStatus,
                batch.status === 'COMPLETED' && styles.statusCompleted,
                batch.status === 'DRAFT' && styles.statusDraft
              ]}>
                {batch.status_display}
              </Text>
            </View>
            <View style={styles.batchDetails}>
              <Text style={styles.batchDetail}>
                Reason: {batch.reason_display}
              </Text>
              <Text style={styles.batchDetail}>
                Items: {batch.item_count} | Value: {formatCurrency(batch.total_waste_value)}
              </Text>
              <Text style={styles.batchDate}>
                {new Date(batch.created_at).toLocaleDateString()}
              </Text>
            </View>
            {batch.reason_details && (
              <Text style={styles.batchNotes}>
                Notes: {batch.reason_details}
              </Text>
            )}
            {currentBatch?.id === batch.id && (
              <Text style={styles.selectedBatchIndicator}>👆 Selected</Text>
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  return (
    <>
      <ScrollView 
        style={[styles.container, Platform.OS === 'web' && styles.webScrollView]}
        contentContainerStyle={Platform.OS === 'web' ? styles.webContentContainer : undefined}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        showsHorizontalScrollIndicator={false}
      >
        {renderHeader()}
        {renderModeSelector()}
        
        {showSummary && renderSummary()}
        
        {/* Show current batch info if in batch mode and batch exists */}
        {wasteMode === 'batch' && currentBatch && (
          <View style={styles.currentBatchInfo}>
            <Text style={styles.currentBatchTitle}>
              📦 Current Batch: {currentBatch.batch_number}
            </Text>
            <Text style={styles.currentBatchDetails}>
              Items: {currentBatch.item_count} | Value: {formatCurrency(currentBatch.total_waste_value || 0)} | Status: {currentBatch.status_display}
            </Text>
            <View style={styles.currentBatchActions}>
              {currentBatch.status === 'DRAFT' ? (
                <TouchableOpacity
                  style={styles.manageBatchButton}
                  onPress={() => {
                    console.log('Add Products button clicked');
                    console.log('Current batch:', currentBatch);
                    console.log('Setting showBatchItems to true');
                    setShowBatchItems(true);
                  }}
                >
                  <Text style={styles.manageBatchButtonText}>➕ Add Products</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.viewOnlyContainer}>
                  <Text style={styles.viewOnlyText}>🔒 View Only - Batch Completed</Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.completeBatchButtonSmall,
                  (currentBatch.status === 'COMPLETED' || batchItems.length === 0 || loading) && styles.completeBatchButtonSmallDisabled
                ]}
                onPress={completeWasteBatch}
                disabled={currentBatch.status === 'COMPLETED' || batchItems.length === 0 || loading}
              >
                <Text style={styles.completeBatchButtonSmallText}>
                  {loading ? 'Completing...' : currentBatch.status === 'COMPLETED' ? '✅ Completed' : '✅ Complete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Show batch creation prompt if in batch mode and no batch exists */}
        {wasteMode === 'batch' && !currentBatch && (
          <View style={styles.batchCreationPrompt}>
            <Text style={styles.batchCreationTitle}>📦 Start New Waste Batch</Text>
            <Text style={styles.batchCreationDescription}>
              Create a batch to record waste for multiple products at once
            </Text>
            <TouchableOpacity
              style={styles.startBatchButton}
              onPress={() => setShowBatchForm(true)}
            >
              <Text style={styles.startBatchButtonText}>🚀 Create New Batch</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {wasteMode === 'single' ? renderWastesList() : renderWasteBatchesList()}
      </ScrollView>
      
      {/* Modals rendered outside ScrollView */}
      {renderSingleWasteForm()}
      {renderBatchWasteForm()}
      {renderBatchItems()}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  webScrollView: {
    flex: 1,
  },
  webContentContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
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
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryButton: {
    fontSize: 18,
  },
  refreshButton: {
    fontSize: 18,
  },
  addButton: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  modeSelector: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  modeButtonText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  summaryContainer: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    color: '#ccc',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  currentBatchInfo: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  currentBatchTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  currentBatchDetails: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 12,
  },
  currentBatchActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  manageBatchButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flex: 1,
  },
  manageBatchButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  manageBatchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  viewOnlyContainer: {
    backgroundColor: '#6b7280',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewOnlyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  completeBatchButtonSmall: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flex: 1,
  },
  completeBatchButtonSmallDisabled: {
    backgroundColor: '#6b7280',
  },
  completeBatchButtonSmallText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  batchCreationPrompt: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
    alignItems: 'center',
  },
  batchCreationTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  batchCreationDescription: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  startBatchButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 200,
    alignItems: 'center',
  },
  startBatchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  stepTitle: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  batchInfoSubText: {
    color: '#10b981',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  completeBatchSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  batchTotalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  helpContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#374151',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  helpTitle: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  helpText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 16,
  },
  troubleshootingContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#555',
  },
  troubleshootingTitle: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  wastesContainer: {
    flex: 1,
    padding: 16,
    minHeight: 400,
  },
  batchesContainer: {
    flex: 1,
    padding: 16,
    minHeight: 400,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
  wasteItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  batchItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  batchItemSelected: {
    borderColor: '#3b82f6',
    borderWidth: 2,
    backgroundColor: '#1e2a3a',
  },
  selectedBatchIndicator: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  wasteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wasteProductName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  batchNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  wasteSeverity: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#6b7280',
    color: '#fff',
  },
  batchStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#6b7280',
    color: '#fff',
  },
  statusCompleted: {
    backgroundColor: '#10b981',
  },
  statusDraft: {
    backgroundColor: '#f59e0b',
  },
  wasteDetails: {
    marginBottom: 8,
  },
  batchDetails: {
    marginBottom: 8,
  },
  wasteDetail: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 2,
  },
  batchDetail: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 2,
  },
  wasteDate: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  batchDate: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  wasteNotes: {
    color: '#f59e0b',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  batchNotes: {
    color: '#f59e0b',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  severityHigh: {
    backgroundColor: '#ef4444',
  },
  severityMedium: {
    backgroundColor: '#f59e0b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '90%',
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#374151',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#444',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    marginLeft: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  productInfo: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  productName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productDetails: {
    color: '#ccc',
    fontSize: 12,
  },
  reasonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  reasonButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  reasonButtonText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '600',
  },
  reasonButtonTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  batchInfo: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  batchInfoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  batchInfoText: {
    color: '#ccc',
    fontSize: 12,
  },
  batchItemsContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  batchItemsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  batchItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  batchItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  batchItemDetails: {
    color: '#ccc',
    fontSize: 12,
  },
  completeBatchButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  completeBatchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default WasteScreen;