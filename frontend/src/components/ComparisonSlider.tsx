/**
 * ComparisonSlider Component
 * Before/after image comparison with draggable divider
 * Per PRD: "Comparison Slider: On COMPLETED images, hover to see a Before/After split-screen slider"
 */
import { useState, useRef, useCallback } from 'react';
import './ComparisonSlider.css';

interface ComparisonSliderProps {
    originalUrl: string;
    resultUrl: string;
}

export function ComparisonSlider({ originalUrl, resultUrl }: ComparisonSliderProps) {
    const [position, setPosition] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const handleMove = useCallback((clientX: number) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setPosition(percentage);
    }, []);

    const handleMouseDown = useCallback(() => {
        isDragging.current = true;
    }, []);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isDragging.current) {
            handleMove(e.clientX);
        }
    }, [handleMove]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        handleMove(e.touches[0].clientX);
    }, [handleMove]);

    return (
        <div
            ref={containerRef}
            className="comparison-slider"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
        >
            {/* Result image (full background) */}
            <img
                src={resultUrl}
                alt="After"
                className="comparison-image comparison-after"
                draggable={false}
            />

            {/* Original image (clipped) */}
            <div
                className="comparison-before-container"
                style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            >
                <img
                    src={originalUrl}
                    alt="Before"
                    className="comparison-image comparison-before"
                    draggable={false}
                />
            </div>

            {/* Divider line */}
            <div
                className="comparison-divider"
                style={{ left: `${position}%` }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
            >
                <div className="divider-handle">
                    <span className="divider-arrow">◀</span>
                    <span className="divider-arrow">▶</span>
                </div>
            </div>

            {/* Labels */}
            <div className="comparison-labels">
                <span className="label-before">Before</span>
                <span className="label-after">After</span>
            </div>
        </div>
    );
}

export default ComparisonSlider;
