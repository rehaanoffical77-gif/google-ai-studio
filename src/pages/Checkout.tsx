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

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Step = 'summary' | 'address' | 'payment' | 'processing' | 'confirmation' | 'tracking';

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, updateQuantity, removeFromCart, clearCart } = useCart();
  
  const [currentStep, setCurrentStep] = useState<Step>('summary');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
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
      await addDoc(collection(db, 'addresses',), {
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
      navigate('/profile');
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
      doc(db, 'settings', 'config'),
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
      // Temporarily finalizing directly without Razorpay for testing
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
        <h2 className="text-3xl font-black italic tracking-tighter mb-2">PAYMENT SUCCESS!</h2>
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

  const [isCOD, setIsCOD] = useState(false);

  // Render Helpers
  const [isCouponOpen, setIsCouponOpen] = useState(false);
  const PACKAGING_FEE = 20;

  const renderSummary = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4"
    >
      {/* Items Section */}
      <div className="bg-white rounded-[24px] p-4 sm:p-6 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-50">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-50 text-[#E31837] rounded-lg">
              <ShoppingBag size={18} />
            </div>
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">Your Items ({items.length})</h3>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="text-[#E31837] text-[13px] font-bold flex items-center gap-1 italic"
          >
            Edit Cart <Pencil size={14} />
          </button>
        </div>

        <div className="space-y-8">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 sm:gap-6 items-center p-3 sm:p-4 lg:p-6 lg:hover:bg-gray-50 rounded-3xl transition-colors">
              <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl overflow-hidden shadow-md shrink-0 ring-2 sm:ring-4 ring-white">
                <img src={item.image || null} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-serif text-base sm:text-lg lg:text-xl text-gray-900 leading-tight italic truncate">{item.name}</h4>
                    <p className="text-[10px] lg:text-xs text-gray-400 font-medium leading-relaxed mt-1 italic line-clamp-2">Slow-cooked and seasoned with authentic spices.</p>
                  </div>
                  <div className="w-4 h-4 border border-green-600 p-0.5 flex items-center justify-center shrink-0">
                    <div className="w-full h-full bg-green-600 rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 sm:mt-4 gap-2 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <span className="font-bold text-gray-900 italic text-sm sm:text-base lg:text-lg">₹{item.price}</span>
                    <div className="flex items-center gap-2 sm:gap-4 bg-white border border-gray-100 rounded-xl px-2 sm:px-4 py-1 sm:py-1.5 shadow-sm">
                      <button onClick={() => updateQuantity(item.id, -1)} className="text-[#E31837] font-black text-base sm:text-lg">-</button>
                      <span className="text-xs sm:text-sm font-black w-4 sm:w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="text-[#E31837] font-black text-base sm:text-lg">+</button>
                    </div>
                  </div>
                  <span className="font-black text-gray-900 italic text-base sm:text-lg shadow-sm px-2 sm:px-3 py-1 bg-gray-50 rounded-lg lg:bg-transparent whitespace-nowrap">₹{item.price * item.quantity}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coupon Section */}
      <div className="bg-white rounded-[24px] p-4 sm:p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="p-2 bg-red-50 text-[#E31837] rounded-xl transform -rotate-12 shrink-0">
              <Tag size={22} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900">Apply Coupon</h4>
              <p className="text-[10px] text-gray-400 font-medium">Get exciting offers and discounts</p>
            </div>
          </div>
          <div className="flex bg-gray-50 rounded-xl overflow-hidden border border-gray-100 w-full sm:max-w-[200px]">
            <input 
              type="text" 
              placeholder="Enter coupon code" 
              className="flex-1 bg-transparent px-3 py-2 text-[10px] font-bold outline-none placeholder:text-gray-300 min-w-0"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                setCouponError('');
              }}
            />
            <button 
              onClick={handleApplyCoupon}
              className="bg-[#E31837] text-white px-4 text-[10px] font-bold py-2 active:scale-95 transition-transform shrink-0"
            >
              {couponApplied ? 'Applied' : 'Apply'}
            </button>
          </div>
        </div>
        {couponError && <p className="text-[10px] text-red-500 font-bold mt-2 px-1 italic">{couponError}</p>}
      </div>

      {/* Bill Details Section */}
      <div className="bg-white rounded-[24px] p-4 sm:p-6 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-50 space-y-3 sm:space-y-4">
        <div className="flex justify-between items-center text-[12px] sm:text-[13px] font-medium text-gray-600">
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-[12px] sm:text-[13px] font-medium text-gray-600">
          <div className="flex items-center gap-1">
            <span>Restaurant Packaging</span>
          </div>
          <span>₹{PACKAGING_FEE.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-[12px] sm:text-[13px] font-medium text-gray-600">
          <div className="flex items-center gap-1">
            <span>Delivery Fee</span>
          </div>
          <span>₹{DELIVERY_FEE.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-[12px] sm:text-[13px] font-medium text-gray-600">
          <div className="flex items-center gap-1">
            <span>Taxes & Charges</span>
          </div>
          <span>₹{tax.toFixed(2)}</span>
        </div>

        {couponApplied && (
          <div className="bg-green-50 rounded-xl p-3 flex justify-between items-center text-green-700 text-[13px] font-black italic">
            <div className="flex items-center gap-2">
               <span className="text-lg">🌿</span>
               <span>You Save</span>
            </div>
            <span>-₹{(VALID_COUPONS[promoCode] || 50).toFixed(2)}</span>
          </div>
        )}

        <div className="h-px border-t border-dashed border-red-200 my-2" />

        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <h5 className="font-bold text-gray-900 italic text-base">To Pay</h5>
            <p className="text-[10px] text-gray-400 font-medium italic">(Inclusive of all taxes)</p>
          </div>
          <span className="text-xl font-black text-[#E31837] italic">₹{(finalTotal + PACKAGING_FEE).toFixed(2)}</span>
        </div>
      </div>

      {/* Delivery Hint */}
      <div className="bg-white rounded-[24px] p-4 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 text-[#E31837] rounded-xl flex items-center justify-center">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-gray-900 italic">Estimated Delivery</p>
            <p className="text-[12px] font-bold text-[#E31837] italic">25 - 35 mins</p>
          </div>
        </div>
        <ChevronDown size={20} className="text-gray-300" />
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

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0 px-1 font-sans">
        <div className="lg:col-span-2">
           <h3 className="text-xl font-bold text-[#0D1B2A] mb-6 italic">Choose Payment Method</h3>
        </div>
        
        {/* UPI Section */}
        <div className="space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">Digital UPI</p>
          <div className="bg-white rounded-[32px] border border-gray-100 divide-y divide-gray-50 shadow-xl overflow-hidden">
            {[
              { id: 'googlepay', name: 'Google Pay', sub: 'Secure via NPCI', icon: <Smartphone size={20} className="text-blue-500" /> },
              { id: 'phonepe', name: 'PhonePe', sub: 'Instant settlement', icon: <Smartphone size={20} className="text-purple-600" /> },
              { id: 'paytm', name: 'Paytm', sub: 'Fast & Secure', icon: <Smartphone size={20} className="text-sky-400" /> }
            ].map((method) => (
              <button 
                key={method.id} 
                onClick={() => { setSelectedPayment(method.id); setIsCOD(false); }}
                className="w-full p-6 flex items-center justify-between group lg:hover:bg-gray-50 transition-all"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100 transition-transform group-hover:scale-110">
                    {method.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-base font-bold text-gray-900 leading-none mb-1.5">{method.name}</p>
                    <p className="text-[12px] text-gray-400 font-medium leading-none italic">{method.sub}</p>
                  </div>
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                  selectedPayment === method.id ? "border-[#E31837] scale-110 shadow-sm" : "border-gray-200"
                )}>
                  {selectedPayment === method.id && <div className="w-3.5 h-3.5 bg-[#E31837] rounded-full animate-in zoom-in-50" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cards & Others */}
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">Traditional & Cards</p>
            <div className="space-y-3">
              <button className="w-full bg-white p-6 rounded-[32px] border border-gray-100 flex items-center justify-between shadow-lg lg:hover:shadow-xl lg:hover:border-red-100 transition-all group">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100 group-hover:rotate-6 transition-transform">
                    <CreditCard size={22} className="text-[#E31837]" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-bold text-gray-900 leading-none mb-1.5">Credit / Debit Cards</p>
                    <p className="text-[12px] text-gray-400 font-medium leading-none italic uppercase">Visa, Master & more</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
              </button>

              <button 
                onClick={() => { setIsCOD(true); setSelectedPayment('cod'); }}
                className={cn(
                  "w-full p-6 rounded-[32px] border flex items-center justify-between shadow-lg lg:hover:shadow-xl transition-all group",
                  isCOD ? "bg-[#FFF5F6] border-[#FFD9DB]" : "bg-white border-gray-100"
                )}
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center border border-green-100 group-hover:-rotate-6 transition-transform">
                    <Banknote size={24} className="text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-bold text-gray-900 leading-none mb-1.5 italic">Cash on Delivery</p>
                    <p className="text-[12px] text-gray-400 font-medium leading-none italic uppercase tracking-tighter">Pay at your doorstep</p>
                  </div>
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                  isCOD ? "border-[#E31837] scale-110 shadow-sm" : "border-gray-200"
                )}>
                  {isCOD && <div className="w-3.5 h-3.5 bg-[#E31837] rounded-full animate-in zoom-in-50" />}
                </div>
              </button>
            </div>
          </div>

          <div className="bg-green-50/50 rounded-[24px] p-4 flex items-start gap-3 border border-green-100">
            <CheckCircle2 size={18} className="text-green-600 mt-1" />
            <div className="flex-1">
              <p className="text-[11px] font-bold text-green-700 italic">Trusted & Secure Payments</p>
              <p className="text-[10px] text-green-600/70 font-medium">Your payment information is encrypted and never stored on our servers.</p>
            </div>
            <Lock size={16} className="text-green-600 shrink-0" />
          </div>
        </div>
      </div>

      {/* Main Action Button (Mobile Only) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-50 max-w-lg mx-auto z-40 lg:hidden">
        <button 
          onClick={handlePlaceOrder}
          disabled={!selectedPayment && !isCOD}
          className="w-full h-16 bg-gradient-to-r from-[#FF2B2B] to-[#E31837] disabled:opacity-50 text-white rounded-[22px] font-bold text-lg shadow-[0_10px_30px_rgba(227,24,55,0.3)] transition-all active:scale-95 flex items-center justify-between px-8 group"
        >
          <span>Pay & Place Order</span>
          <div className="flex items-center gap-3">
            <span className="font-black">₹{(finalTotal + PACKAGING_FEE).toFixed(2)}</span>
            <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
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
        className="pb-40 -mt-10"
      >
        {/* Success Header Area */}
        <div className="bg-gradient-to-b from-[#E31837] to-[#FF4D4D] pt-12 pb-16 px-6 text-center relative overflow-hidden -mx-4 rounded-b-[40px]">
          {/* Confetti simulation (dots) */}
          <div className="absolute inset-0 pointer-events-none opacity-30">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 500, opacity: [0, 1, 0] }}
                transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 5 }}
                className={cn(
                  "absolute w-2 h-2 rounded-full",
                  i % 3 === 0 ? "bg-yellow-400" : i % 3 === 1 ? "bg-blue-400" : "bg-white"
                )}
                style={{ left: `${Math.random() * 100}%` }}
              />
            ))}
          </div>

          <motion.div 
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 12 }}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-2xl relative z-10"
          >
            <div className="w-16 h-16 rounded-full border-4 border-green-500 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 space-y-2 relative z-10 font-sans"
          >
            <h2 className="text-4xl font-serif italic font-bold text-white tracking-tight">Order Placed!</h2>
            <p className="text-sm font-bold text-white/90">Thank you for your order. Your food is on its way!</p>
          </motion.div>
        </div>

        {/* Order Details Card */}
        <div className="px-4 -mt-10 relative z-20 space-y-4">
          <div className="bg-white rounded-[24px] shadow-xl border border-gray-100 overflow-hidden font-sans">
            <div className="p-5 border-b border-gray-50 bg-gray-50/30 flex justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order ID</p>
                <p className="text-sm font-black text-gray-800 tracking-tight">FJ{orderIdShort}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order Placed On</p>
                <p className="text-sm font-bold text-gray-800">
                  {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <div className="p-5 border-b border-dashed border-gray-100 grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-red-50 text-[#E31837] flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <div>
                   <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Est. Delivery</p>
                   <p className="text-[11px] font-black text-green-600">25 - 35 mins</p>
                </div>
              </div>
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-red-50 text-[#E31837] flex items-center justify-center">
                  <MapIcon size={20} />
                </div>
                <div>
                   <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Delivering to</p>
                   <p className="text-[11px] font-black text-gray-800">{displayOrder.address?.label || 'Home'}</p>
                   <button className="text-[9px] font-bold text-[#E31837] flex items-center justify-center gap-0.5">
                     View Address <ChevronRight size={8} />
                   </button>
                </div>
              </div>
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-red-50 text-[#E31837] flex items-center justify-center">
                  <Bike size={20} />
                </div>
                <div>
                   <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Partner</p>
                   <p className="text-[11px] font-black text-gray-800">On the way</p>
                   <button className="text-[9px] font-bold text-[#E31837] flex items-center justify-center gap-0.5">
                     View Details <ChevronRight size={8} />
                   </button>
                </div>
              </div>
            </div>

            {/* Bill Details */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 italic">Bill Details</h3>
                <button className="bg-red-50 text-[#E31837] text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 active:scale-95 transition-transform">
                  Download Bill <Download size={14} />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {orderItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shadow-sm shrink-0">
                      <img src={item.image || null} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 border border-green-600 p-0.5 flex items-center justify-center shrink-0">
                          <div className="w-full h-full bg-green-600 rounded-full" />
                        </div>
                        <p className="text-[12px] font-bold text-gray-800 leading-tight italic">{item.name}</p>
                      </div>
                      <p className="text-[11px] font-bold text-gray-400 ml-4.5 mt-1">₹{item.price}</p>
                    </div>
                    <div className="flex flex-col items-end justify-center">
                      <div className="bg-red-50 text-[#E31837] w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold mb-1">
                        {item.quantity}
                      </div>
                      <p className="text-[12px] font-black text-gray-800 italic">₹{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 pt-4 border-t border-dashed border-gray-100">
                <div className="flex justify-between items-center text-[11px] font-bold text-gray-400 uppercase tracking-tight">
                  <span>Subtotal ({orderItems.length} Items)</span>
                  <span className="text-gray-800 italic">₹{subtotalVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-bold text-gray-400 uppercase tracking-tight">
                  <span>Delivery Charges</span>
                  <span className="text-gray-800 italic">₹{deliveryVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-bold text-gray-400 uppercase tracking-tight">
                  <span>Packaging Charges</span>
                  <span className="text-gray-800 italic">₹{packagingVal.toFixed(2)}</span>
                </div>
                {discountVal > 0 && (
                  <div className="flex justify-between items-center text-[11px] font-bold text-green-600 uppercase tracking-tight">
                    <span>Promo Code ({promoCode || 'SAVE20'})</span>
                    <span className="italic">-₹{discountVal.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="h-px border-t border-dashed border-gray-100 my-2" />
                
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-gray-900 italic">Total Amount</h4>
                  <span className="text-2xl font-black text-[#E31837] italic">₹{(totalVal + packagingVal).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50/60 rounded-xl p-4 flex items-center gap-3 border border-green-100 font-sans">
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
               <CheckCircle2 size={16} />
            </div>
            <p className="text-[11px] font-bold text-green-700 leading-tight">Your order is confirmed and will be delivered soon.</p>
          </div>

          <div className="space-y-3 pt-4">
            <button 
              onClick={() => setCurrentStep('tracking')}
              className="w-full bg-gradient-to-r from-[#FF2B2B] to-[#E31837] text-white h-16 rounded-[22px] font-bold text-sm shadow-[0_10px_30px_rgba(227,24,55,0.3)] transition-all active:scale-95 flex items-center justify-between px-8 group font-sans"
            >
              <div className="flex items-center gap-3">
                <Bike size={24} />
                <span>Track Live Status</span>
              </div>
              <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => navigate('/')}
              className="w-full h-16 rounded-[22px] border border-gray-100 bg-white text-gray-500 font-bold text-sm hover:border-gray-200 hover:text-gray-900 transition-all shadow-sm flex items-center px-8 gap-4 font-sans"
            >
              <Home size={22} />
              <span>Go Back Home</span>
            </button>
          </div>
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
        className="space-y-8"
      >
        <div className="bg-white rounded-[50px] p-10 shadow-2xl shadow-gray-200/50 border border-gray-50/50 space-y-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-3xl font-black text-gray-900 italic tracking-tighter leading-none">
                {isCancelled ? 'Order Voided' : 
                 currentOrder?.status === 'delivered' ? 'Feast Delivered!' : 
                 currentOrder?.status === 'on the way' ? 'Almost There!' :
                 currentOrder?.status === 'ready' ? 'Hot & Ready!' : 'In the Works'}
              </h3>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
                <div className="w-1 h-1 bg-red-500 rounded-full animate-ping" />
                {isCancelled ? 'Transaction cancelled by system' :
                 currentOrder?.status === 'received' ? 'Waiting for chef confirmation' :
                 currentOrder?.status === 'preparing' ? 'Sizzling & seasoning now' : 
                 currentOrder?.status === 'on the way' ? 'Hero is 5 mins away' : 
                 currentOrder?.status === 'delivered' ? 'Check your doorstep' : 'Gearing up for greatness'}
              </p>
            </div>
            <div className="w-14 h-14 bg-red-500 rounded-[22px] text-white flex items-center justify-center shadow-lg shadow-red-500/20 transform rotate-6">
              <Clock size={28} />
            </div>
          </div>

          {!isCancelled && (
            <div className="space-y-12 relative px-2">
              <div className="absolute left-[21px] top-4 bottom-4 w-[2px] bg-gray-100" />
              
              {statusSteps.map((s, idx) => (
                <div key={idx} className="flex gap-8 relative">
                  <div className={cn(
                    "w-9 h-9 rounded-full border-4 border-white flex items-center justify-center z-10 shadow-xl transition-all duration-700",
                    idx < currentStatusIdx ? "bg-red-500 scale-90" : idx === currentStatusIdx ? "bg-white ring-4 ring-red-500/10" : "bg-gray-100"
                  )}>
                    {idx < currentStatusIdx ? <CheckCircle2 size={16} className="text-white" /> : 
                     idx === currentStatusIdx ? <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" /> : null}
                  </div>
                  <div className={cn("transition-all duration-500", idx > currentStatusIdx ? "opacity-30 translate-x-2" : "opacity-100 translate-x-0")}>
                    <p className={cn(
                      "text-[13px] font-black uppercase tracking-widest leading-none mb-1.5", 
                      idx === currentStatusIdx ? "text-red-500 italic" : "text-gray-900"
                    )}>
                      {s.label}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight italic">{idx <= currentStatusIdx ? s.desc : 'Next Mission Step'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 text-white rounded-[40px] p-6 flex items-center gap-5 shadow-2xl relative overflow-hidden group">
          <div className="w-16 h-16 rounded-[20px] bg-white/10 p-1 overflow-hidden shrink-0 transform group-hover:rotate-12 transition-transform border border-white/10">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentOrder?.deliveryPartnerName || 'Delivery'}`} 
              alt="" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">
              {currentOrder?.deliveryPartnerName ? 'Out for Delivery' : 'Assigning Hero'}
            </p>
            <p className="text-base font-black italic tracking-tighter leading-none">
              {currentOrder?.deliveryPartnerName || 'Fetching Hero Details...'}
            </p>
            {currentOrder?.deliveryPartnerName ? (
               <div className="flex items-center gap-1 text-yellow-500 mt-2">
                 <Star size={10} fill="currentColor" />
                 <span className="text-[10px] font-black text-gray-400">4.9 • Best Pilot</span>
               </div>
            ) : (
               <div className="flex items-center gap-2 mt-2">
                 <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-bold text-gray-600 italic">Chef is finishing your meal</span>
               </div>
            )}
          </div>
          <div className="flex gap-2">
            {currentOrder?.deliveryPartnerPhone ? (
              <a 
                href={`tel:${currentOrder.deliveryPartnerPhone}`}
                className="p-4 bg-red-500 hover:bg-red-600 rounded-[24px] text-white transition-all active:scale-95 shadow-lg shadow-red-500/20 flex items-center justify-center"
              >
                <Phone size={20} />
              </a>
            ) : (
              <button className="p-4 bg-white/5 cursor-not-allowed rounded-[24px] text-white/20 transition-all shadow-inner">
                <Phone size={20} />
              </button>
            )}
          </div>
        </div>

        {cancelTimeLeft > 0 && !isCancelled && (
          <button 
            onClick={handleCancelOrder}
            className="w-full text-[10px] font-black text-white uppercase tracking-widest bg-[#E31837] py-4 rounded-[20px] shadow-lg shadow-red-500/20 active:scale-95 transition-all"
          >
            Order Cancellation available for {cancelTimeLeft} more seconds
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/30 flex flex-col font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-gradient-to-br from-[#FF2B2B] to-[#E31837] z-50 px-4 pt-8 pb-6 shadow-xl lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                if (currentStep === 'address') setCurrentStep('summary');
                else if (currentStep === 'payment') setCurrentStep('address');
                else if (currentStep === 'tracking' || currentStep === 'confirmation') navigate('/');
                else navigate('/');
              }} 
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
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
                      "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-500",
                      isActive ? "bg-white text-[#E31837] scale-110 shadow-lg" : 
                      isPast ? "bg-white/40 text-white" : "bg-white/20 text-white/50 border border-white/20"
                    )}>
                      {isPast ? <CheckCircle2 size={14} /> : idx + 1}
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold transition-colors duration-500 uppercase tracking-wider",
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
      <main className="flex-1 pt-48 lg:pt-56 pb-32 px-4 lg:px-8 w-full">
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
              <aside className="lg:col-span-4 hidden lg:block sticky top-56 space-y-6">
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
      <footer className="hidden lg:block fixed bottom-0 left-0 right-0 p-8 text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.3em]">
        Safe • Secure • No-Contact Delivery
      </footer>

      {showAnimatedSuccess && renderAnimatedSuccess()}
    </div>
  );
}
