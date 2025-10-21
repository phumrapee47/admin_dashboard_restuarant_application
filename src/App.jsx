
import React, { useState, useEffect, useRef } from 'react';
import { Store, CheckCircle, XCircle, Clock, Plus, Edit2, Trash2, TrendingUp, DollarSign, LogOut, Eye, EyeOff, Bell, ShoppingBag, Home, UtensilsCrossed } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const LINE_API_URL = import.meta.env.VITE_LINE_API_URL;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables. Please check your .env file.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sendLineNotification = async (lineUserId, orderitem, status, orderTotal) => {
  if (!lineUserId) {
    console.log('⚠️ No LINE User ID - skipping notification');
    return false;
  }
  
  if (!LINE_API_URL) {
    console.error('❌ LINE_API_URL not configured');
    alert('ไม่สามารถส่งแจ้งเตือนได้: ยังไม่ได้ตั้งค่า LINE API URL');
    return false;
  }

  try {
    console.log('📤 Sending notification payload:', {
      lineUserId,
      orderitem,
      status,
      orderTotal,
    });

    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        lineUserId, 
        orderitem, 
        status, 
        orderTotal 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Notification sent successfully:', result);
    return true;
    
  } catch (error) {
    console.error('❌ Error sending LINE notification:', error);
    return false;
  }
};

const playNotificationSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
};

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [isShopOpen, setIsShopOpen] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);
  const previousOrderCount = useRef(0);

  useEffect(() => {
    if (isAuthenticated) {
      loadOrders();
      loadMenuItems();
      loadShopStatus();
      const interval = setInterval(loadOrders, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (username === 'admin' && password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('id', { ascending: false });
      
      if (error) throw error;
      
      const newOrders = data || [];
      if (newOrders.length > previousOrderCount.current) {
        const newPendingOrders = newOrders.filter(o => o.status === 'pending');
        const oldPendingOrders = orders.filter(o => o.status === 'pending');
        if (newPendingOrders.length > oldPendingOrders.length) {
          playNotificationSound();
        }
      }
      previousOrderCount.current = newOrders.length;
      setOrders(newOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const loadMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('id', { ascending: false });
      
      if (error) throw error;
      setMenuItems(data || []);
    } catch (error) {
      console.error('Error loading menu:', error);
    }
  };

  const loadShopStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error) throw error;
      if (data) {
        setIsShopOpen(data.is_open);
      }
    } catch (error) {
      console.error('Error loading shop status:', error);
    }
  };

  const toggleShopStatus = async () => {
    try {
      const newStatus = !isShopOpen;
      const { error } = await supabase
        .from('shop_settings')
        .update({ 
          is_open: newStatus, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', 1);

      if (error) throw error;
      setIsShopOpen(newStatus);
      
      if (!newStatus) {
        setShowClearModal(true);
      } else {
        alert(`อัพเดตสถานะร้านสำเร็จ: เปิด`);
      }
    } catch (error) {
      console.error('Error updating shop status:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const handleClearOrders = async (shouldClear) => {
    setShowClearModal(false);
    try {
      if (shouldClear) {
        const { error } = await supabase
          .from('orders')
          .delete()
          .neq('status', 'accepted');
        
        if (error) throw error;
        await loadOrders();
        alert('เคลียร์ออเดอร์ที่ยังไม่ยืนยันสำเร็จ (รายรับยังคงเก็บไว้)');
      }
      alert('ปิดร้านสำเร็จ');
    } catch (error) {
      console.error('Error clearing orders:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🔐</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">เข้าสู่ระบบเพื่อจัดการร้านค้า</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block font-medium text-gray-700 mb-2">ชื่อผู้ใช้</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-2">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 pr-12 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-3 rounded-lg font-bold text-lg transition-all shadow-md"
            >
              เข้าสู่ระบบ
            </button>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
              <p className="font-medium mb-1">ข้อมูลทดสอบ:</p>
              <p>Username: <strong>admin</strong></p>
              <p>Password: <strong>admin123</strong></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const acceptedOrders = orders.filter(o => o.status === 'accepted');
  const totalRevenue = acceptedOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.created_at).toDateString();
    const today = new Date().toDateString();
    return orderDate === today;
  });
  const todayRevenue = todayOrders
    .filter(o => o.status === 'accepted'|| o.status === 'ready')
    .reduce((sum, order) => sum + (order.total || 0), 0);
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-md sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <Store className="text-orange-500" size={32} />
              <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleShopStatus}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  isShopOpen
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {isShopOpen ? '🟢 ร้านเปิด' : '🔴 ร้านปิด'}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <LogOut size={18} />
                ออกจากระบบ
              </button>
            </div>
          </div>

          <div className="flex gap-1 border-t">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-all ${
                currentPage === 'dashboard'
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Home size={20} />
              หน้าแรก
            </button>
            <button
              onClick={() => setCurrentPage('orders')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-all relative ${
                currentPage === 'orders'
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <ShoppingBag size={20} />
              จัดการออเดอร์
              {pendingOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentPage('menu')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-all ${
                currentPage === 'menu'
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <UtensilsCrossed size={20} />
              จัดการเมนู
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {currentPage === 'dashboard' && (
          <DashboardPage 
            orders={orders}
            pendingOrders={pendingOrders}
            acceptedOrders={acceptedOrders}
            todayRevenue={todayRevenue}
            totalRevenue={totalRevenue}
            menuItems={menuItems}
          />
        )}
        {currentPage === 'orders' && (
          <OrdersPage 
            orders={orders}
            loadOrders={loadOrders}
          />
        )}
        {currentPage === 'menu' && (
          <MenuPage 
            menuItems={menuItems}
            loadMenuItems={loadMenuItems}
          />
        )}
      </div>

      {showClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">ปิดร้าน</h2>
            <p className="text-gray-600 mb-6">
              ต้องการเคลียร์ออเดอร์ที่ยังไม่ยืนยันใช่หรือไม่? (รายรับจากออเดอร์ที่ยืนยันแล้วจะยังคงเก็บไว้)
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleClearOrders(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium"
              >
                ปิดเฉยๆ
              </button>
              <button
                onClick={() => handleClearOrders(true)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium"
              >
                ปิดและเคลียร์
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardPage = ({ orders, pendingOrders, acceptedOrders, todayRevenue, totalRevenue, menuItems }) => {
  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.created_at).toDateString();
    const today = new Date().toDateString();
    return orderDate === today;
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">ภาพรวมร้านค้า</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-500 text-white rounded-xl p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 mb-1">รอดำเนินการ</p>
              <p className="text-3xl font-bold">{pendingOrders.length}</p>
            </div>
            <Clock size={40} className="opacity-80" />
          </div>
        </div>
        <div className="bg-green-500 text-white rounded-xl p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 mb-1">ยืนยันแล้ว</p>
              <p className="text-3xl font-bold">{acceptedOrders.length}</p>
            </div>
            <CheckCircle size={40} className="opacity-80" />
          </div>
        </div>
        <div className="bg-blue-500 text-white rounded-xl p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 mb-1">รายรับวันนี้</p>
              <p className="text-3xl font-bold">{todayRevenue.toLocaleString()}฿</p>
            </div>
            <TrendingUp size={40} className="opacity-80" />
          </div>
        </div>
        <div className="bg-purple-500 text-white rounded-xl p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 mb-1">รายรับทั้งหมด</p>
              <p className="text-3xl font-bold">{totalRevenue.toLocaleString()}฿</p>
            </div>
            <DollarSign size={40} className="opacity-80" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">ออเดอร์วันนี้ ({todayOrders.length})</h3>
        {todayOrders.length === 0 ? (
          <p className="text-gray-400 text-center py-8">ยังไม่มีออเดอร์วันนี้</p>
        ) : (
          <div className="space-y-3">
            {todayOrders.slice(0, 5).map(order => (
              <div key={order.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">ออเดอร์ #{order.id}</p>
                  <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleTimeString('th-TH')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-orange-600">{order.total}฿</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    order.status === 'accepted' ? 'bg-green-100 text-green-700' :
                    order.status === 'ready' ? 'bg-purple-100 text-purple-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {order.status === 'pending' ? 'รอดำเนินการ' :
                     order.status === 'accepted' ? 'ยืนยันแล้ว' :
                     order.status === 'ready' ? 'พร้อมแล้ว' : 'ปฏิเสธ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">สรุปเมนูอาหาร</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">เมนูทั้งหมด</p>
            <p className="text-2xl font-bold text-orange-600">{menuItems.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">เปิดใช้งาน</p>
            <p className="text-2xl font-bold text-green-600">
              {menuItems.filter(m => m.is_active).length}
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">ปิดใช้งาน</p>
            <p className="text-2xl font-bold text-red-600">
              {menuItems.filter(m => !m.is_active).length}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">หมวดหมู่</p>
            <p className="text-2xl font-bold text-blue-600">
              {new Set(menuItems.map(m => m.category)).size}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrdersPage = ({ orders, loadOrders }) => {
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      if (order && order.line_user_id) {
        const statusText = newStatus === 'accepted' ? 'ยืนยันแล้ว' :
                          newStatus === 'ready' ? 'พร้อมแล้ว' :
                          newStatus === 'rejected' ? 'ปฏิเสธ' : newStatus;
        
        await sendLineNotification(
          order.line_user_id,
          order.items,
          statusText,
          order.total
        );
        alert(`อัพเดตสถานะเป็น "${statusText}" และส่งแจ้งเตือนไปยัง LINE สำเร็จ`);
      } else {
        alert('อัพเดตสถานะสำเร็จ');
      }
      await loadOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const [filterPayment, setFilterPayment] = useState('all');

  const filteredOrders = orders
    .filter(o => filterStatus === 'all' || o.status === filterStatus)
    .filter(o => filterPayment === 'all' || o.payment_method === filterPayment);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">จัดการออเดอร์</h2>
        
        <div className="flex flex-col gap-3">
          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap justify-end">
            {['all', 'pending', 'accepted', 'ready', 'rejected'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === status
                    ? 'bg-orange-500 text-white shadow-md scale-105'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                }`}
              >
                {status === 'all' ? '📋 ทั้งหมด' :
                status === 'pending' ? '⏳ รอดำเนินการ' :
                status === 'accepted' ? '✅ ยืนยันแล้ว' :
                status === 'ready' ? '🎉 พร้อมแล้ว' : '❌ ปฏิเสธ'}
              </button>
            ))}
          </div>

          {/* Payment Method Filter */}
          {/* <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => setFilterPayment('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterPayment === 'all'
                  ? 'bg-purple-500 text-white shadow-md scale-105'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              💰 ทั้งหมด
            </button>
            <button
              onClick={() => setFilterPayment('online')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterPayment === 'online'
                  ? 'bg-purple-500 text-white shadow-md scale-105'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              💳 โอนแล้ว
            </button>
            <button
              onClick={() => setFilterPayment('cash')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterPayment === 'cash'
                  ? 'bg-purple-500 text-white shadow-md scale-105'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              💵 หน้าร้าน
            </button>
          </div> */}
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-md">
            <p className="text-gray-400 text-lg">ไม่มีออเดอร์ในสถานะนี้</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div
              key={order.id}
              className={`bg-white rounded-xl shadow-md p-6 ${
                order.status === 'pending' ? 'border-l-4 border-yellow-500' :
                order.status === 'accepted' ? 'border-l-4 border-green-500' :
                order.status === 'ready' ? 'border-l-4 border-purple-500' :
                'border-l-4 border-red-500'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">ออเดอร์ #{order.id}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleString('th-TH')}
                  </p>
                  {order.customer_phone && (
                    <p className="text-sm text-blue-600 mt-1">📞 {order.customer_phone}</p>
                  )}

                  {/* ⭐ เพิ่มส่วนนี้ */}
                  <p className="text-sm mt-1 flex items-center gap-1">
                    {order.payment_method === 'cash' ? (
                      <span className="text-green-600 font-medium">💵 ชำระหน้าร้าน</span>
                    ) : (
                      <span className="text-blue-600 font-medium">💳 โอนเงินแล้ว</span>
                    )}
                  </p>

                  {order.line_user_id && (
                    <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                      <Bell size={14} />
                      เชื่อมต่อ LINE แล้ว
                    </p>
                  )}
                </div>
                <div className={`px-4 py-2 rounded-full font-medium ${
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  order.status === 'accepted' ? 'bg-green-100 text-green-700' :
                  order.status === 'ready' ? 'bg-purple-100 text-purple-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {order.status === 'pending' ? '🔔 รอดำเนินการ' :
                   order.status === 'accepted' ? '✅ ยืนยันแล้ว' :
                   order.status === 'ready' ? '🎉 พร้อมแล้ว' : '❌ ปฏิเสธ'}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {order.items && order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-gray-700 bg-gray-50 p-3 rounded-lg">
                    <span className="flex-1">
                      {item.name} x {item.quantity}
                      {item.itemNote && (
                        <span className="block text-xs text-gray-500 italic mt-1">
                          หมายเหตุ: {item.itemNote}
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-orange-600">{item.price * item.quantity}฿</span>
                  </div>
                ))}
              </div>

              {order.note && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4 rounded">
                  <p className="text-sm font-medium text-blue-900">หมายเหตุ:</p>
                  <p className="text-blue-800">{order.note}</p>
                </div>
              )}
              {/* เปลี่ยนเป็น */}
              {order.payment_method === 'online' && order.slip_url && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">สลิปการชำระเงิน:</p>
                  <img 
                    src={order.slip_url} 
                    alt="สลิป" 
                    className="max-w-xs rounded-lg shadow-md cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => window.open(order.slip_url, '_blank')}
                  />
                </div>
              )}

              {order.payment_method === 'cash' && (
                <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                  <p className="text-sm font-medium text-yellow-900">⚠️ รอชำระเงินหน้าร้าน</p>
                  <p className="text-xs text-yellow-700 mt-1">ลูกค้าจะจ่ายเงินสดตอนมารับของ</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <p className="text-xl font-bold text-gray-800">
                  ยอดรวม: <span className="text-orange-600">{order.total}฿</span>
                </p>
                <button
                  onClick={() => {
                    setSelectedOrder(order);
                    setShowStatusModal(true);
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <Bell size={18} />
                  อัพเดตสถานะ
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showStatusModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">อัพเดตสถานะออเดอร์ #{selectedOrder.id}</h2>
              <button 
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedOrder(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {selectedOrder.line_user_id ? (
                  <span className="flex items-center gap-2 text-green-600">
                    <Bell size={16} />
                    ลูกค้าจะได้รับแจ้งเตือนผ่าน LINE
                  </span>
                ) : (
                  <span className="text-orange-600">
                    ⚠️ ลูกค้าไม่ได้เชื่อมต่อ LINE (ไม่มีการแจ้งเตือน)
                  </span>
                )}
              </p>
            </div>
                    {/* preparing */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  updateOrderStatus(selectedOrder.id, 'accepted');
                  setShowStatusModal(false);
                }}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <CheckCircle size={20} />
                ยืนยันออเดอร์
              </button>

              <button
                onClick={() => {
                  updateOrderStatus(selectedOrder.id, 'ready');
                  setShowStatusModal(false);
                }}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                🎉 พร้อมส่ง/รับได้แล้ว
              </button>

              <button
                onClick={() => {
                  updateOrderStatus(selectedOrder.id, 'rejected');
                  setShowStatusModal(false);
                }}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <XCircle size={20} />
                ปฏิเสธออเดอร์
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuPage = ({ menuItems, loadMenuItems }) => {
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');

  const saveMenuItem = async (menuData) => {
    setLoading(true);
    try {
      // ตรวจสอบข้อมูล
      if (!menuData.name || !menuData.category) {
        alert('กรุณากรอกชื่อเมนูและหมวดหมู่');
        setLoading(false);
        return;
      }

      console.log('Saving menu data:', menuData);

      let result;
      if (editingMenu) {
        const dataToUpdate = {
          name: menuData.name,
          price_normal: menuData.price_normal,
          price_special: menuData.price_special,
          category: menuData.category,
          image: menuData.image,
          is_active: menuData.is_active,
          updated_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
          .from('menu_items')
          .update(dataToUpdate)
          .eq('id', editingMenu.id)
          .select();
        
        result = { data, error };
      } else {
        const dataToInsert = {
          name: menuData.name,
          price_normal: menuData.price_normal,
          price_special: menuData.price_special,
          category: menuData.category,
          image: menuData.image || '',
          is_active: menuData.is_active,
          created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
          .from('menu_items')
          .insert([dataToInsert])
          .select();
        
        result = { data, error };
      }

      if (result.error) {
        console.error('Supabase error:', result.error);
        throw result.error;
      }

      console.log('Save result:', result.data);
      
      setShowMenuForm(false);
      setEditingMenu(null);
      await loadMenuItems();
      alert(editingMenu ? 'อัพเดตเมนูสำเร็จ' : 'บันทึกเมนูสำเร็จ');
    } catch (error) {
      console.error('Error saving menu:', error);
      alert('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const deleteMenuItem = async (id) => {
    if (!confirm('ต้องการลบเมนูนี้?')) return;
    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
      loadMenuItems();
      alert('ลบเมนูสำเร็จ');
    } catch (error) {
      console.error('Error deleting menu:', error);
      alert('เกิดข้อผิดพลาดในการลบเมนู');
    }
  };

  const toggleMenuActive = async (id, isActive) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_active: !isActive })
        .eq('id', id);
      if (error) throw error;
      loadMenuItems();
    } catch (error) {
      console.error('Error toggling menu:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะเมนู');
    }
  };

  const categories = ['all', ...new Set(menuItems.map(m => m.category))];
  const filteredMenuItems = filterCategory === 'all' 
    ? menuItems 
    : menuItems.filter(m => m.category === filterCategory);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">จัดการเมนูอาหาร</h2>
        <button
          onClick={() => {
            setEditingMenu(null);
            setShowMenuForm(true);
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
        >
          <Plus size={20} />
          เพิ่มเมนูใหม่
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterCategory === cat
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'all' ? 'ทั้งหมด' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMenuItems.map(item => (
          <div key={item.id} className={`bg-white rounded-lg shadow-md p-4 flex items-center gap-4 ${
            !item.is_active ? 'opacity-60' : ''
          }`}>
            {item.image && (
              <img src={item.image} alt={item.name} className="w-20 h-20 rounded-lg object-cover" />
            )}
            <div className="flex-1">
              <h3 className="font-bold text-gray-800">{item.name}</h3>
              <p className="text-sm text-gray-500">{item.category}</p>
              <p className="text-sm text-orange-600 font-medium mt-1">
                ธรรมดา: {item.price_normal}฿ | พิเศษ: {item.price_special}฿
              </p>
              <p className="text-xs mt-2">
                <span className={`px-2 py-1 rounded ${
                  item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {item.is_active ? '✓ เปิดใช้งาน' : '✗ ปิดใช้งาน'}
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => toggleMenuActive(item.id, item.is_active)}
                className={`${
                  item.is_active ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'
                } p-2 rounded-lg transition-colors`}
                title={item.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
              >
                {item.is_active ? <XCircle size={20} /> : <CheckCircle size={20} />}
              </button>
              <button
                onClick={() => {
                  setEditingMenu(item);
                  setShowMenuForm(true);
                }}
                className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                title="แก้ไข"
              >
                <Edit2 size={20} />
              </button>
              <button
                onClick={() => deleteMenuItem(item.id)}
                className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                title="ลบ"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showMenuForm && (
        <MenuFormModal 
          editingMenu={editingMenu}
          onClose={() => {
            setShowMenuForm(false);
            setEditingMenu(null);
          }}
          onSave={saveMenuItem}
          loading={loading}
        />
      )}
    </div>
  );
};

const MenuFormModal = ({ editingMenu, onClose, onSave, loading }) => {
  const [formData, setFormData] = useState(editingMenu || {
    name: '',
    price_normal: 40,
    price_special: 50,
    category: 'เมนูไข่',
    image: '',
    is_active: true
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const categories = [
    'เมนูไข่', 'ข้าวผัด', 'กะเพรา', 'ผัดน้ำมันหอย',
    'ทอดกระเทียม', 'ผัดพริกแกง', 'ผัดพริกเผา', 'เมนูหน่อไม้', 'อื่นๆ'
  ];

  const handleImageUpload = async (e) => {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        alert('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
        return;
      }

      // 🔧 ล้างชื่อไฟล์ให้เหลือแต่อักขระที่ปลอดภัย (เช่น อังกฤษ ตัวเลข และ .)
      const originalName = file.name;
      const safeName = originalName
        .replace(/[^a-zA-Z0-9._-]/g, '_') // แทนทุกตัวที่ไม่ใช่ ASCII ด้วย "_"
        .toLowerCase();

      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("menu-images")
        .getPublicUrl(fileName);

      if (publicUrlData?.publicUrl) {
        setFormData({ ...formData, image: publicUrlData.publicUrl });
        alert('อัพโหลดรูปภาพสำเร็จ');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {editingMenu ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block font-medium text-gray-700 mb-2">ชื่อเมนู</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="เช่น กะเพราหมู"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-gray-700 mb-2">
                  ราคาธรรมดา (฿)
                </label>
                <input
                  type="number"
                  value={formData.price_normal}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_normal: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 mb-2">
                  ราคาพิเศษ (฿)
                </label>
                <input
                  type="number"
                  value={formData.price_special}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_special: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-2">หมวดหมู่</label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-2">
                รูปภาพเมนู
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="w-full border border-gray-300 rounded-lg p-3"
              />
              {uploading && <p className="text-sm text-gray-500 mt-2">กำลังอัพโหลด...</p>}
              {formData.image && (
                <div className="mt-3">
                  <img
                    src={formData.image}
                    alt="menu"
                    className="rounded-lg w-32 h-32 object-cover border shadow-md"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-5 h-5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                />
                <span className="font-medium text-gray-700">
                  เปิดใช้งานเมนูนี้
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => onSave(formData)}
              disabled={
                loading ||
                uploading ||
                !formData.name ||
                !formData.price_normal ||
                !formData.price_special
              }
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;