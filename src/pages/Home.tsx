import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import Header from '../components/Header';
import FoodCard from '../components/FoodCard';
import CartDrawer from '../components/CartDrawer';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Star, Clock, Heart, ShoppingBag } from 'lucide-react';

export default function Home() {
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { itemCount, items } = useCart();

  useEffect(() => {
    const path = 'menu';
    const q = query(collection(db, path));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenu(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, 'get', path);
    });
  }, []);

  const categories = ['All', ...Array.from(new Set(menu.map(item => item.category)))];

  const filteredMenu = menu.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    // Available items first
    if (a.isAvailable !== false && b.isAvailable === false) return -1;
    if (a.isAvailable === false && b.isAvailable !== false) return 1;
    return 0;
  });

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col overflow-hidden">
      <Header onCartClick={() => setIsCartOpen(true)} />
      
      {/* Search Bar - Mobile Only */}
      <div className="shrink-0 md:hidden px-4 py-3 bg-white border-b border-gray-100">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search for dishes, cuisines..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-11 py-3 text-sm shadow-inner outline-none focus:bg-white focus:border-red-200 transition-all font-medium"
          />
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar max-w-7xl mx-auto px-4 py-6 w-full">
        {/* Mobile Promo Banner */}
        <div className="md:hidden rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-red-500 to-rose-600 p-6 text-white relative shadow-lg">
          <div className="relative z-10">
            <h3 className="text-xl font-black mb-1 italic">Food Junction</h3>
            <p className="text-sm opacity-90 font-medium">Flat 20% OFF on your first order!</p>
            <button className="mt-4 bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-black uppercase">Order Now</button>
          </div>
          <ShoppingBag size={120} className="absolute right-[-20px] bottom-[-20px] opacity-20" />
        </div>

        {/* Category Scroll */}
        <div className="mb-8">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-xl text-sm font-black whitespace-nowrap transition-all duration-300 border ${
                  activeCategory === cat 
                    ? 'bg-gray-900 text-white border-gray-900 shadow-md transform scale-105' 
                    : 'bg-white text-gray-500 border-gray-100 hover:border-red-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-3xl font-black text-gray-950 tracking-tight">
            {activeCategory === 'All' ? 'In the Spotlight' : `${activeCategory} Specials`}
          </h2>
          <div className="flex items-center gap-2 text-[11px] font-black text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg uppercase tracking-wider">
            <Clock size={14} /> 25-35 mins
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-gray-100 rounded-2xl h-40 md:h-80 animate-pulse border border-gray-50" />
            ))}
          </div>
        ) : filteredMenu.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
            {filteredMenu.map((item) => (
              <FoodCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-white rounded-3xl border border-gray-50">
            <Search size={48} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-bold text-gray-800">No match found</h3>
            <p className="text-sm text-gray-500">Try adjusting your search criteria</p>
          </div>
        )}
      </main>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}

