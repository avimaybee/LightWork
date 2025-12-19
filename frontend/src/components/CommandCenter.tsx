/**
 * CommandCenter Component
 * Sidebar with module selection, global prompt, and job controls
 * Per PRD: The "Command Center" (Sidebar)
 */
import { useState, useEffect } from 'react';
import type { WorkflowModule, AspectRatio } from '../lib/api';
import { api } from '../lib/api';
import ETCCounter from './ETCCounter';
import APIHealthMeter from './APIHealthMeter';
import './CommandCenter.css';

interface CommandCenterProps {
    selectedModule: WorkflowModule | null;
    onModuleChange: (module: WorkflowModule) => void;
    globalPrompt: string;
    onGlobalPromptChange: (prompt: string) => void;
    aspectRatioOverride: AspectRatio | null;
    onAspectRatioChange: (ratio: AspectRatio | null) => void;
    onUpload: (files: FileList) => void;
    onStartJob: () => void;
    onDownload: () => void;
    onClearJob: () => void;
    pendingCount: number;
    completedCount: number;
    totalCount: number;
    isProcessing: boolean;
    hasCompletedImages: boolean;
}

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
    { value: '1:1', label: '1:1 Square' },
    { value: '16:9', label: '16:9 Landscape' },
    { value: '9:16', label: '9:16 Portrait' },
    { value: '4:3', label: '4:3 Standard' },
    { value: '3:4', label: '3:4 Tall' },
];

export function CommandCenter({
    selectedModule,
    onModuleChange,
    globalPrompt,
    onGlobalPromptChange,
    aspectRatioOverride,
    onAspectRatioChange,
    onUpload,
    onStartJob,
    onDownload,
    onClearJob,
    pendingCount,
    completedCount,
    totalCount,
    isProcessing,
    hasCompletedImages,
}: CommandCenterProps) {
    const [modules, setModules] = useState<WorkflowModule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getModules()
            .then(setModules)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onUpload(e.target.files);
            e.target.value = ''; // Reset for re-upload
        }
    };

    const handleModuleSelect = (moduleId: string) => {
        const module = modules.find(m => m.id === moduleId);
        if (module) onModuleChange(module);
    };

    // Group modules by category
    const modulesByCategory = modules.reduce((acc, module) => {
        const category = module.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(module);
        return acc;
    }, {} as Record<string, WorkflowModule[]>);

    return (
        <aside className="command-center">
            <div className="command-header">
                <h1 className="command-title">
                    <span className="banana-emoji">🍌</span>
                    BananaBatch
                </h1>
                <span className="command-version">v0.1</span>
            </div>

            <div className="command-section">
                <label className="command-label">Workflow Module</label>
                <select
                    className="input select"
                    value={selectedModule?.id || ''}
                    onChange={(e) => handleModuleSelect(e.target.value)}
                    disabled={loading}
                >
                    <option value="">Select a module...</option>
                    {Object.entries(modulesByCategory).map(([category, mods]) => (
                        <optgroup key={category} label={category}>
                            {mods.map(mod => (
                                <option key={mod.id} value={mod.id}>
                                    {mod.name}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                {selectedModule && (
                    <p className="module-description">{selectedModule.description}</p>
                )}
            </div>

            <div className="command-section">
                <label className="command-label">Aspect Ratio</label>
                <select
                    className="input select"
                    value={aspectRatioOverride || selectedModule?.parameters.aspect_ratio || ''}
                    onChange={(e) => onAspectRatioChange(e.target.value as AspectRatio || null)}
                >
                    {selectedModule && (
                        <option value="">
                            Default ({selectedModule.parameters.aspect_ratio})
                        </option>
                    )}
                    {ASPECT_RATIOS.map(ratio => (
                        <option key={ratio.value} value={ratio.value}>
                            {ratio.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="command-section">
                <label className="command-label">Global Prompt</label>
                <textarea
                    className="input textarea"
                    placeholder={selectedModule?.user_prompt_placeholder || 'Additional instructions for the entire batch...'}
                    value={globalPrompt}
                    onChange={(e) => onGlobalPromptChange(e.target.value)}
                    rows={4}
                />
            </div>

            <div className="command-section">
                <label className="command-label">Upload Images</label>
                <label className="upload-area">
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="upload-input"
                    />
                    <div className="upload-content">
                        <span className="upload-icon">📁</span>
                        <span>Drop images or click to browse</span>
                    </div>
                </label>
            </div>

            <div className="command-divider" />

            {/* Progress section */}
            {totalCount > 0 && (
                <div className="command-section">
                    <div className="progress-stats">
                        <span>{completedCount} / {totalCount} completed</span>
                        {pendingCount > 0 && (
                            <ETCCounter pendingCount={pendingCount} />
                        )}
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${(completedCount / totalCount) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* API Health */}
            <div className="command-section">
                <APIHealthMeter />
            </div>

            <div className="command-divider" />

            {/* Action buttons */}
            <div className="command-actions">
                {!isProcessing && totalCount > 0 && pendingCount > 0 && (
                    <button
                        className="btn btn-primary btn-full"
                        onClick={onStartJob}
                        disabled={!selectedModule}
                    >
                        🚀 Start Processing
                    </button>
                )}

                {hasCompletedImages && (
                    <button
                        className="btn btn-secondary btn-full"
                        onClick={onDownload}
                    >
                        📦 Download ZIP
                    </button>
                )}

                {totalCount > 0 && (
                    <button
                        className="btn btn-secondary btn-full btn-danger"
                        onClick={onClearJob}
                    >
                        🗑️ Clear Job
                    </button>
                )}
            </div>
        </aside>
    );
}

export default CommandCenter;
