import React, { useState, useEffect } from 'react';
import { useCart as useCartState } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, ChevronRight, X, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { items, total, updateQuantity, removeFromCart, clearCart } = useCartState();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuthWarning, setShowAuthWarning] = useState(false);

  const [deliveryFee, setDeliveryFee] = useState<number>(40);
  const [packagingFee, setPackagingFee] = useState<number>(20);
  const [taxRate, setTaxRate] = useState<number>(0.05);

  useEffect(() => {
    if (!isOpen) return;
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'restaurant'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.deliveryFee !== undefined) setDeliveryFee(Number(data.deliveryFee));
          if (data.packagingFee !== undefined) setPackagingFee(Number(data.packagingFee));
          if (data.taxRate !== undefined) setTaxRate(Number(data.taxRate) / 100);
        }
      } catch (err) {
        console.error("Error fetching restaurant settings in CartDrawer:", err);
      }
    };
    fetchSettings();
  }, [isOpen]);

  const tax = Math.round(total * taxRate);
  const grandTotal = total + tax + deliveryFee + packagingFee;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[60]"
          />
          
          {/* Drawer */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingBag className="text-red-500" />
                <h2 className="text-xl font-bold italic tracking-tight">Shopping Bag</h2>
              </div>
              <button 
                onClick={() => {
                  setShowAuthWarning(false);
                  onClose();
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
              <AnimatePresence>
                {showAuthWarning && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute inset-x-6 top-6 bg-red-50 border border-red-100 rounded-3xl p-8 z-50 text-center shadow-xl space-y-6"
                  >
                    <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg shadow-red-200">
                      <LogIn size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 italic tracking-tighter uppercase mb-2">Login Required</h3>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">Please sign in to your account to place your order from Food Junction.</p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => {
                          setShowAuthWarning(false);
                          onClose();
                          navigate('/profile', { state: { mode: 'login', redirect: '/' } });
                        }}
                        className="w-full bg-red-500 text-white font-black italic tracking-tight py-4 rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                      >
                        SIGN IN NOW
                      </button>
                      <button 
                        onClick={() => setShowAuthWarning(false)}
                        className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
                      >
                        Wait, I'll browse more
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <ShoppingBag size={40} className="text-gray-300" />
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg">Your cart is empty</h3>
                  <p className="text-gray-500">Add some yummy food from the menu to get started!</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <img 
                      src={item.image || null} 
                      alt={item.name} 
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 py-1">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-gray-800 leading-tight">{item.name}</h4>
                        <span className="font-bold text-gray-900">₹{item.price * item.quantity}</span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-2 py-1">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="text-gray-500 hover:text-red-500"
                          >
                            -
                          </button>
                          <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="text-gray-500 hover:text-green-500"
                          >
                            +
                          </button>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-xs text-gray-400 hover:text-red-500 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-4">
                <div className="space-y-2 border-b border-dashed border-gray-200 pb-3">
                  <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                    <span>Subtotal</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                    <span>Restaurant Packaging</span>
                    <span>₹{packagingFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                    <span>Delivery Fee</span>
                    <span className="text-green-600">₹{deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                    <span>Taxes & Charges ({Math.round(taxRate * 100)}%)</span>
                    <span>₹{tax.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-900 font-black italic tracking-tight uppercase text-xs">Total Amount</span>
                  <span className="text-2xl font-black text-red-600 italic">₹{grandTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={() => {
                    if (!user) {
                      setShowAuthWarning(true);
                      return;
                    }
                    onClose();
                    navigate('/checkout');
                  }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-200"
                >
                  Proceed to Checkout
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
