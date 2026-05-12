import { Search, MapPin, User, ChevronDown, ShoppingBag, ClipboardList, Heart, Map, CreditCard, HelpCircle, Settings, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Header({ onCartClick }: { onCartClick?: () => void }) {
  const { user, login, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setDefaultAddress(null);
      return;
    }
    const q = query(collection(db, 'addresses'), where('userId', '==', user.uid), where('isDefault', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setDefaultAddress(snap.docs[0].data());
      } else {
        setDefaultAddress(null);
      }
    });

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setUserData(snap.data());
      }
    });

    return () => {
      unsub();
      unsubUser();
    };
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfileClick = () => {
    if (window.innerWidth < 768) {
      navigate('/profile');
    } else {
      setIsProfileOpen(!isProfileOpen);
    }
  };

  const ADMIN_EMAIL = 'rehaanoffical77@gmail.com'.toLowerCase();

  const menuItems = [
    ...(user?.email?.toLowerCase() === ADMIN_EMAIL ? [{ icon: LayoutDashboard, label: 'Admin Panel', onClick: () => navigate('/owner') }] : []),
    { icon: ClipboardList, label: 'My Orders', onClick: () => navigate('/profile') },
    { icon: Heart, label: 'Favorite Orders', onClick: () => navigate('/profile') },
    { icon: Map, label: 'Address Book', onClick: () => navigate('/profile') },
    { icon: CreditCard, label: 'Payments', onClick: () => navigate('/profile') },
    { icon: HelpCircle, label: 'Online Ordering Help', onClick: () => navigate('/profile') },
    { icon: Settings, label: 'Settings', onClick: () => navigate('/profile') },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-50/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
      <div className="max-w-7xl mx-auto px-4 h-14 md:h-20 flex items-center justify-between gap-4">
        {/* Logo & Location */}
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="md:hidden" onClick={() => navigate('/')}>
            <h1 className="text-xl font-black text-red-500 tracking-tighter italic cursor-pointer">FJ</h1>
          </div>
          <h1 onClick={() => navigate('/')} className="hidden md:block text-3xl font-black text-red-500 tracking-tighter italic cursor-pointer">
            Food Junction
          </h1>
          <div 
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 text-sm text-gray-700 bg-gray-50/80 px-2.5 py-1.5 rounded-lg border border-gray-100/50 max-w-[180px] md:max-w-none cursor-pointer hover:bg-red-50/50 transition-colors"
          >
            <MapPin size={16} className="text-red-500 shrink-0" />
            <span className="font-bold truncate text-xs md:text-sm">
              {defaultAddress ? `${defaultAddress.label}, ${defaultAddress.city}` : 'Select Location'}
            </span>
            <ChevronDown size={14} className="text-gray-400 shrink-0" />
          </div>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden lg:flex items-center bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 gap-3 min-w-[300px]">
            <Search size={18} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Search for snacks, meals..." 
              className="flex-1 bg-transparent outline-none text-sm text-gray-700"
            />
          </div>

          {/* Cart Icon - Visible on Mobile now */}
          <div className="relative group p-1" onClick={onCartClick}>
            <ShoppingBag size={22} className="text-gray-700 md:w-6 md:h-6 cursor-pointer hover:text-red-500 transition-colors" />
            <AnimatePresence>
              {itemCount > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black"
                >
                  {itemCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Profile Section */}
          <div className="relative" ref={profileRef}>
            {user ? (
              <>
                <button 
                  onClick={handleProfileClick}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-black border-2 border-white shadow-sm overflow-hidden"
                >
                  {(userData?.photoURL || user.photoURL) ? (
                    <img src={userData?.photoURL || user.photoURL || null} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (userData?.displayName || user.displayName)?.[0] || 'U'
                  )}
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden py-2"
                    >
                      <div className="px-4 py-3 border-b border-gray-50">
                        <p className="text-sm font-black text-gray-900 truncate">{userData?.displayName || user.displayName || 'User'}</p>
                        <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                      </div>

                      <div className="py-1">
                        {menuItems.map((item, idx) => (
                          <button 
                            key={idx}
                            onClick={item.onClick}
                            className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                          >
                            <item.icon size={18} className="text-gray-400" />
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div className="border-t border-gray-50 pt-1">
                        <button 
                          onClick={() => logout()}
                          className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-red-500 font-bold hover:bg-gray-50 transition-colors"
                        >
                          <LogOut size={18} />
                          Log out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <button 
                onClick={login}
                className="text-gray-900 font-black text-xs md:text-sm hover:text-red-500 transition-colors uppercase tracking-tight"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

