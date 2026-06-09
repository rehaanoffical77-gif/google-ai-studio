import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ShoppingBag, 
  MapPin, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  Receipt,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Pencil,
  Tag,
  MoreVertical,
  MoreHorizontal,
  Info,
  Home,
  Briefcase,
  Loader2,
  Star,
  Phone,
  HelpCircle,
  X,
  Map as MapIcon,
  Smartphone,
  Banknote,
  Lock,
  Wallet,
  Download,
  Bike
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { cn } from '../lib/utils';

// Step type
type Step = 'summary' | 'address' | 'payment' | 'processing' | 'confirmation' | 'tracking';

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, updateQuantity, removeFromCart, clearCart } = useCart();
  
  const [currentStep, setCurrentStep] = useState<Step>('summary');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<any>('cod');
  const [isCOD, setIsCOD] = useState(true);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [promoCode, setPromoCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showAnimatedSuccess, setShowAnimatedSuccess] = useState(false);
  const [isRestaurantOpen, setIsRestaurantOpen] = useState(true);

  // Address Form States
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    street: '',
    city: 'MANDAMARRI',
    state: 'Telangana',
    zipCode: '',
    zone: '1st Zone'
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  const validateAddress = () => {
    const errors: Record<string, string> = {};
    if (!addressForm.street.trim()) errors.street = 'Street is required';
    if (!addressForm.zipCode.trim() || !/^\d{6}$/.test(addressForm.zipCode)) errors.zipCode = 'Valid pincode required';
    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateAddress()) return;
    try {
      await addDoc(collection(db, 'addresses'), {
        userId: user.uid,
        ...addressForm,
        isDefault: false,
        createdAt: serverTimestamp()
      });
      setIsAddingAddress(false);
      setAddressForm({ label: 'Home', street: '', city: 'Nagpur', state: 'Maharashtra', zipCode: '', zone: '1st Zone' });
    } catch (err) {
      handleFirestoreError(err, 'write', 'addresses');
    }
  };

  // Constants
  const DELIVERY_FEE = 40;
  const TAX_RATE = 0.05; // 5%
  const subtotal = total;
  const tax = Math.round(subtotal * TAX_RATE);
  const VALID_COUPONS: Record<string, number> = {
    'SAVE20': 20,
    'WELCOME50': 50,
    'FOODIE': 30
  };

  const handleApplyCoupon = () => {
    if (VALID_COUPONS[promoCode]) {
      setCouponApplied(true);
      setCouponError('');
    } else {
      setCouponError('Invalid coupon code');
      setCouponApplied(false);
    }
  };

  const finalTotal = subtotal + tax + DELIVERY_FEE - (couponApplied ? VALID_COUPONS[promoCode] || 50 : 0);

  useEffect(() => {
    if (!user) {
      alert("Please login to place an order.");
      navigate('/profile', { state: { mode: 'login', redirect: '/checkout' } });
      return;
    }

    const unsubAddr = onSnapshot(
      query(collection(db, 'addresses'), where('userId', '==', user.uid)),
      (snap) => {
        const addrList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAddresses(addrList);
        if (addrList.length > 0 && !selectedAddress) {
          const def = addrList.find((a: any) => a.isDefault) || addrList[0];
          setSelectedAddress(def);
        }
      },
      (err) => handleFirestoreError(err, 'get', 'addresses')
    );

    const unsubPay = onSnapshot(
      query(collection(db, 'payments'), where('userId', '==', user.uid)),
      (snap) => {
        const payList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPayments(payList);
        if (payList.length > 0 && !selectedPayment) {
          const def = payList.find((p: any) => p.isDefault) || payList[0];
          setSelectedPayment(def);
        }
      },
      (err) => handleFirestoreError(err, 'get', 'payments')
    );

    const unsubUser = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) setUserData(snap.data());
      },
      (err) => handleFirestoreError(err, 'get', `users/${user.uid}`)
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'restaurant'),
      (snap) => {
        if (snap.exists()) {
          setIsRestaurantOpen(snap.data().isOpen);
        }
      }
    );

    return () => {
      unsubAddr();
      unsubPay();
      unsubUser();
      unsubSettings();
    };
  }, [user, navigate]);

  // Order Placement logic
  const handlePlaceOrder = async () => {
    if (!user || !selectedAddress || (!selectedPayment && !isCOD)) return;
    
    if (!isRestaurantOpen) {
      alert("Restaurant is currently closed. Please try again later.");
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      await finalizeOrder();
    } catch (err) {
      console.error("Order Error:", err);
      setIsProcessingPayment(false);
    }
  };

  const finalizeOrder = async () => {
    if (!user || !selectedAddress) return;
    try {
      const orderPayload = {
        userId: user.uid,
        userEmail: user.email,
        items: items.map(i => ({ 
          id: i.id, 
          name: i.name, 
          price: i.price, 
          quantity: i.quantity,
          image: i.image 
        })),
        subtotal,
        tax,
        deliveryFee: DELIVERY_FEE,
        packagingFee: PACKAGING_FEE,
        discount: couponApplied ? (VALID_COUPONS[promoCode] || 50) : 0,
        total: finalTotal + PACKAGING_FEE,
        address: selectedAddress,
        paymentMethod: isCOD ? 'COD' : (typeof selectedPayment === 'string' ? selectedPayment : selectedPayment?.id || 'UPI'),
        status: 'received',
        createdAt: serverTimestamp(),
        estimatedDelivery: '25-35 mins'
      };

      const docRef = await addDoc(collection(db, 'orders'), orderPayload);
      setOrderId(docRef.id);
      setOrderData({ id: docRef.id, ...orderPayload });

      setShowAnimatedSuccess(true);
      setIsProcessingPayment(false);

      setTimeout(() => {
        clearCart();
        setCurrentStep('confirmation');
        setShowAnimatedSuccess(false);
      }, 3000);
    } catch (err) {
       handleFirestoreError(err, 'write', 'orders');
       setIsProcessingPayment(false);
    }
  };

  const renderAnimatedSuccess = () => (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-[#FF2B2B] to-[#E31837] flex flex-col items-center justify-center overflow-hidden">
      <motion.div
        initial={{ scale: 0, y: 100, opacity: 0 }}
        animate={{ 
          scale: [0, 1.2, 1], 
          y: [100, -50, 0], 
          opacity: 1,
          boxShadow: [
            "0 0 0 rgba(255,255,255,0)",
            "0 0 80px rgba(255,255,255,0.6)",
            "0 0 30px rgba(255,255,255,0.4)"
          ]
        }}
        transition={{ 
          duration: 1.5, 
          times: [0, 0.6, 1],
          ease: "easeOut"
        }}
        className="w-32 h-32 bg-white rounded-full flex items-center justify-center relative"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <CheckCircle2 size={64} className="text-[#E31837]" />
        </motion.div>
        
        {/* Outer Glow Rings */}
        <motion.div 
          animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 rounded-full border-4 border-white/50"
        />
        <motion.div 
          animate={{ scale: [1, 2, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
          className="absolute inset-0 rounded-full border-2 border-white/30"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="mt-8 text-center text-white font-sans"
      >
        <h2 className="text-3xl font-black italic tracking-tighter mb-2">ORDER PLACED!</h2>
        <p className="text-sm font-bold opacity-80 uppercase tracking-widest">Finalizing your order...</p>
      </motion.div>

      {/* Background Particles Flare */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: 0, x: 0, opacity: 0 }}
            animate={{ 
              y: -600, 
              x: (i - 7) * 50 * Math.random(),
              opacity: [0, 1, 0],
              scale: [0, 1, 0]
            }}
            transition={{ 
              duration: 2.5, 
              repeat: Infinity, 
              delay: Math.random() * 2,
              ease: "easeOut"
            }}
            className="absolute bottom-1/3 left-1/2 w-1.5 h-1.5 bg-white rounded-full blur-[0.5px]"
          />
        ))}
      </div>
    </div>
  );

  // Render Helpers
  const [isCouponOpen, setIsCouponOpen] = useState(false);
  const PACKAGING_FEE = 20;

  const renderSummary = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-3 pb-4"
    >
      {/* Items Section - More Compact */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 max-h-[300px] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-50 text-[#E31837] rounded-lg">
              <ShoppingBag size={14} />
            </div>
            <h3 className="font-bold text-gray-900 text-xs">Your Items ({items.length})</h3>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="text-[#E31837] text-[10px] font-black italic uppercase tracking-widest"
          >
            Edit
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm shrink-0">
                <img src={item.image || undefined} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-[11px] text-gray-900 truncate italic">{item.name}</h4>
                  <span className="font-black text-[11px] text-gray-900 italic">₹{item.price * item.quantity}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-0.5 scale-90 origin-left">
                    <button onClick={() => updateQuantity(item.id, -1)} className="text-[#E31837] font-black text-xs">-</button>
                    <span className="text-[10px] font-black w-2 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="text-[#E31837] font-black text-xs">+</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compact Coupon Section */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 text-[#E31837] rounded-xl shrink-0">
            <Tag size={18} />
          </div>
          <div className="flex-1 flex bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
            <input 
              type="text" 
              placeholder="Coupon Code" 
              className="flex-1 bg-transparent px-3 py-1.5 text-[10px] font-bold outline-none placeholder:text-gray-300 min-w-0"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            />
            <button 
              onClick={handleApplyCoupon}
              className="bg-[#E31837] text-white px-4 text-[10px] font-bold py-1.5 active:scale-95 transition-transform"
            >
              {couponApplied ? 'Applied' : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      {/* Bill Details Section - Compact */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 space-y-1.5">
        <div className="flex justify-between items-center text-[9px] font-black text-gray-400 uppercase tracking-widest">
          <span>Subtotal</span>
          <span className="text-gray-900">₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-[9px] font-black text-gray-400 uppercase tracking-widest">
          <span>Extra Fees</span>
          <span className="text-gray-900">₹{(PACKAGING_FEE + DELIVERY_FEE).toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-[9px] font-black text-gray-400 uppercase tracking-widest">
          <span>Taxes (5%)</span>
          <span className="text-gray-900">₹{tax.toFixed(2)}</span>
        </div>

        {couponApplied && (
          <div className="bg-green-50 rounded-lg p-2 flex justify-between items-center text-green-700 text-[9px] font-black italic">
            <span>Special Discount</span>
            <span>-₹{(VALID_COUPONS[promoCode] || 50).toFixed(2)}</span>
          </div>
        )}

        <div className="h-px border-t border-dashed border-gray-100 my-1" />

        <div className="flex justify-between items-center text-red-600">
          <h5 className="font-black italic text-xs uppercase tracking-tighter">Grand Total</h5>
          <span className="text-xl font-black italic">₹{(finalTotal + PACKAGING_FEE).toFixed(2)}</span>
        </div>
      </div>

      {/* Delivery Hint */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock size={16} className="text-[#E31837]" />
          <p className="text-[11px] font-bold text-gray-900 italic">Delivery in <span className="text-[#E31837]">25-35 mins</span></p>
        </div>
      </div>

      {/* Main Action Button (Mobile Only) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-50 max-w-lg mx-auto z-40 lg:hidden">
        <button 
          onClick={() => setCurrentStep('address')}
          className="w-full h-16 bg-gradient-to-r from-[#FF2B2B] to-[#E31837] text-white rounded-[22px] font-serif italic text-lg shadow-[0_10px_30px_rgba(227,24,55,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3 group"
        >
          Continue <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </motion.div>
  );

  const renderAddressSelection = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-bold text-[#0D1B2A]">Saved Addresses</h3>
        <button 
          onClick={() => setIsAddingAddress(true)} 
          className="text-[#E31837] text-sm font-bold flex items-center gap-1"
        >
          <Plus size={18} /> Add New Address
        </button>
      </div>

      <AnimatePresence>
        {isAddingAddress && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xl mb-4">
              <form onSubmit={handleSaveAddress} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Label (Home, Work, etc.)</label>
                    <input 
                      type="text" 
                      value={addressForm.label}
                      onChange={e => setAddressForm({...addressForm, label: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:bg-white outline-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Street Address</label>
                    <input 
                      type="text" 
                      placeholder="House No, Building, Area"
                      value={addressForm.street}
                      onChange={e => setAddressForm({...addressForm, street: e.target.value})}
                      className={cn("w-full bg-gray-50 border rounded-xl px-4 py-2.5 text-sm font-bold focus:bg-white outline-none", addressErrors.street ? "border-red-300" : "border-gray-100")}
                    />
                    {addressErrors.street && <p className="text-[10px] text-red-500 font-bold px-1 italic">{addressErrors.street}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">City</label>
                    <input 
                      type="text" 
                      placeholder="MANDAMARRI"
                      value={addressForm.city}
                      onChange={e => setAddressForm({...addressForm, city: e.target.value})}
                      className={cn("w-full bg-gray-50 border rounded-xl px-4 py-2.5 text-sm font-bold focus:bg-white outline-none", addressErrors.city ? "border-red-300" : "border-gray-100")}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">State</label>
                    <input 
                      type="text" 
                      placeholder="Telangana"
                      value={addressForm.state}
                      onChange={e => setAddressForm({...addressForm, state: e.target.value})}
                      className={cn("w-full bg-gray-50 border rounded-xl px-4 py-2.5 text-sm font-bold focus:bg-white outline-none", addressErrors.state ? "border-red-300" : "border-gray-100")}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Pincode (6 digits)</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      value={addressForm.zipCode}
                      onChange={e => setAddressForm({...addressForm, zipCode: e.target.value.replace(/\D/g, '')})}
                      className={cn("w-full bg-gray-50 border rounded-xl px-4 py-2.5 text-sm font-bold focus:bg-white outline-none", addressErrors.zipCode ? "border-red-300" : "border-gray-100")}
                    />
                    {addressErrors.zipCode && <p className="text-[10px] text-red-500 font-bold px-1 italic">{addressErrors.zipCode}</p>}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-[#E31837] text-white rounded-xl py-3 font-bold uppercase text-[10px] tracking-widest shadow-lg">Save Address</button>
                  <button type="button" onClick={() => setIsAddingAddress(false)} className="px-6 bg-gray-100 text-gray-400 rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
        {addresses.map((addr) => {
          const isSelected = selectedAddress?.id === addr.id;
          return (
            <button 
              key={addr.id}
              onClick={() => setSelectedAddress(addr)}
              className={cn(
                "w-full rounded-[24px] p-6 text-left transition-all flex items-start gap-4 border lg:hover:border-red-200 lg:hover:shadow-md group",
                isSelected 
                  ? "bg-[#FFF5F6] border-[#FFD9DB] shadow-md" 
                  : "bg-white border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
              )}
            >
              {/* Radio Selector */}
              <div className="mt-1 shrink-0">
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                  isSelected ? "border-[#E31837] scale-110" : "border-gray-200"
                )}>
                  {isSelected && <div className="w-3 h-3 bg-[#E31837] rounded-full animate-in zoom-in-50" />}
                </div>
              </div>

              {/* Icon */}
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                isSelected ? "bg-white text-[#E31837] shadow-sm" : "bg-red-50 text-[#E31837]"
              )}>
                {addr.label.toLowerCase() === 'home' ? <Home size={20} /> : 
                 addr.label.toLowerCase() === 'work' ? <Briefcase size={20} /> : 
                 <MapPin size={20} />}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-gray-900 group-hover:text-[#E31837] transition-colors">{addr.label}</p>
                  {addr.isDefault && (
                    <span className="bg-[#FFE4E6] text-[#E31837] text-[10px] font-bold px-2 py-0.5 rounded-md">Primary</span>
                  )}
                </div>
                <p className="text-[12px] text-gray-500 font-medium leading-relaxed mb-3 italic">
                  {addr.street}, {addr.city}, {addr.state} - {addr.zipCode || '441503'}
                </p>
                <div className="flex items-center gap-2 text-gray-400">
                   <Phone size={12} />
                   <p className="text-[12px] font-bold text-gray-700 tracking-tight">{userData?.phone || 'No phone added'}</p>
                </div>
              </div>

              {/* Action Menu */}
              <div className="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <MoreVertical size={20} className="text-gray-400" />
              </div>
            </button>
          );
        })}

        {/* Use Current Location */}
        <button 
          onClick={() => {
            setIsLocating(true);
            if ("geolocation" in navigator) {
              navigator.geolocation.getCurrentPosition(
                async (position) => {
                  const { latitude, longitude } = position.coords;
                  // In a real app we'd use reverse geocoding here.
                  // For now we'll simulate finding the address components.
                  setAddressForm({
                    ...addressForm,
                    street: `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                    city: 'MANDAMARRI',
                    state: 'Telangana',
                    zipCode: '504231',
                    label: 'Current Location'
                  });
                  setIsAddingAddress(true);
                  setIsLocating(false);
                },
                (error) => {
                  console.error(error);
                  setIsLocating(false);
                }
              );
            }
          }}
          disabled={isLocating}
          className="w-full bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-50 text-[#E31837] flex items-center justify-center">
              {isLocating ? <Loader2 size={20} className="animate-spin" /> : <MapIcon size={20} />}
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900 text-sm">Use Current Location</p>
              <p className="text-[11px] text-gray-400 font-medium">Detect my location using GPS</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-900" />
        </button>

        {/* Note Box */}
        <div className="bg-[#FFF5F6] rounded-2xl p-4 flex gap-3 border border-[#FFD9DB]">
          <div className="mt-0.5 shrink-0">
            <Info size={16} className="text-[#E31837]" />
          </div>
          <div className="flex-1 text-[11px] text-gray-600 font-medium leading-relaxed">
            <span className="font-bold text-gray-900">Note:</span> You can add, edit or remove addresses from the address options.
          </div>
          <button className="shrink-0 opacity-40">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Action Button (Mobile Only) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-50 max-w-lg mx-auto z-40 lg:hidden">
        <button 
          disabled={!selectedAddress}
          onClick={() => setCurrentStep('payment')}
          className="w-full h-16 bg-gradient-to-r from-[#FF2B2B] to-[#E31837] text-white rounded-[22px] font-bold text-lg shadow-[0_10px_30px_rgba(227,24,55,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3 group"
        >
          Deliver Here <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </motion.div>
  );

  const renderPaymentSelection = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4 pb-40"
    >
      {/* Amount Payable Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 font-sans">
        <div className="flex justify-between items-start mb-2">
          <div className="space-y-1">
            <h3 className="text-[13px] font-bold text-gray-800 uppercase tracking-tight">Amount Payable</h3>
            <button 
              onClick={() => setIsViewDetailsOpen(!isViewDetailsOpen)}
              className="text-[#E31837] text-[11px] font-bold flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              View Details <ChevronDown size={14} className={cn("transition-transform", isViewDetailsOpen && "rotate-180")} />
            </button>
          </div>
          <span className="text-2xl font-black text-[#E31837] italic">₹{(finalTotal + PACKAGING_FEE).toFixed(2)}</span>
        </div>
        
        {isViewDetailsOpen && (
          <div className="mt-4 pt-4 border-t border-dashed border-gray-100 space-y-2">
             <div className="flex justify-between text-[11px] text-gray-500">
               <span>Items Total</span>
               <span>₹{subtotal.toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-[11px] text-gray-500">
               <span>Delivery & Packaging</span>
               <span>₹{(DELIVERY_FEE + PACKAGING_FEE).toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-[11px] text-gray-500">
               <span>Taxes</span>
               <span>₹{tax.toFixed(2)}</span>
             </div>
             {couponApplied && (
               <div className="flex justify-between text-[11px] text-green-600 font-bold">
                 <span>Coupon Applied</span>
                 <span>-₹{(VALID_COUPONS[promoCode] || 50).toFixed(2)}</span>
               </div>
             )}
          </div>
        )}
      </div>

      <div className="flex flex-col h-full gap-4 pb-20">
        <div className="shrink-0 bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
          <div className="flex justify-between items-center mb-3">
             <h3 className="text-lg font-bold text-gray-900 italic">Bill Summary</h3>
             <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full">Secure</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Items Total</span>
              <span className="font-bold">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Delivery & Tax</span>
              <span className="font-bold">₹{(DELIVERY_FEE + PACKAGING_FEE + tax).toFixed(2)}</span>
            </div>
            {couponApplied && (
              <div className="flex justify-between text-xs text-green-600 font-bold">
                <span>Coupon Applied</span>
                <span>-₹{(VALID_COUPONS[promoCode] || 50).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-black text-gray-900 border-t border-dashed border-gray-100 pt-2 mt-1">
              <span>To Pay</span>
              <span className="text-[#E31837]">₹{(finalTotal + PACKAGING_FEE).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
          <h3 className="text-base font-bold text-[#0D1B2A] italic px-2">Payment Method</h3>
          <div className="space-y-4">
            <div className={cn(
              "p-5 rounded-3xl border flex items-center justify-between shadow-md bg-red-50/50 border-red-100"
            )}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center border border-green-100">
                  <Banknote size={20} className="text-green-600" />
                </div>
                <div className="text-left leading-tight">
                  <p className="text-sm font-bold text-gray-800 italic">Cash on Delivery</p>
                  <p className="text-[10px] text-gray-400 italic">Pay at doorstep</p>
                </div>
              </div>
              <div className="w-5 h-5 rounded-full border-2 border-[#E31837] flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-[#E31837] rounded-full" />
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 z-40 lg:hidden">
          <button 
            onClick={handlePlaceOrder}
            disabled={!selectedPayment && !isCOD}
            className="w-full h-14 bg-gradient-to-r from-[#FF2B2B] to-[#E31837] disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-100 active:scale-95 flex items-center justify-between px-6"
          >
            <span className="flex items-center gap-2">Place Order <ChevronRight size={18} /></span>
            <span className="font-black text-base">₹{(finalTotal + PACKAGING_FEE).toFixed(2)}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-20 space-y-8">
      <div className="relative">
        <Loader2 size={64} className="text-red-500 animate-spin" />
        <ShoppingBag size={24} className="absolute inset-0 m-auto text-red-300" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-black text-gray-900 italic tracking-tight">Finishing your order...</h3>
        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">We're talking to the kitchen</p>
      </div>
      <div className="w-full max-w-xs h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 3, repeat: Infinity }}
          className="h-full bg-red-500"
        />
      </div>
    </div>
  );

  const renderConfirmation = () => {
    const displayOrder = orderData || {};
    const orderItems = displayOrder.items || [];
    const orderIdShort = displayOrder.id ? displayOrder.id.slice(-6).toUpperCase() : 'FJ1234567890';
    const subtotalVal = displayOrder.subtotal || 0;
    const deliveryVal = displayOrder.deliveryFee || 40;
    const packagingVal = PACKAGING_FEE || 10;
    const totalVal = displayOrder.total || 0;
    const discountVal = displayOrder.discount || 0;

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col h-full gap-4 pb-10"
      >
        {/* Success Header Area */}
        <div className="shrink-0 bg-gradient-to-b from-[#E31837] to-[#FF4D4D] py-8 px-6 text-center relative overflow-hidden -mx-4 rounded-b-[40px] shadow-lg shadow-red-100">
          <div className="absolute inset-0 pointer-events-none opacity-20">
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 300, opacity: [0, 1, 0] }}
                transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
                className="absolute w-1.5 h-1.5 rounded-full bg-white"
                style={{ left: `${Math.random() * 100}%` }}
              />
            ))}
          </div>

          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-xl relative z-10 mb-4"
          >
            <CheckCircle2 size={32} className="text-green-500" />
          </motion.div>
          
          <h2 className="text-2xl font-black text-white italic truncate px-4">Order Confirmed!</h2>
          <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest mt-1">Order #{orderIdShort}</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 px-1">
          <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                  <Bike size={16} />
                </div>
                <div className="leading-none">
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Status</p>
                  <p className="text-[11px] font-black text-gray-800">Assigning Partner</p>
                </div>
              </div>
              <button className="bg-gray-50 text-gray-400 p-1.5 rounded-lg">
                <Download size={14} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {orderItems.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-600 italic">
                    <span className="text-red-500 mr-2">{item.quantity}x</span>
                    {item.name}
                  </span>
                  <span className="font-black text-gray-800">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              
              <div className="pt-3 border-t border-dashed border-gray-100 space-y-1">
                {discountVal > 0 && (
                  <div className="flex justify-between text-[10px] text-green-600 font-bold uppercase">
                    <span>Discount</span>
                    <span>-₹{discountVal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
                  <span>Fees & Taxes</span>
                  <span>₹{(deliveryVal + packagingVal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-gray-900 italic pt-1">
                  <span>To be paid</span>
                  <span className="text-red-600">₹{(totalVal + packagingVal).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50/50 rounded-xl p-3 border border-green-100 flex items-center gap-3">
            <CheckCircle2 size={16} className="text-green-500 shrink-0" />
            <p className="text-[10px] font-black text-green-700 tracking-tight leading-none uppercase">Chef has received your order</p>
          </div>
        </div>

        <div className="shrink-0 space-y-2 pt-2">
          <button 
            onClick={() => setCurrentStep('tracking')}
            className="w-full bg-red-600 text-white h-14 rounded-2xl font-bold text-sm shadow-lg shadow-red-100 active:scale-95 flex items-center justify-center gap-3"
          >
            <Bike size={20} />
            Track Live Status
          </button>
          <button 
            onClick={() => navigate('/')}
            className="w-full h-12 rounded-2xl bg-gray-50 text-gray-400 font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Home size={16} />
            Back to Home
          </button>
        </div>
      </motion.div>
    );
  };

  const [liveOrder, setLiveOrder] = useState<any>(null);

  useEffect(() => {
    if (orderId && currentStep === 'tracking') {
      const unsub = onSnapshot(doc(db, 'orders', orderId), (snap) => {
        if (snap.exists()) {
          setLiveOrder({ id: snap.id, ...snap.data() });
        }
      });
      return () => unsub();
    }
  }, [orderId, currentStep]);

  const [cancelTimeLeft, setCancelTimeLeft] = useState(60);

  useEffect(() => {
    if (currentStep === 'tracking' && (liveOrder || orderData)) {
      const order = liveOrder || orderData;
      const createdAt = order.createdAt?.seconds ? order.createdAt.seconds * 1000 : Date.now();
      const expiryTime = createdAt + 60000;

      const tick = () => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expiryTime - now) / 1000));
        setCancelTimeLeft(diff);
      };

      tick();
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    }
  }, [currentStep, liveOrder, orderData]);

  const handleCancelOrder = async () => {
    const order = liveOrder || orderData;
    if (!order?.id || cancelTimeLeft <= 0) return;
    
    if (window.confirm("Are you sure you want to cancel this order?")) {
      try {
        await updateDoc(doc(db, 'orders', order.id), { status: 'cancelled' });
        alert("Order cancelled successfully");
        navigate('/');
      } catch (err) {
        handleFirestoreError(err, 'write', 'orders');
      }
    }
  };

  const renderTracking = () => {
    const currentOrder = liveOrder || orderData;
    const isCancelled = currentOrder?.status === 'cancelled';
    const statusSteps = [
      { id: 'received', label: 'Order Received', desc: 'Securely lodged in our system' },
      { id: 'preparing', label: 'Chef is Preparing', desc: 'Working magic in the kitchen' },
      { id: 'ready', label: 'Order is Ready', desc: 'Freshly packed & ready for pickup' },
      { id: 'on the way', label: 'On the Way', desc: 'Hero is racing to your location' },
      { id: 'delivered', label: 'Delivered', desc: 'Enjoy your delicious feast!' },
    ];

    const getStatusIndex = (status: string) => {
      switch (status) {
        case 'received': return 0;
        case 'preparing': return 1;
        case 'ready': return 2;
        case 'on the way': return 3;
        case 'delivered': return 4;
        default: return 0;
      }
    };

    const currentStatusIdx = getStatusIndex(currentOrder?.status || 'received');

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col h-full gap-4 pb-10"
      >
        <div className="bg-white rounded-[32px] p-6 shadow-xl border border-gray-50/50 space-y-6 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-[80px] -mr-6 -mt-6" />
          
          <div className="flex justify-between items-start relative z-10">
            <div className="flex-1 pr-4">
              <h3 className="text-xl font-black text-gray-900 italic tracking-tight leading-tight">
                {isCancelled ? 'Order Voided' : 
                 currentOrder?.status === 'delivered' ? 'Food Home!' : 
                 currentOrder?.status === 'on the way' ? 'Almost There!' :
                 currentOrder?.status === 'ready' ? 'Hot & Ready!' : 'In the Works'}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {isCancelled ? 'Cancelled' : currentOrder?.status || 'Processing'}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-600 rounded-2xl text-white flex items-center justify-center shadow-lg shadow-red-100 transform rotate-3 shrink-0">
              <Clock size={24} />
            </div>
          </div>

          {!isCancelled && (
            <div className="space-y-6 relative px-1">
              <div className="absolute left-[13px] top-2 bottom-2 w-[1.5px] bg-gray-50" />
              
              {statusSteps.slice(0, 5).map((s, idx) => (
                <div key={idx} className="flex gap-4 relative">
                  <div className={cn(
                    "w-7 h-7 rounded-full border-4 border-white flex items-center justify-center z-10 shadow-md",
                    idx < currentStatusIdx ? "bg-red-500" : idx === currentStatusIdx ? "bg-white ring-2 ring-red-500" : "bg-gray-100"
                  )}>
                    {idx < currentStatusIdx ? <CheckCircle2 size={12} className="text-white" /> : 
                     idx === currentStatusIdx ? <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-[11px] font-black uppercase tracking-tight truncate", 
                      idx === currentStatusIdx ? "text-red-500 italic" : "text-gray-900"
                    )}>
                      {s.label}
                    </p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{idx <= currentStatusIdx ? s.desc : 'Next Step'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 text-white rounded-[32px] p-4 flex items-center gap-4 shadow-xl shrink-0">
          <div className="w-12 h-12 rounded-xl bg-white/10 p-0.5 overflow-hidden shrink-0 border border-white/10">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentOrder?.deliveryPartnerName || 'Delivery'}`} 
              alt="" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">
              {currentOrder?.deliveryPartnerName ? 'Out for Delivery' : 'Assigning'}
            </p>
            <p className="text-sm font-black italic tracking-tighter truncate leading-none">
              {currentOrder?.deliveryPartnerName || 'Finding Hero...'}
            </p>
          </div>
          {currentOrder?.deliveryPartnerPhone && (
            <a 
              href={`tel:${currentOrder.deliveryPartnerPhone}`}
              className="w-10 h-10 bg-red-600 rounded-xl text-white flex items-center justify-center shadow-lg shadow-red-900/50"
            >
              <Phone size={18} />
            </a>
          )}
        </div>

        {cancelTimeLeft > 0 && !isCancelled && (
          <button 
            onClick={handleCancelOrder}
            className="w-full text-[9px] font-black text-white uppercase tracking-widest bg-red-600/10 text-red-600 py-3 rounded-xl border border-red-100"
          >
            Cancel Order ({cancelTimeLeft}s)
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div className="h-[100dvh] bg-gray-50/30 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-gradient-to-br from-[#FF2B2B] to-[#E31837] z-50 px-4 pt-8 pb-6 shadow-xl lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                if (currentStep === 'address') setCurrentStep('summary');
                else if (currentStep === 'payment') setCurrentStep('address');
                else if (currentStep === 'tracking' || currentStep === 'confirmation') navigate('/');
                else navigate('/');
              }} 
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft size={24} className="text-white" />
            </button>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              {currentStep === 'summary' ? 'Order Summary' : 
               currentStep === 'address' ? 'Delivery Address' : 
               currentStep === 'payment' ? 'Payment' : 
               currentStep === 'tracking' ? 'Live Track' : 'Success'}
            </h1>
          </div>
          
          {/* Progress Stepper */}
          <div className="flex items-center justify-between relative px-4 lg:w-1/2">
            {[
              { id: 'summary', label: 'Summary' },
              { id: 'address', label: 'Address' },
              { id: 'payment', label: 'Payment' },
              { id: 'tracking', label: 'Place Order' }
            ].map((s, idx, arr) => {
              const steps = ['summary', 'address', 'payment', 'tracking'];
              const currentIdx = steps.indexOf(currentStep);
              const isPast = idx < currentIdx;
              const isActive = idx === currentIdx;

              return (
                <React.Fragment key={s.id}>
                  <div className="flex flex-col items-center gap-2 relative z-10">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500",
                      isActive ? "bg-white text-[#E31837] scale-110 shadow-lg" : 
                      isPast ? "bg-white/40 text-white" : "bg-white/20 text-white/50 border border-white/20"
                    )}>
                      {isPast ? <CheckCircle2 size={14} /> : idx + 1}
                    </div>
                    <span className={cn(
                      "text-[9px] font-black transition-colors duration-500 uppercase tracking-tighter",
                      isActive ? "text-white" : "text-white/60"
                    )}>{s.label}</span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className={cn(
                      "flex-1 h-px border-t border-dashed mx-2 -mt-5 transition-colors duration-500",
                      idx < currentIdx ? "border-white/60" : "border-white/20"
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pt-6 pb-40 px-4 lg:px-8 w-full">
        <div className="max-w-7xl mx-auto w-full h-full">
          <div className={cn(
            "h-full w-full",
            (currentStep === 'confirmation' || currentStep === 'tracking' || currentStep === 'processing')
              ? "max-w-2xl mx-auto"
              : "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
          )}>
            {/* Left Content Area */}
            <div className={cn(
              (currentStep === 'confirmation' || currentStep === 'tracking' || currentStep === 'processing')
                ? "w-full"
                : "lg:col-span-8 flex flex-col gap-6"
            )}>
              <AnimatePresence mode="wait">
                {currentStep === 'summary' && renderSummary()}
                {currentStep === 'address' && renderAddressSelection()}
                {currentStep === 'payment' && renderPaymentSelection()}
                {currentStep === 'processing' && renderProcessing()}
                {currentStep === 'confirmation' && renderConfirmation()}
                {currentStep === 'tracking' && renderTracking()}
              </AnimatePresence>
            </div>

            {/* Right Sidebar (Bill Details) - Desktop Only */}
            {!(currentStep === 'confirmation' || currentStep === 'tracking' || currentStep === 'processing') && (
              <aside className="lg:col-span-4 hidden lg:block sticky top-0 space-y-6">
                <div className="bg-white rounded-[32px] p-8 shadow-xl border border-gray-100 flex flex-col gap-6">
                  <h3 className="text-xl font-bold text-gray-900 italic tracking-tight">Order Bill</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm font-medium text-gray-500">
                      <span>Items Subtotal</span>
                      <span className="text-gray-900">₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium text-gray-500">
                      <span>Restaurant Packaging</span>
                      <span className="text-gray-900">₹{PACKAGING_FEE.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium text-gray-500">
                      <span>Delivery Fee</span>
                      <span className="text-gray-900 text-green-600">₹{DELIVERY_FEE.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium text-gray-500">
                      <span>Taxes & Charges (5%)</span>
                      <span className="text-gray-900">₹{tax.toFixed(2)}</span>
                    </div>
                    
                    {couponApplied && (
                      <div className="flex justify-between items-center text-sm font-black text-green-600 italic py-2 bg-green-50 px-3 rounded-xl border border-green-100">
                        <span>Coupon Discount</span>
                        <span>-₹{(VALID_COUPONS[promoCode] || 50).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="h-px border-t border-dashed border-gray-200" />

                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">Total Amount</span>
                      <span className="text-3xl font-black text-[#E31837] italic">₹{(finalTotal + PACKAGING_FEE).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Desktop Action Trigger */}
                  <button 
                    onClick={() => {
                      if (currentStep === 'summary') setCurrentStep('address');
                      else if (currentStep === 'address') setCurrentStep('payment');
                      else if (currentStep === 'payment') handlePlaceOrder();
                    }}
                    disabled={(currentStep === 'address' && !selectedAddress) || (currentStep === 'payment' && !selectedPayment && !isCOD)}
                    className="w-full h-16 bg-gradient-to-r from-[#FF2B2B] to-[#E31837] text-white rounded-2xl font-bold text-lg shadow-[0_10px_30px_rgba(227,24,55,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {currentStep === 'summary' ? 'Proceed to Delivery' : 
                     currentStep === 'address' ? 'Proceed to Payment' : 
                     'Place Order Now'}
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* Safety Badge */}
                <div className="bg-gray-900 text-white rounded-2xl p-4 flex items-center gap-3 shadow-lg">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Lock size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Secure Checkout</p>
                    <p className="text-[11px] font-medium text-white/90">256-bit SSL encrypted payment</p>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </main>

      {/* Footer Info (Desktop) */}
      <footer className="hidden lg:block shrink-0 p-8 text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.3em]">
        Safe • Secure • No-Contact Delivery
      </footer>

      {showAnimatedSuccess && renderAnimatedSuccess()}
    </div>
  );
}
