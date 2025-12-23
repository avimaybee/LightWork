import React, { useState, useRef, useEffect } from 'react';
import { Project, Module } from '../types';
import { Zap, Wand2, Layers, Cpu, Maximize2, Minimize2, Save, Settings, Grid, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

interface CommandDockProps {
  project: Project;
  modules: Module[];
  isProcessing: boolean;
  queuedCount: number;
  onUpdateProject: (updates: Partial<Project>) => void;
  onProcess: () => void;
  onCreateModule: (name: string, prompt: string) => void;
  onDeleteModule: (id: string) => void;
  onManageModules: () => void;
}

export const CommandDock: React.FC<CommandDockProps> = ({
  project,
  modules,
  isProcessing,
  queuedCount,
  onUpdateProject,
  onProcess,
  onCreateModule,
  onDeleteModule,
  onManageModules
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Custom Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModule = modules.find(m => m.id === project.selectedModulePreset);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

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
    setIsDropdownOpen(false);
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-auto max-w-6xl z-50 flex flex-col items-center font-sans">
      {/* Expanded System Context */}
      {isExpanded && (
          <div className="w-full bg-[#FDFCFB]/95 backdrop-blur-xl border border-stone-200 border-b-0 rounded-t-xl p-6 animate-in slide-in-from-bottom-2 shadow-2xl shadow-stone-900/10 mb-[-12px] pb-8 z-0">
             <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-stone-100 rounded-md">
                        <Layers className="w-4 h-4 text-stone-600" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-stone-900 block font-heading">System Context</span>
                        <span className="text-[11px] text-stone-500 block">Global instructions for this session</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                     <button onClick={handleSaveModule} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 hover:border-stone-300 rounded-lg text-xs font-semibold text-stone-700 transition-colors shadow-sm">
                        <Save className="w-3.5 h-3.5" />
                        Save Preset
                     </button>
                     <button onClick={() => setIsExpanded(false)} className="text-stone-400 hover:text-stone-600 p-2 hover:bg-stone-100 rounded-lg transition-colors">
                        <Minimize2 className="w-4 h-4" />
                     </button>
                 </div>
             </div>
             
             <textarea 
                value={project.modulePrompt}
                onChange={(e) => onUpdateProject({ modulePrompt: e.target.value })}
                className="w-full h-40 bg-white border border-stone-200 rounded-lg p-3 text-sm font-mono text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 resize-none shadow-inner leading-relaxed"
                placeholder="Enter detailed global instructions here..."
                autoFocus
             />
          </div>
      )}

      {/* Main Control Bar */}
      <div className="bg-[#FDFCFB] border border-stone-200 shadow-2xl shadow-stone-900/10 rounded-2xl px-4 py-3 flex items-end gap-4 transition-all relative z-10">
        
        {/* Toggle Expand */}
        <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-white border border-stone-200 rounded-full p-1 shadow-sm text-stone-400 hover:text-stone-900 z-20 hover:scale-110 transition-transform ${isExpanded ? 'bg-stone-100 text-stone-900 border-stone-300' : ''}`}
            title={isExpanded ? "Collapse" : "Expand System Context"}
        >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>

        {/* SECTION: MODEL */}
        <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-heading pl-1">Model</span>
            <div className="flex bg-stone-100 p-1 rounded-xl h-10 items-center">
                <button 
                    onClick={() => onUpdateProject({ selectedMode: 'fast' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all h-full flex items-center gap-1.5 ${project.selectedMode === 'fast' ? 'bg-white text-stone-900 shadow-sm ring-1 ring-black/5' : 'text-stone-500 hover:text-stone-700'}`}
                >
                    <Zap className={`w-3.5 h-3.5 ${project.selectedMode === 'fast' ? 'text-green-600' : 'text-stone-400'}`} />
                    <span>FAST</span>
                </button>
                <button 
                    onClick={() => onUpdateProject({ selectedMode: 'pro' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all h-full flex items-center gap-1.5 ${project.selectedMode === 'pro' ? 'bg-white text-stone-900 shadow-sm ring-1 ring-black/5' : 'text-stone-500 hover:text-stone-700'}`}
                >
                    <Cpu className={`w-3.5 h-3.5 ${project.selectedMode === 'pro' ? 'text-purple-600' : 'text-stone-400'}`} />
                    <span>PRO</span>
                </button>
            </div>
        </div>

        <div className="w-px h-8 bg-stone-200 mb-1" />

        {/* SECTION: MODULE */}
        <div className="flex flex-col gap-1.5 relative" ref={dropdownRef}>
             <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-heading pl-1">Module</span>
             
             {/* Dropdown Button */}
            <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 text-xs font-bold text-stone-700 hover:text-stone-900 bg-white border border-stone-200 hover:border-stone-300 px-3 h-10 rounded-xl transition-all min-w-[160px] justify-between shadow-sm active:scale-95"
            >
                <span className="truncate max-w-[140px] flex items-center gap-2">
                    {activeModule?.isCustom ? <Grid className="w-3.5 h-3.5 text-clay-500" /> : <Terminal className="w-3.5 h-3.5 text-stone-400" />}
                    {activeModule ? activeModule.name : (project.selectedModulePreset ? "Unknown" : "Custom Draft")}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Custom Dropdown Menu */}
            {isDropdownOpen && (
                <div className="absolute bottom-full left-0 mb-3 w-72 bg-white rounded-xl shadow-2xl shadow-stone-900/15 border border-stone-100 overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <div className="p-3 border-b border-stone-50 bg-stone-50/50">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest pl-1">System Presets</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-1.5">
                        {modules.filter(m => !m.isCustom).map(m => (
                            <button
                                key={m.id}
                                onClick={() => handleSelectModule(m)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between group transition-colors ${project.selectedModulePreset === m.id ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:bg-stone-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Terminal className="w-4 h-4 text-stone-400" />
                                    <span className="font-heading text-sm">{m.name}</span>
                                </div>
                                {project.selectedModulePreset === m.id && <div className="w-1.5 h-1.5 rounded-full bg-stone-900" />}
                            </button>
                        ))}
                        </div>

                        <div className="p-2 border-y border-stone-50 bg-stone-50/50 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest pl-1">My Modules</span>
                        </div>
                        
                        <div className="max-h-48 overflow-y-auto p-1.5">
                        {modules.filter(m => m.isCustom).length === 0 && (
                            <div className="px-3 py-4 text-center text-[10px] text-stone-400 italic">
                                No custom modules yet
                            </div>
                        )}
                        {modules.filter(m => m.isCustom).map(m => (
                            <button
                                key={m.id}
                                onClick={() => handleSelectModule(m)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between group transition-colors ${project.selectedModulePreset === m.id ? 'bg-clay-50 text-clay-800' : 'text-stone-600 hover:bg-stone-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Grid className="w-4 h-4 text-clay-500" />
                                    <span className="font-heading">{m.name}</span>
                                </div>
                                {project.selectedModulePreset === m.id && <div className="w-1.5 h-1.5 rounded-full bg-clay-500" />}
                            </button>
                        ))}
                        </div>
                        
                        <div className="p-2 border-t border-stone-100 bg-stone-50/80">
                            <button 
                            onClick={() => { onManageModules(); setIsDropdownOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-stone-200 shadow-sm hover:shadow"
                            >
                                <Settings className="w-3.5 h-3.5" />
                                <span>Manage Library</span>
                            </button>
                        </div>
                </div>
            )}
        </div>

        <div className="w-px h-8 bg-stone-200 mx-1 mb-1" />

        {/* SECTION: PROMPT */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[320px]">
             <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-heading pl-1">Modification Instructions</span>
             <div className="relative group">
                 {isExpanded ? (
                    <button 
                        onClick={() => setIsExpanded(false)}
                        className="w-full bg-stone-50 border border-stone-200 border-dashed rounded-xl px-3 flex items-center justify-between hover:bg-stone-100 transition-colors group h-10"
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs font-medium text-stone-500 group-hover:text-stone-700">Detailed Editing Active</span>
                        </div>
                        <Minimize2 className="w-3.5 h-3.5 text-stone-400" />
                    </button>
                 ) : (
                    <>
                        <input 
                            id="global-prompt-input"
                            type="text" 
                            value={project.modulePrompt}
                            onChange={(e) => onUpdateProject({ modulePrompt: e.target.value, selectedModulePreset: '' })}
                            className="w-full bg-white border border-stone-200 rounded-xl px-3 pl-4 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400/20 transition-all truncate pr-9 h-10 shadow-sm font-sans"
                            placeholder="Type instructions here..."
                        />
                        <button 
                            onClick={() => setIsExpanded(true)}
                            className="absolute right-3 top-3 text-stone-300 hover:text-stone-600 transition-colors"
                            title="Expand to Edit"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    </>
                 )}
             </div>
        </div>

        {/* ACTION BUTTON */}
        <div className="pl-4">
            <button
                onClick={onProcess}
                disabled={isProcessing || queuedCount === 0}
                title="Cmd+Enter to run"
                className={`
                    h-10 px-6 rounded-xl font-heading font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 transition-all shadow-md whitespace-nowrap
                    ${isProcessing 
                        ? 'bg-stone-100 text-stone-400 cursor-not-allowed shadow-none border border-stone-200' 
                        : 'bg-stone-900 text-[#FDFCFB] hover:bg-stone-800 hover:shadow-lg active:scale-95 border border-stone-900'
                    }
                `}
            >
                {isProcessing ? (
                    <>
                        <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-500 rounded-full animate-spin" />
                        <span>Processing...</span>
                    </>
                ) : (
                    <>
                        <Wand2 className="w-4 h-4 text-clay-300" />
                        <span>Run Batch {queuedCount > 0 ? `(${queuedCount})` : ''}</span>
                    </>
                )}
            </button>
        </div>

      </div>
    </div>
  );
};