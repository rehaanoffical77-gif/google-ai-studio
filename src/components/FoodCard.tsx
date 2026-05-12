import { Star, Plus, Minus, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc,
  onSnapshot 
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import React, { useState, useEffect } from 'react';

export default function FoodCard({ item }: any) {
  const { addToCart, updateQuantity, items } = useCart();
  const { user } = useAuth();
  const cartItem = items.find((i) => i.id === item.id);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favId, setFavId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'favorites'), 
      where('userId', '==', user.uid), 
      where('itemId', '==', item.id)
    );
    return onSnapshot(q, (snap) => {
      setIsFavorite(!snap.empty);
      if (!snap.empty) setFavId(snap.docs[0].id);
      else setFavId(null);
    });
  }, [user, item.id]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    try {
      if (isFavorite && favId) {
        await deleteDoc(doc(db, 'favorites', favId));
      } else {
        await addDoc(collection(db, 'favorites'), {
          userId: user.uid,
          itemId: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          addedAt: new Date()
        });
      }
    } catch (err) {
      handleFirestoreError(err, 'write', 'favorites');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100 flex md:flex-col h-full relative"
    >
      <div className="relative w-32 h-32 md:w-full md:aspect-[4/3] shrink-0 overflow-hidden">
        <img 
          src={item.image || null} 
          alt={item.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 shadow-lg z-10">
          {item.rating} <Star size={10} fill="currentColor" />
        </div>
        
        {/* Favorite Button */}
        <button 
          onClick={toggleFavorite}
          className={cn(
            "absolute top-2 right-2 p-1.5 md:p-2 rounded-xl transition-all duration-300 z-10 backdrop-blur-md shadow-lg",
            isFavorite 
              ? "bg-red-500 text-white scale-110" 
              : "bg-white/90 text-gray-400 hover:text-red-500 hover:bg-white"
          )}
        >
          <Heart size={16} fill={isFavorite ? "currentColor" : "none"} className="md:w-[18px] md:h-[18px]" />
        </button>
      </div>

      <div className="p-3 md:p-4 flex flex-col flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className="font-extrabold text-gray-900 text-sm md:text-lg leading-tight truncate md:whitespace-normal">{item.name}</h3>
        </div>
        <p className="text-gray-500 text-[11px] md:text-sm line-clamp-2 mb-3 md:mb-4 flex-1">
          {item.description}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <span className="font-black text-gray-950 text-sm md:text-xl tracking-tight">₹{item.price}</span>
          
          <div className="relative">
            {!cartItem ? (
              <button 
                onClick={() => addToCart(item)}
                className="bg-white text-green-600 border border-gray-200 px-4 md:px-6 py-1 md:py-1.5 rounded-lg font-black shadow-sm hover:bg-gray-50 transition-colors uppercase text-[10px] md:text-sm"
              >
                Add
              </button>
            ) : (
              <div className="flex items-center gap-2 md:gap-3 bg-white border border-green-600 rounded-lg px-1.5 md:px-2 py-0.5 md:py-1 shadow-sm">
                <button 
                  onClick={() => updateQuantity(item.id, -1)}
                  className="text-green-600 hover:bg-green-50 rounded p-0.5 md:p-1"
                >
                  <Minus size={14} className="md:w-4 md:h-4" />
                </button>
                <span className="font-black text-green-600 min-w-[16px] md:min-w-[20px] text-center text-xs md:text-base">
                  {cartItem.quantity}
                </span>
                <button 
                  onClick={() => updateQuantity(item.id, 1)}
                  className="text-green-600 hover:bg-green-50 rounded p-0.5 md:p-1"
                >
                  <Plus size={14} className="md:w-4 md:h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
