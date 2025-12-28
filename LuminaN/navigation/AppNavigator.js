import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ROUTES } from '../constants/navigation';

// Import screens
import WelcomeScreen from '../screens/WelcomeScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LoginScreen from '../screens/LoginScreen';
import CashierDashboardScreen from '../screens/CashierDashboardScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import CashierResetPasswordScreen from '../screens/CashierResetPasswordScreen';
import RegistrationDetailsScreen from '../screens/RegistrationDetailsScreen';
import SuccessScreen from '../screens/SuccessScreen';
import StaffContractScreen from '../screens/StaffContractScreen';
import CashierRegisterScreen from '../screens/CashierRegisterScreen';
import InventoryAuditTrailScreen from '../screens/InventoryAuditTrailScreen';
import InventoryReceivingScreen from '../screens/InventoryReceivingScreen';
import RestockManagerScreen from '../screens/RestockManagerScreen';
import StockTransferScreen from '../screens/StockTransferScreen';
import StockTransferHistoryScreen from '../screens/StockTransferHistoryScreen';
import OrderConfirmationScreen from '../screens/OrderConfirmationScreen';
import SettingsScreen from '../screens/SettingsScreen';
import StockValuationScreen from '../screens/StockValuationScreen';
import POSPriceScreen from '../screens/POSPriceScreen';
import SalesAndRefundsScreen from '../screens/SalesAndRefundsScreen';
import OwnerSalesScreen from '../screens/OwnerSalesScreen';
import ExpenseManagementScreen from '../screens/ExpenseManagementScreen';
import StockTakeScreen from '../screens/StockTakeScreen';
import StockTakeHistoryScreen from '../screens/StockTakeHistoryScreen';

// Import Tab Navigator
import TabNavigator from './TabNavigator';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.WELCOME}
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Authentication Flow */}
      <Stack.Screen name={ROUTES.WELCOME} component={WelcomeScreen} />
      <Stack.Screen name={ROUTES.REGISTER} component={RegisterScreen} />
      <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
      <Stack.Screen name={ROUTES.CASHIER_DASHBOARD} component={CashierDashboardScreen} />
      <Stack.Screen name={ROUTES.FORGOT_PASSWORD} component={ForgotPasswordScreen} />
      <Stack.Screen name={ROUTES.CASHIER_RESET_PASSWORD} component={CashierResetPasswordScreen} />
      
      {/* Main App with Tab Navigation */}
      <Stack.Screen 
        name="MainApp" 
        component={TabNavigator}
        options={{
          headerShown: false,
        }}
      />
      
      {/* Additional Screens */}
      <Stack.Screen name={ROUTES.REGISTRATION_DETAILS} component={RegistrationDetailsScreen} />
      <Stack.Screen name={ROUTES.SUCCESS} component={SuccessScreen} />
      <Stack.Screen name={ROUTES.SETTINGS} component={SettingsScreen} />
      <Stack.Screen name={ROUTES.STAFF_CONTRACT} component={StaffContractScreen} />
      <Stack.Screen name={ROUTES.CASHIER_REGISTER} component={CashierRegisterScreen} />
      <Stack.Screen name={ROUTES.INVENTORY_AUDIT_TRAIL} component={InventoryAuditTrailScreen} />
      <Stack.Screen name={ROUTES.INVENTORY_RECEIVING} component={InventoryReceivingScreen} />
      <Stack.Screen name={ROUTES.RESTOCK_MANAGER} component={RestockManagerScreen} />
      <Stack.Screen name={ROUTES.STOCK_TRANSFER} component={StockTransferScreen} />
      <Stack.Screen name={ROUTES.STOCK_TRANSFER_HISTORY} component={StockTransferHistoryScreen} />
      <Stack.Screen name={ROUTES.STOCK_VALUATION} component={StockValuationScreen} />
      <Stack.Screen name={ROUTES.POS_PRICE} component={POSPriceScreen} />
      <Stack.Screen name={ROUTES.SALES_AND_REFUNDS} component={SalesAndRefundsScreen} />
      <Stack.Screen name={ROUTES.OWNER_SALES} component={OwnerSalesScreen} />
      <Stack.Screen name={ROUTES.EXPENSE_MANAGEMENT} component={ExpenseManagementScreen} />
      <Stack.Screen name={ROUTES.STOCK_TAKE} component={StockTakeScreen} />
      <Stack.Screen name={ROUTES.STOCK_TAKE_HISTORY} component={StockTakeHistoryScreen} />
      <Stack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} />

    </Stack.Navigator>
  );
};

export default AppNavigator;