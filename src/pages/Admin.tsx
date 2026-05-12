import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  orderBy,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Settings, 
  Clock, 
  CheckCircle2, 
  Truck, 
  XCircle,
  MoreVertical,
  ChevronRight,
  Utensils,
  Lock,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function CancellationTimer({ order }: { order: any }) {
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    const createdAt = order.createdAt?.seconds ? order.createdAt.seconds * 1000 : Date.now();
    const expiryTime = createdAt + 60000;

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiryTime - now) / 1000));
      setTimeLeft(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  if (timeLeft <= 0) return null;

  return (
    <span className="text-[10px] font-black text-red-500 animate-pulse">
      CAN CANCEL: {timeLeft}s
    </span>
  );
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isAddingMenuItem, setIsAddingMenuItem] = useState(false);
  const [isRestaurantOpen, setIsRestaurantOpen] = useState(true);
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    price: 0,
    category: 'Main Course',
    description: '',
    image: '',
    isAvailable: true
  });

  const ADMIN_EMAILS = ['rehaanoffical77@gmail.com', 'capcutrehaan@gmail.com'].map(e => e.toLowerCase());

  useEffect(() => {
    if (authLoading) return;

    if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")) {
      return;
    }

    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Orders Listener Error:", error);
      setLoading(false);
    });
    return unsub;
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (activeTab === 'menu') {
      const unsub = onSnapshot(collection(db, 'menu'), (snap) => {
        setMenuItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return unsub;
    }
    if (activeTab === 'customers') {
      const unsub = onSnapshot(collection(db, 'users'), (snap) => {
        setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return unsub;
    }
    if (activeTab === 'settings') {
      const unsub = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
        if (snap.exists()) {
          setIsRestaurantOpen(snap.data().isOpen);
        }
      });
      return unsub;
    }
  }, [activeTab]);

  const toggleRestaurantStatus = async () => {
    try {
      await updateDoc(doc(db, 'settings', 'config'), { isOpen: !isRestaurantOpen });
    } catch (error) {
      // If doc doesn't exist, set it
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'settings', 'config'), { isOpen: !isRestaurantOpen });
    }
  };

  const addMenuItem = async () => {
    try {
      await addDoc(collection(db, 'menu'), newMenuItem);
      setIsAddingMenuItem(false);
      setNewMenuItem({ name: '', price: 0, category: 'Main Course', description: '', image: '', isAvailable: true });
    } catch (error) {
      console.error("Add Menu Error:", error);
    }
  };

  const deleteMenuItem = async (id: string) => {
    if (window.confirm("Delete this menu item?")) {
      await deleteDoc(doc(db, 'menu', id));
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-full" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[40px] p-12 shadow-xl border border-gray-100 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <Lock size={40} className="text-[#E31837]" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 italic tracking-tight">Access Denied</h2>
          <p className="text-gray-500 font-medium leading-relaxed">
            This area is reserved for the restaurant owner. Please login with authorized credentials to continue.
          </p>
          <button 
            onClick={() => navigate('/')}
            className="w-full h-14 bg-gray-900 text-white rounded-2xl font-bold transition-transform active:scale-95"
          >
            Back to Website
          </button>
        </div>
      </div>
    );
  }

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      console.error("Update Status Error:", error);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (window.confirm("Permanently cancel this order? This cannot be undone.")) {
      try {
        await updateDoc(doc(db, 'orders', orderId), { status: 'cancelled' });
      } catch (error) {
        console.error("Cancel Order Error:", error);
      }
    }
  };

  const updateOrderInfo = async (orderId: string, info: any) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), info);
    } catch (error) {
      console.error("Update Info Error:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'received': return 'text-blue-500 bg-blue-50 border-blue-100';
      case 'preparing': return 'text-orange-500 bg-orange-50 border-orange-100';
      case 'ready': return 'text-purple-500 bg-purple-50 border-purple-100';
      case 'on the way': return 'text-indigo-500 bg-indigo-50 border-indigo-100';
      case 'delivered': return 'text-green-500 bg-green-50 border-green-100';
      case 'cancelled': return 'text-red-500 bg-red-50 border-red-100';
      default: return 'text-gray-500 bg-gray-50 border-gray-100';
    }
  };

  const getOrderItemsList = (order: any) => {
    if (!order.items || !Array.isArray(order.items)) return 'No items';
    return order.items.map((item: any) => `${item.quantity}x ${item.name}`).join(', ');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex font-sans selection:bg-red-100">
      {/* Sidebar - Professional Gradient */}
      <aside className="w-72 bg-gray-900 hidden lg:flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none" />
        
        <div className="p-8 relative">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-[#E31837] rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
              <Utensils size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-black italic text-white tracking-tight uppercase">MNDM <span className="text-red-500">PRO</span></h1>
          </div>

          <nav className="space-y-1.5">
            {[
              { id: 'orders', label: 'Command Center', icon: LayoutDashboard, count: orders.length },
              { id: 'menu', label: 'Culinary Menu', icon: Utensils },
              { id: 'customers', label: 'VIP Guests', icon: Users },
              { id: 'settings', label: 'System Config', icon: Settings },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl font-bold text-sm transition-all group ${
                  activeTab === item.id 
                    ? 'bg-white/10 text-white shadow-xl' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={activeTab === item.id ? 'text-red-500' : 'group-hover:text-red-400'} />
                  {item.label}
                </div>
                {item.count !== undefined && (
                  <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-red-500/20">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-white/5">
          <div className="bg-white/5 rounded-[32px] p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-black italic shadow-lg">
              RA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white truncate italic tracking-tighter">Rehaan Admin</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Master Auth</p>
              </div>
            </div>
            <button className="text-gray-500 hover:text-white transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Modern Header */}
        <header className="h-24 bg-white/80 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-10 sticky top-0 z-50">
          <div>
            <h2 className="text-2xl font-black text-gray-900 italic tracking-tighter capitalize flex items-center gap-3">
              {activeTab}
              <span className="text-[9px] not-italic bg-green-50 text-green-600 font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-green-100 flex items-center gap-1.5">
                <div className="w-1 h-1 bg-green-600 rounded-full animate-ping" />
                System Live
              </span>
            </h2>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time Operations Monitoring</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] mb-1">Today's Revenue</p>
              <p className="text-2xl font-black text-gray-900 italic tracking-tighter">₹{orders.reduce((acc, o) => acc + (o.total || 0), 0).toLocaleString()}</p>
            </div>
            <div className="h-10 w-px bg-gray-100" />
            <button className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all active:scale-95 text-gray-400 hover:text-gray-900">
               <Clock size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 font-sans custom-scrollbar">
          {activeTab === 'orders' ? (
            <div className="max-w-7xl mx-auto space-y-10">
              {/* Stats Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Active', value: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/5' },
                  { label: 'Revenue', value: '₹' + orders.reduce((acc, o) => acc + (o.total || 0), 0).toFixed(0), icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-500/5' },
                  { label: 'Completed', value: orders.filter(o => o.status === 'delivered').length, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/5' },
                  { label: 'Cancelled', value: orders.filter(o => o.status === 'cancelled').length, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/5' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] group hover:shadow-xl hover:shadow-red-500/5 transition-all">
                    <div className={`p-3 w-fit rounded-2xl mb-5 transition-transform group-hover:scale-110 ${stat.bg} ${stat.color}`}>
                      <stat.icon size={22} />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
                    <p className="text-3xl font-black text-gray-900 italic tracking-tighter">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Advanced Orders Control */}
              <div className="bg-white rounded-[40px] shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden outline outline-4 outline-white">
                <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-transparent">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 italic tracking-tight">Recent Activity</h3>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time Order Feed</p>
                  </div>
                  <div className="flex gap-2">
                    {['all', 'preparing', 'on the way'].map(filter => (
                      <button key={filter} className="px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-gray-50 text-gray-400 hover:bg-gray-100 transition-all border border-gray-100">
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-gray-50">
                  {orders.length === 0 ? (
                    <div className="py-24 text-center">
                      <ShoppingBag size={48} className="mx-auto text-gray-100 mb-6" />
                      <h3 className="text-xl font-black text-gray-300 italic uppercase">Silence in the kitchen</h3>
                      <p className="text-gray-400 font-bold text-sm tracking-widest uppercase mt-2">Waiting for first strike...</p>
                    </div>
                  ) : (
                    orders.map((order) => (
                      <div key={order.id} className="p-10 flex gap-8 group hover:bg-[#F8F9FA] transition-all relative">
                        {/* ID & Date Badge */}
                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                          <div className="w-16 h-16 bg-gray-900 rounded-[28px] flex flex-col items-center justify-center text-white shadow-xl shadow-gray-900/10 group-hover:-rotate-6 transition-transform">
                            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">ORDER</p>
                            <p className="text-sm font-black italic">#{order.id.slice(-4).toUpperCase()}</p>
                          </div>
                          <p className="text-[10px] font-bold text-gray-400 tracking-tighter">
                            {new Date(order.createdAt?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        {/* Customer & Items */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-xl font-black text-gray-900 italic tracking-tight truncate">{order.address?.label || 'Direct Order'}</h4>
                            <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                               {order.items?.length || 0} Items
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 font-medium leading-relaxed italic line-clamp-2">
                            {getOrderItemsList(order)}
                          </p>
                          <div className="flex items-center gap-4 mt-6">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                               <Users size={12} className="text-gray-400" />
                               <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{order.userEmail?.split('@')[0] || 'Guest'}</span>
                            </div>
                            <p className="text-lg font-black text-gray-900 tracking-tighter">₹{order.total?.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Dynamic Status Engine */}
                        <div className="flex flex-col items-center gap-4 min-w-[140px]">
                           <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Lifecycle State</p>
                           <div className="flex flex-col items-center gap-3">
                             <div className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm border ${getStatusColor(order.status)}`}>
                               {order.status}
                             </div>
                             {order.status === 'received' && (
                               <CancellationTimer order={order} />
                             )}
                           </div>
                        </div>

                        {/* Professional Partner Management */}
                        <div className="w-60 bg-white/50 backdrop-blur-sm p-5 rounded-[32px] border border-gray-100 shadow-inner group-hover:bg-white transition-all">
                           <div className="flex items-center gap-3 mb-4">
                              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                                <Truck size={16} />
                              </div>
                              <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest italic">Logistics</p>
                           </div>
                           <div className="space-y-3">
                              <input 
                                type="text" 
                                placeholder="Pilot Name" 
                                className="w-full text-[11px] font-bold border-none outline-none focus:text-red-600 bg-transparent placeholder:text-gray-300"
                                defaultValue={order.deliveryPartnerName || ''}
                                onBlur={(e) => updateOrderInfo(order.id, { deliveryPartnerName: e.target.value })}
                              />
                              <div className="h-[1px] bg-gray-100 w-full" />
                              <input 
                                type="text" 
                                placeholder="Pilot Phone" 
                                className="w-full text-[11px] font-black border-none outline-none focus:text-red-600 bg-transparent placeholder:text-gray-300 tracking-wider"
                                defaultValue={order.deliveryPartnerPhone || ''}
                                onBlur={(e) => updateOrderInfo(order.id, { deliveryPartnerPhone: e.target.value })}
                              />
                           </div>
                        </div>

                        {/* Command Actions */}
                        <div className="flex flex-col justify-center gap-2 shrink-0">
                           {order.status === 'received' && (
                             <button 
                               onClick={() => updateOrderStatus(order.id, 'preparing')}
                               className="w-12 h-12 bg-blue-600 text-white rounded-[20px] flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-blue-600/20"
                               title="Received -> Preparing"
                             >
                               <Utensils size={20} />
                             </button>
                           )}
                           {order.status === 'preparing' && (
                             <button 
                               onClick={() => updateOrderStatus(order.id, 'ready')}
                               className="w-12 h-12 bg-orange-600 text-white rounded-[20px] flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-orange-600/20"
                               title="Preparing -> Ready"
                             >
                               <ShoppingBag size={20} />
                             </button>
                           )}
                           {order.status === 'ready' && (
                             <button 
                               onClick={() => updateOrderStatus(order.id, 'on the way')}
                               className="w-12 h-12 bg-purple-600 text-white rounded-[20px] flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-purple-600/20"
                               title="Ready -> On the Way"
                             >
                               <Truck size={20} />
                             </button>
                           )}
                           {order.status === 'on the way' && (
                             <button 
                               onClick={() => updateOrderStatus(order.id, 'delivered')}
                               className="w-12 h-12 bg-green-600 text-white rounded-[20px] flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-green-600/20"
                               title="On the Way -> Delivered"
                             >
                               <CheckCircle2 size={20} />
                             </button>
                           )}
                           {order.status !== 'cancelled' && order.status !== 'delivered' && (
                             <button 
                               onClick={() => cancelOrder(order.id)}
                               className="w-12 h-12 bg-red-50 text-red-500 rounded-[20px] flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                               title="Cancel Order"
                             >
                               <XCircle size={20} />
                             </button>
                           )}
                           <button 
                             onClick={() => setSelectedOrder(order)}
                             className="w-12 h-12 bg-gray-50 text-gray-400 rounded-[20px] flex items-center justify-center hover:bg-gray-100 hover:text-gray-900 transition-all font-black text-xs"
                             title="Full Details"
                           >
                             <MoreVertical size={20} />
                           </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'menu' ? (
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 italic uppercase">Culinary Menu</h3>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Manage dishes and availability</p>
                </div>
                <button 
                  onClick={() => setIsAddingMenuItem(true)}
                  className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black italic text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-gray-900/10"
                >
                  Add New Dish
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuItems.map(item => (
                  <div key={item.id} className="bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm group hover:shadow-xl transition-all">
                    <div className="aspect-video relative overflow-hidden">
                      <img src={item.image || null} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase italic tracking-widest shadow-sm">
                        {item.category}
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-lg font-black text-gray-900 italic tracking-tight">{item.name}</h4>
                        <p className="text-xl font-black text-gray-900 whitespace-nowrap">₹{item.price}</p>
                      </div>
                      <p className="text-xs text-gray-500 font-medium line-clamp-2 leading-relaxed mb-6">{item.description}</p>
                      <div className="flex justify-between items-center gap-4">
                        <button 
                          onClick={() => updateDoc(doc(db, 'menu', item.id), { isAvailable: !item.isAvailable })}
                          className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            item.isAvailable ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                          }`}
                        >
                          {item.isAvailable ? 'Available' : 'Sold Out'}
                        </button>
                        <button 
                          onClick={() => deleteMenuItem(item.id)}
                          className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'customers' ? (
            <div className="max-w-7xl mx-auto bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-10 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-transparent">
                <h3 className="text-2xl font-black text-gray-900 italic uppercase">VIP Guests</h3>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Audience Reach</p>
              </div>
              <div className="divide-y divide-gray-50">
                {customers.map(c => (
                  <div key={c.id} className="p-8 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-red-500 rounded-2xl flex items-center justify-center text-white text-xl font-black italic shadow-lg shadow-red-500/10">
                        {c.email?.[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-gray-900 italic tracking-tight text-lg leading-none mb-1">{c.displayName || c.name || 'Anonymous Guest'}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{c.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Contact Detail</p>
                       <p className="text-sm font-black text-gray-900 italic tracking-tight">{c.phone || 'No Phone Link'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto bg-white rounded-[40px] border border-gray-100 shadow-sm p-12 text-center">
              <div className="w-24 h-24 bg-gray-50 rounded-[40px] flex items-center justify-center mx-auto mb-8">
                <Settings size={40} className="text-gray-300" />
              </div>
              <h3 className="text-3xl font-black text-gray-900 italic uppercase mb-2">System Configuration</h3>
              <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-12">Fine-tune the culinary engine</p>
              
              <div className="space-y-6 max-w-md mx-auto">
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl">
                  <div className="text-left">
                    <p className="font-black text-gray-900 tracking-tight">Restaurant Status</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Toggle ordering capability</p>
                  </div>
                  <div 
                    onClick={toggleRestaurantStatus}
                    className={`w-14 h-8 rounded-full relative p-1 cursor-pointer transition-colors duration-500 ${isRestaurantOpen ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <motion.div 
                      animate={{ x: isRestaurantOpen ? 24 : 0 }}
                      className="w-6 h-6 bg-white rounded-full shadow-sm" 
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl">
                  <div className="text-left">
                    <p className="font-black text-gray-900 tracking-tight">Maintenance Mode</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Admin only access</p>
                  </div>
                  <div className="w-14 h-8 bg-gray-200 rounded-full relative p-1 cursor-not-allowed">
                    <div className="w-6 h-6 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[48px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase leading-none">Order Details</h2>
                    <p className="text-[11px] font-black text-red-500 uppercase tracking-widest mt-3 flex items-center gap-2 italic">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      #{selectedOrder.id.toUpperCase()}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedOrder(null)}
                    className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"
                  >
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Customer Details</p>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#E31837] shadow-sm border border-gray-100">
                        <Users size={20} />
                      </div>
                      <div>
                        <p className="font-black text-gray-900 text-lg leading-none mb-1">{selectedOrder.userEmail}</p>
                        <p className="text-sm font-medium text-gray-500 italic leading-relaxed">{selectedOrder.address?.street}, {selectedOrder.address?.city}</p>
                        <p className="text-sm font-black text-gray-400 mt-2">Zone: {selectedOrder.address?.zone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-4">Order Manifest</p>
                    <div className="space-y-2">
                       {selectedOrder.items?.map((item: any, i: number) => (
                         <div key={i} className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-3xl hover:border-red-100 transition-colors">
                           <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-gray-50 rounded-2xl overflow-hidden shadow-inner border border-gray-100">
                               <img src={item.image || null} alt="" className="w-full h-full object-cover" />
                             </div>
                             <div>
                               <p className="font-black text-gray-900 tracking-tight">{item.name}</p>
                               <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{item.quantity} Unit(s)</p>
                             </div>
                           </div>
                           <p className="text-lg font-black text-gray-900 italic tracking-tighter">₹{(item.price * item.quantity).toFixed(2)}</p>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-[32px] p-8 text-white flex items-center justify-between shadow-2xl shadow-gray-900/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-8 -mt-8" />
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 italic">Settlement Total</p>
                      <p className="text-3xl font-black italic tracking-tighter">₹{selectedOrder.total?.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Payment Method</p>
                       <p className="text-sm font-black italic tracking-tight text-red-500">{selectedOrder.paymentMethod}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Menu Item Modal */}
      <AnimatePresence>
        {isAddingMenuItem && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 sm:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingMenuItem(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[48px] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 italic uppercase leading-none">New Creation</h2>
                    <p className="text-[11px] font-black text-red-500 uppercase tracking-widest mt-3 italic">Add to Culinary Menu</p>
                  </div>
                  <button onClick={() => setIsAddingMenuItem(false)} className="text-gray-400 hover:text-gray-900">
                    <XCircle size={32} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 mt-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Dish Title</label>
                       <input 
                         type="text" 
                         className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5 font-bold outline-none focus:bg-white transition-all shadow-inner"
                         placeholder="e.g. Royal Chicken Biryani"
                         value={newMenuItem.name}
                         onChange={e => setNewMenuItem({...newMenuItem, name: e.target.value})}
                       />
                    </div>
                    <div className="space-y-1 mt-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Settlement Price</label>
                       <input 
                         type="number" 
                         className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5 font-bold outline-none focus:bg-white transition-all shadow-inner"
                         placeholder="₹299"
                         value={newMenuItem.price}
                         onChange={e => setNewMenuItem({...newMenuItem, price: Number(e.target.value)})}
                       />
                    </div>
                  </div>

                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Visual Asset URL</label>
                     <input 
                       type="text" 
                       className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5 font-bold outline-none focus:bg-white transition-all shadow-inner"
                       placeholder="https://images.unsplash.com/..."
                       value={newMenuItem.image}
                       onChange={e => setNewMenuItem({...newMenuItem, image: e.target.value})}
                     />
                  </div>

                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Category Segment</label>
                     <select 
                       className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5 font-bold outline-none focus:bg-white transition-all shadow-inner appearance-none capitalize"
                       value={newMenuItem.category}
                       onChange={e => setNewMenuItem({...newMenuItem, category: e.target.value})}
                     >
                       <option>Biryani</option>
                       <option>Starters</option>
                       <option>Desserts</option>
                       <option>Beverages</option>
                       <option>Main Course</option>
                     </select>
                  </div>

                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Culinary Narrative</label>
                     <textarea 
                       className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5 font-bold outline-none focus:bg-white transition-all shadow-inner h-24 resize-none"
                       placeholder="Describe the flavors..."
                       value={newMenuItem.description}
                       onChange={e => setNewMenuItem({...newMenuItem, description: e.target.value})}
                     />
                  </div>

                  <button 
                    onClick={addMenuItem}
                    className="w-full bg-gray-900 text-white rounded-3xl py-4 font-black italic text-sm shadow-2xl shadow-gray-900/20 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                  >
                    DEPLOY TO MENU
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
