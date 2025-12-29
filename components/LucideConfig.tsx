import React, { createContext, useContext } from 'react';

// Lucide Icon Configuration Context
// Provides consistent icon styling across the application

interface LucideConfigContextType {
    defaultStrokeWidth: number;
    defaultSize: number;
}

const LucideConfigContext = createContext<LucideConfigContextType>({
    defaultStrokeWidth: 1.75,
    defaultSize: 24,
});

export const useLucideConfig = () => useContext(LucideConfigContext);

interface LucideConfigProviderProps {
    children: React.ReactNode;
    strokeWidth?: number;
    size?: number;
}

/**
 * LucideConfigProvider - Provides consistent icon defaults across the app
 * 
 * Usage:
 * Wrap your app with this provider and all Lucide icons will use consistent defaults.
 * You can still override individual icons by passing props directly.
 * 
 * Default strokeWidth: 1.75 (between 1.5 and 2, for a clean, professional look)
 */
export const LucideConfigProvider: React.FC<LucideConfigProviderProps> = ({
    children,
    strokeWidth = 1.75,
    size = 24,
}) => {
    return (
        <LucideConfigContext.Provider value={{ defaultStrokeWidth: strokeWidth, defaultSize: size }}>
            {children}
        </LucideConfigContext.Provider>
    );
};

/**
 * Icon wrapper component that applies consistent stroke width
 * Use this for icons that need the standard styling
 */
interface IconProps {
    icon: React.ComponentType<{ strokeWidth?: number; className?: string; [key: string]: unknown }>;
    className?: string;
    strokeWidth?: number;
    [key: string]: unknown;
}

export const Icon: React.FC<IconProps> = ({ 
    icon: IconComponent, 
    className,
    strokeWidth,
    ...props 
}) => {
    const config = useLucideConfig();
    return (
        <IconComponent 
            strokeWidth={strokeWidth ?? config.defaultStrokeWidth} 
            className={className}
            {...props} 
        />
    );
};

export default LucideConfigProvider;
