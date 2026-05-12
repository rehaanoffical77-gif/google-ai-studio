import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from './firebase';

const MENU_ITEMS = [
  {
    name: "Classic Paneer Tikka",
    price: 350,
    description: "Cottage cheese cubes marinated in spices and grilled in tandoor.",
    category: "Starters",
    image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=800",
    rating: 4.5,
    isAvailable: true
  },
  {
    name: "Butter Chicken",
    price: 450,
    description: "Tender chicken cooked in a rich, creamy tomato-based gravy.",
    category: "Main Course",
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=800",
    rating: 4.8,
    isAvailable: true
  },
  {
    name: "Dal Makhani",
    price: 320,
    description: "Slow-cooked black lentils with cream and butter.",
    category: "Main Course",
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&q=80&w=800",
    rating: 4.6,
    isAvailable: true
  },
  {
    name: "Garlic Naan",
    price: 80,
    description: "Leavened bread topped with garlic and coriander.",
    category: "Breads",
    image: "https://images.unsplash.com/photo-1601050690597-df056fb04791?auto=format&fit=crop&q=80&w=800",
    rating: 4.4,
    isAvailable: true
  },
  {
    name: "Gulab Jamun",
    price: 150,
    description: "Soft milk dumplings soaked in sugar syrup.",
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1589119908995-c6837fa14848?auto=format&fit=crop&q=80&w=800",
    rating: 4.7,
    isAvailable: true
  },
  {
    name: "Chicken Biryani",
    price: 380,
    description: "Fragrant basmati rice cooked with succulent chicken and aromatic spices.",
    category: "Main Course",
    image: "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?auto=format&fit=crop&q=80&w=800",
    rating: 4.9,
    isAvailable: true
  },
  {
    name: "Paneer Butter Masala",
    price: 360,
    description: "Creamy and mildly sweet cottage cheese curry.",
    category: "Main Course",
    image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=800",
    rating: 4.7,
    isAvailable: true
  },
  {
    name: "Mango Lassi",
    price: 120,
    description: "Refreshing yogurt-based drink with mango pulp.",
    category: "Beverages",
    image: "https://images.unsplash.com/photo-1571006682858-3932d5cbe928?auto=format&fit=crop&q=80&w=800",
    rating: 4.5,
    isAvailable: true
  }
];

export async function seedMenu() {
  const path = 'menu';
  try {
    const menuSnap = await getDocs(collection(db, path));
    if (menuSnap.empty) {
      console.log('Seeding menu data...');
      for (const item of MENU_ITEMS) {
        await addDoc(collection(db, path), item);
      }
      console.log('Seeding complete!');
    }
  } catch (error) {
    // If it's a permission error during seeding, we handle it
    console.error('Seeding failed:', error);
    handleFirestoreError(error, 'write', path);
  }
}
