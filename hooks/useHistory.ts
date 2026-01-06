import { useState, useCallback, useRef } from 'react';

/**
 * A generic undo/redo hook that maintains a history stack.
 * Works with any serializable state.
 */

interface UseHistoryOptions<T> {
    maxHistory?: number; // Maximum number of states to keep (default: 50)
    debounceMs?: number; // Debounce threshold for rapid changes (default: 300)
}

interface UseHistoryReturn<T> {
    state: T;
    setState: (newState: T | ((prev: T) => T), options?: { skipHistory?: boolean }) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    clearHistory: () => void;
    historyLength: number;
}

export function useHistory<T>(
    initialState: T,
    options: UseHistoryOptions<T> = {}
): UseHistoryReturn<T> {
    const { maxHistory = 50, debounceMs = 300 } = options;

    // Current state
    const [state, setStateInternal] = useState<T>(initialState);

    // History stacks
    const pastRef = useRef<T[]>([]);
    const futureRef = useRef<T[]>([]);

    // Debounce tracking
    const lastChangeTimeRef = useRef<number>(0);
    const lastStateRef = useRef<T>(initialState);

    const canUndo = pastRef.current.length > 0;
    const canRedo = futureRef.current.length > 0;

    const setState = useCallback(
        (newStateOrUpdater: T | ((prev: T) => T), opts: { skipHistory?: boolean } = {}) => {
            setStateInternal((prevState) => {
                const newState =
                    typeof newStateOrUpdater === 'function'
                        ? (newStateOrUpdater as (prev: T) => T)(prevState)
                        : newStateOrUpdater;

                // Skip history if explicitly requested
                if (opts.skipHistory) {
                    lastStateRef.current = newState;
                    return newState;
                }

                const now = Date.now();
                const timeSinceLastChange = now - lastChangeTimeRef.current;

                // Debounce: merge rapid changes into a single history entry
                // Only push to history if enough time has passed since last change
                if (timeSinceLastChange > debounceMs) {
                    // Push current state to past stack
                    pastRef.current = [...pastRef.current, prevState].slice(-maxHistory);
                    // Clear future on new action
                    futureRef.current = [];
                }

                lastChangeTimeRef.current = now;
                lastStateRef.current = newState;
                return newState;
            });
        },
        [maxHistory, debounceMs]
    );

    const undo = useCallback(() => {
        if (pastRef.current.length === 0) return;

        const previous = pastRef.current[pastRef.current.length - 1];
        const newPast = pastRef.current.slice(0, -1);

        pastRef.current = newPast;
        futureRef.current = [lastStateRef.current, ...futureRef.current];
        lastStateRef.current = previous;
        setStateInternal(previous);
    }, []);

    const redo = useCallback(() => {
        if (futureRef.current.length === 0) return;

        const next = futureRef.current[0];
        const newFuture = futureRef.current.slice(1);

        pastRef.current = [...pastRef.current, lastStateRef.current];
        futureRef.current = newFuture;
        lastStateRef.current = next;
        setStateInternal(next);
    }, []);

    const clearHistory = useCallback(() => {
        pastRef.current = [];
        futureRef.current = [];
    }, []);

    return {
        state,
        setState,
        undo,
        redo,
        canUndo,
        canRedo,
        clearHistory,
        historyLength: pastRef.current.length,
    };
}

/**
 * Specialized hook for tracking state changes with named actions.
 * Useful for debugging and displaying action history to users.
 */
interface HistoryEntry<T> {
    state: T;
    action: string;
    timestamp: number;
}

interface UseNamedHistoryReturn<T> extends Omit<UseHistoryReturn<T>, 'setState'> {
    setState: (newState: T | ((prev: T) => T), actionName?: string) => void;
    lastAction: string | null;
}

export function useNamedHistory<T>(
    initialState: T,
    options: UseHistoryOptions<T> = {}
): UseNamedHistoryReturn<T> {
    const history = useHistory<HistoryEntry<T>>(
        { state: initialState, action: 'Initial', timestamp: Date.now() },
        options
    );

    const setState = useCallback(
        (newStateOrUpdater: T | ((prev: T) => T), actionName: string = 'Update') => {
            history.setState((prev) => {
                const newState =
                    typeof newStateOrUpdater === 'function'
                        ? (newStateOrUpdater as (prev: T) => T)(prev.state)
                        : newStateOrUpdater;
                return { state: newState, action: actionName, timestamp: Date.now() };
            });
        },
        [history]
    );

    return {
        state: history.state.state,
        setState,
        undo: history.undo,
        redo: history.redo,
        canUndo: history.canUndo,
        canRedo: history.canRedo,
        clearHistory: history.clearHistory,
        historyLength: history.historyLength,
        lastAction: history.state.action,
    };
}
