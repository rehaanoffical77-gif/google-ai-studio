import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { 
  ChevronRight,
  Star,
  ShieldCheck,
  Bell,
  Trash2,
  Plus,
  X,
  Map as MapIcon,
  ShoppingBag,
  Headset,
  Hexagon,
  Gift,
  Pencil,
  ChevronLeft,
  ClipboardList,
  Heart,
  MapPin,
  CreditCard,
  HelpCircle,
  Settings,
  LogOut,
  LogIn,
  Camera,
  CheckCircle2,
  Clock,
  Bike,
  Tag,
  Receipt,
  Download,
  Phone,
  Mail,
  Moon,
  Globe,
  Trash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDocs,
  limit
} from 'firebase/firestore';
import { updateProfile, deleteUser } from 'firebase/auth';
import { db, handleFirestoreError, auth } from '../lib/firebase';
import { cn } from '../lib/utils';

type View = 'main' | 'orders' | 'addresses' | 'payments' | 'offers' | 'favorites' | 'notifications' | 'billing' | 'support' | 'settings' | 'edit';

export default function Profile() {
  const { user, logout, login, loginWithEmail, signupWithEmail, resetPassword, loading: authLoading } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentView, setCurrentView] = useState<View>('main');
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  // Auth Form States
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Settings States
  const [settings, setSettings] = useState({
    push: true,
    sms: false,
    email: true,
    darkMode: false,
    language: 'English'
  });

  // Form States
  const [editName, setEditName] = useState(user?.displayName || '');
  const [editPhoto, setEditPhoto] = useState(user?.photoURL || '');
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to 0.7 quality to stay well under 1MB
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Str = reader.result as string;
        const compressed = await compressImage(base64Str);
        setEditPhoto(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      if (location.state?.mode) {
        setAuthMode(location.state.mode);
      }
      return;
    }

    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')), 
      (snap) => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, 'get', 'orders')
    );

    const unsubAddr = onSnapshot(
      query(collection(db, 'addresses'), where('userId', '==', user.uid)), 
      (snap) => {
        setAddresses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, 'get', 'addresses')
    );

    const unsubPay = onSnapshot(
      query(collection(db, 'payments'), where('userId', '==', user.uid)), 
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, 'get', 'payments')
    );

    const unsubFav = onSnapshot(
      query(collection(db, 'favorites'), where('userId', '==', user.uid)), 
      (snap) => {
        setFavorites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, 'get', 'favorites')
    );

    const unsubUser = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);
          if (data.phone) setEditPhone(data.phone);
          if (data.displayName) setEditName(data.displayName);
        }
      },
      (error) => handleFirestoreError(error, 'get', `users/${user.uid}`)
    );

    return () => {
      unsubOrders();
      unsubAddr();
      unsubPay();
      unsubFav();
      unsubUser();
    };
  }, [user, navigate, authLoading]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSaving(true);
    try {
      if (authMode === 'login') {
        await loginWithEmail(authEmail, authPass);
      } else if (authMode === 'signup') {
        if (!authName || !authPhone) {
          throw new Error('Name and Phone are required');
        }
        await signupWithEmail(authEmail, authPass, authName, authPhone);
      } else {
        await resetPassword(authEmail);
        alert('Password reset link sent to your email.');
        setAuthMode('login');
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (selectedOrder) setSelectedOrder(null);
    else if (currentView !== 'main') setCurrentView('main');
    else navigate('/');
  };

  const reorder = (items: any[]) => {
    items.forEach(item => addToCart(item));
    navigate('/');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      // Only update auth profile with small strings. photoURL limit is 2048 chars.
      // Base64 images (starting with 'data:') are usually much longer.
      const authUpdate: any = { displayName: editName };
      // Check if photo URL is reasonably sized for Auth profile (limited to 2048 chars)
      if (editPhoto && !editPhoto.startsWith('data:') && editPhoto.length < 2000) {
        authUpdate.photoURL = editPhoto;
      }
      await updateProfile(user, authUpdate);

      const userDocRef = doc(db, 'users', user.uid);
      const userPayload = {
        displayName: editName,
        photoURL: editPhoto,
        phone: editPhone,
        email: user.email,
        updatedAt: new Date()
      };

      try {
        await updateDoc(userDocRef, userPayload);
      } catch (err: any) {
        // If doc doesn't exist, use setDoc or just handle addDoc
        if (err.code === 'not-found') {
          const { setDoc } = await import('firebase/firestore');
          await setDoc(userDocRef, userPayload, { merge: true });
        } else {
          throw err;
        }
      }
      setCurrentView('main');
    } catch (err: any) { 
      console.error('Profile Update Error:', err);
      // If still too large, alert user
      if (err.message?.includes('exceeds the maximum allowed size')) {
        alert('Image is too large. Please try a smaller image.');
      }
    } finally { 
      setIsSaving(false); 
    }
  };

  const setDefaultAddress = async (id: string) => {
    try {
      const updates = addresses.map(async (a) => {
        const path = `addresses/${a.id}`;
        try {
          await updateDoc(doc(db, 'addresses', a.id), { isDefault: a.id === id });
        } catch (err) {
          handleFirestoreError(err, 'write', path);
        }
      });
      await Promise.all(updates);
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'out-for-delivery': return <Bike className="text-blue-500" size={16} />;
      case 'preparing': return <Clock className="text-orange-500" size={16} />;
      default: return <Clock className="text-gray-400" size={16} />;
    }
  };

  // Views rendering ...
  const renderOrders = () => (
    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="px-4 space-y-4">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2 px-1">Order History</h3>
      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 italic text-gray-400">No orders yet.</div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 space-y-4">
            <div className="flex justify-between items-start">
              <div onClick={() => setSelectedOrder(order)} className="cursor-pointer">
                <p className="font-black text-gray-900 leading-tight">Order #{order.id.slice(-6).toUpperCase()}</p>
                <p className="text-[11px] text-gray-400 font-bold uppercase mt-0.5">
                  {order.createdAt?.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5",
                order.status === 'delivered' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
              )}>
                {getStatusIcon(order.status)}
                {order.status.replace(/-/g, ' ')}
              </div>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-50">
              <span className="text-lg font-black text-gray-950">₹{order.total}</span>
              <button 
                onClick={() => reorder(order.items)}
                className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-600 transition-colors"
              >
                Reorder
              </button>
            </div>
          </div>
        ))
      )}
    </motion.div>
  );

  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    street: '',
    city: 'MANDAMARRI',
    state: 'TELANGANA',
    zipCode: '',
    zone: '1st Zone',
    instructions: ''
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  const validateAddress = () => {
    const errors: Record<string, string> = {};
    if (!addressForm.street.trim()) errors.street = 'Street address is required';
    if (!addressForm.city.trim()) errors.city = 'City is required';
    if (!addressForm.state.trim()) errors.state = 'State is required';
    if (!addressForm.zipCode.trim() || !/^\d{6}$/.test(addressForm.zipCode)) errors.zipCode = 'Valid 6-digit PIN code is required';
    if (!addressForm.zone) errors.zone = 'Zone is required';
    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateAddress()) return;

    try {
      if (editingAddressId) {
        await updateDoc(doc(db, 'addresses', editingAddressId), {
          ...addressForm,
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'addresses'), {
          userId: user.uid,
          ...addressForm,
          isDefault: addresses.length === 0,
          createdAt: new Date()
        });
      }
      setIsAddingAddress(false);
      setEditingAddressId(null);
      setAddressForm({ label: 'Home', street: '', city: 'MANDAMARRI', state: 'TELANGANA', zipCode: '', zone: '1st Zone', instructions: '' });
    } catch (err) {
      handleFirestoreError(err, 'write', 'addresses');
    }
  };

  const startEditAddress = (addr: any) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      label: addr.label,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zipCode: addr.zipCode,
      zone: addr.zone || '1st Zone',
      instructions: addr.instructions || ''
    });
    setIsAddingAddress(true);
  };

  const renderAddresses = () => (
    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="px-4 space-y-6">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Delivery Addresses</h3>
        {!isAddingAddress && (
          <button 
            onClick={() => setIsAddingAddress(true)} 
            className="bg-red-500 text-white font-black text-[10px] uppercase px-4 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-red-100 hover:bg-red-600 transition-all active:scale-95"
          >
            <Plus size={14} /> Add New
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAddingAddress && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-[40px] p-6 border border-gray-100 shadow-xl mb-6">
              <form onSubmit={handleSaveAddress} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Label (Home, Work, etc.)</label>
                    <input 
                      type="text" 
                      value={addressForm.label}
                      onChange={e => setAddressForm({...addressForm, label: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:bg-white outline-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Street Address</label>
                    <input 
                      type="text" 
                      placeholder="House No, Building, Area"
                      value={addressForm.street}
                      onChange={e => setAddressForm({...addressForm, street: e.target.value})}
                      className={cn("w-full bg-gray-50 border rounded-2xl px-5 py-3.5 text-sm font-bold focus:bg-white outline-none", addressErrors.street ? "border-red-300" : "border-gray-100")}
                    />
                    {addressErrors.street && <p className="text-[10px] text-red-500 font-bold px-1 italic">{addressErrors.street}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">City</label>
                    <input 
                      type="text" 
                      placeholder="MANDAMARRI"
                      value={addressForm.city}
                      readOnly
                      className={cn("w-full bg-gray-100 border rounded-2xl px-5 py-3.5 text-sm font-black text-gray-400 outline-none cursor-not-allowed")}
                    />
                    <p className="text-[9px] font-bold text-gray-400 px-1 italic">Location locked to Mandamarri</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">State</label>
                    <input 
                      type="text" 
                      value={addressForm.state}
                      readOnly
                      className={cn("w-full bg-gray-100 border rounded-2xl px-5 py-3.5 text-sm font-black text-gray-400 outline-none cursor-not-allowed")}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Pincode (6 digits)</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      value={addressForm.zipCode}
                      onChange={e => setAddressForm({...addressForm, zipCode: e.target.value.replace(/\D/g, '')})}
                      className={cn("w-full bg-gray-50 border rounded-2xl px-5 py-3.5 text-sm font-bold focus:bg-white outline-none", addressErrors.zipCode ? "border-red-300" : "border-gray-100")}
                    />
                    {addressErrors.zipCode && <p className="text-[10px] text-red-500 font-bold px-1 italic">{addressErrors.zipCode}</p>}
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Delivery Zone</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['1st Zone', '2nd Zone', '3rd Zone'].map((z) => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => setAddressForm({...addressForm, zone: z})}
                          className={cn(
                            "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all",
                            addressForm.zone === z 
                              ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-100" 
                              : "bg-gray-50 border-gray-100 text-gray-400 hover:border-red-200"
                          )}
                        >
                          {z}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-gray-900 text-white rounded-[20px] py-4 font-black uppercase text-xs tracking-widest shadow-xl">Save Address</button>
                  <button type="button" onClick={() => setIsAddingAddress(false)} className="px-6 bg-gray-100 text-gray-400 rounded-[20px] font-black uppercase text-xs tracking-widest">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {addresses.map((addr) => (
        <div key={addr.id} className={cn("bg-white rounded-[40px] p-6 shadow-sm border transition-all hover:shadow-md", addr.isDefault ? "border-red-200 ring-4 ring-red-50/50 scale-[1.02]" : "border-gray-100")}>
          <div className="flex items-start justify-between">
            <div className="flex gap-5">
              <div className={cn("w-14 h-14 rounded-[22px] flex items-center justify-center shrink-0 shadow-inner", addr.isDefault ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400")}>
                <MapPin size={28} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <p className="font-black text-gray-900 text-lg italic tracking-tight">{addr.label}</p>
                  {addr.isDefault && <span className="bg-red-50 text-red-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-100">Default</span>}
                  <span className="bg-gray-50 text-gray-400 text-[9px] font-black px-2 py-0.5 rounded-md border border-gray-100 uppercase tracking-tighter">{addr.zone || 'Zone 1'}</span>
                </div>
                <p className="text-sm text-gray-500 font-bold leading-relaxed mt-2">{addr.street}</p>
                <p className="text-xs text-gray-400 font-bold uppercase mt-1">{addr.city}, {addr.state} • {addr.zipCode}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-6 pt-5 border-t border-gray-50">
            {!addr.isDefault && (
              <button onClick={() => setDefaultAddress(addr.id)} className="text-[10px] font-black uppercase text-gray-400 hover:text-red-500 transition-colors">Set Default</button>
            )}
            <button onClick={() => startEditAddress(addr)} className="text-[10px] font-black uppercase text-gray-400 hover:text-red-500 transition-colors">Edit</button>
            <button 
              onClick={async () => {
                const path = `addresses/${addr.id}`;
                try {
                  await deleteDoc(doc(db, 'addresses', addr.id));
                } catch (err) {
                  handleFirestoreError(err, 'write', path);
                }
              }} 
              className="text-[10px] font-black uppercase text-red-300 hover:text-red-600 ml-auto"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      {addresses.length === 0 && !isAddingAddress && (
        <div className="bg-white rounded-[40px] p-20 text-center border-2 border-dashed border-gray-100">
          <MapPin size={48} className="mx-auto text-gray-100 mb-4" />
          <p className="text-gray-300 font-black uppercase tracking-widest text-xs italic">No addresses saved yet</p>
        </div>
      )}
    </motion.div>
  );

  const renderFavorites = () => (
    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="px-4 grid grid-cols-1 gap-4">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2 px-1">Favorite Dishes</h3>
      {favorites.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center text-gray-300 italic font-bold">No favorites yet</div>
      ) : (
        favorites.map((fav) => (
          <div key={fav.id} className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 flex items-center gap-4">
            <img src={fav.image || null} alt="" className="w-20 h-20 rounded-2xl object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-gray-900 truncate">{fav.name}</h4>
              <p className="text-lg font-black text-red-500">₹{fav.price}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => reorder([{ id: fav.itemId, name: fav.name, price: fav.price, quantity: 1 }])}
                className="bg-gray-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase"
              >
                Order
              </button>
              <button 
                onClick={async () => {
                  const path = `favorites/${fav.id}`;
                  try {
                    await deleteDoc(doc(db, 'favorites', fav.id));
                  } catch (err) {
                    handleFirestoreError(err, 'write', path);
                  }
                }} 
                className="text-red-300 p-2 hover:text-red-500 self-center transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))
      )}
    </motion.div>
  );

  const renderOffers = () => (
    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="px-4 space-y-4">
      <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Your Balance</p>
          <p className="text-4xl font-black mb-1">₹450.00</p>
          <p className="text-xs font-bold opacity-90">Food Junction Cash & Rewards</p>
        </div>
        <Clock size={120} className="absolute right-[-20px] bottom-[-20px] opacity-10" />
      </div>
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] pt-4 px-1">Available Coupons</h3>
      {[
        { code: 'WELCOM340', desc: '40% OFF on first 3 orders', valid: 'Ends in 2 days' },
        { code: 'JUNCTION50', desc: 'Flat ₹50 OFF on orders above ₹499', valid: 'Valid for today' }
      ].map((offer, i) => (
        <div key={i} className="bg-white rounded-3xl p-5 border border-dashed border-red-200 flex items-center justify-between group">
          <div className="space-y-1">
            <p className="font-black text-gray-900 text-lg group-hover:text-red-500 transition-colors uppercase italic tracking-tighter">{offer.code}</p>
            <p className="text-xs text-gray-500 font-medium">{offer.desc}</p>
            <p className="text-[10px] text-red-400 font-bold uppercase">{offer.valid}</p>
          </div>
          <button className="text-red-500 text-xs font-black uppercase px-4 py-2 bg-red-50 rounded-xl hover:bg-red-100">Apply</button>
        </div>
      ))}
    </motion.div>
  );

  const renderSupport = () => (
    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="px-4 space-y-4">
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
        <h3 className="text-xl font-black text-gray-900 mb-6 italic tracking-tight">Need help with something?</h3>
        <div className="grid grid-cols-2 gap-4">
          <button className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-red-50 hover:text-red-600 transition-all group">
            <Mail className="text-gray-400 group-hover:text-red-500" />
            <span className="text-[11px] font-black uppercase">Email Us</span>
          </button>
          <button className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-red-50 hover:text-red-600 transition-all group">
            <Phone className="text-gray-400 group-hover:text-red-500" />
            <span className="text-[11px] font-black uppercase">Call Us</span>
          </button>
        </div>
      </div>
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] pt-4 px-1">Common Questions</h3>
      {[
        "Where is my order?",
        "How can I cancel my order?",
        "Is there a delivery fee?",
        "How do I use my coupon?"
      ].map((q, i) => (
        <button key={i} className="w-full bg-white px-6 py-4 rounded-2xl flex items-center justify-between border border-gray-50 text-left hover:border-red-100 transition-colors">
          <span className="text-sm font-bold text-gray-700">{q}</span>
          <Plus size={18} className="text-gray-300" />
        </button>
      ))}
    </motion.div>
  );

  const renderSettings = () => (
    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="px-4 space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <h3 className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400 bg-gray-50/50">App Experience</h3>
        <div className="divide-y divide-gray-50">
          <button onClick={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50">
            <div className="flex items-center gap-4">
              <Moon size={20} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-700">Dark Mode</span>
            </div>
            <div className={cn("w-10 h-6 rounded-full p-1 transition-colors", settings.darkMode ? "bg-red-500" : "bg-gray-200")}>
              <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", settings.darkMode ? "translate-x-4" : "")} />
            </div>
          </button>
          <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50">
            <div className="flex items-center gap-4">
              <Globe size={20} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-700">Language</span>
            </div>
            <span className="text-xs font-black text-red-500 uppercase">{settings.language}</span>
          </button>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <h3 className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400 bg-gray-50/50">Legal & Privacy</h3>
        <div className="divide-y divide-gray-50">
          <button className="w-full px-6 py-4 text-left text-sm font-bold text-gray-700 hover:bg-gray-50">Privacy Policy</button>
          <button className="w-full px-6 py-4 text-left text-sm font-bold text-gray-700 hover:bg-gray-50">Terms of Service</button>
          <button className="w-full px-6 py-4 text-left text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-2">
            <ShieldCheck size={18} />
            Delete Account
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderPayments = () => (
    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="px-4 space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Payment Methods</h3>
        <button 
          onClick={async () => {
            const path = 'payments';
            try {
              await addDoc(collection(db, path), { 
                userId: user?.uid, 
                type: 'card', 
                provider: 'Visa', 
                lastFour: '4242', 
                expiry: '12/28',
                isDefault: false 
              });
            } catch (err) {
              handleFirestoreError(err, 'write', path);
            }
          }} 
          className="text-red-500 font-black text-xs uppercase flex items-center gap-1"
        >
          <Plus size={16} /> Add Card
        </button>
      </div>
      {payments.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center text-gray-300 italic font-bold">No saved payments</div>
      ) : (
        payments.map((pay) => (
          <div key={pay.id} className={cn("bg-white rounded-3xl p-5 shadow-sm border transition-all", pay.isDefault ? "border-red-200 ring-2 ring-red-50" : "border-gray-50")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", pay.type === 'card' ? "bg-blue-50 text-blue-500" : "bg-purple-50 text-purple-500")}>
                  <CreditCard size={24} />
                </div>
                <div>
                  <p className="font-black text-gray-900">{pay.provider} •••• {pay.lastFour}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Expires {pay.expiry}</p>
                </div>
              </div>
              <button 
                onClick={async () => {
                  const path = `payments/${pay.id}`;
                  try {
                    await deleteDoc(doc(db, 'payments', pay.id));
                  } catch (err) {
                    handleFirestoreError(err, 'write', path);
                  }
                }}
                className="text-red-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))
      )}
    </motion.div>
  );

  const renderBilling = () => (
    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="px-4 space-y-4">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2 px-1">Past Invoices & Receipts</h3>
      {orders.filter(o => o.status === 'delivered').length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center text-gray-300 italic font-bold">No invoices available</div>
      ) : (
        orders.filter(o => o.status === 'delivered').map((order) => (
          <div key={order.id} className="bg-white rounded-3xl p-5 border border-gray-50 flex items-center justify-between group hover:border-red-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-500 transition-colors">
                <Receipt size={24} />
              </div>
              <div>
                <p className="font-black text-gray-900 text-sm">₹{order.total} • Order #{order.id.slice(-6).toUpperCase()}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{order.createdAt?.toDate().toLocaleDateString()}</p>
              </div>
            </div>
            <button className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
              <Download size={18} />
            </button>
          </div>
        ))
      )}
    </motion.div>
  );

  const renderMain = () => (
    <div className="animate-in fade-in slide-in-from-bottom-5 duration-700 bg-white">
      {/* ── Header ── */}
      <section className="bg-gradient-to-br from-[#ff2a2a] to-[#e8001e] pt-16 pb-20 px-6 relative overflow-hidden">
        {/* Navigation Icons */}
        <div className="absolute top-5 left-5 right-5 flex items-center justify-between z-30">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 flex items-center justify-center text-white/90 hover:text-white transition-colors"
          >
            <ChevronLeft size={28} strokeWidth={1.5} />
          </button>
          <button 
            onClick={() => setCurrentView('settings')}
            className="w-10 h-10 flex items-center justify-center text-white/90 hover:text-white transition-colors"
          >
            <Settings size={28} strokeWidth={1.5} />
          </button>
        </div>

        {/* Bag Watermark */}
        <div className="absolute right-4 top-14 opacity-[0.18] pointer-events-none transform rotate-12">
          <ShoppingBag size={120} strokeWidth={1} className="text-white" />
        </div>

        {/* Profile Row */}
        <div className="flex items-center gap-5 relative z-10">
          <div className="relative">
            <div className="w-22 h-22 rounded-full bg-[#3b2a1a] flex items-center justify-center text-white text-3xl font-bold border-4 border-white/30 overflow-hidden shadow-xl">
              {(userData?.photoURL || user?.photoURL) ? (
                <img src={userData?.photoURL || user?.photoURL || null} alt="" className="w-full h-full object-cover" />
              ) : (
                (userData?.displayName || user?.displayName)?.[0] || 'U'
              )}
            </div>
            <button 
              onClick={() => setCurrentView('edit')}
              className="absolute bottom-1 right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all border border-gray-100"
            >
              <Pencil size={12} className="text-[#e8001e]" />
            </button>
          </div>
          <div className="flex-1 text-white">
            <h2 className="text-2xl font-bold tracking-tight leading-none mb-1.5">{userData?.displayName || user?.displayName || 'Feast Explorer'}</h2>
            <p className="text-sm font-bold text-white/90 mb-1">{userData?.email || user?.email}</p>
            <p className="text-sm font-bold text-white/90 mb-1.5">{userData?.phone || 'No phone linked'}</p>
            <div className="flex items-center gap-1.5 text-white/80">
              <MapPin size={12} />
              <p className="text-[11px] font-bold">Home, Mandamarri</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Body Body ── */}
      <div className="bg-white rounded-t-[32px] -mt-8 relative z-20 px-4 pt-8 pb-10">
        {/* Promo Banner */}
        <div className="bg-white border-[1.5px] border-gray-100 rounded-3xl p-5 flex items-center gap-4 mb-8 shadow-[0_2px_10px_rgba(0,0,0,0.05)] group">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-[#e8001e] shrink-0 group-hover:scale-110 transition-transform">
            <Gift size={32} strokeWidth={1.5} />
          </div>
          <div className="flex-1 font-bold text-gray-800 text-[15px] leading-snug">
            Flat 20% OFF on<br />your first order!
          </div>
          <button 
            onClick={() => navigate('/')}
            className="bg-gradient-to-br from-[#ff2a2a] to-[#e8001e] text-white px-5 py-3 rounded-full text-[12px] font-black uppercase tracking-widest shadow-lg shadow-red-100"
          >
            ORDER NOW
          </button>
        </div>

        {/* Menu List */}
        <div className="rounded-3xl border-[1.5px] border-gray-100 overflow-hidden divide-y divide-gray-50 mb-6">
          {[
            { id: 'orders', label: 'My Orders', icon: ShoppingBag },
            { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
            { id: 'payments', label: 'Payment Methods', icon: CreditCard },
            { id: 'offers', label: 'Offers & Rewards', icon: Tag },
            { id: 'favorites', label: 'Favorites', icon: Heart },
            { id: 'notifications', label: 'Notifications & Preferences', icon: Bell },
            { id: 'support', label: 'Help & Support', icon: Headset },
            { id: 'app_settings', label: 'App Settings', icon: Hexagon },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setCurrentView(item.id === 'app_settings' ? 'settings' : item.id as View)}
              className="w-full px-5 py-5 flex items-center justify-between group hover:bg-[#fff5f5] transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="text-[#e8001e] group-hover:scale-110 transition-transform">
                  <item.icon size={22} strokeWidth={1.5} />
                </div>
                <span className="text-[15px] font-bold text-gray-700">{item.label}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-red-500 transition-colors" />
            </button>
          ))}
        </div>

        {/* Logout Section */}
        <div className="rounded-3xl border-[1.5px] border-gray-100 overflow-hidden mb-8">
          <button 
            onClick={() => logout()}
            className="w-full px-5 py-5 flex items-center justify-between group hover:bg-[#fff5f5] transition-colors text-left"
          >
            <div className="flex items-center gap-4 text-[#e8001e]">
              <div className="group-hover:scale-110 transition-transform">
                <LogOut size={22} strokeWidth={1.5} />
              </div>
              <span className="text-[15px] font-bold">Logout</span>
            </div>
          </button>
        </div>

        {/* Developer Info */}
        <div className="text-center pb-8 pt-4 pointer-events-none opacity-40">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.4em] mb-0.5">Developer: Rehan</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider italic">Instagram: i_vnl_01</p>
        </div>
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return renderAuth();
  }

  return (
    <div className={cn("h-[100dvh] bg-white flex flex-col font-sans selection:bg-red-100 overflow-hidden", settings.darkMode && "dark bg-gray-900")}>
      {currentView !== 'main' && (
        <header className="shrink-0 bg-white/80 backdrop-blur-xl px-4 h-16 md:h-20 flex items-center gap-4 z-[60] border-b border-gray-50/50 shadow-sm">
          <button onClick={handleBack} className="p-3 bg-gray-50 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all">
            <ChevronLeft size={24} className="font-bold" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-serif tracking-tight capitalize italic text-gray-900">
              {selectedOrder ? 'Order Detail' : currentView.replace('main', 'Profile Center')}
            </h1>
          </div>
        </header>
      )}

      <main className={cn("flex-1 w-full relative overflow-y-auto no-scrollbar", currentView !== 'main' && "max-w-4xl mx-auto pb-20")}>
        <AnimatePresence mode="wait">
          {selectedOrder ? (
            <motion.div key="order-detail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="px-4 py-8 max-w-lg mx-auto">
              <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-gray-100 space-y-8 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 italic tracking-tight">Order Receipt</h3>
                    <p className="text-[11px] text-gray-400 font-bold uppercase mt-2 tracking-widest">ID: {selectedOrder.id.toUpperCase()}</p>
                  </div>
                  <div className="bg-green-50 px-4 py-1.5 rounded-2xl text-[10px] font-black text-green-600 uppercase border border-green-100">
                    {selectedOrder.status}
                  </div>
                </div>
                <div className="space-y-5">
                  {selectedOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center group">
                      <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-xs font-black text-gray-400 group-hover:bg-red-50 group-hover:text-red-500 transition-all">
                          {item.quantity}x
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold">Standard Portion</p>
                        </div>
                      </div>
                      <span className="font-black text-gray-900 text-sm">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-8 border-t border-dashed border-gray-200 flex justify-between items-center">
                  <span className="font-black text-gray-400 uppercase text-[10px] tracking-widest">Total Amount</span>
                  <span className="text-3xl font-black text-gray-950 tracking-tighter">₹{selectedOrder.total}</span>
                </div>
                <button className="w-full bg-gray-900 text-white py-4 rounded-[20px] font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 shadow-lg shadow-gray-200 hover:bg-black transition-all">
                  <Download size={18} /> Download Invoice
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key={currentView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {currentView === 'main' && renderMain()}
              {currentView === 'orders' && renderOrders()}
              {currentView === 'addresses' && renderAddresses()}
              {currentView === 'favorites' && renderFavorites()}
              {currentView === 'offers' && renderOffers()}
              {currentView === 'payments' && renderPayments()}
              {currentView === 'billing' && renderBilling()}
              {currentView === 'support' && renderSupport()}
              {currentView === 'settings' && renderSettings()}
              {currentView === 'edit' && handleEditView()}
              {/* Other views simulated for now */}
              {(currentView === 'notifications') && (
                <div className="px-4 py-20 text-center space-y-4">
                  <h3 className="text-xl font-black text-gray-900 italic tracking-tight">Coming Soon</h3>
                  <p className="text-sm text-gray-400 font-bold max-w-xs mx-auto">We're working hard to polish this section for you. Stay tuned!</p>
                  <button onClick={() => setCurrentView('main')} className="bg-red-50 text-red-500 px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest">Go Back</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Small Legal Footer */}
      <footer className="py-3 px-4 text-center border-t border-gray-50 bg-gray-50/5 shrink-0">
        <div className="flex gap-4 justify-center mb-1">
          <ShieldCheck className="text-gray-200" size={12} />
          <Settings className="text-gray-200" size={12} />
          <HelpCircle className="text-gray-200" size={12} />
        </div>
        <p className="text-[9px] font-black text-gray-200 uppercase tracking-[0.2em] italic">Food Junction Premium</p>
        <p className="text-[7px] font-bold text-gray-200 mt-0.5 uppercase tracking-tighter">v1.4.2</p>
      </footer>
    </div>
  );

  function handleEditView() {
    return (
      <div className="px-4 pt-4">
        <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-gray-100 max-w-lg mx-auto">
          <div className="flex items-center gap-6 mb-10">
            <div className="relative group">
              <div className="w-24 h-24 rounded-[32px] bg-red-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl relative">
                {editPhoto ? <img src={editPhoto || null} alt="" className="w-full h-full object-cover" /> : <Camera size={32} className="text-red-200" />}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <Camera className="text-white" size={24} />
                </div>
              </div>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 p-3 bg-red-500 text-white rounded-2xl shadow-lg border-4 border-white hover:scale-110 active:scale-95 transition-all"
              >
                <Plus size={16} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 italic tracking-tight">Identity & Profile</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Tap + to upload a new profile picture</p>
            </div>
          </div>
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Display Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold shadow-inner focus:bg-white transition-all outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Phone Number</label>
              <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+91 99999 88888" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold shadow-inner focus:bg-white transition-all outline-none" />
            </div>
            <div className="pt-4 flex gap-4">
              <button disabled={isSaving} type="submit" className="flex-1 bg-red-500 text-white rounded-2xl py-4 font-black uppercase text-xs tracking-widest shadow-xl shadow-red-100 disabled:opacity-50">Save Changes</button>
              <button disabled={isSaving} type="button" onClick={() => { setCurrentView('main'); setEditingAddressId(null); }} className="px-6 bg-gray-50 text-gray-400 rounded-2xl font-black uppercase text-xs tracking-widest">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderAuth() {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center p-4 z-[9999]">
        <div className="w-full max-w-sm flex flex-col justify-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-gray-100 space-y-6 overflow-y-auto no-scrollbar max-h-[90vh]"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-100">
                <LogIn className="text-white" size={28} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                {authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Reset Password'}
              </h2>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {authMode === 'login' ? 'Enter your details to access your account' : authMode === 'signup' ? 'Join us to start ordering your favorite food' : 'Enter your email to receive a reset link'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authError && (
                <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-red-600 text-[10px] font-bold text-center">
                  {authError}
                </div>
              )}

              {authMode === 'signup' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={authName}
                      onChange={e => setAuthName(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm transition-all outline-none focus:border-red-500" 
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Phone Number</label>
                    <input 
                      type="tel" 
                      required
                      value={authPhone}
                      onChange={e => setAuthPhone(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm transition-all outline-none focus:border-red-500" 
                      placeholder="+91 99999 88888"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm transition-all outline-none focus:border-red-500" 
                  placeholder="email@example.com"
                />
              </div>

              {authMode !== 'forgot' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Password</label>
                    {authMode === 'login' && (
                      <button 
                        type="button" 
                        onClick={() => setAuthMode('forgot')}
                        className="text-[10px] font-bold text-red-500 hover:text-red-600"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <input 
                    type="password" 
                    required
                    value={authPass}
                    onChange={e => setAuthPass(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm transition-all outline-none focus:border-red-500" 
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button 
                disabled={isSaving}
                type="submit" 
                className="w-full bg-red-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-600 active:scale-[0.98] transition-all shadow-md shadow-red-100 disabled:opacity-50 mt-2"
              >
                {isSaving ? 'Processing...' : authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Reset Password'}
              </button>
            </form>

            <div className="relative hidden md:block">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="bg-white px-3 text-gray-400 font-bold tracking-tight">OR</span>
              </div>
            </div>

            <button 
              onClick={() => login()}
              className="w-full bg-white border border-gray-200 rounded-xl py-3 hidden md:flex items-center justify-center gap-3 font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
              <span className="text-xs">Continue with Google</span>
            </button>
            
            {/* Note for Mobile App Users */}
            <p className="text-[9px] text-gray-300 font-medium text-center uppercase tracking-tighter italic hidden md:block">
              Note: If Google sign-in fails in the app, use email above.
            </p>

            <div className="text-center">
              <button 
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setAuthError('');
                }}
                className="text-xs font-semibold text-gray-500 hover:text-red-500 transition-colors"
              >
                {authMode === 'login' ? (
                  <>Don't have an account? <span className="text-red-500 underline decoration-red-200 underline-offset-4">Sign Up</span></>
                ) : (
                  <>Already have an account? <span className="text-red-500 underline decoration-red-200 underline-offset-4">Sign In</span></>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }
}


