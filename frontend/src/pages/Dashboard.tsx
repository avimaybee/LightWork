/**
 * Dashboard Page
 * Main application view combining CommandCenter and StagingGrid
 */
import { useState, useCallback } from 'react';
import type { WorkflowModule, AspectRatio } from '../lib/api';
import { api } from '../lib/api';
import { useSessionRecovery } from '../hooks/useSessionRecovery';
import { useJobPolling } from '../hooks/useJobPolling';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import CommandCenter from '../components/CommandCenter';
import StagingGrid from '../components/StagingGrid';
import './Dashboard.css';

export function Dashboard() {
    const { jobId, saveJobId, clearJobId } = useSessionRecovery();
    const { job, refetch } = useJobPolling(jobId);
    const isOnline = useOnlineStatus();

    // Local state for new job creation
    const [selectedModule, setSelectedModule] = useState<WorkflowModule | null>(null);
    const [globalPrompt, setGlobalPrompt] = useState('');
    const [aspectRatioOverride, setAspectRatioOverride] = useState<AspectRatio | null>(null);
    const [uploading, setUploading] = useState(false);

    // Computed values
    const images = job?.images || [];
    const pendingCount = images.filter(img =>
        img.status === 'PENDING' || img.status === 'PROCESSING' || img.status === 'COOLDOWN'
    ).length;
    const completedCount = images.filter(img => img.status === 'COMPLETED').length;
    const isProcessing = images.some(img => img.status === 'PROCESSING');
    const hasCompletedImages = completedCount > 0;

    // Create job if doesn't exist
    const ensureJob = useCallback(async (): Promise<string> => {
        if (jobId) return jobId;

        if (!selectedModule) {
            throw new Error('Please select a workflow module first');
        }

        const newJob = await api.createJob({
            module_id: selectedModule.id,
            global_prompt: globalPrompt || undefined,
            aspect_ratio_override: aspectRatioOverride || undefined,
        });

        saveJobId(newJob.id);
        return newJob.id;
    }, [jobId, selectedModule, globalPrompt, aspectRatioOverride, saveJobId]);

    // Handle file upload
    const handleUpload = useCallback(async (files: FileList) => {
        if (!selectedModule) {
            alert('Please select a workflow module first');
            return;
        }

        setUploading(true);
        try {
            const currentJobId = await ensureJob();

            // Upload files in sequence to avoid overwhelming the API
            for (const file of Array.from(files)) {
                await api.uploadImage(currentJobId, file);
            }

            await refetch();
        } catch (error) {
            console.error('Upload failed:', error);
            alert(error instanceof Error ? error.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    }, [selectedModule, ensureJob, refetch]);

    // Handle start processing
    const handleStartJob = useCallback(async () => {
        // The backend worker automatically picks up pending images
        // Just trigger a refetch to show updated status
        await refetch();
    }, [refetch]);

    // Handle download
    const handleDownload = useCallback(() => {
        if (!jobId) return;
        window.open(api.getDownloadUrl(jobId), '_blank');
    }, [jobId]);

    // Handle clear job
    const handleClearJob = useCallback(async () => {
        if (!jobId) return;

        if (!confirm('Are you sure you want to clear this job? All images will be deleted.')) {
            return;
        }

        try {
            await api.deleteJob(jobId);
            clearJobId();
            setSelectedModule(null);
            setGlobalPrompt('');
            setAspectRatioOverride(null);
        } catch (error) {
            console.error('Failed to clear job:', error);
        }
    }, [jobId, clearJobId]);

    return (
        <div className="dashboard">
            {/* Offline banner */}
            {!isOnline && (
                <div className="offline-banner">
                    <span>⚠️ Connection lost. Don't worry — your job continues processing on the server.</span>
                </div>
            )}

            {/* Uploading overlay */}
            {uploading && (
                <div className="uploading-overlay">
                    <div className="uploading-spinner" />
                    <span>Uploading images...</span>
                </div>
            )}

            {/* Command Center Sidebar */}
            <CommandCenter
                selectedModule={selectedModule}
                onModuleChange={setSelectedModule}
                globalPrompt={globalPrompt}
                onGlobalPromptChange={setGlobalPrompt}
                aspectRatioOverride={aspectRatioOverride}
                onAspectRatioChange={setAspectRatioOverride}
                onUpload={handleUpload}
                onStartJob={handleStartJob}
                onDownload={handleDownload}
                onClearJob={handleClearJob}
                pendingCount={pendingCount}
                completedCount={completedCount}
                totalCount={images.length}
                isProcessing={isProcessing}
                hasCompletedImages={hasCompletedImages}
            />

            {/* Main Content - Staging Grid */}
            <main className="dashboard-main">
                <StagingGrid
                    images={images}
                    jobId={jobId || ''}
                />
            </main>
        </div>
    );
}

export default Dashboard;
