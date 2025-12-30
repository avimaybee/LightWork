import React, { useState } from 'react';
import { useAuth } from '../services/authContext';
import { User, Keyboard, Monitor, Shield, LogOut, Moon, Sun, Laptop } from 'lucide-react';
import { generateGradient } from '../utils'; // We'll need to make sure this exists or inline it

interface SettingsPageProps {
    onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
    const { user, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState<'general' | 'shortcuts' | 'account'>('general');

    const shortcuts = [
        { key: 'Space', action: 'Quick Preview (Lightbox)' },
        { key: 'Esc', action: 'Close Preview / Deselect All' },
        { key: 'Delete', action: 'Delete Selected Images' },
        { key: 'Ctrl + A', action: 'Select All Visible' },
        { key: 'Ctrl + Enter', action: 'Run Process Batch' },
        { key: 'Arrows', action: 'Navigate Grid' },
    ];

    // Simple deterministic gradient generator if utils one doesn't exist
    const getGradient = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c1 = `hsl(${hash % 360}, 70%, 60%)`;
        const c2 = `hsl(${(hash + 40) % 360}, 70%, 60%)`;
        return `linear-gradient(135deg, ${c1}, ${c2})`;
    };

    const userEmail = user?.email || 'user@example.com';
    const userName = user?.displayName || userEmail.split('@')[0];
    const initial = userName.charAt(0).toUpperCase();

    return (
        <div className="flex-1 h-full flex flex-col bg-[#FDFCFB] overflow-hidden font-sans">
            {/* Header */}
            <div className="h-20 flex items-center px-10 border-b border-stone-200 shrink-0">
                <h1 className="text-2xl font-bold text-stone-900 font-heading">Settings</h1>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 border-r border-stone-200 p-6 space-y-2">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'}`}
                    >
                        <Monitor className="w-4 h-4" />
                        <span>General & Appearance</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('shortcuts')}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'shortcuts' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'}`}
                    >
                        <Keyboard className="w-4 h-4" />
                        <span>Keyboard Shortcuts</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('account')}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'account' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'}`}
                    >
                        <User className="w-4 h-4" />
                        <span>Account</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 max-w-4xl">

                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-stone-900 font-heading border-b border-stone-100 pb-2">Appearance</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="border border-stone-200 rounded-xl p-4 flex flex-col items-center gap-3 cursor-not-allowed opacity-60 bg-stone-50">
                                        <div className="w-full h-20 bg-white border border-stone-200 rounded-lg shadow-sm" />
                                        <div className="flex items-center gap-2 text-sm font-bold text-stone-400">
                                            <Sun className="w-4 h-4" /> Light (Default)
                                        </div>
                                    </div>
                                    <div className="border border-stone-200 rounded-xl p-4 flex flex-col items-center gap-3 cursor-not-allowed opacity-60">
                                        <div className="w-full h-20 bg-stone-900 border border-stone-800 rounded-lg shadow-sm" />
                                        <div className="flex items-center gap-2 text-sm font-bold text-stone-400">
                                            <Moon className="w-4 h-4" /> Dark (Soon)
                                        </div>
                                    </div>
                                    <div className="border border-stone-200 rounded-xl p-4 flex flex-col items-center gap-3 cursor-not-allowed opacity-60">
                                        <div className="w-full h-20 bg-gradient-to-br from-stone-100 to-stone-200 border border-stone-200 rounded-lg shadow-sm" />
                                        <div className="flex items-center gap-2 text-sm font-bold text-stone-400">
                                            <Laptop className="w-4 h-4" /> System
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-stone-400 italic">Dark mode coming in v2.0</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'shortcuts' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-lg font-bold text-stone-900 font-heading border-b border-stone-100 pb-2">Keyboard Shortcuts</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {shortcuts.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-white border border-stone-200 rounded-xl shadow-sm">
                                        <span className="text-sm font-medium text-stone-600">{s.action}</span>
                                        <kbd className="px-2.5 py-1 bg-stone-100 border border-stone-200 rounded-lg text-xs font-bold text-stone-500 font-mono shadow-[0_2px_0_0_rgba(0,0,0,0.05)]">
                                            {s.key}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'account' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-lg font-bold text-stone-900 font-heading border-b border-stone-100 pb-2">Profile</h3>

                            <div className="flex items-start gap-6">
                                <div
                                    className="w-24 h-24 rounded-full shadow-lg flex items-center justify-center text-3xl font-bold text-white border-4 border-white"
                                    style={{ background: user?.photoURL ? `url(${user.photoURL}) center/cover` : getGradient(userName) }}
                                >
                                    {!user?.photoURL && initial}
                                </div>
                                <div className="space-y-1 py-2">
                                    <h4 className="text-xl font-bold text-stone-900">{userName}</h4>
                                    <p className="text-stone-500 font-mono text-sm">{userEmail}</p>
                                    <div className="pt-2">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-200">
                                            <Shield className="w-3 h-3" />
                                            Free Tier
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-stone-100">
                                <button
                                    onClick={() => { if (confirm('Sign out?')) signOut(); }}
                                    className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors text-sm font-bold"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
