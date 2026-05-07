import React from 'react';
import { 
  Utensils, 
  Users, 
  ShoppingCart, 
  Shirt, 
  GraduationCap,
  Building2,
  MapPin,
  Moon,
  Beef
} from 'lucide-react';
import { ListingCategory } from '../types';

interface CategoryIconProps {
  category: ListingCategory;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, className }) => {
  switch (category) {
    case 'Restaurants':
      return <Utensils className={className} />;
    case 'Mosques':
      return <Moon className={className} />;
    case 'Organizations':
      return <Users className={className} />;
    case 'Grocery':
      return <ShoppingCart className={className} />;
    case 'Clothing':
      return <Shirt className={className} />;
    case 'Schools':
      return <GraduationCap className={className} />;
    case 'Butchers':
      return <Beef className={className} />;
    default:
      return <MapPin className={className} />;
  }
};
