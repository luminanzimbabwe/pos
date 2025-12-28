import React, { useEffect, useState, useCallback } from 'react';
import { useRoute } from '@react-navigation/native';
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
  FlatList,
  Switch,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { shopAPI } from '../services/api';
import { shopStorage } from '../services/storage';
import BarcodeScanner from '../components/BarcodeScanner';

const { width } = Dimensions.get('window');

const InventoryReceivingScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [shopCredentials, setShopCredentials] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Enhanced form states
  const [receivingItems, setReceivingItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [receivingQuantity, setReceivingQuantity] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [updateBaseCost, setUpdateBaseCost] = useState(false);
  const [batchBarcode, setBatchBarcode] = useState(''); // New barcode for this batch/supplier

  // Purchase Order states
  const [showPurchaseOrder, setShowPurchaseOrder] = useState(false);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [orderStatus, setOrderStatus] = useState('pending');

  // Quality Control states
  const [showQualityCheck, setShowQualityCheck] = useState(false);
  const [qualityRating, setQualityRating] = useState(5);
  const [damageNotes, setDamageNotes] = useState('');
  const [damageCount, setDamageCount] = useState('');

  // Reference and tracking
  const [receivingReference, setReceivingReference] = useState('');
  const [receivingDate, setReceivingDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderId, setOrderId] = useState('');

  // Modal states
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showSupplierSelector, setShowSupplierSelector] = useState(false);
  const [showReceivingHistory, setShowReceivingHistory] = useState(false);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showReceivingReports, setShowReceivingReports] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [receivingHistory, setReceivingHistory] = useState([]);

  // NO AUTHENTICATION NEEDED - Public access

  useEffect(() => {
    // NO AUTHENTICATION NEEDED - Public access
    loadInitialData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery]);

  // REMOVED authentication - screen is now public

  const loadInitialData = async () => {
    try {
      // NO AUTHENTICATION NEEDED - Public access
      const productsRes = await shopAPI.getProducts();
      
      setProducts(productsRes.data || []);
      setSuppliers([]); // Empty suppliers list for now
      setReceivingHistory([]); // Empty history for now
      
      // Generate all required IDs automatically
      generateReceivingReference();
      generateInvoiceNumber();
      generateOrderId();
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load initial data. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateReceivingReference = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const ref = `REC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${timestamp}-${random}`;
    setReceivingReference(ref);
  };

  const generateInvoiceNumber = () => {
    const timestamp = Date.now().toString().slice(-8);
    const invoice = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${timestamp}`;
    setInvoiceNumber(invoice);
  };

  const generateOrderId = () => {
    const orderId = `ORD-${Date.now()}`;
    setOrderId(orderId);
  };

  const filterProducts = () => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.line_code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInitialData();
  }, []);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setCostPrice(product.cost_price?.toString() || '');
    setShowProductSelector(false);
    
    // Check for negative stock and show special messaging
    const currentStock = parseFloat(product.stock_quantity) || 0;
    if (currentStock < 0) {
      Alert.alert(
        '🚨 Oversold Item Detected',
        `${product.name} is currently oversold by ${Math.abs(currentStock)} units.\n\nThis restock will clear the oversell and add ${Math.abs(currentStock)} units to bring stock to 0, plus any additional quantity you specify.`,
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const handleBarcodeScanned = async ({ data }) => {
    try {
      // Find product by barcode/line_code
      const product = products.find(p => 
        p.line_code === data || 
        p.barcode === data ||
        p.line_code?.toString() === data
      );
      
      if (product) {
        handleProductSelect(product);
        setShowBarcodeScanner(false);
        Alert.alert('Product Found', `Selected: ${product.name}`);
      } else {
        Alert.alert(
          'Product Not Found',
          `No product found with barcode: ${data}`,
          [
            { text: 'OK', onPress: () => setShowBarcodeScanner(false) },
            { text: 'Scan Again', onPress: () => {} }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error processing barcode:', error);
      Alert.alert('Error', 'Failed to process barcode scan.');
    }
  };

  const handleSupplierSelect = (supplier) => {
    setSupplierName(supplier.name);
    setShowSupplierSelector(false);
  };

  const addReceivingItem = () => {
    console.log('➕ Adding receiving item...');
    console.log('📦 Selected product:', selectedProduct);
    console.log('🔢 Quantity:', receivingQuantity);
    console.log('💰 Cost price:', costPrice);
    
    if (!selectedProduct || !receivingQuantity || !costPrice) {
      console.log('❌ Missing required fields for item');
      Alert.alert('Error', 'Please fill in all required fields (Product, Quantity, Cost Price).');
      return;
    }

    // Check for negative stock transition
    const currentStock = parseFloat(selectedProduct.stock_quantity) || 0;
    const newQuantity = parseFloat(receivingQuantity);
    const willClearOversell = currentStock < 0 && (currentStock + newQuantity) >= 0;
    const willTransitionToPositive = currentStock < 0 && (currentStock + newQuantity) > 0;
    
    // Enhanced item with transition tracking
    const newItem = {
      id: Date.now(),
      product: selectedProduct,
      quantity: newQuantity,
      costPrice: parseFloat(costPrice),
      totalCost: parseFloat(receivingQuantity) * parseFloat(costPrice),
      updateBaseCost: updateBaseCost,
      qualityRating: qualityRating,
      damageCount: damageCount ? parseInt(damageCount) : 0,
      damageNotes: damageNotes,
      batchBarcode: batchBarcode.trim(), // Store barcode for this batch/supplier
      supplierName: supplierName.trim(), // Store supplier for this batch
      receivingDate: receivingDate,
      // Enhanced tracking for negative stock transitions
      currentStock: currentStock,
      willClearOversell: willClearOversell,
      willTransitionToPositive: willTransitionToPositive,
      oversellAmount: currentStock < 0 ? Math.abs(currentStock) : 0,
      newStockAfterReceiving: currentStock + newQuantity,
      transitionType: willTransitionToPositive ? 'NEGATIVE_TO_POSITIVE' : 
                     willClearOversell ? 'CLEAR_OVERSELL' : 'NORMAL',
      inventoryValueChange: calculateInventoryValueChange(currentStock, newQuantity, parseFloat(costPrice))
    };

    console.log('✅ New item created with transition tracking:', newItem);
    setReceivingItems([...receivingItems, newItem]);
    console.log('📋 Updated items list:', [...receivingItems, newItem]);
    
    // Show transition success message
    if (willTransitionToPositive) {
      Alert.alert(
        '🎉 Negative Stock Cleared!',
        `${selectedProduct.name} transition: ${currentStock} → ${currentStock + newQuantity}\n\n` +
        `✅ Oversell cleared: ${Math.abs(currentStock)} units\n` +
        `✅ New stock added: ${newQuantity} units\n` +
        `✅ Final stock: ${currentStock + newQuantity} units`,
        [{ text: 'Great!', style: 'default' }]
      );
    } else if (willClearOversell) {
      Alert.alert(
        '✅ Oversell Cleared',
        `${selectedProduct.name} will go from ${currentStock} to 0.\n\n` +
        `This clears the oversell of ${Math.abs(currentStock)} units.`,
        [{ text: 'OK', style: 'default' }]
      );
    }
    
    // Reset form
    setSelectedProduct(null);
    setReceivingQuantity('');
    setCostPrice('');
    setBatchBarcode(''); // Reset barcode field
    setDamageNotes('');
    setDamageCount('');
    setQualityRating(5);
    setUpdateBaseCost(false);
    
    console.log('🔄 Form reset complete');
  };

  const calculateInventoryValueChange = (currentStock, newQuantity, costPrice) => {
    const previousInventoryValue = Math.max(0, currentStock) * costPrice;
    const newInventoryValue = Math.max(0, currentStock + newQuantity) * costPrice;
    return newInventoryValue - previousInventoryValue;
  };

  const removeReceivingItem = (itemId) => {
    setReceivingItems(receivingItems.filter(item => item.id !== itemId));
  };

  const updateReceivingItem = (itemId, field, value) => {
    setReceivingItems(receivingItems.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'costPrice') {
          updatedItem.totalCost = updatedItem.quantity * updatedItem.costPrice;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const calculateTotals = () => {
    const totalItems = receivingItems.length;
    const totalQuantity = receivingItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = receivingItems.reduce((sum, item) => sum + item.totalCost, 0);
    const totalDamage = receivingItems.reduce((sum, item) => sum + item.damageCount, 0);
    
    // Enhanced totals for negative stock transitions
    const oversoldItems = receivingItems.filter(item => item.currentStock < 0);
    const oversellClearing = oversoldItems.reduce((sum, item) => sum + item.oversellAmount, 0);
    const negativeToPositiveTransitions = receivingItems.filter(item => item.willTransitionToPositive).length;
    const totalInventoryValueChange = receivingItems.reduce((sum, item) => sum + (item.inventoryValueChange || 0), 0);
    
    return { 
      totalItems, 
      totalQuantity, 
      totalValue, 
      totalDamage,
      oversoldItems: oversoldItems.length,
      oversellClearing,
      negativeToPositiveTransitions,
      totalInventoryValueChange
    };
  };

  const saveOrderLocally = async () => {
    try {
      console.log('💾 Saving order to storage...');
      
      // Generate unique order ID
      const uniqueOrderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      console.log('📋 Generated Order ID:', uniqueOrderId);
      
      // Get existing orders
      const existingOrdersJson = await shopStorage.getItem('pending_orders');
      let existingOrders = [];
      try {
        existingOrders = JSON.parse(existingOrdersJson || '[]');
      } catch (e) {
        existingOrders = [];
      }
      
      // Create order data
      const orderData = {
        id: uniqueOrderId,
        reference: receivingReference || `REF-${Date.now()}`,
        invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
        supplierName: supplierName || 'Unknown Supplier',
        receivingDate: receivingDate || new Date().toISOString().split('T')[0],
        notes: notes || '',
        receivingItems: receivingItems || [],
        totals: calculateTotals(),
        status: 'pending_review',
        createdAt: new Date().toISOString()
      };
      
      console.log('📝 Order data:', orderData);
      
      // Add to orders and save
      existingOrders.push(orderData);
      const saveResult = await shopStorage.setItem('pending_orders', JSON.stringify(existingOrders));
      
      if (saveResult === false) {
        console.warn('⚠️ Storage save returned false, but continuing...');
      }
      
      console.log('✅ Order saved! Total orders:', existingOrders.length);
      return true;
      
    } catch (error) {
      console.error('❌ Storage error:', error);
      // Don't throw error - let the process continue
      return false;
    }
  };

  const validateBatchReceiving = () => {
    console.log('🔍 Validating order...');
    console.log('📦 Items count:', receivingItems.length);
    console.log('🏢 Supplier name:', supplierName);
    console.log('📝 Notes:', notes);
    
    if (receivingItems.length === 0) {
      console.log('❌ Validation failed: No items');
      Alert.alert('Error', 'Please add at least one item to receive.');
      return false;
    }
    
    if (!supplierName.trim()) {
      console.log('❌ Validation failed: No supplier');
      Alert.alert('Error', 'Please enter supplier name.');
      return false;
    }
    
    console.log('✅ Validation passed!');
    return true;
  };

  const handleSubmitForReview = async () => {
    console.log('🚀 Starting order submission...');
    console.log('📊 Current state:');
    console.log('  - Items count:', receivingItems.length);
    console.log('  - Items:', receivingItems);
    console.log('  - Supplier:', `"${supplierName}"`);
    console.log('  - Supplier trimmed:', `"${supplierName.trim()}"`);
    
    if (!validateBatchReceiving()) {
      console.log('❌ Validation failed - stopping process');
      return;
    }
    
    const totals = calculateTotals();
    console.log('📊 Calculated totals:', totals);
    
    // Always attempt to save order
    console.log('💾 Attempting to save order...');
    const saveResult = await saveOrderLocally();
    
    if (saveResult === false) {
      console.log('⚠️ Storage save had issues, but continuing...');
    } else {
      console.log('✅ Order saved successfully!');
    }
    
    // Always show success modal - this ensures user gets feedback
    console.log('🎉 Showing success modal...');
    setShowSuccessModal(true);
  };

  const handleSuccessModalOK = () => {
    setShowSuccessModal(false);
    // Order is already saved when modal appears, just close it
  };



  const confirmAndSubmitOrder = async () => {
    setSaving(true);
    setShowConfirmation(false);
    
    try {
      const totals = calculateTotals();
      
      // Create order payload
      const payload = {
        orderId: orderId,
        reference: receivingReference,
        invoiceNumber: invoiceNumber,
        supplier: supplierName,
        receivingDate: receivingDate,
        notes: notes,
        items: receivingItems.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          costPrice: item.costPrice,
          totalCost: item.totalCost,
          updateBaseCost: item.updateBaseCost,
          qualityRating: item.qualityRating,
          damageCount: item.damageCount,
          damageNotes: item.damageNotes,
        })),
        totals: totals,
        createdAt: new Date().toISOString(),
        status: 'pending_review'
      };

      console.log('📦 Creating new order:', payload);
      
      // Simulate API call for now (replace with actual API)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Order Created Successfully!',
        `Your receiving order has been created and is pending review.\n\nOrder ID: ${orderId}\nReference: ${receivingReference}\nInvoice: ${invoiceNumber}\nItems: ${totals.totalItems}\nTotal Value: ${totals.totalValue.toFixed(2)}`,
        [
          {
            text: 'View Order Details',
            onPress: () => {
              resetForm();
              // Navigate to order details or audit trail
            }
          },
          {
            text: 'Create Another Order',
            onPress: () => {
              resetForm();
              generateReceivingReference();
              generateInvoiceNumber();
              generateOrderId();
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error creating order:', error);
      Alert.alert('Error', 'Failed to create order. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setReceivingItems([]);
    setSelectedProduct(null);
    setReceivingQuantity('');
    setCostPrice('');
    setBatchBarcode(''); // Reset barcode field
    setSupplierName('');
    setInvoiceNumber('');
    setNotes('');
    setUpdateBaseCost(false);
    setQualityRating(5);
    setDamageNotes('');
    setDamageCount('');
    setSearchQuery('');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>← Back to Restock</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>📦 Batch Receiving</Text>
      <TouchableOpacity onPress={() => setShowReceivingHistory(true)}>
        <Text style={styles.historyButton}>📋 History</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReceivingForm = () => (
    <View style={styles.formCard}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Add Items to Receive</Text>
        <Text style={styles.formSubtitle}>Reference: {receivingReference}</Text>
      </View>

      {/* Product Selection */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Product *</Text>
        <View style={styles.productSelectionContainer}>
          <TouchableOpacity
            style={styles.productSelector}
            onPress={() => setShowProductSelector(true)}
          >
            {selectedProduct ? (
              <View>
                <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                <Text style={styles.selectedProductDetails}>
                  {`Current Stock: ${selectedProduct.stock_quantity || 0} • Cost: ${selectedProduct.cost_price || '0.00'}`}
                </Text>
              </View>
            ) : (
              <Text style={styles.placeholder}>Tap to select a product</Text>
            )}
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.barcodeButton}
            onPress={() => setShowBarcodeScanner(true)}
          >
            <Text style={styles.barcodeButtonText}>📷</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barcode Input for this Batch */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Batch Barcode (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter barcode for this batch/supplier"
          value={batchBarcode}
          onChangeText={setBatchBarcode}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.helpText}>💡 Leave empty to use product's default barcode</Text>
      </View>

      {/* Quantity and Cost Price Row */}
      <View style={styles.row}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Quantity *</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            value={receivingQuantity}
            onChangeText={setReceivingQuantity}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Cost Price *</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            value={costPrice}
            onChangeText={setCostPrice}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Quality Control */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Quality Rating (1-5)</Text>
        <View style={styles.qualityRating}>
          {[1, 2, 3, 4, 5].map(rating => (
            <TouchableOpacity
              key={rating}
              style={[
                styles.ratingStar,
                qualityRating >= rating && styles.ratingStarActive
              ]}
              onPress={() => setQualityRating(rating)}
            >
              <Text style={[
                styles.ratingStarText,
                qualityRating >= rating && styles.ratingStarTextActive
              ]}>
                ⭐
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Damage Tracking */}
      <View style={styles.row}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Damage Count</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            value={damageCount}
            onChangeText={setDamageCount}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Update Base Cost?</Text>
          <Switch
            value={updateBaseCost}
            onValueChange={setUpdateBaseCost}
            trackColor={{ false: '#767577', true: '#10b981' }}
            thumbColor={updateBaseCost ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Damage Notes */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Damage/Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Quality issues, damage notes, etc."
          value={damageNotes}
          onChangeText={setDamageNotes}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Add Item Button */}
      <TouchableOpacity
        style={styles.addItemButton}
        onPress={addReceivingItem}
        disabled={!selectedProduct || !receivingQuantity || !costPrice}
      >
        <Text style={styles.addItemButtonText}>➕ Add Item</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReceivingItems = () => {
    const totals = calculateTotals();
    
    return (
      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Receiving Items ({totals.totalItems})</Text>
          <TouchableOpacity 
            style={styles.batchActionsButton}
            onPress={() => setShowBatchActions(true)}
          >
            <Text style={styles.batchActionsText}>⚙️ Actions</Text>
          </TouchableOpacity>
        </View>

        {/* Enhanced transition info for negative stock */}
        {totals.oversoldItems > 0 && (
          <View style={styles.negativeStockAlert}>
            <Text style={styles.negativeStockAlertTitle}>🚨 Negative Stock Transitions</Text>
            <Text style={styles.negativeStockAlertText}>
              {totals.oversoldItems} item(s) will clear oversell conditions
            </Text>
            <Text style={styles.negativeStockAlertText}>
              {totals.negativeToPositiveTransitions} will transition from negative to positive stock
            </Text>
            <Text style={styles.negativeStockAlertValue}>
              Total Inventory Value Change: ${totals.totalInventoryValueChange.toFixed(2)}
            </Text>
          </View>
        )}

        {receivingItems.length === 0 ? (
          <Text style={styles.emptyText}>No items added yet</Text>
        ) : (
          <>
            <FlatList
              data={receivingItems}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={[
                  styles.receivingItem,
                  item.currentStock < 0 && styles.negativeStockItem
                ]}>
                  <View style={styles.itemHeader}>
                    <Text style={[
                      styles.itemName,
                      item.currentStock < 0 && styles.negativeStockItemName
                    ]}>
                      {item.product.name}
                      {item.currentStock < 0 && ' ⚠️'}
                    </Text>
                    <TouchableOpacity
                      style={styles.removeItemButton}
                      onPress={() => removeReceivingItem(item.id)}
                    >
                      <Text style={styles.removeItemText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Stock transition info */}
                  {item.currentStock < 0 && (
                    <View style={styles.stockTransitionInfo}>
                      <Text style={styles.stockTransitionText}>
                        Stock Transition: {item.currentStock} → {item.newStockAfterReceiving}
                      </Text>
                      <Text style={styles.stockTransitionDetail}>
                        Will clear oversell of {item.oversellAmount} units
                      </Text>
                      {item.willTransitionToPositive && (
                        <Text style={styles.positiveTransitionText}>
                          🎉 Will transition to positive stock!
                        </Text>
                      )}
                    </View>
                  )}
                  
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemDetail}>Qty: {item.quantity}</Text>
                    <Text style={styles.itemDetail}>Cost: ${item.costPrice.toFixed(2)}</Text>
                    <Text style={styles.itemDetail}>Total: ${item.totalCost.toFixed(2)}</Text>
                  </View>
                  
                  {/* Enhanced inventory value info */}
                  {item.inventoryValueChange > 0 && (
                    <View style={styles.inventoryValueChange}>
                      <Text style={styles.inventoryValueChangeText}>
                        📈 Inventory Value: +${item.inventoryValueChange.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  
                  {/* Barcode and Supplier Info */}
                  {(item.batchBarcode || item.supplierName) && (
                    <View style={styles.batchInfo}>
                      {item.batchBarcode && (
                        <Text style={styles.batchBarcode}>🔖 Barcode: {item.batchBarcode}</Text>
                      )}
                      {item.supplierName && (
                        <Text style={styles.batchSupplier}>🏢 Supplier: {item.supplierName}</Text>
                      )}
                    </View>
                  )}

                  {item.damageCount > 0 && (
                    <Text style={styles.damageBadge}>⚠️ {item.damageCount} damaged</Text>
                  )}

                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={styles.qualityButton}
                      onPress={() => {
                        // Handle quality check for this item
                      }}
                    >
                      <Text style={styles.qualityButtonText}>⭐ {item.qualityRating}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              scrollEnabled={false}
            />

            {/* Enhanced Totals Summary */}
            <View style={styles.totalsCard}>
              <Text style={styles.totalsTitle}>Receiving Summary</Text>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Total Items:</Text>
                <Text style={styles.totalsValue}>{totals.totalItems}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Total Quantity:</Text>
                <Text style={styles.totalsValue}>{totals.totalQuantity}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Total Value:</Text>
                <Text style={styles.totalsValue}>${totals.totalValue.toFixed(2)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Total Damaged:</Text>
                <Text style={styles.totalsValue}>{totals.totalDamage}</Text>
              </View>
              
              {/* Enhanced totals for negative stock transitions */}
              {totals.oversoldItems > 0 && (
                <>
                  <View style={styles.totalsDivider} />
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Oversold Items:</Text>
                    <Text style={[
                      styles.totalsValue, 
                      styles.negativeStockValue
                    ]}>{totals.oversoldItems}</Text>
                  </View>
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Oversell Being Cleared:</Text>
                    <Text style={[
                      styles.totalsValue, 
                      styles.negativeStockValue
                    ]}>{totals.oversellClearing}</Text>
                  </View>
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Neg→Pos Transitions:</Text>
                    <Text style={[
                      styles.totalsValue, 
                      styles.positiveTransitionValue
                    ]}>{totals.negativeToPositiveTransitions}</Text>
                  </View>
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Inventory Value Change:</Text>
                    <Text style={[
                      styles.totalsValue, 
                      totals.totalInventoryValueChange >= 0 ? styles.positiveTransitionValue : styles.negativeStockValue
                    ]}>
                      {totals.totalInventoryValueChange >= 0 ? '+' : ''}${totals.totalInventoryValueChange.toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderReceivingDetails = () => (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>Receiving Details</Text>

      {/* Supplier Selection */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Supplier Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter supplier name"
          value={supplierName}
          onChangeText={setSupplierName}
        />
      </View>

      {/* Invoice Number (Auto-generated) */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Invoice Number (Auto-generated)</Text>
        <View style={styles.autoGeneratedField}>
          <Text style={styles.autoGeneratedValue}>{invoiceNumber}</Text>
          <TouchableOpacity 
            style={styles.regenerateButton}
            onPress={generateInvoiceNumber}
          >
            <Text style={styles.regenerateButtonText}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Receiving Date */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Receiving Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={receivingDate}
          onChangeText={setReceivingDate}
        />
      </View>

      {/* Notes */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Additional notes about this receiving..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (receivingItems.length === 0) && styles.submitButtonDisabled
        ]}
        onPress={handleSubmitForReview}
        disabled={receivingItems.length === 0}
      >
        <Text style={styles.submitButtonText}>
          📋 Submit for Review
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderBatchActionsModal = () => (
    <Modal
      visible={showBatchActions}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowBatchActions(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Batch Actions</Text>
          <TouchableOpacity onPress={() => setShowBatchActions(false)}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.modalActionButton}>
            <Text style={styles.modalActionText}>📋 Export Receiving List</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.modalActionButton}>
            <Text style={styles.modalActionText}>💾 Save as Draft</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.modalActionButton}>
            <Text style={styles.modalActionText}>📤 Load from Purchase Order</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.modalActionButton, { backgroundColor: '#dc2626' }]}
            onPress={() => {
              Alert.alert(
                'Clear All Items',
                'Are you sure you want to remove all items from this receiving?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Clear All', 
                    style: 'destructive',
                    onPress: () => {
                      setReceivingItems([]);
                      setShowBatchActions(false);
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.modalActionText}>🗑️ Clear All Items</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderReceivingHistoryModal = () => (
    <Modal
      visible={showReceivingHistory}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowReceivingHistory(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Receiving History</Text>
          <TouchableOpacity onPress={() => setShowReceivingHistory(false)}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={receivingHistory}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <View style={styles.historyItem}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyReference}>{item.reference}</Text>
                <Text style={styles.historyDate}>{item.date}</Text>
              </View>
              <Text style={styles.historySupplier}>{item.supplier}</Text>
              <View style={styles.historyDetails}>
                <Text style={styles.historyDetail}>Items: {item.itemCount}</Text>
                <Text style={styles.historyDetail}>Value: ${item.totalValue}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No receiving history found</Text>
          }
        />
      </View>
    </Modal>
  );

  const renderSupplierSelectorModal = () => (
    <Modal
      visible={showSupplierSelector}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSupplierSelector(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Supplier</Text>
          <TouchableOpacity onPress={() => setShowSupplierSelector(false)}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={suppliers}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.supplierItem}
              onPress={() => handleSupplierSelect(item)}
            >
              <Text style={styles.supplierName}>{item.name}</Text>
              <Text style={styles.supplierDetails}>
                {`${item.contact || 'No contact info'} • ${item.location || 'No location'}`}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No suppliers found</Text>
          }
        />
      </View>
    </Modal>
  );

  const renderProductSelectorModal = () => (
    <Modal
      visible={showProductSelector}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowProductSelector(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Product</Text>
          <TouchableOpacity onPress={() => setShowProductSelector(false)}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productItem}
              onPress={() => handleProductSelect(item)}
            >
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productDetails}>
                {`${item.category} • Current Cost: ${item.cost_price || '0.00'} • Stock: ${item.stock_quantity || 0}`}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No products found</Text>
          }
        />
      </View>
    </Modal>
  );

  const renderBarcodeScannerModal = () => (
    <BarcodeScanner
      visible={showBarcodeScanner}
      onClose={() => setShowBarcodeScanner(false)}
      onScan={handleBarcodeScanned}
      title="Scan Product Barcode"
    />
  );

  const renderReceivingReportsModal = () => (
    <Modal
      visible={showReceivingReports}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowReceivingReports(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Receiving Reports</Text>
          <TouchableOpacity onPress={() => setShowReceivingReports(false)}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.modalActionButton}>
            <Text style={styles.modalActionText}>📈 Daily Receiving Summary</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.modalActionButton}>
            <Text style={styles.modalActionText}>📅 Weekly Report</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.modalActionButton}>
            <Text style={styles.modalActionText}>📊 Monthly Analytics</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.modalActionButton}>
            <Text style={styles.modalActionText}>🏆 Top Suppliers Report</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.modalActionButton}>
            <Text style={styles.modalActionText}>📦 Product Performance</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderSuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.successModalContainer}>
        <View style={styles.successModalContent}>
          {/* Success Checkmark */}
          <View style={styles.successIconContainer}>
            <Text style={styles.successIcon}>✅</Text>
          </View>
          
          {/* Success Title */}
          <Text style={styles.successTitle}>Order Created Successfully!</Text>
          
          {/* Success Message */}
          <Text style={styles.successMessage}>
            Your receiving order has been created and is waiting for approval.
          </Text>
          
          {/* Order Details */}
          <View style={styles.successDetails}>
            <Text style={styles.successDetail}>📋 Order ID: {orderId}</Text>
            <Text style={styles.successDetail}>🔗 Reference: {receivingReference}</Text>
            <Text style={styles.successDetail}>🧾 Invoice: {invoiceNumber}</Text>
            <Text style={styles.successDetail}>📦 Items: {calculateTotals().totalItems}</Text>
            <Text style={styles.successDetail}>💰 Total Value: ${calculateTotals().totalValue.toFixed(2)}</Text>
          </View>
          
          {/* Next Step */}
          <Text style={styles.successNextStep}>
            ✅ Next Step: Go to "Confirm" tab to review and approve this order.
          </Text>
          
          {/* OK Button */}
          <TouchableOpacity 
            style={styles.successOKButton}
            onPress={handleSuccessModalOK}
          >
            <Text style={styles.successOKButtonText}>OK</Text>
          </TouchableOpacity>
          

        </View>
      </View>
    </Modal>
  );



  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading receiving system...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, Platform.OS === 'web' && styles.webContainer]}
      contentContainerStyle={styles.scrollContentContainer}
      showsVerticalScrollIndicator={true}
      scrollEventThrottle={16}
      nestedScrollEnabled={Platform.OS === 'web'}
      removeClippedSubviews={false}
      onScroll={(event) => {
        if (Platform.OS === 'web') {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const isAtBottom = contentOffset.y >= (contentSize.height - layoutMeasurement.height - 10);
        }
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#06b6d4']}
          tintColor="#06b6d4"
        />
      }
    >
      {renderReceivingForm()}
      {renderReceivingItems()}
      {renderReceivingDetails()}
      
      {/* Bottom padding for web scrolling */}
      <View style={{ 
        height: Platform.OS === 'web' ? 100 : 20,
        minHeight: Platform.OS === 'web' ? 100 : 0
      }} />

      {/* Modals */}
      {renderProductSelectorModal()}
      {renderSupplierSelectorModal()}
      {renderReceivingHistoryModal()}
      {renderBatchActionsModal()}
      {renderBarcodeScannerModal()}
      {renderReceivingReportsModal()}
      {renderSuccessModal()}
    </ScrollView>
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
  webContainer: {
    ...Platform.select({
      web: {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'auto',
        WebkitOverflowScrolling: 'auto',
        scrollBehavior: 'smooth',
      },
    }),
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'web' ? 100 : 40,
    ...Platform.select({
      web: {
        minHeight: '100vh',
        width: '100%',
        flexGrow: 1,
      },
    }),
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
  historyButton: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  formCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  formSubtitle: {
    color: '#999',
    fontSize: 12,
  },
  batchActionsButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  batchActionsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
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
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productSelector: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#444',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedProductName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedProductDetails: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  placeholder: {
    color: '#999',
    fontSize: 16,
  },
  arrow: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: 'bold',
  },
  qualityRating: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  ratingStar: {
    padding: 4,
  },
  ratingStarActive: {
    backgroundColor: '#fbbf24',
    borderRadius: 4,
  },
  ratingStarText: {
    fontSize: 20,
    color: '#666',
  },
  ratingStarTextActive: {
    color: '#000',
  },
  addItemButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  receivingItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  removeItemButton: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeItemText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemDetail: {
    color: '#ccc',
    fontSize: 12,
  },
  damageBadge: {
    backgroundColor: '#fbbf24',
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  qualityButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qualityButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  totalsCard: {
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  totalsTitle: {
    color: '#93c5fd',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalsLabel: {
    color: '#bfdbfe',
    fontSize: 14,
  },
  totalsValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalClose: {
    color: '#3b82f6',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
  },
  modalActionButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 20,
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  productItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  productName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productDetails: {
    color: '#999',
    fontSize: 12,
  },
  supplierItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  supplierName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  supplierDetails: {
    color: '#999',
    fontSize: 12,
  },
  historyItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyReference: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyDate: {
    color: '#999',
    fontSize: 12,
  },
  historySupplier: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDetail: {
    color: '#ccc',
    fontSize: 12,
  },
  // Enhanced product selection
  productSelectionContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  barcodeButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeButtonText: {
    fontSize: 20,
  },
  // Auto-generated fields
  autoGeneratedField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  autoGeneratedValue: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  regenerateButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  regenerateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Success Modal Styles
  successModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  successModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
    maxWidth: '90%',
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 40,
  },
  successTitle: {
    color: '#10b981',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  successMessage: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  successDetails: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    width: '100%',
  },
  successDetail: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  successNextStep: {
    color: '#93c5fd',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
    fontWeight: '600',
  },

  successPrimaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // OK Button Styles
  successOKButton: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
    width: '80%',
  },
  successOKButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Help text style
  helpText: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Batch information styles
  batchInfo: {
    backgroundColor: '#374151',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  batchBarcode: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  batchSupplier: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },

  // Enhanced negative stock transition styles
  negativeStockAlert: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  negativeStockAlertTitle: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  negativeStockAlertText: {
    color: '#fca5a5',
    fontSize: 14,
    marginBottom: 4,
  },
  negativeStockAlertValue: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  negativeStockItem: {
    borderColor: '#dc2626',
    borderWidth: 2,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
  },
  negativeStockItemName: {
    color: '#fca5a5',
  },
  stockTransitionInfo: {
    backgroundColor: '#374151',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  stockTransitionText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  stockTransitionDetail: {
    color: '#fca5a5',
    fontSize: 11,
    marginBottom: 2,
  },
  positiveTransitionText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inventoryValueChange: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 4,
    padding: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  inventoryValueChangeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
  },
  totalsDivider: {
    height: 1,
    backgroundColor: '#444',
    marginVertical: 8,
  },
  negativeStockValue: {
    color: '#dc2626',
  },
  positiveTransitionValue: {
    color: '#10b981',
  },

});

export default InventoryReceivingScreen;