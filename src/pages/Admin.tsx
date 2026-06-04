import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  ShoppingBag, 
  Users, 
  Settings, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  X, 
  Search, 
  Filter, 
  MoreVertical,
  ChevronRight,
  Utensils,
  Truck,
  Phone,
  AlertCircle,
  XCircle,
  ArrowLeft,
  Camera,
  LogOut
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';

interface Order {
  id: string;
  userEmail: string;
  items: any[];
  total: number;
  status: 'received' | 'preparing' | 'ready' | 'on the way' | 'delivered' | 'cancelled';
  createdAt: any;
  address: any;
  paymentMethod: string;
  deliveryPartnerPhone?: string;
  cancellationTimerId?: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  isAvailable: boolean;
}

interface Customer {
  id: string;
  email: string;
  displayName: string;
  phone?: string;
  name?: string;
}

const Admin: React.FC = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'customers' | 'settings'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isAddingMenuItem, setIsAddingMenuItem] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');
  const [menuAvailabilityFilter, setMenuAvailabilityFilter] = useState<string>('all');
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    price: '',
    description: '',
    category: 'Main Course',
    image: ''
  });
  const [isRestaurantOpen, setIsRestaurantOpen] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  });
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    const unsubMenu = onSnapshot(collection(db, 'menu'), (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
    });

    const unsubCustomers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'restaurant'), (doc) => {
      if (doc.exists()) {
        setIsRestaurantOpen(doc.data().isOpen !== false);
      }
    });

    return () => {
      unsubOrders();
      unsubMenu();
      unsubCustomers();
      unsubSettings();
    };
  }, []);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const updateOrderInfo = async (orderId: string, info: any) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), info);
    } catch (error) {
      console.error('Error updating info:', error);
    }
  };

  const cancelOrder = (orderId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        await updateOrderStatus(orderId, 'cancelled');
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const deleteMenuItem = (itemId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Menu Item',
      message: 'Are you sure you want to remove this item from the menu? It will be permanently deleted.',
      type: 'danger',
      onConfirm: async () => {
        await deleteDoc(doc(db, 'menu', itemId));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'menu'), {
        ...newMenuItem,
        price: Number(newMenuItem.price),
        isAvailable: true
      });
      setIsAddingMenuItem(false);
      setNewMenuItem({ name: '', price: '', description: '', category: 'Main Course', image: '' });
    } catch (error) {
      console.error('Error adding menu item:', error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size too large (max 2MB)');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMenuItem(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleRestaurantStatus = async () => {
    const nextStatus = !isRestaurantOpen;
    setIsRestaurantOpen(nextStatus);
    await updateDoc(doc(db, 'settings', 'restaurant'), { isOpen: nextStatus });
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'preparing': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'ready': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'on the way': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'delivered': return 'bg-green-50 text-green-600 border-green-100';
      case 'cancelled': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.address?.street?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(menuSearchQuery.toLowerCase());
    const matchesCategory = menuCategoryFilter === 'all' || item.category === menuCategoryFilter;
    const matchesAvailability = 
      menuAvailabilityFilter === 'all' || 
      (menuAvailabilityFilter === 'available' ? item.isAvailable : !item.isAvailable);
    
    return matchesSearch && matchesCategory && matchesAvailability;
  });

  const getOrderItemsList = (order: Order) => {
    return order.items.map(item => `${item.quantity}x ${item.name}`).join(', ');
  };

  const CancellationTimer = ({ order }: { order: Order }) => {
    const [seconds, setSeconds] = useState(60);
    
    useEffect(() => {
      if (order.status !== 'received') return;
      const timer = setInterval(() => {
        setSeconds(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }, [order.status]);

    if (order.status !== 'received' || seconds === 0) return null;

    return (
      <div className="flex items-center gap-1.5 bg-red-50 text-red-600 px-2.5 py-1 rounded-lg animate-pulse border border-red-100">
        <Clock size={10} className="font-black" />
        <span className="text-[10px] font-black tracking-tighter">CANCEL IN {seconds}s</span>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-16 h-16 bg-red-600 rounded-[24px] flex items-center justify-center text-white shadow-xl shadow-red-200"
        >
          <Utensils size={32} />
        </motion.div>
        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 italic">Securing Control Panel...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="h-screen bg-[#F8FAFC] flex overflow-hidden">
      {/* SaaS Sidebar */}
      <aside className="w-24 bg-white border-r border-slate-200 flex flex-col items-center py-10 z-50 shrink-0">
        <div className="w-12 h-12 bg-red-600 rounded-[22px] flex items-center justify-center text-white mb-16 shadow-lg shadow-red-500/20 group cursor-pointer overflow-hidden relative">
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Utensils size={24} className="relative z-10" />
        </div>

        <nav className="flex flex-col gap-8 flex-1">
          {[
            { id: 'orders', icon: ShoppingBag },
            { id: 'menu', icon: Utensils },
            { id: 'customers', icon: Users },
            { id: 'settings', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative group",
                activeTab === item.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon size={20} />
              {activeTab === item.id && (
                <motion.div layoutId="active" className="absolute -left-6 w-1 h-6 bg-indigo-600 rounded-r-full" />
              )}
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50">
                {item.id}
              </div>
            </button>
          ))}
        </nav>

        <button 
          onClick={handleLogout}
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all group relative"
        >
          <LogOut size={20} />
          <div className="absolute left-full ml-4 px-3 py-1.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50">
            Sign Out
          </div>
        </button>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 shrink-0">
          <div className="max-w-7xl mx-auto px-10 h-24 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">{activeTab} Panel</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Operational Control Center</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900">Restaurant Status</p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isRestaurantOpen ? "bg-green-500" : "bg-red-500")} />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {isRestaurantOpen ? "Accepting Orders" : "Kitchen Closed"}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 border-2 border-slate-100 rounded-full flex items-center justify-center bg-slate-50 text-slate-900 font-bold text-xs shadow-sm">
                R
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === 'orders' ? (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
              {/* Refined Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Active Orders', value: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length, icon: Clock, color: 'indigo' },
                  { label: 'Total Revenue', value: '₹' + orders.filter(o => o.status === 'delivered').reduce((acc, o) => acc + (o.total || 0), 0).toLocaleString(), icon: BarChart3, color: 'blue' },
                  { label: 'Sold Out', value: menuItems.filter(i => i.isAvailable === false).length, icon: AlertCircle, color: 'red' },
                  { label: 'Total Guests', value: customers.filter(c => !['admin'].includes((c as any).role)).length, icon: Users, color: 'slate' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white px-6 py-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                      stat.color === 'indigo' && "bg-indigo-50 text-indigo-600",
                      stat.color === 'blue' && "bg-blue-50 text-blue-600",
                      stat.color === 'red' && "bg-red-50 text-red-600",
                      stat.color === 'slate' && "bg-slate-100 text-slate-600"
                    )}>
                      <stat.icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                      <p className="text-xl font-black text-slate-900 tracking-tight truncate">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sold Out Advertisement/Alert */}
              {menuItems.filter(i => !i.isAvailable).length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-red-900 italic tracking-tight">INVENTORY ALERT: {menuItems.filter(i => !i.isAvailable).length} ITEMS SOLD OUT</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {menuItems.filter(i => !i.isAvailable).slice(0, 5).map(item => (
                          <span key={item.id} className="text-[9px] font-black uppercase text-red-400 bg-white px-2 py-0.5 rounded-md border border-red-50">
                            {item.name}
                          </span>
                        ))}
                        {menuItems.filter(i => !i.isAvailable).length > 5 && (
                          <span className="text-[9px] font-black uppercase text-red-400">+{menuItems.filter(i => !i.isAvailable).length - 5} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('menu')}
                    className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-red-200 active:scale-95 transition-all"
                  >
                    Restock
                  </button>
                </motion.div>
              )}

              {/* Order Management Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Live Orders</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time operation control</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative group">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Search ID/Guest..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-[11px] font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all w-48"
                      />
                    </div>
                    <div className="relative">
                      <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="p-2 pr-8 bg-slate-50 border border-slate-200 text-slate-500 text-[11px] font-bold rounded-lg hover:bg-slate-100 transition-all appearance-none outline-none focus:border-indigo-500"
                      >
                        <option value="all">All States</option>
                        <option value="received">Received</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready">Ready</option>
                        <option value="on the way">On The Way</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <Filter size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID & Guest</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Logistics</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                            No matching orders in feed
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => (
                          <tr key={order.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                            <td className="px-6 py-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-900 tracking-tighter"># {order.id.slice(-6).toUpperCase()}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate max-w-[100px]">{order.userEmail}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-700 italic line-clamp-1">{getOrderItemsList(order)}</span>
                                <span className="text-[10px] font-black text-indigo-600 mt-1">₹{order.total?.toFixed(2)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <div className="flex justify-center">
                                <div className={cn(
                                  "inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border items-center gap-1.5",
                                  getStatusColor(order.status)
                                )}>
                                  <div className={cn(
                                    "w-1 h-1 rounded-full",
                                    order.status === 'received' ? 'bg-blue-500' :
                                    order.status === 'preparing' ? 'bg-orange-500' :
                                    order.status === 'ready' ? 'bg-purple-500' :
                                    order.status === 'on the way' ? 'bg-indigo-500' :
                                    order.status === 'delivered' ? 'bg-green-500' : 'bg-red-500'
                                  )} />
                                  {order.status}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <input 
                                    defaultValue={order.deliveryPartnerPhone || ''} 
                                    placeholder="Pilot Phone"
                                    onBlur={(e) => updateOrderInfo(order.id, { deliveryPartnerPhone: e.target.value })} 
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-32 text-[10px] font-bold outline-none focus:border-indigo-500 transition-all" 
                                  />
                                  {order.deliveryPartnerPhone && (
                                    <a 
                                      href={`tel:${order.deliveryPartnerPhone}`} 
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600"
                                      title="Call Pilot"
                                    >
                                      <Phone size={12} />
                                    </a>
                                  )}
                                </div>
                                <CancellationTimer order={order} />
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {['received', 'preparing', 'ready', 'on the way'].includes(order.status) && (
                                  <button 
                                    onClick={() => {
                                      const nextStatusMap: Record<string, string> = {
                                        'received': 'preparing',
                                        'preparing': 'ready',
                                        'ready': 'on the way',
                                        'on the way': 'delivered'
                                      };
                                      updateOrderStatus(order.id, nextStatusMap[order.status]);
                                    }}
                                    className="p-2 bg-indigo-600 text-white rounded-lg hover:scale-105 active:scale-95 transition-all shadow-sm"
                                    title="Next Stage"
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                )}
                                {['received', 'preparing'].includes(order.status) && (
                                  <button 
                                    onClick={() => cancelOrder(order.id)}
                                    className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    title="Cancel Order"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                )}
                                <button onClick={() => setSelectedOrder(order)} className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-all" title="View Details">
                                  <ChevronRight size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'menu' ? (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col lg:flex-row justify-between lg:items-center bg-white p-6 sm:p-8 rounded-[40px] border border-gray-100 shadow-sm gap-6">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 italic uppercase">Culinary Menu</h3>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Manage dishes and availability</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative group min-w-[200px]">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Search dishes..." 
                      value={menuSearchQuery}
                      onChange={(e) => setMenuSearchQuery(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all w-full"
                    />
                  </div>
                  <div className="relative h-10 min-w-[140px]">
                    <select 
                      value={menuCategoryFilter}
                      onChange={(e) => setMenuCategoryFilter(e.target.value)}
                      className="w-full h-full p-2 pr-8 bg-slate-50 border border-slate-200 text-slate-500 text-[11px] font-bold rounded-xl hover:bg-slate-100 transition-all appearance-none outline-none focus:border-indigo-500"
                    >
                      <option value="all">Categories</option>
                      <option>Main Course</option>
                      <option>Starters</option>
                      <option>Breads</option>
                      <option>Desserts</option>
                      <option>Beverages</option>
                    </select>
                    <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <div className="relative h-10 min-w-[120px]">
                    <select 
                      value={menuAvailabilityFilter}
                      onChange={(e) => setMenuAvailabilityFilter(e.target.value)}
                      className="w-full h-full p-2 pr-8 bg-slate-50 border border-slate-200 text-slate-500 text-[11px] font-bold rounded-xl hover:bg-slate-100 transition-all appearance-none outline-none focus:border-indigo-500"
                    >
                      <option value="all">Status</option>
                      <option value="available">In Stock</option>
                      <option value="unavailable">Sold Out</option>
                    </select>
                    <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <button 
                    onClick={() => setIsAddingMenuItem(true)}
                    className="h-10 bg-gray-900 text-white px-6 rounded-xl font-black italic text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-gray-900/10 flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add Dish
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                {filteredMenuItems.length === 0 ? (
                  <div className="col-span-full py-20 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                      <Search size={32} className="text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">No culinary items found matching your filters</p>
                  </div>
                ) : (
                  filteredMenuItems.map(item => (
                  <div key={item.id} className="bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm group hover:shadow-xl transition-all">
                    <div className="aspect-video relative overflow-hidden">
                      <img src={item.image || undefined} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
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
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'customers' ? (
            <div className="max-w-7xl mx-auto bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-10 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-transparent">
                <h3 className="text-2xl font-black text-gray-900 italic uppercase">VIP Guests</h3>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Audience Reach</p>
              </div>
              <div className="divide-y divide-gray-50">
                {customers.sort((a, b) => ((b as any).role === 'admin' ? 1 : -1)).map(c => (
                  <div key={c.id} className="p-8 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black italic shadow-lg",
                        (c as any).role === 'admin' ? "bg-indigo-600 shadow-indigo-500/10" : "bg-red-500 shadow-red-500/10"
                      )}>
                        {c.email?.[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="font-black text-gray-900 italic tracking-tight text-lg leading-none">{c.displayName || c.name || 'Anonymous Guest'}</p>
                          {(c as any).role === 'admin' && (
                            <span className="bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-md border border-indigo-100 tracking-[0.2em]">Management</span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">{c.email}</p>
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
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase leading-none px-2">Order Report</h2>
                    <p className="text-[11px] font-black text-red-500 uppercase tracking-widest mt-2 flex items-center gap-2 italic px-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      ID: {selectedOrder.id.toUpperCase()}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedOrder(null)}
                    className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all hover:bg-red-50 hover:text-red-500"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl transition-all group-hover:scale-150" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Recipient Information</p>
                    <div className="flex items-start gap-4 relative z-10">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-50">
                        <Users size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 text-lg leading-none mb-1.5 truncate">{selectedOrder.userEmail}</p>
                        <p className="text-sm font-bold text-slate-400 italic leading-relaxed">{selectedOrder.address?.street}, {selectedOrder.address?.city}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Itemized Bill</p>
                      <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">
                          {selectedOrder.paymentMethod}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-6 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                              <Utensils size={16} />
                            </div>
                            <div>
                              <p className="font-black text-slate-900 italic text-sm">{item.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.quantity} x ₹{item.price}</p>
                            </div>
                          </div>
                          <p className="font-black text-slate-900 italic text-sm tracking-tighter">₹{item.price * item.quantity}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl shadow-slate-900/10 mb-2">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Final Settlement</p>
                      <h4 className="text-3xl font-black italic tracking-tighter">₹{selectedOrder.total}</h4>
                    </div>
                    <div className="text-right flex flex-col items-end gap-3">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Operational State</p>
                        <div className="flex items-center gap-2 justify-end">
                          <div className={cn("w-2 h-2 rounded-full animate-pulse", selectedOrder.status === 'cancelled' ? 'bg-red-400' : 'bg-green-400')} />
                          <p className="text-lg font-black italic uppercase tracking-tighter">{selectedOrder.status}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Menu Item Modal */}
      <AnimatePresence>
        {isAddingMenuItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
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
              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <form onSubmit={handleAddMenuItem} className="flex flex-col h-full">
                <div className="p-6 sm:p-10 pb-0 shrink-0">
                  <div className="flex items-center justify-between mb-8 sm:mb-10">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none px-2">New Creation</h2>
                      <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2 sm:mt-3 italic px-2">Add to culinary library</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsAddingMenuItem(false)}
                      className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-10 pt-0 space-y-6 sm:space-y-8 custom-scrollbar">
                  {/* Image Upload Area */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[16/9] sm:aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center gap-2 sm:gap-4 cursor-pointer hover:bg-slate-100/50 hover:border-indigo-200 transition-all overflow-hidden relative group"
                  >
                    {newMenuItem.image ? (
                      <>
                        <img src={newMenuItem.image} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Camera className="text-white" size={24} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 group-hover:text-indigo-400 group-hover:border-indigo-100 transition-all">
                          <Camera size={24} />
                        </div>
                        <div className="text-center">
                          <p className="text-xs sm:text-sm font-black text-slate-900 italic tracking-tight">Upload Product Shot</p>
                          <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 italic">Max 2MB • PNG/JPG</p>
                        </div>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Dish Title</label>
                      <input 
                        required
                        value={newMenuItem.name}
                        onChange={e => setNewMenuItem(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black italic outline-none focus:bg-white focus:border-indigo-500 transition-all text-sm placeholder:text-slate-300"
                        placeholder="e.g., Signature Burger"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Valuation (₹)</label>
                      <input 
                        required
                        type="number"
                        value={newMenuItem.price}
                        onChange={e => setNewMenuItem(prev => ({ ...prev, price: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black italic outline-none focus:bg-white focus:border-indigo-500 transition-all text-sm placeholder:text-slate-300"
                        placeholder="299"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Culinary Narrative</label>
                    <textarea 
                      required
                      value={newMenuItem.description}
                      onChange={e => setNewMenuItem(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-100 rounded-[32px] px-6 py-4 font-black italic outline-none focus:bg-white focus:border-indigo-500 transition-all text-sm h-32 resize-none placeholder:text-slate-300"
                      placeholder="Describe the flavors and ingredients..."
                    />
                  </div>

                  <div className="space-y-2 pb-4">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Menu Classification</label>
                    <div className="relative">
                      <select 
                        value={newMenuItem.category}
                        onChange={e => setNewMenuItem(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black italic outline-none focus:bg-white focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
                      >
                        <option>Main Course</option>
                        <option>Starters</option>
                        <option>Breads</option>
                        <option>Desserts</option>
                        <option>Beverages</option>
                      </select>
                      <Filter size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-10 pt-4 shrink-0 bg-white border-t border-slate-50">
                  <button 
                    type="submit"
                    className="w-full bg-slate-900 text-white py-4 sm:py-6 rounded-3xl font-black italic text-base sm:text-lg shadow-xl shadow-slate-900/10 hover:bg-black hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    Deploy New Dish
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl p-8 text-center overflow-hidden"
            >
              <div className={cn(
                "w-16 h-16 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-lg",
                confirmDialog.type === 'danger' ? "bg-red-50 text-red-500 shadow-red-500/10" : "bg-orange-50 text-orange-500 shadow-orange-500/10"
              )}>
                {confirmDialog.type === 'danger' ? <Trash2 size={24} /> : <AlertCircle size={24} />}
              </div>
              <h3 className="text-2xl font-black text-slate-900 italic tracking-tight uppercase leading-none mb-3">{confirmDialog.title}</h3>
              <p className="text-xs font-bold text-slate-500 leading-relaxed mb-8 px-4">{confirmDialog.message}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Go Back
                </button>
                <button 
                  onClick={confirmDialog.onConfirm}
                  className={cn(
                    "flex-1 px-4 py-3 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg",
                    confirmDialog.type === 'danger' ? "bg-red-600 shadow-red-200" : "bg-orange-600 shadow-orange-200"
                  )}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Admin;
