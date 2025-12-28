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
  Animated,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { shopAPI } from '../services/api';
import { shopStorage } from '../services/storage';
import { ROUTES } from '../constants/navigation';

const ExpenseManagementScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [shopCredentials, setShopCredentials] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Tab state
  const [activeTab, setActiveTab] = useState('expenses');

  // Add Expense Modal states
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [addExpenseLoading, setAddExpenseLoading] = useState(false);
  const [newExpense, setNewExpense] = useState({
    category: '',
    description: '',
    amount: '',
    payment_method: 'cash',
    vendor: '',
    date: new Date().toISOString().split('T')[0],
    receipt_number: '',
    notes: '',
    product_lookup_code: '', // For staff lunch product lookup
    quantity: '', // Quantity for staff lunch
    staff_lunch_type: 'stock' // 'stock' for eating products, 'money' for other reasons
  });

  // Add Refund Modal states
  const [showAddRefundModal, setShowAddRefundModal] = useState(false);
  const [addRefundLoading, setAddRefundLoading] = useState(false);
  const [newRefund, setNewRefund] = useState({
    sale_id: '',
    customer_name: '',
    refund_amount: '',
    refund_reason: '',
    refund_type: 'money', // 'money' or 'stock'
    return_stock: false,
    return_items: [],
    notes: ''
  });

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Expense categories - simplified to only Staff Lunch and Product Expense
  const expenseCategories = [
    'Staff Lunch',
    'Product Expense'
  ];

  // Refund reasons
  const refundReasons = [
    'Damaged Product',
    'Wrong Item',
    'Customer Request',
    'Quality Issue',
    'Expired Product',
    'Price Error',
    'Other'
  ];

  useEffect(() => {
    loadShopCredentials();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Web scrolling is now handled by Platform.select styles (same as StockValuationScreen)
  }, []);

  useEffect(() => {
    if (shopCredentials) {
      loadData();
    }
  }, [shopCredentials]);

  const loadShopCredentials = async () => {
    try {
      const credentials = await shopStorage.getCredentials();
      if (credentials) {
        setShopCredentials(credentials);
      } else {
        console.log('❌ No shop credentials found');
        Alert.alert('Error', 'Shop credentials not found. Please log in again.');
        navigation.navigate(ROUTES.LOGIN);
      }
    } catch (error) {
      console.error('❌ Error loading shop credentials:', error);
      Alert.alert('Error', 'Failed to load shop credentials.');
    }
  };

  const loadData = async () => {
    if (!shopCredentials) {
      console.log('⏳ Waiting for shop credentials...');
      return;
    }

    try {
      setLoading(true);
      console.log('💰 Loading expense and refund data...');

      // Load expenses and refunds in parallel
      const [expensesResponse, refundsResponse] = await Promise.allSettled([
        shopAPI.getExpenses(),
        shopAPI.getRefunds()
      ]);

      if (expensesResponse.status === 'fulfilled' && expensesResponse.value.data) {
        setExpenses(expensesResponse.value.data);
        console.log(`📊 Loaded ${expensesResponse.value.data.length} expenses`);
      }

      if (refundsResponse.status === 'fulfilled' && refundsResponse.value.data) {
        setRefunds(refundsResponse.value.data);
        console.log(`📊 Loaded ${refundsResponse.value.data.length} refunds`);
      }

    } catch (error) {
      console.error('❌ Error loading data:', error);
      Alert.alert('Error', 'Failed to load expense and refund data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleAddExpense = async () => {
    console.log('handleAddExpense called', newExpense);
    if (!newExpense.category.trim() || !newExpense.amount.trim()) {
      Alert.alert('Error', 'Category and amount are required.');
      return;
    }

    // Validate staff lunch requirements
    if (newExpense.category === 'Staff Lunch') {
      if (!newExpense.quantity.trim()) {
        Alert.alert('Error', 'Quantity is required for Staff Lunch expenses.');
        return;
      }
      
      if (newExpense.staff_lunch_type === 'stock' && !newExpense.product_lookup_code.trim()) {
        Alert.alert('Error', 'Product line code or barcode is required for Stock type Staff Lunch.');
        return;
      }
    }

    if (!shopCredentials) {
      Alert.alert('Error', 'Shop credentials not found. Please log in again.');
      return;
    }

    try {
      setAddExpenseLoading(true);
      
      const expenseData = {
        ...newExpense,
        amount: parseFloat(newExpense.amount),
        quantity: parseFloat(newExpense.quantity) || 0,
        password: shopCredentials.shop_owner_master_password,
        cashier_id: null, // Can be set if a cashier is creating the expense
        product_lookup_code: newExpense.staff_lunch_type === 'stock' ? newExpense.product_lookup_code : null,
        staff_lunch_type: newExpense.staff_lunch_type
      };

      await shopAPI.createExpense(expenseData);
      
      Alert.alert('Success', 'Expense recorded successfully!');
      setShowAddExpenseModal(false);
      setNewExpense({
        category: '',
        description: '',
        amount: '',
        payment_method: 'cash',
        vendor: '',
        date: new Date().toISOString().split('T')[0],
        receipt_number: '',
        notes: '',
        product_lookup_code: '',
        quantity: '',
        staff_lunch_type: 'stock'
      });
      loadData();
      
    } catch (error) {
      console.error('❌ Add expense failed:', error);
      Alert.alert('Error', `Failed to add expense: ${error.message || 'Please try again.'}`);
    } finally {
      setAddExpenseLoading(false);
    }
  };

  const handleAddRefund = async () => {
    if (!newRefund.refund_amount.trim()) {
      Alert.alert('Error', 'Refund amount is required.');
      return;
    }

    if (!shopCredentials) {
      Alert.alert('Error', 'Shop credentials not found. Please log in again.');
      return;
    }

    try {
      setAddRefundLoading(true);
      
      const refundData = {
        sale_id: newRefund.sale_id || null,
        customer_name: newRefund.customer_name.trim(),
        refund_amount: parseFloat(newRefund.refund_amount),
        refund_reason: newRefund.refund_reason,
        refund_type: newRefund.refund_type,
        return_stock: newRefund.return_stock,
        return_items: newRefund.return_items,
        notes: newRefund.notes.trim(),
        password: shopCredentials.shop_owner_master_password,
        cashier_id: null // Can be set if a cashier is creating the refund
      };

      await shopAPI.createRefund(refundData);
      
      Alert.alert('Success', 'Refund recorded successfully!');
      setShowAddRefundModal(false);
      setNewRefund({
        sale_id: '',
        customer_name: '',
        refund_amount: '',
        refund_reason: '',
        refund_type: 'money',
        return_stock: false,
        return_items: [],
        notes: ''
      });
      loadData();
      
    } catch (error) {
      console.error('❌ Add refund failed:', error);
      Alert.alert('Error', `Failed to add refund: ${error.message || 'Please try again.'}`);
    } finally {
      setAddRefundLoading(false);
    }
  };

  const getTotalExpenses = () => {
    return expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  };

  const getTotalRefunds = () => {
    return refunds.reduce((sum, refund) => sum + (refund.refund_amount || 0), 0);
  };

  const getMonthlyExpenses = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return expenses
      .filter(expense => {
        const expenseDate = new Date(expense.expense_date);
        return expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
      })
      .reduce((sum, expense) => sum + (expense.amount || 0), 0);
  };

  const getMonthlyRefunds = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return refunds
      .filter(refund => {
        const refundDate = new Date(refund.created_at);
        return refundDate.getMonth() === currentMonth && 
               refundDate.getFullYear() === currentYear;
      })
      .reduce((sum, refund) => sum + (refund.refund_amount || 0), 0);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Expense Management</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity 
          onPress={onRefresh} 
          style={[styles.headerActionButton, styles.refreshButton]}
          disabled={refreshing}
        >
          <Text style={styles.headerActionText}>{refreshing ? '⏳' : '🔄'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <Text style={styles.sectionTitle}>💰 Financial Summary</Text>
      
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, styles.cardRed]}>
          <Text style={styles.summaryIcon}>💸</Text>
          <Text style={styles.summaryValue}>{formatCurrency(getTotalExpenses())}</Text>
          <Text style={styles.summaryLabel}>Total Expenses</Text>
        </View>
        
        <View style={[styles.summaryCard, styles.cardOrange]}>
          <Text style={styles.summaryIcon}>↩️</Text>
          <Text style={styles.summaryValue}>{formatCurrency(getTotalRefunds())}</Text>
          <Text style={styles.summaryLabel}>Total Refunds</Text>
        </View>
        
        <View style={[styles.summaryCard, styles.cardBlue]}>
          <Text style={styles.summaryIcon}>📅</Text>
          <Text style={styles.summaryValue}>{formatCurrency(getMonthlyExpenses())}</Text>
          <Text style={styles.summaryLabel}>This Month Expenses</Text>
        </View>
        
        <View style={[styles.summaryCard, styles.cardGreen]}>
          <Text style={styles.summaryIcon}>📊</Text>
          <Text style={styles.summaryValue}>{formatCurrency(getMonthlyRefunds())}</Text>
          <Text style={styles.summaryLabel}>This Month Refunds</Text>
        </View>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
        onPress={() => setActiveTab('expenses')}
      >
        <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
          💸 Expenses
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'refunds' && styles.tabActive]}
        onPress={() => setActiveTab('refunds')}
      >
        <Text style={[styles.tabText, activeTab === 'refunds' && styles.tabTextActive]}>
          ↩️ Refunds
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderExpenseItem = (expense) => (
    <View key={expense.id} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{expense.category}</Text>
          <Text style={styles.itemDescription}>{expense.description}</Text>
          <Text style={styles.itemDate}>{formatDate(expense.expense_date)}</Text>
        </View>
        <View style={styles.itemAmount}>
          <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
          <Text style={styles.paymentMethod}>{expense.payment_method}</Text>
        </View>
      </View>
      
      {expense.vendor && (
        <Text style={styles.vendor}>Vendor: {expense.vendor}</Text>
      )}
      
      {/* Show staff lunch information */}
      {expense.category === 'Staff Lunch' && (
        <>
          <Text style={styles.staffLunchInfo}>
            {expense.staff_lunch_type === 'stock' ? '🍽️ Eat from Stock' : '💰 Money Allowance'}
          </Text>
          {expense.quantity && (
            <Text style={styles.productInfo}>📏 Quantity: {expense.quantity}</Text>
          )}
        </>
      )}
      
      {/* Show product information for staff lunch and product expenses */}
      {expense.product_name && (
        <Text style={styles.productInfo}>🛒 Product: {expense.product_name}</Text>
      )}
      
      {expense.product_line_code && (
        <Text style={styles.productInfo}>📦 Line Code: {expense.product_line_code}</Text>
      )}
      
      {expense.notes && (
        <Text style={styles.notes}>Notes: {expense.notes}</Text>
      )}
    </View>
  );

  const renderRefundItem = (refund) => (
    <View key={refund.id} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{refund.refund_reason}</Text>
          <Text style={styles.itemDescription}>
            Customer: {refund.customer_name || 'N/A'}
          </Text>
          <Text style={styles.itemDate}>{formatDate(refund.created_at)}</Text>
        </View>
        <View style={styles.itemAmount}>
          <Text style={[styles.amount, styles.refundAmount]}>
            -{formatCurrency(refund.refund_amount)}
          </Text>
          <Text style={styles.refundType}>
            {refund.refund_type === 'money' ? '💰 Money' : '📦 Stock'}
          </Text>
        </View>
      </View>
      
      {refund.return_stock && (
        <Text style={styles.stockReturn}>↩️ Stock Return Included</Text>
      )}
      
      {refund.notes && (
        <Text style={styles.notes}>Notes: {refund.notes}</Text>
      )}
    </View>
  );

  const renderContent = () => {
    const currentData = activeTab === 'expenses' ? expenses : refunds;
    const filteredData = currentData.filter(item => {
      const matchesSearch = activeTab === 'expenses' 
        ? item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
        : item.refund_reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'All' || 
        (activeTab === 'expenses' ? item.category === selectedCategory : true);
      
      return matchesSearch && matchesCategory;
    });

    return (
      <>
        {/* Summary Cards */}
        {renderSummaryCards()}

        {/* Tabs */}
        {renderTabs()}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {activeTab === 'expenses' ? (
            <>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => {
                  setShowAddExpenseModal(true);
                }}
              >
                <Text style={styles.addButtonText}>💸 Add Expense</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                setShowAddRefundModal(true);
              }}
            >
              <Text style={styles.addButtonText}>↩️ Add Refund</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search and Filter */}
        <View style={styles.searchFilterContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          
          {activeTab === 'expenses' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {['All', ...expenseCategories].map((category) => (
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
          )}
        </View>

        {/* Data List */}
        <View style={styles.listContainer}>
          {filteredData.length > 0 ? (
            filteredData.map(item => 
              activeTab === 'expenses' ? renderExpenseItem(item) : renderRefundItem(item)
            )
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                📊 No {activeTab} found
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'expenses' 
                  ? 'Start by adding your first business expense'
                  : 'Start by recording your first refund'
                }
              </Text>
            </View>
          )}
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading expense data...</Text>
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
          colors={['#3b82f6']}
          tintColor="#3b82f6"
        />
      }
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Clean UI - no debug info needed anymore */}
        {renderHeader()}
        {renderContent()}

        {/* Add Expense Modal */}
        <Modal
          visible={showAddExpenseModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddExpenseModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>💸 Add New Expense</Text>
              
              <ScrollView style={styles.formContent}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Category *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {expenseCategories.map((category) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryButton,
                          newExpense.category === category && styles.categoryButtonActive
                        ]}
                        onPress={() => setNewExpense({...newExpense, category})}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          newExpense.category === category && styles.categoryButtonTextActive
                        ]}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Staff Lunch Type Selection */}
                {newExpense.category === 'Staff Lunch' && (
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Staff Lunch Type *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                      {[
                        { value: 'stock', label: '🍽️ Eat from Stock' },
                        { value: 'money', label: '💰 Money Allowance' }
                      ].map((type) => (
                        <TouchableOpacity
                          key={type.value}
                          style={[
                            styles.categoryButton,
                            newExpense.staff_lunch_type === type.value && styles.categoryButtonActive
                          ]}
                          onPress={() => setNewExpense({...newExpense, staff_lunch_type: type.value})}
                        >
                          <Text style={[
                            styles.categoryButtonText,
                            newExpense.staff_lunch_type === type.value && styles.categoryButtonTextActive
                          ]}>
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Product Lookup Field for Staff Lunch - Stock Type */}
                {newExpense.category === 'Staff Lunch' && newExpense.staff_lunch_type === 'stock' && (
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Product Line Code or Barcode *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newExpense.product_lookup_code}
                      onChangeText={(text) => setNewExpense({...newExpense, product_lookup_code: text})}
                      placeholder="Enter product line code or barcode"
                    />
                    <Text style={{color: '#999', fontSize: 12, marginTop: 4}}>
                      Scan or enter the product's line code or barcode
                    </Text>
                  </View>
                )}

                {/* Quantity Field for Staff Lunch */}
                {newExpense.category === 'Staff Lunch' && (
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Quantity *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newExpense.quantity}
                      onChangeText={(text) => setNewExpense({...newExpense, quantity: text})}
                      placeholder="Enter quantity"
                      keyboardType="numeric"
                    />
                    <Text style={{color: '#999', fontSize: 12, marginTop: 4}}>
                      {newExpense.staff_lunch_type === 'stock' 
                        ? 'Quantity to deduct from stock'
                        : 'Number of staff or meals'
                      }
                    </Text>
                  </View>
                )}

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Description</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newExpense.description}
                    onChangeText={(text) => setNewExpense({...newExpense, description: text})}
                    placeholder="Enter expense description"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Amount *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newExpense.amount}
                    onChangeText={(text) => setNewExpense({...newExpense, amount: text})}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Payment Method</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {['cash', 'card', 'bank_transfer', 'check'].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.categoryButton,
                          newExpense.payment_method === method && styles.categoryButtonActive
                        ]}
                        onPress={() => setNewExpense({...newExpense, payment_method: method})}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          newExpense.payment_method === method && styles.categoryButtonTextActive
                        ]}>
                          {method.replace('_', ' ').toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Vendor/Payee</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newExpense.vendor}
                    onChangeText={(text) => setNewExpense({...newExpense, vendor: text})}
                    placeholder="Enter vendor or payee name"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Date</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newExpense.date}
                    onChangeText={(text) => setNewExpense({...newExpense, date: text})}
                    placeholder="YYYY-MM-DD"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Receipt/Invoice Number</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newExpense.receipt_number}
                    onChangeText={(text) => setNewExpense({...newExpense, receipt_number: text})}
                    placeholder="Enter receipt or invoice number"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Notes</Text>
                  <TextInput
                    style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                    value={newExpense.notes}
                    onChangeText={(text) => setNewExpense({...newExpense, notes: text})}
                    placeholder="Additional notes"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </ScrollView>
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowAddExpenseModal(false)}
                  disabled={addExpenseLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.confirmButton, addExpenseLoading && styles.disabledButton]}
                  onPress={handleAddExpense}
                  disabled={addExpenseLoading}
                >
                  {addExpenseLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Add Expense</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Refund Modal */}
        <Modal
          visible={showAddRefundModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddRefundModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>↩️ Add New Refund</Text>
              
              <ScrollView style={styles.formContent}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Customer Name</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newRefund.customer_name}
                    onChangeText={(text) => setNewRefund({...newRefund, customer_name: text})}
                    placeholder="Enter customer name"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Sale ID (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newRefund.sale_id}
                    onChangeText={(text) => setNewRefund({...newRefund, sale_id: text})}
                    placeholder="Enter original sale ID"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Refund Amount *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newRefund.refund_amount}
                    onChangeText={(text) => setNewRefund({...newRefund, refund_amount: text})}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Refund Reason</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {refundReasons.map((reason) => (
                      <TouchableOpacity
                        key={reason}
                        style={[
                          styles.categoryButton,
                          newRefund.refund_reason === reason && styles.categoryButtonActive
                        ]}
                        onPress={() => setNewRefund({...newRefund, refund_reason: reason})}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          newRefund.refund_reason === reason && styles.categoryButtonTextActive
                        ]}>
                          {reason}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Refund Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {[
                      { value: 'money', label: '💰 Money Refund' },
                      { value: 'stock', label: '📦 Stock Return' }
                    ].map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.categoryButton,
                          newRefund.refund_type === type.value && styles.categoryButtonActive
                        ]}
                        onPress={() => setNewRefund({...newRefund, refund_type: type.value})}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          newRefund.refund_type === type.value && styles.categoryButtonTextActive
                        ]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Notes</Text>
                  <TextInput
                    style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                    value={newRefund.notes}
                    onChangeText={(text) => setNewRefund({...newRefund, notes: text})}
                    placeholder="Additional notes about the refund"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </ScrollView>
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowAddRefundModal(false)}
                  disabled={addRefundLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.confirmButton, addRefundLoading && styles.disabledButton]}
                  onPress={handleAddRefund}
                  disabled={addRefundLoading}
                >
                  {addRefundLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Add Refund</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Animated.View>
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
    paddingBottom: Platform.OS === 'web' ? 100 : 0,
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
    paddingTop: 60,
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
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center'
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
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
    backgroundColor: '#0a0a0a'
  },
  loadingText: { 
    color: '#fff', 
    marginTop: 16,
    fontSize: 16
  },
  summaryContainer: {
    padding: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardRed: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cardOrange: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  cardBlue: {
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  cardGreen: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  summaryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  actionButtonsContainer: {
    padding: 20,
    paddingTop: 10,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchFilterContainer: {
    backgroundColor: '#1a1a1a',
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
    marginBottom: 12,
  },
  categoryScroll: {
    marginBottom: 8,
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
  listContainer: {
    padding: 20,
    paddingTop: 0,
  },
  itemCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemDescription: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 2,
  },
  itemDate: {
    color: '#999',
    fontSize: 12,
  },
  itemAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  refundAmount: {
    color: '#f59e0b',
  },
  paymentMethod: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  refundType: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  vendor: {
    color: '#3b82f6',
    fontSize: 12,
    marginTop: 4,
  },
  stockReturn: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  notes: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  productInfo: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  staffLunchInfo: {
    color: '#f59e0b',
    fontSize: 12,
    marginTop: 4,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
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
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  formContent: {
    maxHeight: 400,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
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
  disabledButton: {
    opacity: 0.5,
  },
});

export default ExpenseManagementScreen;