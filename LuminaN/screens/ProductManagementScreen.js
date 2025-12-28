import React, { useEffect, useState } from 'react';
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
  Animated,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { shopAPI } from '../services/api';
import { shopStorage } from '../services/storage';
import { ROUTES } from '../constants/navigation';

import SuccessScreen from './SuccessScreen';

const ProductManagementScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(false); // Track auto-refresh from inventory updates
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [shopCredentials, setShopCredentials] = useState(null);
  const [shopData, setShopData] = useState(null);
  
  // Notification states
  const [showNotification, setShowNotification] = useState(false);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [notificationIndex, setNotificationIndex] = useState(0);
  const [notificationFadeAnim] = useState(new Animated.Value(0));
  const [notificationSlideAnim] = useState(new Animated.Value(-100));
  
  // Total inventory value (simple display)
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Bulk selection
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);
  
  // Product status filtering
  const [showDelisted, setShowDelisted] = useState(false);

  // Add Product Modal states
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    cost_price: '',
    category: '',
    barcode: '',
    additional_barcodes: '',
    stock_quantity: '',
    min_stock_level: '5',
    supplier: '',
    currency: 'USD',
    price_type: 'unit'
  });

  // Edit Product Modal states
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editProductLoading, setEditProductLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editedProduct, setEditedProduct] = useState({
    name: '',
    description: '',
    price: '',
    cost_price: '',
    category: '',
    barcode: '',
    additional_barcodes: '',
    stock_quantity: '',
    min_stock_level: '5',
    supplier: '',
    currency: 'USD',
    price_type: 'unit'
  });

  // Stock Receiving Modal states
  const [showReceivingModal, setShowReceivingModal] = useState(false);
  const [receivingProduct, setReceivingProduct] = useState(null);
  const [receivingData, setReceivingData] = useState({
    quantity_received: '',
    cost_price: '',
    supplier_invoice: '',
    notes: ''
  });

  // Bulk Update Modal states
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateType, setBulkUpdateType] = useState('price');
  const [bulkUpdateValue, setBulkUpdateValue] = useState('');

  // Success/Error Screen states
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [successScreenData, setSuccessScreenData] = useState(null);

  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  // Price Type Options
  const priceTypes = [
    { value: 'unit', label: 'Per Unit' },
    { value: 'kg', label: 'Per Kilogram' },
    { value: 'g', label: 'Per Gram' },
    { value: 'lb', label: 'Per Pound' },
    { value: 'oz', label: 'Per Ounce' }
  ];

  // Comprehensive Category options
  const categoryOptions = [
    'All',
    'Fresh Produce',
    'Bakery',
    'Butcher & Meat',
    'Seafood',
    'Dairy & Eggs',
    'Frozen Foods',
    'Grocery & Pantry',
    'Beverages',
    'Snacks & Confectionery',
    'Spices & Seasonings',
    'Canned & Preserved Foods',
    'Health & Organic Foods',
    'Electronics & Technology',
    'Clothing & Fashion',
    'Footwear',
    'Jewelry & Accessories',
    'Beauty & Personal Care',
    'Health & Pharmacy',
    'Home & Garden',
    'Furniture & Home Decor',
    'Kitchen & Appliances',
    'Bedding & Bath',
    'Cleaning Supplies',
    'Household Essentials',
    'Toys & Games',
    'Books & Media',
    'Sports & Recreation',
    'Automotive',
    'Pet Supplies',
    'Hardware & Tools',
    'Office & School Supplies',
    'Baby & Kids',
    'Gifts & Flowers',
    'Tobacco & Vapes',
    'Fuel & Energy',
    'Services',
    'Other'
  ];

  // NO AUTHENTICATION NEEDED - Public access

  useEffect(() => {
    // NO AUTHENTICATION NEEDED - Public access
    loadProducts();
  }, []);

  useEffect(() => {
    // Listen for products refresh signal
    const checkForRefreshSignal = async () => {
      try {
        const refreshSignal = await shopStorage.getItem('products_need_refresh');
        if (refreshSignal === 'true') {
          setAutoRefresh(true);
          
          // Clear the signal
          await shopStorage.setItem('products_need_refresh', 'false');
          
          // Reload products
          await loadProducts();
          
          // Hide auto-refresh indicator after 3 seconds
          setTimeout(() => setAutoRefresh(false), 3000);
        }
      } catch (error) {
        // Silent error handling for refresh signal
      }
    };

    // Check immediately
    checkForRefreshSignal();
    
    // Set up interval to check every 1 second (more frequent)
    const interval = setInterval(checkForRefreshSignal, 1000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [products.length]); // Check whenever products data changes

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Filter and search effect
  useEffect(() => {
    filterAndSortProducts();
  }, [products, searchQuery, selectedCategory, sortBy, sortOrder, showDelisted]);

  // Notification system effect
  useEffect(() => {
    if (products.length > 0) {
      startNotificationSystem();
    }
    return () => {
      // Cleanup notification intervals
    };
  }, [products]);

  // REMOVED authentication - screen is now public

  const loadProducts = async () => {
    try {
      // NO AUTHENTICATION NEEDED - Public access
      const response = await shopAPI.getProducts();
      
      const productsData = response.data || [];
      setProducts(productsData);
      
      // Calculate total inventory value using proper business logic
      let totalValue = 0;
      productsData.forEach(product => {
        const stockQty = parseFloat(product.stock_quantity) || 0;
        const costPrice = parseFloat(product.cost_price) || 0;
        // Apply business logic: only count actual physical stock (max 0)
        const actualStockValue = Math.max(0, stockQty) * costPrice;
        totalValue += actualStockValue;
      });
      setTotalInventoryValue(totalValue);
      
    } catch (error) {
      Alert.alert('Error', 'Failed to load products.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterAndSortProducts = () => {
    let filtered = [...products];

    // Filter by delisted status
    if (!showDelisted) {
      // Show active products (is_active is true, undefined, null, or doesn't exist)
      filtered = filtered.filter(product => {
        const isActive = product.is_active;
        return isActive === undefined || isActive === null || isActive === true;
      });
    } else {
      // Show delisted products (is_active is explicitly false)
      filtered = filtered.filter(product => product.is_active === false);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        (product.name && product.name.toLowerCase().includes(query)) ||
        (product.category && product.category.toLowerCase().includes(query)) ||
        (product.supplier && product.supplier.toLowerCase().includes(query)) ||
        (product.line_code && product.line_code.toLowerCase().includes(query)) ||
        (product.barcode && product.barcode.toLowerCase().includes(query)) ||
        (product.additional_barcodes && Array.isArray(product.additional_barcodes) && 
         product.additional_barcodes.some(barcode => barcode.toLowerCase().includes(query)))
      );
    }

    // Category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'price' || sortBy === 'cost_price' || sortBy === 'stock_quantity' || sortBy === 'min_stock_level') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredProducts(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  // Notification system functions
  const startNotificationSystem = () => {
    const criticalProducts = products.filter(p => {
      const stockQuantity = parseFloat(p.stock_quantity) || 0;
      const minStockLevel = parseFloat(p.min_stock_level) || 5;
      return stockQuantity === 0 || stockQuantity <= minStockLevel;
    });

    if (criticalProducts.length === 0) {
      setShowNotification(false);
      return;
    }

    // Show first notification
    showNextNotification(criticalProducts);
    
    // Set up interval to cycle through notifications
    const interval = setInterval(() => {
      showNextNotification(criticalProducts);
    }, 45000); // 45 seconds

    return () => clearInterval(interval);
  };

  const showNextNotification = (criticalProducts) => {
    if (criticalProducts.length === 0) return;

    const product = criticalProducts[notificationIndex % criticalProducts.length];
    const stockQuantity = parseFloat(product.stock_quantity) || 0;
    const minStockLevel = parseFloat(product.min_stock_level) || 5;
    // FIXED: Negative stock should be treated as "Out of Stock"
    const isOutOfStock = stockQuantity <= 0;
    const isLowStock = stockQuantity > 0 && stockQuantity <= minStockLevel;

    const unitDisplay = product.price_type === 'unit' ? 'units' : product.price_type;
    
    setCurrentNotification({
      product,
      type: isOutOfStock ? 'out_of_stock' : 'low_stock',
      message: isOutOfStock 
        ? `🚨 OUT OF STOCK: ${product.name || 'Unknown Product'} - ${unitDisplay}`
        : `⚠️ LOW STOCK: ${product.name || 'Unknown Product'} (${stockQuantity} ${unitDisplay} left)`,
      backgroundColor: '#dc2626' // Always red as requested
    });

    // Animate in
    setShowNotification(true);
    Animated.parallel([
      Animated.timing(notificationFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(notificationSlideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after 45 seconds
    setTimeout(() => {
      hideNotification();
    }, 45000);

    setNotificationIndex(prev => prev + 1);
  };

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(notificationFadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(notificationSlideAnim, {
        toValue: -100,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowNotification(false);
      setCurrentNotification(null);
    });
  };

  const getPriceTypeLabel = (priceType) => {
    const type = priceTypes.find(t => t.value === priceType);
    return type ? type.label : priceType;
  };

  const getStockStatusStyle = (product) => {
    const stockQuantity = parseFloat(product.stock_quantity) || 0;
    const minStockLevel = parseFloat(product.min_stock_level) || 5;
    
    // FIXED: Negative stock should be "Out of Stock" (no physical inventory)
    if (stockQuantity <= 0) {
      return styles.outOfStock;
    } else if (stockQuantity <= minStockLevel) {
      return styles.lowStock;
    } else {
      return styles.normalStock;
    }
  };

  const getStockStatusText = (product) => {
    const stockQuantity = parseFloat(product.stock_quantity) || 0;
    const minStockLevel = parseFloat(product.min_stock_level) || 5;
    
    // FIXED: Negative stock should be "Out" (no physical inventory)
    if (stockQuantity <= 0) {
      return 'Out';
    } else if (stockQuantity <= minStockLevel) {
      return 'Low';
    } else {
      return 'OK';
    }
  };

  const getStockTextStyle = (product) => {
    const stockQuantity = parseFloat(product.stock_quantity) || 0;
    const minStockLevel = parseFloat(product.min_stock_level) || 5;
    
    // FIXED: Negative stock should show as "Out" style (no physical inventory)
    if (stockQuantity <= 0) {
      return styles.stockOut;
    } else if (stockQuantity <= minStockLevel) {
      return styles.stockLow;
    } else {
      return styles.stockOk;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Bulk selection functions
  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const selectAllProducts = () => {
    setSelectedProducts(filteredProducts.map(p => p.id));
  };

  const clearSelection = () => {
    setSelectedProducts([]);
  };



  const handleBulkUpdate = () => {
    if (selectedProducts.length === 0) {
      Alert.alert('Error', 'Please select products to update.');
      return;
    }

    if (!bulkUpdateValue.trim()) {
      Alert.alert('Error', 'Please enter a value to update.');
      return;
    }

    Alert.alert(
      'Bulk Update',
      `Update ${selectedProducts.length} selected products with ${bulkUpdateType}: ${bulkUpdateValue}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Update', 
          onPress: () => {
            // Implement bulk update logic here
            Alert.alert('Success', `${selectedProducts.length} products updated successfully.`);
            setSelectedProducts([]);
            setBulkMode(false);
            setShowBulkUpdateModal(false);
            setBulkUpdateValue('');
            loadProducts();
          }
        }
      ]
    );
  };

  // Delete and Delist functions
  const handleDeleteProduct = async (product) => {
    console.log('🗑️ handleDeleteProduct called with:', product);
    console.log('🔍 About to show alert...');
    
    Alert.alert(
      'Delete Product',
      `Are you sure you want to PERMANENTLY DELETE "${product.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Permanently', 
          style: 'destructive',
          onPress: async () => {
            console.log('🗑️ Delete confirmed for:', product.id, product.name);
            console.log('🔐 Checking shopCredentials...', shopCredentials);
            
            try {
              // NO AUTHENTICATION NEEDED - Public access
              const response = await shopAPI.deleteProduct(product.id);
              
              console.log('✅ Product deleted successfully:', response);
              Alert.alert('Success', `"${product.name}" has been permanently deleted.`);
              loadProducts();
            } catch (error) {
              console.error('❌ Delete failed with full error:', error);
              console.error('❌ Error response:', error.response);
              console.error('❌ Error message:', error.message);
              Alert.alert('Error', `Failed to delete product: ${error.message || 'Please try again.'}`);
            }
          }
        }
      ]
    );
  };

  const handleDelistProduct = async (product) => {
    console.log('⏸️ handleDelistProduct called with:', product);
    console.log('🔍 About to show alert...');
    
    Alert.alert(
      'Delist Product',
      `Are you sure you want to DELIST "${product.name}"? This will hide it from the main list but keep it in the system.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delist Product', 
          onPress: async () => {
            console.log('⏸️ Delist confirmed for:', product.id, product.name);
            console.log('🔐 Checking shopCredentials...', shopCredentials);
            
            try {
              // NO AUTHENTICATION NEEDED - Public access
              console.log('📤 Sending delist data:', { is_active: false });
              
              const response = await shopAPI.updateProduct(product.id, {
                is_active: false
              });
              
              console.log('✅ Product delisted successfully:', response);
              Alert.alert('Success', `"${product.name}" has been delisted successfully.`);
              loadProducts();
            } catch (error) {
              console.error('❌ Delist failed with full error:', error);
              console.error('❌ Error response:', error.response);
              console.error('❌ Error message:', error.message);
              Alert.alert('Error', `Failed to delist product: ${error.message || 'Please try again.'}`);
            }
          }
        }
      ]
    );
  };

  const handleRelistProduct = async (product) => {
    console.log('▶️ handleRelistProduct called with:', product);
    try {
      console.log('▶️ Relisting product:', product.id, product.name);
      
      // NO AUTHENTICATION NEEDED - Public access
      await shopAPI.updateProduct(product.id, {
        is_active: true
      });
      
      console.log('✅ Product relisted successfully');
      Alert.alert('Success', `"${product.name}" has been relisted successfully.`);
      loadProducts();
    } catch (error) {
      console.error('❌ Relist failed:', error);
      Alert.alert('Error', `Failed to relist product: ${error.message || 'Please try again.'}`);
    }
  };

  const handleBulkDelete = () => {
    if (selectedProducts.length === 0) {
      Alert.alert('Error', 'Please select products to delete.');
      return;
    }

    Alert.alert(
      'Bulk Delete Products',
      `Are you sure you want to PERMANENTLY DELETE ${selectedProducts.length} selected products? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Permanently', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Bulk deleting products:', selectedProducts.length);
              
              // NO AUTHENTICATION NEEDED - Public access
              // Delete each selected product
              for (const productId of selectedProducts) {
                await shopAPI.deleteProduct(productId);
              }
              
              console.log('✅ Bulk delete completed');
              Alert.alert('Success', `${selectedProducts.length} products permanently deleted.`);
              setSelectedProducts([]);
              setBulkMode(false);
              loadProducts();
            } catch (error) {
              console.error('❌ Bulk delete failed:', error);
              Alert.alert('Error', `Failed to delete some products: ${error.message || 'Please try again.'}`);
            }
          }
        }
      ]
    );
  };

  const handleBulkDelist = () => {
    if (selectedProducts.length === 0) {
      Alert.alert('Error', 'Please select products to delist.');
      return;
    }

    Alert.alert(
      'Bulk Delist Products',
      `Are you sure you want to DELIST ${selectedProducts.length} selected products? This will hide them from the main list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delist Products', 
          onPress: async () => {
            try {
              console.log('⏸️ Bulk delisting products:', selectedProducts.length);
              
              // NO AUTHENTICATION NEEDED - Public access
              // Delist each selected product
              for (const productId of selectedProducts) {
                await shopAPI.updateProduct(productId, {
                  is_active: false
                });
              }
              
              console.log('✅ Bulk delist completed');
              Alert.alert('Success', `${selectedProducts.length} products delisted successfully.`);
              setSelectedProducts([]);
              setBulkMode(false);
              loadProducts();
            } catch (error) {
              console.error('❌ Bulk delist failed:', error);
              Alert.alert('Error', `Failed to delist some products: ${error.message || 'Please try again.'}`);
            }
          }
        }
      ]
    );
  };

  const handleBulkRelist = () => {
    if (selectedProducts.length === 0) {
      Alert.alert('Error', 'Please select products to relist.');
      return;
    }

    Alert.alert(
      'Bulk Relist Products',
      `Are you sure you want to RELIST ${selectedProducts.length} selected products? This will make them visible in the main list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Relist Products', 
          onPress: async () => {
            try {
              console.log('▶️ Bulk relisting products:', selectedProducts.length);
              
              // NO AUTHENTICATION NEEDED - Public access
              // Relist each selected product
              for (const productId of selectedProducts) {
                await shopAPI.updateProduct(productId, {
                  is_active: true
                });
              }
              
              console.log('✅ Bulk relist completed');
              Alert.alert('Success', `${selectedProducts.length} products relisted successfully.`);
              setSelectedProducts([]);
              setBulkMode(false);
              loadProducts();
            } catch (error) {
              console.error('❌ Bulk relist failed:', error);
              Alert.alert('Error', `Failed to relist some products: ${error.message || 'Please try again.'}`);
            }
          }
        }
      ]
    );
  };

  const handleAddProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price.trim()) {
      Alert.alert('Error', 'Product name and price are required.');
      return;
    }

    try {
      setAddProductLoading(true);
      console.log('🔄 Starting product creation...');
      
      // NO AUTHENTICATION NEEDED - Public access
      const productData = {
        name: newProduct.name.trim(),
        description: newProduct.description.trim(),
        price: parseFloat(newProduct.price),
        cost_price: parseFloat(newProduct.cost_price) || 0,
        category: newProduct.category,
        barcode: newProduct.barcode.trim(),
        additional_barcodes: newProduct.additional_barcodes ? 
          newProduct.additional_barcodes.split(',').map(b => b.trim()).filter(b => b) : [],
        stock_quantity: parseFloat(newProduct.stock_quantity) || 0,
        min_stock_level: parseFloat(newProduct.min_stock_level) || 5,
        supplier: newProduct.supplier.trim(),
        currency: newProduct.currency,
        price_type: newProduct.price_type
      };

      console.log('📤 Sending add product request...', productData);
      const response = await shopAPI.addProduct(productData);
      console.log('✅ Add product response received:', response);
      
      // Close loading first
      setAddProductLoading(false);
      
      // Refresh products list
      loadProducts();
      
      // Reset form and close modal
      setNewProduct({
        name: '',
        description: '',
        price: '',
        cost_price: '',
        category: '',
        barcode: '',
        additional_barcodes: '',
        stock_quantity: '',
        min_stock_level: '5',
        supplier: '',
        currency: 'USD',
        price_type: 'unit'
      });
      setShowAddProductModal(false);
      
      // Show success alert
      Alert.alert('Success', 'Product added successfully!');
      
    } catch (error) {
      console.error('❌ Add product failed:', error);
      setAddProductLoading(false);
      Alert.alert('Error', `Failed to add product: ${error.message || 'Please try again.'}`);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setEditedProduct({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      cost_price: product.cost_price?.toString() || '',
      category: product.category || '',
      barcode: product.barcode || '',
      additional_barcodes: product.additional_barcodes ? 
        product.additional_barcodes.join(', ') : '',
      stock_quantity: product.stock_quantity?.toString() || '',
      min_stock_level: product.min_stock_level?.toString() || '5',
      supplier: product.supplier || '',
      currency: product.currency || 'USD',
      price_type: product.price_type || 'unit'
    });
    setShowEditProductModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!editedProduct.name.trim() || !editedProduct.price.trim()) {
      Alert.alert('Error', 'Product name and price are required.');
      return;
    }

    try {
      setEditProductLoading(true);
      console.log('🔄 Starting product update...', { productId: editingProduct?.id });
      
      // NO AUTHENTICATION NEEDED - Public access
      const productData = {
        name: editedProduct.name.trim(),
        description: editedProduct.description.trim(),
        price: parseFloat(editedProduct.price),
        cost_price: parseFloat(editedProduct.cost_price) || 0,
        category: editedProduct.category,
        barcode: editedProduct.barcode.trim(),
        additional_barcodes: editedProduct.additional_barcodes ? 
          editedProduct.additional_barcodes.split(',').map(b => b.trim()).filter(b => b) : [],
        stock_quantity: parseFloat(editedProduct.stock_quantity) || 0,
        min_stock_level: parseFloat(editedProduct.min_stock_level) || 5,
        supplier: editedProduct.supplier.trim(),
        currency: editedProduct.currency,
        price_type: editedProduct.price_type
      };

      console.log('📤 Sending update request...', productData);
      const response = await shopAPI.updateProduct(editingProduct.id, productData);
      console.log('✅ Update response received:', response);
      
      // Close loading first
      setEditProductLoading(false);
      
      // Show simple modal for successful updates
      Alert.alert(
        'Success',
        'Product updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('🔄 Refreshing products and closing modal...');
              // Refresh products list and close modal
              loadProducts();
              setShowEditProductModal(false);
              setEditingProduct(null);
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ Update failed:', error);
      setEditProductLoading(false);
      
      // Show simple error alert for product updates
      Alert.alert(
        'Error',
        `Failed to update product: ${error.message || 'Please try again.'}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleStockReceiving = (product) => {
    setReceivingProduct(product);
    setReceivingData({
      quantity_received: '',
      cost_price: product.cost_price?.toString() || '',
      supplier_invoice: '',
      notes: ''
    });
    // Navigate to the dedicated Inventory Receiving Screen
    navigation.navigate(ROUTES.INVENTORY_RECEIVING, { selectedProduct: product });
  };

  const submitStockReceiving = async () => {
    if (!receivingData.quantity_received.trim()) {
      Alert.alert('Error', 'Please enter quantity received.');
      return;
    }

    const quantity = parseFloat(receivingData.quantity_received);
    if (quantity <= 0) {
      Alert.alert('Error', 'Quantity must be greater than 0.');
      return;
    }

    try {
      const newStockQuantity = (parseFloat(receivingProduct.stock_quantity) || 0) + quantity;
      const newCostPrice = parseFloat(receivingData.cost_price) || receivingProduct.cost_price || 0;

      // NO AUTHENTICATION NEEDED - Public access
      const updateData = {
        stock_quantity: newStockQuantity,
        cost_price: newCostPrice,
        supplier_invoice: receivingData.supplier_invoice.trim(),
        receiving_notes: receivingData.notes.trim()
      };

      await shopAPI.updateProduct(receivingProduct.id, updateData);

      Alert.alert('Success', `Stock updated: +${quantity} ${receivingProduct.name}`);
      setShowReceivingModal(false);
      setReceivingData({
        quantity_received: '',
        cost_price: '',
        supplier_invoice: '',
        notes: ''
      });
      loadProducts();
    } catch (error) {
      Alert.alert('Error', 'Failed to receive stock. Please try again.');
    }
  };



  const renderRefreshBar = () => (
    <TouchableOpacity 
      style={styles.refreshBar}
      onPress={() => {
        console.log('🔄 Manual refresh triggered from top bar');
        loadProducts();
      }}
      activeOpacity={0.7}
    >
      <Text style={styles.refreshBarText}>🔄 Pull to Refresh - Tap to Refresh Products</Text>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Product Management</Text>
      <View style={styles.headerActions}>
        {bulkMode ? (
          <>
            <TouchableOpacity onPress={selectAllProducts} style={styles.headerActionButton}>
              <Text style={styles.headerActionText}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearSelection} style={styles.headerActionButton}>
              <Text style={styles.headerActionText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBulkMode(false)} style={styles.headerActionButton}>
              <Text style={styles.headerActionText}>Done</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              onPress={() => {
                console.log('🔄 Manual refresh triggered');
                loadProducts();
              }} 
              style={[styles.headerActionButton, styles.refreshButton]}
            >
              <Text style={styles.headerActionText}>🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDelisted(!showDelisted)} style={[styles.headerActionButton, showDelisted && styles.headerActionButtonActive]}>
              <Text style={styles.headerActionText}>{showDelisted ? 'Active' : 'Delisted'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => navigation.navigate(ROUTES.RESTOCK_MANAGER)} 
              style={[styles.headerActionButton, styles.restockButton]}
            >
              <Text style={styles.headerActionText}>📦</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBulkMode(true)} style={styles.headerActionButton}>
              <Text style={styles.headerActionText}>Select</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderTotalValue = () => (
    <View style={styles.totalValueContainer}>
      <Text style={styles.totalValueLabel}>Total Inventory Value</Text>
      <Text style={styles.totalValueAmount}>{formatCurrency(totalInventoryValue)}</Text>
    </View>
  );

  const renderSearchAndFilter = () => (
    <View style={styles.searchFilterContainer}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products, categories, suppliers, barcodes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>
      
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categoryOptions.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryFilter,
                selectedCategory === category && styles.categoryFilterActive
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryFilterText,
                selectedCategory === category && styles.categoryFilterTextActive
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {selectedProducts.length > 0 && (
        <View style={styles.bulkActionsContainer}>
          <Text style={styles.bulkActionText}>
            {selectedProducts.length} product(s) selected
          </Text>
          <View style={styles.bulkActionButtons}>
            <TouchableOpacity 
              style={styles.bulkActionButton}
              onPress={() => setShowBulkUpdateModal(true)}
            >
              <Text style={styles.bulkActionButtonText}>Update</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.bulkActionButton}
              onPress={handleBulkDelist}
            >
              <Text style={styles.bulkActionButtonText}>Delist</Text>
            </TouchableOpacity>
            {showDelisted && (
              <TouchableOpacity 
                style={styles.bulkActionButton}
                onPress={handleBulkRelist}
              >
                <Text style={styles.bulkActionButtonText}>Relist</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.bulkActionButton, styles.bulkDeleteButton]}
              onPress={handleBulkDelete}
            >
              <Text style={styles.bulkDeleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Live Stock Notifications */}
      {showNotification && currentNotification && (
        <Animated.View 
          style={[
            styles.notificationContainer,
            { 
              backgroundColor: currentNotification.backgroundColor,
              opacity: notificationFadeAnim,
              transform: [{ translateY: notificationSlideAnim }]
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.notificationContent}
            onPress={hideNotification}
          >
            <Text style={styles.notificationText}>{currentNotification.message}</Text>
            <TouchableOpacity onPress={hideNotification}>
              <Text style={styles.notificationClose}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Success/Error Screen */}
      {showSuccessScreen && successScreenData && (
        <SuccessScreen
          title={successScreenData.title}
          subtitle={successScreenData.subtitle}
          details={successScreenData.details}
          buttonText={successScreenData.buttonText}
          onContinue={successScreenData.onContinue}
          isError={successScreenData.isError}
        />
      )}

      {/* Manual Refresh Bar - At the very top */}
      {renderRefreshBar()}

      {/* Main Scrollable Content - Everything scrolls together */}
      <ScrollView 
        style={styles.mainScrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        {renderHeader()}

        {/* Auto-refresh indicator */}
        {autoRefresh && (
          <View style={styles.autoRefreshIndicator}>
            <Text style={styles.autoRefreshText}>🔄 Auto-refreshing from inventory update...</Text>
          </View>
        )}

        {/* Total Value Display */}
        {renderTotalValue()}
        


        {/* Search and Filter */}
        {renderSearchAndFilter()}

        {/* Products Table */}
        <View style={styles.tableContainer}>
          {/* Statistics */}
          <View style={styles.statsContainer}>
          <Text style={styles.sectionHeader}>📊 Quick Stats</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
              <Text style={styles.statValue}>{filteredProducts.length}</Text>
              <Text style={styles.statTitle}>Filtered Products</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
              <Text style={styles.statValue}>
                {filteredProducts.filter(p => (parseFloat(p.stock_quantity) || 0) > (parseFloat(p.min_stock_level) || 5)).length}
              </Text>
              <Text style={styles.statTitle}>In Stock</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#dc2626' }]}>
              <Text style={styles.statValue}>
                {filteredProducts.filter(p => (parseFloat(p.stock_quantity) || 0) > 0 && (parseFloat(p.stock_quantity) || 0) <= (parseFloat(p.min_stock_level) || 5)).length}
              </Text>
              <Text style={styles.statTitle}>Low Stock</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#dc2626' }]}>
              <Text style={styles.statValue}>
                {filteredProducts.filter(p => (parseFloat(p.stock_quantity) || 0) <= 0).length}
              </Text>
              <Text style={styles.statTitle}>Out of Stock</Text>
            </View>
          </View>
        </View>
        </View>

        {/* Add Product Button */}
        <View style={styles.addButtonContainer}>
          <TouchableOpacity 
            style={styles.addProductButton}
            onPress={() => setShowAddProductModal(true)}
          >
            <Text style={styles.addProductButtonText}>➕ Add New Product</Text>
          </TouchableOpacity>
        </View>

        {/* Excel-like Table */}
        {(filteredProducts.length > 0 || products.length > 0) ? (
          <View style={styles.tableWrapper}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.headerCell}>#</Text>
              <Text style={[styles.headerCell, styles.headerName]}>Product Name</Text>
              <Text style={styles.headerCell}>Category</Text>
              <Text style={styles.headerCell}>Primary Barcode</Text>
              <Text style={styles.headerCell}>Additional Barcodes</Text>
              <Text style={styles.headerCell}>Code</Text>
              <Text style={styles.headerCell}>Price</Text>
              <Text style={styles.headerCell}>Cost</Text>
              <Text style={styles.headerCell}>Stock</Text>
              <Text style={styles.headerCell}>Min</Text>
              <Text style={styles.headerCell}>Status</Text>
              <Text style={styles.headerCell}>Actions</Text>
            </View>
            
            {/* Table Rows - Use products as fallback if filteredProducts is empty */}
            {(filteredProducts.length > 0 ? filteredProducts : products).map((product, index) => (
              <View key={product.id || index} style={[
                styles.tableRow, 
                index % 2 === 1 && styles.tableRowAlternate
              ]}>
                <Text style={styles.cell}>{index + 1}</Text>
                <Text style={[styles.cell, styles.cellName]} numberOfLines={2}>{product.name || 'Unknown Product'}</Text>
                <Text style={styles.cell} numberOfLines={1}>{product.category || 'Unknown'}</Text>
                <Text style={styles.cell} numberOfLines={1}>{product.barcode || 'N/A'}</Text>
                <Text style={styles.cell} numberOfLines={2}>
                  {product.additional_barcodes && Array.isArray(product.additional_barcodes) && product.additional_barcodes.length > 0 
                    ? product.additional_barcodes.slice(0, 2).join(', ') + (product.additional_barcodes.length > 2 ? ` (+${product.additional_barcodes.length - 2})` : '')
                    : 'None'
                  }
                </Text>
                <Text style={styles.cell} numberOfLines={1}>{product.line_code || 'N/A'}</Text>
                <Text style={[styles.cell, styles.cellPrice]}>{product.currency || 'USD'} ${product.price || '0.00'}</Text>
                <Text style={[styles.cell, styles.cellCost]}>${product.cost_price || '0.00'}</Text>
                <Text style={[styles.cell, styles.cellStock, getStockTextStyle(product)]}>
                  {formatNumber(parseFloat(product.stock_quantity) || 0)}
                </Text>
                <Text style={styles.cell}>{formatNumber(parseFloat(product.min_stock_level) || 5)}</Text>
                <View style={[styles.cell, styles.cellStatus]}>
                  <View style={[styles.statusIndicator, getStockStatusStyle(product)]}>
                    <Text style={styles.statusText}>{getStockStatusText(product)}</Text>
                  </View>
                </View>
                <View style={[styles.cell, styles.cellActions]}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleEditProduct(product)}
                  >
                    <Text style={styles.actionButtonText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleStockReceiving(product)}
                  >
                    <Text style={styles.actionButtonText}>📦</Text>
                  </TouchableOpacity>
                  {(product.is_active !== false) ? (
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
                      onPress={() => handleDelistProduct(product)}
                    >
                      <Text style={styles.actionButtonText}>⏸️</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: '#10b981' }]}
                      onPress={() => handleRelistProduct(product)}
                    >
                      <Text style={styles.actionButtonText}>▶️</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: '#dc2626' }]}
                    onPress={() => handleDeleteProduct(product)}
                  >
                    <Text style={styles.actionButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>📦 No Products Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || selectedCategory !== 'All' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Start by adding your first product to manage inventory.'
              }
            </Text>
            <TouchableOpacity 
              style={styles.emptyAddButton}
              onPress={() => setShowAddProductModal(true)}
            >
              <Text style={styles.emptyAddButtonText}>Add First Product</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add Product Modal */}
      <Modal
        visible={showAddProductModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddProductModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Add New Product</Text>
            
            <ScrollView style={styles.formContent}>
              {/* Basic Information */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>📝 Basic Information</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Product Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.name}
                    onChangeText={(text) => setNewProduct({...newProduct, name: text})}
                    placeholder="Enter product name"
                  />
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Description</Text>
                  <TextInput
                    style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                    value={newProduct.description}
                    onChangeText={(text) => setNewProduct({...newProduct, description: text})}
                    placeholder="Product description"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Primary Barcode (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.barcode}
                    onChangeText={(text) => setNewProduct({...newProduct, barcode: text})}
                    placeholder="Enter primary product barcode"
                  />
                  <Text style={styles.formHelperText}>
                    Primary barcode for scanning products during sales
                  </Text>
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Additional Barcodes (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.additional_barcodes}
                    onChangeText={(text) => setNewProduct({...newProduct, additional_barcodes: text})}
                    placeholder="Enter additional barcodes separated by commas"
                  />
                  <Text style={styles.formHelperText}>
                    Additional barcodes from different suppliers (comma-separated)
                  </Text>
                </View>
              </View>

              {/* Pricing & Units */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>💰 Pricing</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Selling Price *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.price}
                    onChangeText={(text) => setNewProduct({...newProduct, price: text})}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Cost Price</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.cost_price}
                    onChangeText={(text) => setNewProduct({...newProduct, cost_price: text})}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Currency</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.currency}
                    onChangeText={(text) => setNewProduct({...newProduct, currency: text})}
                    placeholder="USD"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Price Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {priceTypes.map((priceType) => (
                      <TouchableOpacity
                        key={priceType.value}
                        style={[
                          styles.categoryButton,
                          newProduct.price_type === priceType.value && styles.categoryButtonActive
                        ]}
                        onPress={() => setNewProduct({...newProduct, price_type: priceType.value})}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          newProduct.price_type === priceType.value && styles.categoryButtonTextActive
                        ]}>
                          {priceType.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Categories */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>📂 Categories</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {categoryOptions.slice(1).map((category) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryButton,
                          newProduct.category === category && styles.categoryButtonActive
                        ]}
                        onPress={() => setNewProduct({...newProduct, category})}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          newProduct.category === category && styles.categoryButtonTextActive
                        ]}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Inventory & Alerts */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>📦 Inventory</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Initial Stock Quantity</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.stock_quantity}
                    onChangeText={(text) => setNewProduct({...newProduct, stock_quantity: text})}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Minimum Stock Level</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.min_stock_level}
                    onChangeText={(text) => setNewProduct({...newProduct, min_stock_level: text})}
                    placeholder="5"
                    keyboardType="numeric"
                  />
                  <Text style={styles.formHelperText}>
                    Set to 5 to get alerts when stock drops to 5 or below. You can customize this per product.
                  </Text>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Supplier</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.supplier}
                    onChangeText={(text) => setNewProduct({...newProduct, supplier: text})}
                    placeholder="Supplier name"
                  />
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowAddProductModal(false)}
                disabled={addProductLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.confirmButton, addProductLoading && styles.disabledButton]}
                onPress={handleAddProduct}
                disabled={addProductLoading}
              >
                {addProductLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Add Product</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        visible={showEditProductModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditProductModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Product</Text>
            
            <ScrollView style={styles.formContent}>
              {/* Basic Information */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>📝 Basic Information</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Product Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editedProduct.name}
                    onChangeText={(text) => setEditedProduct({...editedProduct, name: text})}
                    placeholder="Enter product name"
                  />
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Description</Text>
                  <TextInput
                    style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                    value={editedProduct.description}
                    onChangeText={(text) => setEditedProduct({...editedProduct, description: text})}
                    placeholder="Product description"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Primary Barcode (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editedProduct.barcode}
                    onChangeText={(text) => setEditedProduct({...editedProduct, barcode: text})}
                    placeholder="Enter primary product barcode"
                  />
                  <Text style={styles.formHelperText}>
                    Primary barcode for scanning products during sales
                  </Text>
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Additional Barcodes (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editedProduct.additional_barcodes}
                    onChangeText={(text) => setEditedProduct({...editedProduct, additional_barcodes: text})}
                    placeholder="Enter additional barcodes separated by commas"
                  />
                  <Text style={styles.formHelperText}>
                    Additional barcodes from different suppliers (comma-separated)
                  </Text>
                </View>
              </View>

              {/* Pricing & Units */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>💰 Pricing</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Selling Price *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editedProduct.price}
                    onChangeText={(text) => setEditedProduct({...editedProduct, price: text})}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Cost Price</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editedProduct.cost_price}
                    onChangeText={(text) => setEditedProduct({...editedProduct, cost_price: text})}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Currency</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editedProduct.currency}
                    onChangeText={(text) => setEditedProduct({...editedProduct, currency: text})}
                    placeholder="USD"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Price Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {priceTypes.map((priceType) => (
                      <TouchableOpacity
                        key={priceType.value}
                        style={[
                          styles.categoryButton,
                          editedProduct.price_type === priceType.value && styles.categoryButtonActive
                        ]}
                        onPress={() => setEditedProduct({...editedProduct, price_type: priceType.value})}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          editedProduct.price_type === priceType.value && styles.categoryButtonTextActive
                        ]}>
                          {priceType.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Categories */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>📂 Categories</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {categoryOptions.slice(1).map((category) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryButton,
                          editedProduct.category === category && styles.categoryButtonActive
                        ]}
                        onPress={() => setEditedProduct({...editedProduct, category})}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          editedProduct.category === category && styles.categoryButtonTextActive
                        ]}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Inventory & Alerts */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>📦 Inventory</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Stock Quantity</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editedProduct.stock_quantity}
                    onChangeText={(text) => setEditedProduct({...editedProduct, stock_quantity: text})}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Minimum Stock Level</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editedProduct.min_stock_level}
                    onChangeText={(text) => setEditedProduct({...editedProduct, min_stock_level: text})}
                    placeholder="5"
                    keyboardType="numeric"
                  />
                  <Text style={styles.formHelperText}>
                    Set to 5 to get alerts when stock drops to 5 or below. For example, if you set it to 45, you'll get alerts when stock is 45 or less.
                  </Text>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Supplier</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editedProduct.supplier}
                    onChangeText={(text) => setEditedProduct({...editedProduct, supplier: text})}
                    placeholder="Supplier name"
                  />
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowEditProductModal(false)}
                disabled={editProductLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.updateButton, editProductLoading && styles.disabledButton]}
                onPress={handleUpdateProduct}
                disabled={editProductLoading}
              >
                {editProductLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.updateButtonText}>Update Product</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stock Receiving Modal */}
      <Modal
        visible={showReceivingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReceivingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>📦 Stock Receiving</Text>
            <Text style={styles.modalSubtitle}>{receivingProduct?.name}</Text>
            
            <ScrollView style={styles.formContent}>
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Receive Stock</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Quantity Received *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={receivingData.quantity_received}
                    onChangeText={(text) => setReceivingData({...receivingData, quantity_received: text})}
                    placeholder="Enter quantity"
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Cost Price (per unit)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={receivingData.cost_price}
                    onChangeText={(text) => setReceivingData({...receivingData, cost_price: text})}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Supplier Invoice #</Text>
                  <TextInput
                    style={styles.formInput}
                    value={receivingData.supplier_invoice}
                    onChangeText={(text) => setReceivingData({...receivingData, supplier_invoice: text})}
                    placeholder="Invoice number"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Notes</Text>
                  <TextInput
                    style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                    value={receivingData.notes}
                    onChangeText={(text) => setReceivingData({...receivingData, notes: text})}
                    placeholder="Additional notes"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowReceivingModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={submitStockReceiving}
              >
                <Text style={styles.confirmButtonText}>Receive Stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bulk Update Modal */}
      <Modal
        visible={showBulkUpdateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBulkUpdateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Bulk Update Products</Text>
            <Text style={styles.modalSubtitle}>
              Update {selectedProducts.length} selected products
            </Text>
            
            <ScrollView style={styles.formContent}>
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Select Update Type</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Update Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {[
                      { value: 'price', label: 'Selling Price' },
                      { value: 'cost_price', label: 'Cost Price' },
                      { value: 'min_stock_level', label: 'Min Stock Level' },
                      { value: 'category', label: 'Category' },
                      { value: 'supplier', label: 'Supplier' }
                    ].map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.categoryButton,
                          bulkUpdateType === type.value && styles.categoryButtonActive
                        ]}
                        onPress={() => setBulkUpdateType(type.value)}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          bulkUpdateType === type.value && styles.categoryButtonTextActive
                        ]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>New Value</Text>
                  <TextInput
                    style={styles.formInput}
                    value={bulkUpdateValue}
                    onChangeText={setBulkUpdateValue}
                    placeholder={`Enter new ${bulkUpdateType}`}
                  />
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowBulkUpdateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={handleBulkUpdate}
              >
                <Text style={styles.confirmButtonText}>Update Products</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0a0a' 
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
    fontWeight: '600'
  },
  headerTitle: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#333',
    borderRadius: 6,
  },
  refreshButton: {
    backgroundColor: '#10b981',
  },
  restockButton: {
    backgroundColor: '#f59e0b',
  },
  
  // Manual Refresh Bar at very top
  refreshBar: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#059669',
  },
  refreshBarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerActionButtonActive: {
    backgroundColor: '#3b82f6',
  },
  headerActionText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },

  // Total Value Display (HUGE)
  totalValueContainer: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  totalValueLabel: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  totalValueAmount: {
    color: '#10b981',
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  searchFilterContainer: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchContainer: {
    marginBottom: 12,
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
  filterContainer: {
    marginBottom: 12,
  },
  categoryFilter: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  categoryFilterActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryFilterText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryFilterTextActive: {
    color: '#fff',
  },
  bulkActionsContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bulkActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bulkActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkActionButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  bulkActionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bulkDeleteButton: {
    backgroundColor: '#dc2626',
  },
  bulkDeleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#0a0a0a'
  },
  loadingText: { 
    color: '#fff', 
    marginTop: 16,
    fontSize: 16
  },
  // Main Scrollable Content
  mainScrollView: {
    flex: 1,
  },
  tableContainer: {
    margin: 16,
  },
  tableWrapper: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableRowAlternate: {
    backgroundColor: '#1e1e1e',
  },
  headerCell: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    flex: 1,
  },
  headerName: {
    flex: 3,
    textAlign: 'left',
  },
  cell: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
    flex: 1,
  },
  cellName: {
    flex: 3,
    textAlign: 'left',
    fontSize: 12,
    fontWeight: '600',
  },
  cellPrice: {
    color: '#10b981',
    fontWeight: 'bold',
  },
  cellCost: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  cellStock: {
    fontWeight: 'bold',
  },
  stockOk: {
    color: '#10b981',
  },
  stockLow: {
    color: '#fbbf24',
  },
  stockOut: {
    color: '#dc2626',
  },
  cellStatus: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 40,
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cellActions: {
    flex: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginHorizontal: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Live Notification Styles
  notificationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
  },
  notificationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  notificationClose: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
    padding: 4,
  },

  // Statistics Section
  statsContainer: {
    padding: 20,
  },
  sectionHeader: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  statCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statTitle: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },

  // Products Section
  productsContainer: {
    padding: 20,
  },
  productCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productCategory: {
    color: '#3b82f6',
    fontSize: 14,
    marginBottom: 2,
  },
  productCode: {
    color: '#999',
    fontSize: 12,
  },
  productUnit: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 2,
  },
  productPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stockText: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  inventoryValue: {
    color: '#f59e0b',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  lowStockAlertText: {
    color: '#dc2626',
    fontSize: 10,
    marginTop: 2,
    fontWeight: 'bold',
  },
  productDescription: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supplierText: {
    color: '#999',
    fontSize: 12,
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockStatus: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  normalStock: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  lowStock: {
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  outOfStock: {
    backgroundColor: 'rgba(220, 38, 38, 0.5)',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  stockStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  receivingButton: {
    backgroundColor: '#10b981',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  receivingButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  editButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Add Button Container
  addButtonContainer: {
    padding: 20,
    paddingTop: 0,
  },
  addProductButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  addProductButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyAddButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyAddButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Modal Styles
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
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  formContent: {
    maxHeight: 400,
  },
  formSection: {
    marginBottom: 24,
  },
  formSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  formHelperText: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  formInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },

  // Category Buttons
  categoryScroll: {
    marginBottom: 8,
  },
  categoryButton: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  categoryButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryButtonText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },

  // Modal Buttons
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
    color: '#fff',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  updateButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  
  // Auto-refresh indicator
  autoRefreshIndicator: {
    backgroundColor: '#10b981',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#059669',
  },
  autoRefreshText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ProductManagementScreen;