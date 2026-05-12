import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Checkout from './pages/Checkout';
import Admin from './pages/Admin';
import SplashScreen from './components/SplashScreen';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { useEffect, useState } from 'react';
import { seedMenu } from './lib/seed';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    seedMenu();
    // Pre-loader simulates a minimum splash time
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 500); 
    return () => clearTimeout(timer);
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <SplashScreen />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/owner" element={<Admin />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
