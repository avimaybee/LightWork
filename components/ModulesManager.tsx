import React, { useState } from 'react';
import { Module, DEFAULT_MODULES } from '../types';
import { ArrowLeft, Plus, Trash2, Edit3, Save, X, LayoutGrid, Check, Terminal, Star, Search, RotateCcw, Sparkles, RefreshCcw } from 'lucide-react';
import { enhancePrompt } from '../services/geminiService';
import { useFavorites } from '../hooks/useFavorites';

interface ModulesManagerProps {
    modules: Module[];
    onCreate: (name: string, prompt: string) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Module>) => void;
    onBack: () => void;
}

export const ModulesManager: React.FC<ModulesManagerProps> = ({ modules, onCreate, onDelete, onUpdate, onBack }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPrompt, setNewPrompt] = useState('');

    // Detail / Edit View State
    const [selectedModule, setSelectedModule] = useState<Module | null>(null);
    const [editPrompt, setEditPrompt] = useState('');

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    const [isEnhancing, setIsEnhancing] = useState(false);

    const handleEnhance = async (currentText: string, setText: (s: string) => void) => {
        if (!currentText.trim()) return;
        setIsEnhancing(true);
        const res = await enhancePrompt(currentText);
        if (res.success && res.result) {
            setText(res.result);
        }
        setIsEnhancing(false);
    };

    const { favoriteIds, toggleFavorite, isFavorite } = useFavorites();

    const CUSTOM_OVERRIDES_KEY = 'lightwork_module_overrides';


    // Load custom overrides for system modules
    const loadOverrides = (): Record<string, string> => {
        try {
            const raw = localStorage.getItem(CUSTOM_OVERRIDES_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    };

    const [moduleOverrides, setModuleOverrides] = useState<Record<string, string>>(loadOverrides);



    const saveOverride = (moduleId: string, prompt: string) => {
        const newOverrides = { ...moduleOverrides, [moduleId]: prompt };
        setModuleOverrides(newOverrides);
        try {
            localStorage.setItem(CUSTOM_OVERRIDES_KEY, JSON.stringify(newOverrides));
        } catch {
            // ignore
        }
    };

    const clearOverride = (moduleId: string) => {
        const newOverrides = { ...moduleOverrides };
        delete newOverrides[moduleId];
        setModuleOverrides(newOverrides);
        try {
            localStorage.setItem(CUSTOM_OVERRIDES_KEY, JSON.stringify(newOverrides));
        } catch {
            // ignore
        }
    };

    const getDefaultPrompt = (moduleId: string): string | null => {
        const defaultModule = DEFAULT_MODULES.find(m => m.id === moduleId);
        return defaultModule?.prompt ?? null;
    };

    const hasOverride = (moduleId: string): boolean => {
        return moduleId in moduleOverrides;
    };



    // Apply overrides to modules for display
    const getModulePrompt = (module: Module): string => {
        if (!module.isCustom && moduleOverrides[module.id]) {
            return moduleOverrides[module.id];
        }
        return module.prompt;
    };

    const orderedModules = [...modules]
        .filter(module => {
            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase();
            const prompt = getModulePrompt(module);
            return (
                module.name.toLowerCase().includes(term) ||
                prompt.toLowerCase().includes(term)
            );
        })
        .sort((a, b) => {
            const af = isFavorite(a.id);
            const bf = isFavorite(b.id);
            if (af !== bf) return af ? -1 : 1;
            return (a.name || '').localeCompare(b.name || '');
        });

    const handleCreate = () => {
        if (newName && newPrompt) {
            onCreate(newName, newPrompt);
            setNewName('');
            setNewPrompt('');
            setIsCreating(false);
        }
    };

    const openModule = (m: Module) => {
        setSelectedModule(m);
        setEditPrompt(getModulePrompt(m));
    };

    const saveChanges = () => {
        if (selectedModule) {
            if (selectedModule.isCustom) {
                // Custom module - update via API
                onUpdate(selectedModule.id, { prompt: editPrompt });
            } else {
                // System module - save as local override
                saveOverride(selectedModule.id, editPrompt);
            }
            setSelectedModule(null);
        }
    };

    const revertToDefault = () => {
        if (selectedModule && !selectedModule.isCustom) {
            const defaultPrompt = getDefaultPrompt(selectedModule.id);
            if (defaultPrompt) {
                setEditPrompt(defaultPrompt);
                clearOverride(selectedModule.id);
            }
        }
    };

    return (
        <div className="flex-1 h-full flex flex-col bg-[#F2F0E9] overflow-hidden relative font-sans">
            {/* Header */}
            <div className="h-20 flex items-center px-10 border-b border-stone-200/50 bg-[#F2F0E9]/80 backdrop-blur-md shrink-0 sticky top-0 z-20">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors mr-6"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="font-bold text-sm">Back</span>
                </button>
                <h1 className="text-2xl font-bold text-stone-900 font-heading">Module Library</h1>

                {/* Search Bar */}
                <div className="ml-auto relative max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                        type="text"
                        placeholder="Search modules..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-lg pl-10 pr-4 h-10 text-sm font-medium text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-clay-500/5 focus:border-clay-400 transition-all font-sans shadow-sm"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">

                    {/* Create New Card */}
                    <div
                        onClick={() => setIsCreating(true)}
                        className="section-outline p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all hover:border-clay-400 hover:bg-white/80 group h-full min-h-[280px] border-dashed border-2"
                    >
                        <div className="w-14 h-14 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform group-hover:border-clay-200">
                            <Plus className="w-6 h-6 text-stone-400 group-hover:text-clay-500" />
                        </div>
                        <span className="font-bold text-stone-500 text-lg font-heading group-hover:text-stone-700">Create New Module</span>
                    </div>

                    {/* Module Cards */}
                    {orderedModules.map(module => (
                        <div
                            key={module.id}
                            onClick={() => openModule(module)}
                            className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md hover:border-stone-300 transition-all flex flex-col h-full min-h-[280px] relative group overflow-hidden cursor-pointer hover:-translate-y-1"
                        >
                            {/* Card Header */}
                            <div className="p-6 border-b border-stone-100 flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${module.isCustom ? 'bg-clay-50 border-clay-100 text-clay-600' : 'bg-stone-50 border-stone-100 text-stone-500'}`}>
                                        {module.isCustom ? <LayoutGrid className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-stone-900 text-lg leading-tight font-heading">{module.name}</h3>
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
                                            {module.isCustom ? 'Custom Preset' : 'System Preset'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleFavorite(module.id); }}
                                        className={`p-1 rounded-md transition-colors ${isFavorite(module.id) ? 'text-clay-600 hover:text-clay-700 hover:bg-clay-50' : 'text-stone-300 hover:text-stone-600 hover:bg-stone-50'}`}
                                        title={isFavorite(module.id) ? 'Unfavorite' : 'Favorite'}
                                    >
                                        <Star className="w-4 h-4" fill={isFavorite(module.id) ? 'currentColor' : 'none'} />
                                    </button>
                                    {module.isCustom && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete(module.id); }}
                                            className="text-stone-300 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-6 flex-1 flex flex-col relative">
                                <div className="relative flex-1">
                                    <p
                                        className="text-xs text-stone-600 font-mono leading-relaxed overflow-hidden h-28"
                                        style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }}
                                    >
                                        {module.prompt}
                                    </p>
                                </div>
                                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-sm border border-stone-200 rounded-md px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-stone-700 pointer-events-none">
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Inspect</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Modal Overlay */}
            {selectedModule && (
                <div className="absolute inset-0 z-50 bg-stone-900/10 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full h-full max-h-[85vh] flex flex-col overflow-hidden ring-1 ring-stone-900/5 animate-in slide-in-from-bottom-8 zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/30">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${selectedModule.isCustom ? 'bg-clay-50 border-clay-100 text-clay-600' : 'bg-stone-50 border-stone-100 text-stone-500'}`}>
                                    {selectedModule.isCustom ? <LayoutGrid className="w-6 h-6" /> : <Terminal className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h2 className="font-bold text-2xl text-stone-900 font-heading">{selectedModule.name}</h2>
                                    <p className="text-xs text-stone-500 font-mono uppercase tracking-wide">
                                        {selectedModule.isCustom ? 'Custom Module' : 'System Module'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toggleFavorite(selectedModule.id)}
                                    className={`p-2 rounded-lg transition-colors ${isFavorite(selectedModule.id) ? 'text-clay-600 hover:bg-clay-50' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'}`}
                                    title={isFavorite(selectedModule.id) ? 'Unfavorite' : 'Favorite'}
                                >
                                    <Star className="w-5 h-5" fill={isFavorite(selectedModule.id) ? 'currentColor' : 'none'} />
                                </button>
                                <button onClick={() => setSelectedModule(null)} className="p-2 hover:bg-stone-100 rounded-lg transition-colors" title="Close">
                                    <X className="w-6 h-6 text-stone-400" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 p-8 flex flex-col gap-3 bg-[#FDFCFB]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono">System Prompt</label>
                                    <button
                                        onClick={() => handleEnhance(editPrompt, setEditPrompt)}
                                        disabled={isEnhancing || !editPrompt.trim()}
                                        className="text-stone-400 hover:text-clay-600 transition-colors p-1"
                                        title="Enhance with AI"
                                    >
                                        {isEnhancing ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                                {!selectedModule.isCustom && hasOverride(selectedModule.id) && (
                                    <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-bold border border-amber-200">Modified from default</span>
                                )}
                            </div>
                            <textarea
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                className="flex-1 w-full bg-stone-50 border border-stone-200 rounded-xl p-6 text-sm font-mono text-stone-700 leading-relaxed resize-none focus:outline-none focus:ring-4 focus:ring-clay-500/5 focus:border-clay-400"
                                placeholder="Enter detailed system instructions..."
                                spellCheck={false}
                                autoFocus
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-stone-400 font-mono">
                                    {editPrompt.length} characters
                                </span>
                                {!selectedModule.isCustom && (
                                    <button
                                        onClick={revertToDefault}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                                        title="Revert to default prompt"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Revert to Default</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedModule(null)}
                                    className="px-5 py-2.5 text-stone-500 hover:text-stone-900 font-bold text-sm transition-colors font-sans"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveChanges}
                                    className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-bold text-sm shadow-lg shadow-stone-900/10 flex items-center gap-2 transition-all font-sans"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Save Changes</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Module Modal */}
            {isCreating && (
                <div className="absolute inset-0 z-50 bg-stone-900/10 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden ring-1 ring-stone-900/5 animate-in slide-in-from-bottom-8 zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center border bg-clay-50 border-clay-100 text-clay-600">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-2xl text-stone-900 font-heading">Create New Module</h2>
                                    <p className="text-xs text-stone-500 font-mono uppercase tracking-wide">
                                        Custom Preset
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setIsCreating(false); setNewName(''); setNewPrompt(''); }} className="p-2 hover:bg-stone-100 rounded-lg transition-colors" title="Close">
                                <X className="w-6 h-6 text-stone-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 flex flex-col gap-6 bg-[#FDFCFB]">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono">Module Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g., Product Cleanup, Portrait Pro..."
                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 font-sans"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono">System Prompt</label>
                                    <button
                                        onClick={() => handleEnhance(newPrompt, setNewPrompt)}
                                        disabled={isEnhancing || !newPrompt.trim()}
                                        className="text-stone-400 hover:text-purple-600 transition-colors p-1"
                                        title="Enhance with AI"
                                    >
                                        {isEnhancing ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                                <textarea
                                    value={newPrompt}
                                    onChange={e => setNewPrompt(e.target.value)}
                                    placeholder="Enter detailed system instructions for this module..."
                                    className="w-full h-64 bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm font-mono text-stone-700 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400"
                                    spellCheck={false}
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between">
                            <div className="text-xs text-stone-400 font-mono">
                                {newPrompt.length} characters
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { setIsCreating(false); setNewName(''); setNewPrompt(''); }}
                                    className="px-5 py-2.5 text-stone-500 hover:text-stone-900 font-bold text-sm transition-colors font-sans"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!newName.trim() || !newPrompt.trim()}
                                    className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-bold text-sm shadow-lg shadow-stone-900/10 flex items-center gap-2 transition-all font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Create Module</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};