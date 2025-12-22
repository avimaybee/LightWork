/**
 * Module icon mapping
 * Maps module icons to Lucide React icons
 * Expanded to support 20+ categories for comprehensive module coverage
 */

import {
    Utensils,
    ShoppingBag,
    User,
    Home,
    Camera,
    Sparkles,
    ImageIcon,
    Wand2,
    Palette,
    Brush,
    Layers,
    Aperture,
    Film,
    Diamond,
    Crown,
    Leaf,
    Mountain,
    Coffee,
    Shirt,
    Watch,
    Car,
    Building2,
    Dog,
    Sun,
    Moon,
    Flower2,
    Scissors,
    PenTool,
    Frame,
    ZoomIn,
    type LucideIcon
} from 'lucide-react';

export const moduleIcons: Record<string, LucideIcon> = {
    // Original icons
    'utensils': Utensils,
    'shopping-bag': ShoppingBag,
    'user': User,
    'home': Home,
    'camera': Camera,
    'sparkles': Sparkles,
    'image': ImageIcon,
    'wand': Wand2,
    
    // Expanded icon set
    'palette': Palette,
    'brush': Brush,
    'layers': Layers,
    'aperture': Aperture,
    'film': Film,
    'diamond': Diamond,
    'crown': Crown,
    'leaf': Leaf,
    'mountain': Mountain,
    'coffee': Coffee,
    'shirt': Shirt,
    'watch': Watch,
    'car': Car,
    'building': Building2,
    'dog': Dog,
    'sun': Sun,
    'moon': Moon,
    'flower': Flower2,
    'scissors': Scissors,
    'pen-tool': PenTool,
    'frame': Frame,
    'zoom-in': ZoomIn,
};

export function getModuleIcon(iconName: string | null): LucideIcon {
    return moduleIcons[iconName || ''] || Sparkles;
}

// Category labels - expanded to support more module types
export const categoryLabels: Record<string, string> = {
    'food': '🍽️ Food & Beverage',
    'product': '📦 E-Commerce',
    'portrait': '👤 Portrait',
    'realestate': '🏠 Real Estate',
    'general': '✨ General',
    'interior': '🛋️ Interior Design',
    'fashion': '👗 Fashion & Apparel',
    'macro': '🔬 Macro Photography',
    'automotive': '🚗 Automotive',
    'jewelry': '💎 Jewelry & Accessories',
    'lifestyle': '🌟 Lifestyle',
    'nature': '🌿 Nature & Outdoors',
    'pet': '🐾 Pets & Animals',
    'art': '🎨 Art & Creative',
    'architecture': '🏛️ Architecture',
};
