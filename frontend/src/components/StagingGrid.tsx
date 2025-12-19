/**
 * StagingGrid Component
 * Grid display for uploaded images with status badges and interactions
 * Following PRD specifications for the staging area
 */
import { useState, useCallback } from 'react';
import type { ImageResponse, JobStatus } from '../lib/api';
import { api } from '../lib/api';
import StatusBadge from './StatusBadge';
import ComparisonSlider from './ComparisonSlider';
import './StagingGrid.css';

interface StagingGridProps {
    images: ImageResponse[];
    jobId: string;
    onImageSelect?: (imageIds: string[]) => void;
}

export function StagingGrid({ images, jobId, onImageSelect }: StagingGridProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [showComparison, setShowComparison] = useState<string | null>(null);

    const handleSelect = useCallback((imageId: string, event: React.MouseEvent) => {
        setSelectedIds(prev => {
            const next = new Set(prev);

            if (event.shiftKey && prev.size > 0) {
                // Shift-click: select range
                const allIds = images.map(img => img.id);
                const lastSelected = Array.from(prev).pop()!;
                const startIdx = allIds.indexOf(lastSelected);
                const endIdx = allIds.indexOf(imageId);
                const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

                for (let i = from; i <= to; i++) {
                    next.add(allIds[i]);
                }
            } else if (event.ctrlKey || event.metaKey) {
                // Ctrl/Cmd-click: toggle single
                if (next.has(imageId)) {
                    next.delete(imageId);
                } else {
                    next.add(imageId);
                }
            } else {
                // Regular click: select only this
                next.clear();
                next.add(imageId);
            }

            onImageSelect?.(Array.from(next));
            return next;
        });
    }, [images, onImageSelect]);

    const getStatusBorderClass = (status: JobStatus): string => {
        switch (status) {
            case 'PENDING': return 'border-pending';
            case 'PROCESSING': return 'border-processing';
            case 'COOLDOWN': return 'border-cooldown';
            case 'COMPLETED': return 'border-completed';
            case 'FAILED': return 'border-failed';
            case 'REFUSED': return 'border-refused';
            default: return '';
        }
    };

    if (images.length === 0) {
        return (
            <div className="staging-empty">
                <div className="staging-empty-icon">🍌</div>
                <h3>No images yet</h3>
                <p>Upload images to start processing</p>
            </div>
        );
    }

    return (
        <div className="staging-grid">
            {images.map((image, index) => (
                <div
                    key={image.id}
                    className={`staging-item ${getStatusBorderClass(image.status)} ${selectedIds.has(image.id) ? 'selected' : ''
                        }`}
                    onClick={(e) => handleSelect(image.id, e)}
                    onMouseEnter={() => setHoveredId(image.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ animationDelay: `${index * 50}ms` }}
                >
                    {/* Image thumbnail */}
                    <div className="staging-thumbnail">
                        {image.status === 'COMPLETED' && showComparison === image.id ? (
                            <ComparisonSlider
                                originalUrl={api.getOriginalImageUrl(jobId, image.id)}
                                resultUrl={api.getResultImageUrl(jobId, image.id)}
                            />
                        ) : (
                            <img
                                src={api.getOriginalImageUrl(jobId, image.id)}
                                alt={`Image ${index + 1}`}
                                loading="lazy"
                            />
                        )}

                        {/* Processing overlay */}
                        {image.status === 'PROCESSING' && (
                            <div className="staging-processing-overlay">
                                <div className="processing-spinner" />
                            </div>
                        )}
                    </div>

                    {/* Status badge */}
                    <div className="staging-status">
                        <StatusBadge status={image.status} size="sm" />
                    </div>

                    {/* Hover overlay for completed images */}
                    {image.status === 'COMPLETED' && hoveredId === image.id && (
                        <div className="staging-hover-overlay">
                            <button
                                className="btn-compare"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowComparison(prev => prev === image.id ? null : image.id);
                                }}
                            >
                                {showComparison === image.id ? 'Hide' : 'Compare'}
                            </button>
                        </div>
                    )}

                    {/* Error tooltip */}
                    {image.error_message && (
                        <div className="staging-error-tooltip">
                            {image.error_message}
                        </div>
                    )}

                    {/* Selection indicator */}
                    {selectedIds.has(image.id) && (
                        <div className="staging-selected-indicator">✓</div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default StagingGrid;
