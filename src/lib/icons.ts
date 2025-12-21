/**
 * Module icon mapping
 * Maps module icons to Lucide React icons
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
    type LucideIcon
} from 'lucide-react';

export const moduleIcons: Record<string, LucideIcon> = {
    'utensils': Utensils,
    'shopping-bag': ShoppingBag,
    'user': User,
    'home': Home,
    'camera': Camera,
    'sparkles': Sparkles,
    'image': ImageIcon,
    'wand': Wand2,
};

export function getModuleIcon(iconName: string | null): LucideIcon {
    return moduleIcons[iconName || ''] || Sparkles;
}

// Category labels
export const categoryLabels: Record<string, string> = {
    'food': '🍽️ Food & Beverage',
    'product': '📦 E-Commerce',
    'portrait': '👤 Portrait',
    'realestate': '🏠 Real Estate',
    'general': '✨ General',
};
