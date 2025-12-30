import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useFavorites() {
    const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    const refreshFavorites = useCallback(async () => {
        try {
            const ids = await api.getFavorites();
            setFavoriteIds(new Set(ids));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        refreshFavorites();

        // Listen for global updates (optimistic UI sync across components)
        const handleLocalUpdate = () => refreshFavorites();
        window.addEventListener('lightwork:favorites-updated', handleLocalUpdate);
        return () => window.removeEventListener('lightwork:favorites-updated', handleLocalUpdate);
    }, [refreshFavorites]);

    const toggleFavorite = async (moduleId: string) => {
        const isFav = favoriteIds.has(moduleId);

        // Optimistic Update
        const next = new Set(favoriteIds);
        if (isFav) next.delete(moduleId);
        else next.add(moduleId);
        setFavoriteIds(next);

        // API Call
        let success = false;
        if (isFav) {
            success = await api.removeFavorite(moduleId);
        } else {
            success = await api.addFavorite(moduleId);
        }

        if (!success) {
            // Revert on failure
            refreshFavorites();
        } else {
            // Notify other components
            window.dispatchEvent(new Event('lightwork:favorites-updated'));
        }
    };

    const isFavorite = (moduleId: string) => favoriteIds.has(moduleId);

    return { favoriteIds, toggleFavorite, isFavorite, isLoading };
}
