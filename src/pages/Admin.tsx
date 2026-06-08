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
  LogOut,
  Sparkles,
  Star,
  Heart,
  Info
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await addDoc(collection(db, 'menu'), {
        name: newMenuItem.name,
        price: Number(newMenuItem.price),
        description: newMenuItem.description,
        category: newMenuItem.category,
        image: newMenuItem.image,
        isAvailable: true
      });
      setIsAddingMenuItem(false);
      setNewMenuItem({ name: '', price: '', description: '', category: 'Main Course', image: '' });
    } catch (error: any) {
      console.error('Error adding menu item:', error);
      setSubmitError(error?.message || String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('File size too large (max 3MB)');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          // Client-side compression & downscaling using HTML5 Canvas
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension bounds (keep under 850px for fast loading and low storage footprint, while looking pristine)
          const MAX_DIM = 850;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress heavily to a premium quality JPEG that is highly optimized (~100KB which fits Firestore perfectly)
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.72);
            setNewMenuItem(prev => ({ ...prev, image: compressedBase64 }));
          } else {
            setNewMenuItem(prev => ({ ...prev, image: reader.result as string }));
          }
        };
        img.onerror = () => {
          setNewMenuItem(prev => ({ ...prev, image: reader.result as string }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleRestaurantStatus = async () => {
    const nextStatus = !isRestaurantOpen;
    setIsRestaurantOpen(nextStatus);
    await updateDoc(doc(db, 'settings', 'restaurant'), { isOpen: nextStatus });
  };

  const [isPurging, setIsPurging] = useState(false);

  const purgeAllTestData = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Purge All Test Data',
      message: 'Are you sure you want to completely delete all active/past orders, and clear all customer guest profiles? This will reset your dashboard counts to zero.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsPurging(true);
        try {
          // 1. Delete all orders
          const ordersSnap = await getDocs(collection(db, 'orders'));
          for (const orderDoc of ordersSnap.docs) {
            await deleteDoc(doc(db, 'orders', orderDoc.id));
          }

          // 2. Delete all non-admin users/customers
          const usersSnap = await getDocs(collection(db, 'users'));
          const adminEmails = ['rehaanoffical77@gmail.com', 'capcutrehaan@gmail.com', 'rehaanhacker4@gmai.com'];
          for (const userDoc of usersSnap.docs) {
            const data = userDoc.data();
            if (data.role !== 'admin' && !adminEmails.includes(data.email || '')) {
              await deleteDoc(doc(db, 'users', userDoc.id));
            }
          }

          // 3. Reset all sold out items back to available
          const menuSnap = await getDocs(collection(db, 'menu'));
          for (const itemDoc of menuSnap.docs) {
            const data = itemDoc.data();
            if (data.isAvailable === false) {
              await updateDoc(doc(db, 'menu', itemDoc.id), { isAvailable: true });
            }
          }

          alert('Test data purged successfully! Dashboard is reset and clean.');
        } catch (error: any) {
          console.error("Purging failed:", error);
          alert('Error clearing data: ' + (error.message || String(error)));
        } finally {
          setIsPurging(false);
        }
      }
    });
  };

  const clearAllOrders = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear All Orders',
      message: 'Are you sure you want to permanently delete all order logs and reset total revenue to zero?',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsPurging(true);
        try {
          const snap = await getDocs(collection(db, 'orders'));
          for (const d of snap.docs) {
            await deleteDoc(doc(db, 'orders', d.id));
          }
          alert('All orders have been permanently deleted.');
        } catch (error: any) {
          console.error("Error clearing orders:", error);
          alert('Failed to clear orders: ' + (error.message || String(error)));
        } finally {
          setIsPurging(false);
        }
      }
    });
  };

  const resetSoldOutItems = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Sold Out Items',
      message: 'Are you sure you want to make all menu items available (in stock) again?',
      type: 'warning',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsPurging(true);
        try {
          const snap = await getDocs(collection(db, 'menu'));
          for (const d of snap.docs) {
            if (d.data().isAvailable === false) {
              await updateDoc(doc(db, 'menu', d.id), { isAvailable: true });
            }
          }
          alert('All menu items have been reset to Available.');
        } catch (error: any) {
          console.error("Error resetting items:", error);
          alert('Failed to reset items: ' + (error.message || String(error)));
        } finally {
          setIsPurging(false);
        }
      }
    });
  };

  const clearGuests = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear VIP Guests',
      message: 'Are you sure you want to delete all non-admin registered customer guest profiles? This resets Total Guests to zero.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsPurging(true);
        try {
          const snap = await getDocs(collection(db, 'users'));
          const adminEmails = ['rehaanoffical77@gmail.com', 'capcutrehaan@gmail.com', 'rehaanhacker4@gmai.com'];
          for (const d of snap.docs) {
            if (d.data().role !== 'admin' && !adminEmails.includes(d.data().email || '')) {
              await deleteDoc(doc(db, 'users', d.id));
            }
          }
          alert('All customer profiles cleared successfully.');
        } catch (error: any) {
          console.error("Error clearing guests:", error);
          alert('Failed to clear guests: ' + (error.message || String(error)));
        } finally {
          setIsPurging(false);
        }
      }
    });
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
    <div className="h-screen bg-[#F8FAFC] flex overflow-hidden relative pb-16 md:pb-0">
      {/* SaaS Sidebar (Hidden on mobile, flex on desktop) */}
      <aside className="hidden md:flex w-24 bg-white border-r border-slate-200 flex-col items-center py-10 z-50 shrink-0">
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

      {/* Modern SaaS Bottom Navigation Bar for Mobile Viewports */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex justify-around items-center py-2 px-1 shadow-2xl">
        {[
          { id: 'orders', label: 'Orders', icon: ShoppingBag },
          { id: 'menu', label: 'Menu', icon: Utensils },
          { id: 'customers', label: 'Guests', icon: Users },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all relative flex-1 min-w-0",
                isActive ? "text-indigo-600 scale-[1.03]" : "text-slate-400"
              )}
            >
              <Icon size={18} className={isActive ? "stroke-[2.5]" : "stroke-[1.5]"} />
              <span className="text-[9px] font-extrabold uppercase tracking-widest leading-none text-center truncate w-full">
                {item.label}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="activeBottomTab" 
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-600 rounded-full" 
                />
              )}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header (Fully Responsive height and paddings) */}
        <header className="bg-white border-b border-slate-200 shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-10 h-20 sm:h-24 flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight italic uppercase">{activeTab} Panel</h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">Operational Control Center</p>
            </div>
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900">Restaurant Status</p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isRestaurantOpen ? "bg-green-500" : "bg-red-500")} />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {isRestaurantOpen ? "Accepting Orders" : "Kitchen Closed"}
                  </span>
                </div>
              </div>
              
              {/* Logout Button directly accessible on Mobile Header */}
              <button 
                onClick={handleLogout}
                className="md:hidden w-9 h-9 sm:w-10 sm:h-10 bg-red-50 hover:bg-red-100 border border-red-100 text-red-500 rounded-xl flex items-center justify-center transition-colors active:scale-95 shrink-0"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>

              <div className="w-9 h-9 sm:w-10 sm:h-10 border-2 border-slate-100 rounded-full flex items-center justify-center bg-slate-50 text-slate-900 font-bold text-xs shadow-sm shrink-0">
                R
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-10 pb-28 sm:pb-10 custom-scrollbar">
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

                {/* Desktop View: Wide Grid */}
                <div className="hidden md:block overflow-x-auto">
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

                {/* Mobile View: High-Density Touch Cards List */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 font-extrabold uppercase tracking-wider text-[10px] italic">
                      No matching orders in feed
                    </div>
                  ) : (
                    filteredOrders.map((order) => (
                      <div key={order.id} className="p-4 space-y-3.5 hover:bg-slate-50/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-black text-slate-900 tracking-tighter"># {order.id.slice(-6).toUpperCase()}</span>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide truncate max-w-[180px]">{order.userEmail}</p>
                          </div>
                          
                          <div className={cn(
                            "inline-flex px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border items-center gap-1 shrink-0",
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

                        {/* Order Items Summary */}
                        <div className="bg-slate-50/65 rounded-xl p-3 border border-slate-100/50">
                          <p className="text-xs font-bold text-slate-700 italic leading-relaxed">{getOrderItemsList(order)}</p>
                          <p className="text-xs font-black text-indigo-600 mt-1.5">₹{order.total?.toFixed(2)}</p>
                        </div>

                        {/* Order Logistics */}
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input 
                              type="text"
                              defaultValue={order.deliveryPartnerPhone || ''} 
                              placeholder="Pilot Phone"
                              onBlur={(e) => updateOrderInfo(order.id, { deliveryPartnerPhone: e.target.value })} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-[10px] font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-350" 
                            />
                            {order.deliveryPartnerPhone && (
                              <a 
                                href={`tel:${order.deliveryPartnerPhone}`} 
                                className="absolute right-2 px-1 top-1/2 -translate-y-1/2 text-indigo-600"
                                title="Call Pilot"
                              >
                                <Phone size={11} />
                              </a>
                            )}
                          </div>
                          <CancellationTimer order={order} />
                        </div>

                        {/* Interactive Buttons with premium tactile padding */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-dashed border-slate-100">
                          <button 
                            onClick={() => setSelectedOrder(order)} 
                            className="px-4 py-2 bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0"
                          >
                            Details
                          </button>

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
                              className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-1 shadow-md shadow-indigo-100 shrink-0"
                            >
                              <CheckCircle2 size={11} />
                              Next Stage
                            </button>
                          )}

                          {['received', 'preparing'].includes(order.status) && (
                            <button 
                              onClick={() => cancelOrder(order.id)}
                              className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shrink-0"
                              title="Cancel Order"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'menu' ? (
             <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col lg:flex-row justify-between lg:items-center bg-white p-4 sm:p-8 rounded-[24px] sm:rounded-[40px] border border-gray-100 shadow-sm gap-4 sm:gap-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 italic uppercase">Culinary Menu</h3>
                  <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 sm:mt-1">Manage dishes and availability</p>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
                  <div className="relative group min-w-0 sm:min-w-[200px] flex-1">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Search dishes..." 
                      value={menuSearchQuery}
                      onChange={(e) => setMenuSearchQuery(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all w-full"
                    />
                  </div>
                  <div className="relative h-10 min-w-0 sm:min-w-[140px] flex-1 sm:flex-initial">
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
                  <div className="relative h-10 min-w-0 sm:min-w-[120px] flex-1 sm:flex-initial">
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
                    className="h-10 bg-gray-900 text-white px-6 rounded-xl font-black italic text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-gray-900/10 flex items-center justify-center gap-2 shrink-0"
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
            <div className="max-w-7xl mx-auto bg-white rounded-[24px] sm:rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 sm:p-10 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-transparent">
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 italic uppercase">VIP Guests</h3>
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 sm:mt-1">Total Audience Reach</p>
              </div>
              <div className="divide-y divide-gray-50">
                {customers.sort((a, b) => ((b as any).role === 'admin' ? 1 : -1)).map(c => (
                  <div key={c.id} className="p-5 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-4 sm:gap-5">
                      <div className={cn(
                        "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white text-lg font-black italic shadow-lg shrink-0",
                        (c as any).role === 'admin' ? "bg-indigo-600 shadow-indigo-500/10" : "bg-red-500 shadow-red-500/10"
                      )}>
                        {c.email?.[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                          <p className="font-black text-gray-900 italic tracking-tight text-base sm:text-lg leading-none truncate max-w-[200px]">{c.displayName || c.name || 'Anonymous Guest'}</p>
                          {(c as any).role === 'admin' && (
                            <span className="bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-md border border-indigo-100 tracking-[0.2em] shrink-0">Management</span>
                          )}
                        </div>
                        <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1 truncate max-w-[220px]">{c.email}</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right pl-16 sm:pl-0">
                       <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1.5">Contact Detail</p>
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

                {/* Database Maintenance Section */}
                <div className="border border-slate-200 rounded-[32px] p-6 text-left space-y-4">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Database & Test Data</h4>
                    <p className="text-[10px] text-slate-400 leading-normal">Manage, clean, and clear diagnostic test entries added for demonstration purposes.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2.5">
                    <button 
                      onClick={clearAllOrders}
                      disabled={isPurging}
                      className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl py-3 px-4 text-xs font-black text-left flex items-center justify-between transition-colors disabled:opacity-50"
                    >
                      <span>Clear All Orders & Reset Revenue</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>

                    <button 
                      onClick={resetSoldOutItems}
                      disabled={isPurging}
                      className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl py-3 px-4 text-xs font-black text-left flex items-center justify-between transition-colors disabled:opacity-50"
                    >
                      <span>Reset Sold Out Items (Back to Available)</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>

                    <button 
                      onClick={clearGuests}
                      disabled={isPurging}
                      className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl py-3 px-4 text-xs font-black text-left flex items-center justify-between transition-colors disabled:opacity-50"
                    >
                      <span>Clear Customer Guest Profiles</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>

                    <button 
                      onClick={purgeAllTestData}
                      disabled={isPurging}
                      className="w-full bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-2xl py-3.5 px-4 text-xs font-black uppercase tracking-wider text-center flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      {isPurging ? 'Purging is in progress...' : 'Purge All Diagnostic / Test Data'}
                    </button>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingMenuItem(false)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col border border-slate-100"
            >
              <form onSubmit={handleAddMenuItem} className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-sm shadow-slate-900/10">
                      <Sparkles size={18} className="text-amber-400 fill-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 italic tracking-tight uppercase leading-none px-1">New Creation</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic px-1">Add to culinary library</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsAddingMenuItem(false)}
                    className="w-10 h-10 bg-white border border-slate-150 rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all active:scale-95"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Main Content Area: Split Columns on Medium/Large Screens */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Column: Live Sensory Card Preview & Stock Generator */}
                    <div className="lg:col-span-5 lg:sticky lg:top-0 space-y-6">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-indigo-600 tracking-[0.2em] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                          Live Sensory Twin
                        </span>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Real-time Customer Card</h3>
                      </div>

                      {/* Customer Card Live Simulation */}
                      <div className="bg-slate-50 border border-slate-100 rounded-[28px] p-4 flex justify-center items-center relative overflow-hidden">
                        <div className="w-full max-w-[280px] bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 transition-all duration-300 flex flex-col relative">
                          <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-slate-100">
                            {newMenuItem.image ? (
                              <img 
                                src={newMenuItem.image} 
                                alt={newMenuItem.name || "Preview"} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-300 bg-slate-50/50">
                                <Utensils size={36} className="mb-2 stroke-[1.5]" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">No image chosen</span>
                              </div>
                            )}
                            <div className="absolute top-2 left-2 bg-green-600 text-white text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 shadow-lg z-10">
                              4.8 <Star size={8} fill="currentColor" />
                            </div>
                            
                            <button 
                              type="button"
                              className="absolute top-2 right-2 p-1.5 rounded-xl bg-white/90 text-red-500 scale-100 z-10 backdrop-blur-md shadow-sm"
                            >
                              <Heart size={14} fill="currentColor" />
                            </button>
                          </div>

                          <div className="p-3.5 flex flex-col flex-1 min-w-0">
                            <h3 className="font-extrabold text-slate-900 text-sm leading-tight truncate">
                              {newMenuItem.name || "Premium Dish Title"}
                            </h3>
                            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-0.5 mb-1.5">
                              {newMenuItem.category}
                            </p>
                            <p className="text-slate-500 text-[11px] line-clamp-2 leading-relaxed mb-3 flex-1 min-h-[32px]">
                              {newMenuItem.description || "Formulate an enchanting description for this dish detailing its exquisite flavors, organic ingredients and culinary mastery."}
                            </p>

                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                              <span className="font-black text-slate-950 text-sm tracking-tight">
                                ₹{newMenuItem.price || "---"}
                              </span>
                              <button 
                                type="button" 
                                className="px-4 py-1 rounded-lg bg-white text-green-600 border border-slate-200 hover:bg-slate-50 font-black uppercase text-[10px]"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stock Library Presets for Instant Configuration */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Info size={12} className="text-slate-400" />
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Culinary Stock Presets</h4>
                        </div>
                        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2">
                          {[
                            { name: 'Burger', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600', label: '🍔 Burger', category: 'Main Course' },
                            { name: 'Pasta', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=600', label: '🍝 Pasta', category: 'Main Course' },
                            { name: 'Samosa', url: 'https://images.unsplash.com/photo-1541014741259-df5290db5785?auto=format&fit=crop&q=80&w=600', label: '🥗 Starter', category: 'Starters' },
                            { name: 'Dessert', url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&q=80&w=600', label: '🍰 Dessert', category: 'Desserts' },
                            { name: 'Cocktail', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=600', label: '🍹 Drink', category: 'Beverages' },
                          ].map(preset => (
                            <button
                              type="button"
                              key={preset.name}
                              onClick={() => setNewMenuItem(prev => ({ ...prev, image: preset.url, category: preset.category }))}
                              className={cn(
                                "py-2 px-1 text-[10px] font-black rounded-xl border transition-all text-center flex flex-col justify-center items-center gap-0.5",
                                newMenuItem.image === preset.url 
                                  ? "bg-slate-900 border-slate-950 text-white scale-[1.03]" 
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                              )}
                            >
                              <span>{preset.label}</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-400 text-center font-medium leading-tight">Clicking loads a highly premium food photo directly.</p>
                      </div>
                    </div>

                    {/* Right Column: Formulation Details Form */}
                    <div className="lg:col-span-7 space-y-6 sm:space-y-8">
                      {/* Image Upload Zone */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Dish Aspect & Shot</label>
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-[16/9] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-100/50 hover:border-indigo-400 transition-all overflow-hidden relative group"
                        >
                          {newMenuItem.image ? (
                            <>
                              <img src={newMenuItem.image} alt="Upload Preview" className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity text-white">
                                <Camera size={24} className="text-white" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Replace Photo</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover:text-indigo-500 group-hover:border-indigo-200 transition-all">
                                <Camera size={20} />
                              </div>
                              <div className="text-center">
                                <p className="text-xs font-black text-slate-800 italic tracking-tight">Upload Custom Product Shot</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 italic">Drag & drop or Click to browse (Max 3MB)</p>
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
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Name Input */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Dish Title</label>
                          <div className="relative group">
                            <input 
                              required
                              value={newMenuItem.name}
                              onChange={e => setNewMenuItem(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-100 rounded-[18px] px-5 py-3.5 font-black italic outline-none focus:bg-white focus:border-slate-900 focus:shadow-sm transition-all text-sm placeholder:text-slate-350"
                              placeholder="e.g., Signature Sautéed Lobster"
                            />
                          </div>
                        </div>

                        {/* Price Input */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Valuation (₹)</label>
                          <div className="relative group">
                            <input 
                              required
                              type="number"
                              value={newMenuItem.price}
                              onChange={e => setNewMenuItem(prev => ({ ...prev, price: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-100 rounded-[18px] px-5 py-3.5 font-black italic outline-none focus:bg-white focus:border-slate-900 focus:shadow-sm transition-all text-sm placeholder:text-slate-350"
                              placeholder="299"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Category Input */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Menu Classification</label>
                          <div className="relative">
                            <select 
                              value={newMenuItem.category}
                              onChange={e => setNewMenuItem(prev => ({ ...prev, category: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-100 rounded-[18px] px-5 py-3.5 font-black italic outline-none focus:bg-white focus:border-slate-900 focus:shadow-sm transition-all text-sm appearance-none cursor-pointer text-slate-700"
                            >
                              <option>Main Course</option>
                              <option>Starters</option>
                              <option>Breads</option>
                              <option>Desserts</option>
                              <option>Beverages</option>
                            </select>
                            <Filter size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        {/* Premium Tag Badge helper */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Menu Accent Feature</label>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {['Chef Special', 'Spicy', 'Gluten Free'].map((tag) => (
                              <button
                                type="button"
                                key={tag}
                                onClick={() => {
                                  if (!newMenuItem.description.includes(tag)) {
                                    setNewMenuItem(prev => ({
                                      ...prev,
                                      description: prev.description 
                                        ? `[${tag}] ${prev.description}` 
                                        : `[${tag}] `
                                    }));
                                  }
                                }}
                                className="px-3 py-1.5 rounded-full border border-dashed border-slate-200 text-slate-500 hover:bg-slate-50 text-[10px] font-bold transition-all"
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Culinary Narrative Description TextArea */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center ml-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Culinary Narrative</label>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{newMenuItem.description.length} / 250</span>
                        </div>
                        <textarea 
                          required
                          maxLength={250}
                          value={newMenuItem.description}
                          onChange={e => setNewMenuItem(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-100 rounded-[24px] px-5 py-3.5 font-bold outline-none focus:bg-white focus:border-slate-900 focus:shadow-sm transition-all text-sm h-28 resize-none placeholder:text-slate-350 custom-scrollbar"
                          placeholder="Describe the magical flavors, ingredients used, preparation technique, and culinary sensations of this formulation..."
                        />
                      </div>

                      {submitError && (
                        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-[18px] text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                          <Info size={16} className="shrink-0 mt-0.5 text-red-500" />
                          <div className="space-y-1">
                            <p className="font-extrabold uppercase tracking-wide">Deployment Failed</p>
                            <p className="opacity-95 leading-relaxed font-medium">{submitError}</p>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* Footer Controls */}
                <div className="p-6 sm:p-8 bg-slate-50 shrink-0 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                  <div className="hidden sm:flex items-center gap-2 text-slate-400">
                    <Info size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Instantly synchronized with Firebase Firestore database</span>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button 
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsAddingMenuItem(false)}
                      className="flex-1 sm:flex-initial px-6 py-3.5 border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 rounded-[18px] font-black italic text-xs transition-all uppercase tracking-widest disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-3 sm:flex-initial bg-slate-900 text-white px-8 py-3.5 rounded-[18px] font-black italic text-xs shadow-md hover:bg-black transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Deploying...
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          Deploy New Dish
                        </>
                      )}
                    </button>
                  </div>
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
