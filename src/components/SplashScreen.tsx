import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UtensilsCrossed, Pizza, Coffee, Beef, Cookie } from 'lucide-react';

export default function SplashScreen() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const floatingIcons = [
    { Icon: Pizza, top: '15%', left: '10%', delay: 0.2 },
    { Icon: Coffee, top: '20%', right: '15%', delay: 0.5 },
    { Icon: Beef, bottom: '25%', left: '20%', delay: 0.8 },
    { Icon: Cookie, bottom: '15%', right: '10%', delay: 1.1 },
  ];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: [0.43, 0.13, 0.23, 0.96] }}
          className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Background Decorative Circles */}
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.05 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute -top-[20%] -left-[20%] w-[100%] aspect-square bg-red-600 rounded-full"
          />
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.05 }}
            transition={{ duration: 2, ease: "easeOut", delay: 0.2 }}
            className="absolute -bottom-[20%] -right-[20%] w-[100%] aspect-square bg-red-600 rounded-full"
          />

          {/* Floating Icons */}
          {floatingIcons.map(({ Icon, top, left, right, bottom, delay }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.1, scale: 1 }}
              transition={{ delay, duration: 1 }}
              style={{ position: 'absolute', top, left, right, bottom }}
              className="text-red-500"
            >
              <Icon size={48} strokeWidth={1} />
            </motion.div>
          ))}
          
          <div className="relative flex flex-col items-center z-10 px-6">
            {/* Logo Container */}
            <motion.div
              initial={{ scale: 0, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ 
                duration: 1, 
                type: "spring",
                stiffness: 260,
                damping: 20 
              }}
              className="w-28 h-28 bg-red-600 rounded-[40px] flex items-center justify-center shadow-[0_20px_50px_rgba(220,38,38,0.3)] mb-10 overflow-hidden relative"
            >
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <UtensilsCrossed size={56} className="text-white" />
              </motion.div>
              {/* Shine effect */}
              <motion.div 
                animate={{ x: ['100%', '-100%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
              />
            </motion.div>

            {/* App Name */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-center"
            >
              <h1 className="text-5xl font-black text-gray-900 tracking-tighter italic uppercase mb-3">
                Food<span className="text-red-600">Junction</span>
              </h1>
              <div className="flex items-center justify-center gap-3">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }} 
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-2 h-2 bg-red-600 rounded-full" 
                />
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-[0.2em] leading-none">
                  Mandamarri's 1st Delivery Partner
                </p>
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }} 
                  transition={{ repeat: Infinity, duration: 1, delay: 0.5 }}
                  className="w-2 h-2 bg-red-600 rounded-full" 
                />
              </div>
            </motion.div>
          </div>

          {/* Progress bar at bottom */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48 space-y-4">
            <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
                className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
              />
            </div>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              className="text-center text-[10px] font-black text-gray-300 uppercase tracking-widest"
            >
              Initializing Happiness
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
