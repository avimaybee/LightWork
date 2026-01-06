import React, { useState } from 'react';
import { useAuth } from '../services/authContext';
import { useSettings } from '../hooks/useSettings';
import {
    User, Keyboard, Monitor, Shield, LogOut, Moon, Sun, Laptop,
    Sparkles, RefreshCcw, Save, Trash2, Database, Sliders, Zap,
    Wand2, Brain, AlertCircle, FileType, HardDrive
} from 'lucide-react';

interface SettingsPageProps {
    onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
    const { user, signOut } = useAuth();
    const { settings, updateSettings, resetSettings } = useSettings();
    const [activeTab, setActiveTab] = useState<'general' | 'workflow' | 'data' | 'labs' | 'account'>('general');

    const shortcuts = [
        { key: 'Space', action: 'Quick Preview (Lightbox)' },
        { key: 'Esc', action: 'Close Preview / Deselect All' },
        { key: 'Delete', action: 'Delete Selected Images' },
        { key: 'Ctrl + A', action: 'Select All Visible' },
        { key: 'Ctrl + Enter', action: 'Run Process Batch' },
        { key: 'Arrows', action: 'Navigate Grid' },
    ];

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

    const NavButton = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'}`}
        >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
        </button>
    );

    const SectionHeader = ({ title, description }: { title: string, description?: string }) => (
        <div className="border-b border-stone-100 pb-4 mb-6">
            <h3 className="text-lg font-bold text-stone-900 font-heading">{title}</h3>
            {description && <p className="text-sm text-stone-500 mt-1">{description}</p>}
        </div>
    );

    const Toggle = ({ label, description, checked, onChange, disabled }: { label: string, description?: string, checked: boolean, onChange: (c: boolean) => void, disabled?: boolean }) => (
        <div className={`flex items-start justify-between p-4 bg-white border border-stone-200 rounded-xl ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <div className="flex-1 mr-4">
                <div className="text-sm font-bold text-stone-900">{label}</div>
                {description && <div className="text-xs text-stone-500 mt-1">{description}</div>}
            </div>
            <button
                onClick={() => !disabled && onChange(!checked)}
                disabled={disabled}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-clay-500' : 'bg-stone-200'}`}
            >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </div>
    );

    return (
        <div className="flex-1 h-full flex flex-col bg-[#FDFCFB] overflow-hidden font-sans">
            {/* Header */}
            <div className="h-20 flex items-center px-10 border-b border-stone-200 shrink-0">
                <h1 className="text-2xl font-bold text-stone-900 font-heading">Settings</h1>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 border-r border-stone-200 p-6 space-y-2 overflow-y-auto">
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 px-4 mt-2">App</div>
                    <NavButton id="general" icon={Monitor} label="Appearance" />
                    <NavButton id="workflow" icon={Zap} label="Workflow" />

                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 px-4 mt-6">Data</div>
                    <NavButton id="data" icon={Database} label="Data & Storage" />

                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 px-4 mt-6">System</div>
                    <NavButton id="labs" icon={Sparkles} label="Beta & Labs" />
                    <NavButton id="account" icon={User} label="Account" />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 max-w-4xl">

                    {/* GENERAL TAB */}
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <SectionHeader title="Theme" description="Customize how LightWork looks." />
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { id: 'light', icon: Sun, label: 'Light' },
                                        { id: 'dark', icon: Moon, label: 'Dark' },
                                        { id: 'system', icon: Laptop, label: 'System' }
                                    ].map((theme) => (
                                        <button
                                            key={theme.id}
                                            onClick={() => updateSettings({ theme: theme.id as any })}
                                            className={`border rounded-xl p-4 flex flex-col items-center gap-3 transition-all ${settings.theme === theme.id ? 'border-clay-500 bg-clay-50 ring-1 ring-clay-500' : 'border-stone-200 hover:border-stone-300 bg-white'}`}
                                        >
                                            <div className={`w-full h-20 rounded-lg shadow-sm border ${theme.id === 'dark' ? 'bg-stone-900 border-stone-800' : theme.id === 'system' ? 'bg-gradient-to-br from-stone-100 to-stone-800' : 'bg-white border-stone-100'}`} />
                                            <div className={`flex items-center gap-2 text-sm font-bold ${settings.theme === theme.id ? 'text-clay-700' : 'text-stone-500'}`}>
                                                <theme.icon className="w-4 h-4" /> {theme.label}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <SectionHeader title="Display Density" />
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'comfortable', label: 'Comfortable', desc: 'Larger cards, more breathing room' },
                                        { id: 'compact', label: 'Compact', desc: 'More items visible at once' }
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() => updateSettings({ density: mode.id as any })}
                                            className={`text-left p-4 border rounded-xl transition-all ${settings.density === mode.id ? 'border-clay-500 bg-clay-50 ring-1 ring-clay-500' : 'border-stone-200 hover:border-stone-300 bg-white'}`}
                                        >
                                            <div className="text-sm font-bold text-stone-900">{mode.label}</div>
                                            <div className="text-xs text-stone-500 mt-1">{mode.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Toggle
                                label="Reduce Motion"
                                description="Minimize animations for a faster, less distracting feel."
                                checked={settings.reduceMotion}
                                onChange={(c) => updateSettings({ reduceMotion: c })}
                            />
                        </div>
                    )}

                    {/* WORKFLOW TAB */}
                    {activeTab === 'workflow' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <SectionHeader title="Processing Defaults" description="Set your preferred starting configuration for new projects." />
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => updateSettings({ defaultModel: 'fast' })}
                                        className={`text-left p-4 border rounded-xl transition-all ${settings.defaultModel === 'fast' ? 'border-clay-500 bg-clay-50 ring-1 ring-clay-500' : 'border-stone-200 hover:border-stone-300 bg-white'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-1 rounded bg-yellow-100 text-yellow-700"><Zap className="w-3 h-3" /></div>
                                            <div className="text-sm font-bold text-stone-900">Nano Banana (Fast)</div>
                                        </div>
                                        <div className="text-xs text-stone-500">Optimized for speed. Best for quick drafts and simple tasks.</div>
                                    </button>

                                    <button
                                        onClick={() => updateSettings({ defaultModel: 'pro' })}
                                        className={`text-left p-4 border rounded-xl transition-all ${settings.defaultModel === 'pro' ? 'border-clay-500 bg-clay-50 ring-1 ring-clay-500' : 'border-stone-200 hover:border-stone-300 bg-white'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-1 rounded bg-indigo-100 text-indigo-700"><Sparkles className="w-3 h-3" /></div>
                                            <div className="text-sm font-bold text-stone-900">Nano Banana Pro</div>
                                        </div>
                                        <div className="text-xs text-stone-500">Higher quality, better reasoning. Best for complex images.</div>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <SectionHeader title="Automation" description="Streamline your workflow with smart actions." />
                                <div className="space-y-4">
                                    <Toggle
                                        label="Auto-Draft Descriptions"
                                        description="Automatically analyze and describe images when uploaded."
                                        checked={settings.autoDraft}
                                        onChange={(c) => updateSettings({ autoDraft: c })}
                                    />
                                    <Toggle
                                        label="Smart Rename on Upload"
                                        description="Suggest better filenames based on image content."
                                        checked={settings.smartRename}
                                        onChange={(c) => updateSettings({ smartRename: c })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DATA TAB */}
                    {activeTab === 'data' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <SectionHeader title="Export Preferences" description="Configure how files are saved." />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 block">Default Format</label>
                                        <div className="flex gap-2">
                                            {['png', 'jpg', 'webp'].map((fmt) => (
                                                <button
                                                    key={fmt}
                                                    onClick={() => updateSettings({ defaultExportFormat: fmt as any })}
                                                    className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${settings.defaultExportFormat === fmt ? 'bg-clay-50 border-clay-500 text-clay-700' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'}`}
                                                >
                                                    {fmt.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 block">Filename Pattern</label>
                                        <select
                                            value={settings.filenamePattern}
                                            onChange={(e) => updateSettings({ filenamePattern: e.target.value as any })}
                                            className="w-full p-2.5 rounded-lg border border-stone-200 bg-white text-sm font-sans focus:outline-none focus:ring-2 focus:ring-clay-500/20"
                                        >
                                            <option value="original">Original (image-001.png)</option>
                                            <option value="smart">Smart (a-cat-in-space.png)</option>
                                            <option value="date_original">Date + Original (2024-01-01_image.png)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-stone-900 font-heading">Cache & Storage</h3>
                                        <p className="text-sm text-stone-500 mt-1">Manage local data usage.</p>
                                    </div>
                                    <button onClick={resetSettings} className="text-xs font-bold text-red-600 hover:text-red-700">
                                        Reset Settings
                                    </button>
                                </div>
                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-white rounded-lg shadow-sm text-stone-600">
                                            <HardDrive className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-stone-900">Application Cache</div>
                                            <div className="text-xs text-stone-500">~24 MB used locally</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => alert('Cache cleared!')}
                                        className="px-3 py-1.5 bg-white border border-stone-200 text-stone-600 text-xs font-bold rounded-lg hover:text-red-600 hover:border-red-200 transition-colors"
                                    >
                                        Clear Cache
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LABS TAB */}
                    {activeTab === 'labs' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <SectionHeader title="Experimental Features" description="Try out features that are still in development." />

                            <Toggle
                                label="Enable Experimental Tools"
                                description="Access unreleased tools like 'Magic Eraser' and 'Variant Batching'."
                                checked={settings.experimentalFeatures}
                                onChange={(c) => updateSettings({ experimentalFeatures: c })}
                            />

                            <Toggle
                                label="Debug Mode"
                                description="Show technical details and raw API logs in the inspector."
                                checked={settings.debugMode}
                                onChange={(c) => updateSettings({ debugMode: c })}
                            />

                            <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl flex items-start gap-3">
                                <Sparkles className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="text-sm font-bold text-sky-900">Have a suggestion?</h4>
                                    <p className="text-xs text-sky-700 mt-1">We build features based on user feedback. Let us know what you want to see next!</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ACCOUNT TAB */}
                    {activeTab === 'account' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <SectionHeader title="Profile" />

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

                            <div>
                                <h3 className="text-lg font-bold text-stone-900 font-heading border-b border-stone-100 pb-2 mb-4">Shortcuts</h3>
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
