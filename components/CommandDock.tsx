import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project, Module, ApiMode } from '../types';
import { Zap, Wand2, Cpu, Save, Settings, Grid, Terminal, ChevronDown, Coins, Star, SlidersHorizontal, Pencil, X } from 'lucide-react';

import { Tooltip, HelpTooltip, HELP_CONTENT } from './Tooltip';
import { useFavorites } from '../hooks/useFavorites';

interface CommandDockProps {
    project: Project;
    modules: Module[];
    isProcessing: boolean;
    queuedCount: number;
    apiMode: ApiMode;
    onApiModeChange: (mode: ApiMode) => void;
    onUpdateProject: (updates: Partial<Project>) => void;
    onProcess: () => void;
    onProcessBatch: () => void;
    onCreateModule: (name: string, prompt: string) => void;
    onDeleteModule: (id: string) => void;
    onManageModules: () => void;
}

export const CommandDock: React.FC<CommandDockProps> = ({
    project,
    modules,
    isProcessing,
    queuedCount,
    apiMode,
    onApiModeChange,
    onUpdateProject,
    onProcess,
    onProcessBatch,
    onCreateModule,
    onDeleteModule,
    onManageModules
}) => {
    // UI States
    const [isPromptExpanded, setIsPromptExpanded] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);

    // Refs for click-outside handling
    const moduleRef = useRef<HTMLDivElement>(null);
    const configRef = useRef<HTMLDivElement>(null);

    // Favorites hook
    const { toggleFavorite, isFavorite } = useFavorites();

    const activeModule = modules.find(m => m.id === project.selectedModulePreset);

    // Click outside listener
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (moduleRef.current && !moduleRef.current.contains(event.target as Node)) {
                setIsModuleDropdownOpen(false);
            }
            if (configRef.current && !configRef.current.contains(event.target as Node)) {
                setIsConfigOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSaveModule = () => {
        const name = window.prompt("Enter a name for this module preset:");
        if (name) {
            onCreateModule(name, project.modulePrompt);
        }
    };

    const handleSelectModule = (m: Module) => {
        onUpdateProject({
            selectedModulePreset: m.id,
            modulePrompt: m.prompt
        });
        setIsModuleDropdownOpen(false);
    };

    const systemModules = modules
        .filter(m => !m.isCustom)
        .slice()
        .sort((a, b) => {
            const af = isFavorite(a.id);
            const bf = isFavorite(b.id);
            if (af !== bf) return af ? -1 : 1;
            return (a.name || '').localeCompare(b.name || '');
        });

    const customModules = modules
        .filter(m => m.isCustom)
        .slice()
        .sort((a, b) => {
            const af = isFavorite(a.id);
            const bf = isFavorite(b.id);
            if (af !== bf) return af ? -1 : 1;
            return (a.name || '').localeCompare(b.name || '');
        });

    return (
        <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center font-sans w-auto max-w-[90vw]"
        >
            {/* Expanded System Context Panel */}
            <AnimatePresence>
                {isPromptExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="w-full bg-[#FDFCFB]/95 backdrop-blur-xl border border-stone-200/80 rounded-2xl p-4 shadow-2xl shadow-stone-900/10 mb-3"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider font-heading">System Instructions</span>
                            <div className="flex items-center gap-2">
                                <button onClick={handleSaveModule} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 hover:border-stone-300 rounded-lg text-[11px] font-semibold text-stone-600 transition-colors shadow-sm">
                                    <Save className="w-3 h-3" />
                                    Save
                                </button>
                                <button onClick={() => setIsPromptExpanded(false)} className="text-stone-400 hover:text-stone-600 p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={project.modulePrompt}
                            onChange={(e) => onUpdateProject({ modulePrompt: e.target.value })}
                            className="w-full h-32 bg-white border border-stone-200 rounded-xl p-3 text-sm font-mono text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 resize-none shadow-inner leading-relaxed"
                            placeholder="Enter detailed global instructions here..."
                            autoFocus
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Control Pill */}
            <div className="bg-[#FDFCFB]/95 backdrop-blur-xl shadow-2xl shadow-stone-900/15 rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center gap-2 sm:gap-3 transition-all relative z-10 border border-stone-200/80 w-full justify-between">

                {/* Left: Config Button */}
                <div className="relative" ref={configRef}>
                    <Tooltip content="Processing Settings" position="top" delay={400}>
                        <button
                            onClick={() => setIsConfigOpen(!isConfigOpen)}
                            className={`p-2.5 rounded-xl transition-all ${isConfigOpen ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'}`}
                            aria-label="Open settings"
                        >
                            <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </Tooltip>

                    {/* Config Popover */}
                    <AnimatePresence>
                        {isConfigOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                className="absolute bottom-full left-0 mb-2.5 w-56 bg-white rounded-xl shadow-2xl shadow-stone-900/15 border border-stone-100 overflow-hidden z-50 p-3 space-y-3"
                            >
                                {/* Model Toggle */}
                                <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Model</span>
                                        <HelpTooltip content={project.selectedMode === 'pro' ? HELP_CONTENT.MODEL_PRO : HELP_CONTENT.MODEL_FAST} />
                                    </div>
                                    <div className="flex bg-stone-100 p-1 rounded-xl items-center">
                                        <button
                                            onClick={() => onUpdateProject({ selectedMode: 'fast' })}
                                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${project.selectedMode === 'fast' ? 'bg-white text-stone-900 shadow-sm ring-1 ring-black/5' : 'text-stone-500 hover:text-stone-700'}`}
                                        >
                                            <Zap className={`w-3.5 h-3.5 ${project.selectedMode === 'fast' ? 'text-green-600' : ''}`} />
                                            Fast
                                        </button>
                                        <button
                                            onClick={() => onUpdateProject({ selectedMode: 'pro' })}
                                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${project.selectedMode === 'pro' ? 'bg-white text-stone-900 shadow-sm ring-1 ring-black/5' : 'text-stone-500 hover:text-stone-700'}`}
                                        >
                                            <Cpu className={`w-3.5 h-3.5 ${project.selectedMode === 'pro' ? 'text-purple-600' : ''}`} />
                                            Pro
                                        </button>
                                    </div>
                                </div>
                                {/* Speed Toggle */}
                                <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Speed</span>
                                        <HelpTooltip content={apiMode === 'economy' ? HELP_CONTENT.SPEED_ECONOMY : HELP_CONTENT.SPEED_FAST} />
                                    </div>
                                    <div className="flex bg-stone-100 p-1 rounded-xl items-center">
                                        <button
                                            onClick={() => onApiModeChange('fast')}
                                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${apiMode === 'fast' ? 'bg-white text-stone-900 shadow-sm ring-1 ring-black/5' : 'text-stone-500 hover:text-stone-700'}`}
                                        >
                                            <Zap className={`w-3.5 h-3.5 ${apiMode === 'fast' ? 'text-amber-500' : ''}`} />
                                            Fast
                                        </button>
                                        <button
                                            onClick={() => onApiModeChange('economy')}
                                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${apiMode === 'economy' ? 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200' : 'text-stone-500 hover:text-stone-700'}`}
                                        >
                                            <Coins className={`w-3.5 h-3.5 ${apiMode === 'economy' ? 'text-emerald-600' : ''}`} />
                                            Economy
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Center: Module Selector (Primary) */}
                <div className="flex-1 flex items-center justify-center relative" ref={moduleRef}>
                    <button
                        onClick={() => setIsModuleDropdownOpen(!isModuleDropdownOpen)}
                        className="flex items-center gap-2 text-sm sm:text-base font-bold text-stone-800 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all justify-center active:scale-[0.98] w-full max-w-xs"
                    >
                        <span className="truncate font-heading">
                            {activeModule ? activeModule.name : "Select Module"}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform duration-200 flex-shrink-0 ${isModuleDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Module Dropdown */}
                    <AnimatePresence>
                        {isModuleDropdownOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-72 bg-white rounded-xl shadow-2xl shadow-stone-900/15 border border-stone-100 overflow-hidden z-50"
                            >
                                <div className="p-2.5 border-b border-stone-100 bg-stone-50/50">
                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest pl-1">System Presets</span>
                                </div>
                                <div className="max-h-56 overflow-y-auto p-1.5">
                                    {systemModules.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => handleSelectModule(m)}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between group transition-colors ${project.selectedModulePreset === m.id ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:bg-stone-50'}`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Terminal className="w-4 h-4 text-stone-400" />
                                                <span className="font-heading">{m.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(m.id); }}
                                                    className={`p-1 rounded-md transition-colors ${isFavorite(m.id) ? 'text-amber-500' : 'text-stone-300 hover:text-stone-500'}`}
                                                >
                                                    <Star className="w-3.5 h-3.5" fill={isFavorite(m.id) ? 'currentColor' : 'none'} />
                                                </button>
                                                {project.selectedModulePreset === m.id && <div className="w-1.5 h-1.5 rounded-full bg-stone-900" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {customModules.length > 0 && (
                                    <>
                                        <div className="p-2 border-y border-stone-100 bg-stone-50/50">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest pl-1">My Modules</span>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto p-1.5">
                                            {customModules.map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => handleSelectModule(m)}
                                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between group transition-colors ${project.selectedModulePreset === m.id ? 'bg-clay-50 text-clay-800' : 'text-stone-600 hover:bg-stone-50'}`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <Grid className="w-4 h-4 text-clay-500" />
                                                        <span className="font-heading">{m.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleFavorite(m.id); }}
                                                            className={`p-1 rounded-md transition-colors ${isFavorite(m.id) ? 'text-amber-500' : 'text-stone-300 hover:text-stone-500'}`}
                                                        >
                                                            <Star className="w-3.5 h-3.5" fill={isFavorite(m.id) ? 'currentColor' : 'none'} />
                                                        </button>
                                                        {project.selectedModulePreset === m.id && <div className="w-1.5 h-1.5 rounded-full bg-clay-600" />}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                <div className="p-2 border-t border-stone-100 bg-stone-50/80">
                                    <button
                                        onClick={() => { onManageModules(); setIsModuleDropdownOpen(false); }}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-white rounded-lg transition-colors"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        <span>Manage Library</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right: Edit Prompt + Run Button */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <Tooltip content="Edit Instructions" position="top" delay={400}>
                        <button
                            onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                            className={`p-2.5 rounded-xl transition-all ${isPromptExpanded ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'}`}
                            aria-label="Edit instructions"
                        >
                            <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </Tooltip>

                    <Tooltip
                        content={
                            queuedCount > 0 ? (
                                <div className="space-y-1.5 min-w-[160px]">
                                    <div className="font-bold text-white">Estimated</div>
                                    <div className="flex items-center gap-2 text-stone-300 text-xs">
                                        <span>⏱️</span>
                                        <span>
                                            {apiMode === 'economy'
                                                ? `Results in < 24h`
                                                : `~${Math.ceil(queuedCount * 3 / 60)} min`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-stone-300 text-xs">
                                        <span>💰</span>
                                        <span>
                                            {apiMode === 'economy'
                                                ? `~$${(queuedCount * 0.0195).toFixed(3)}`
                                                : `~$${(queuedCount * 0.039).toFixed(3)}`}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <span>No images queued</span>
                            )
                        }
                        position="top"
                        delay={300}
                    >
                        <button
                            onClick={apiMode === 'economy' ? onProcessBatch : onProcess}
                            disabled={isProcessing || queuedCount === 0}
                            className={`
                                h-10 px-4 sm:px-5 rounded-xl font-heading font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-md whitespace-nowrap
                                ${isProcessing
                                    ? 'bg-stone-100 text-stone-400 cursor-not-allowed shadow-none border border-stone-200'
                                    : apiMode === 'economy'
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg active:scale-95'
                                        : 'bg-stone-900 text-[#FDFCFB] hover:bg-stone-800 hover:shadow-lg active:scale-95'
                                }
                            `}
                        >
                            {isProcessing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-500 rounded-full animate-spin" />
                                    <span className="hidden sm:inline">Processing...</span>
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-4 h-4" />
                                    <span className="hidden sm:inline">Run</span>
                                    {queuedCount > 0 && <span className="text-xs opacity-80">({queuedCount})</span>}
                                </>
                            )}
                        </button>
                    </Tooltip>
                </div>
            </div>
        </motion.div>
    );
};