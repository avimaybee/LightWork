/**
 * APIHealthMeter Component
 * Shows real-time RPM usage and API status
 * Per PRD: "API Health Meter: Shows real-time RPM usage (0/7)"
 */
import { useState, useEffect } from 'react';
import type { RateLimitStatus } from '../lib/api';
import { api } from '../lib/api';
import './APIHealthMeter.css';

export function APIHealthMeter() {
    const [status, setStatus] = useState<RateLimitStatus | null>(null);
    const [workerRunning, setWorkerRunning] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const health = await api.health();
                setStatus(health.rate_limit);
                setWorkerRunning(health.worker_running);
                setError(false);
            } catch {
                setError(true);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 5000);
        return () => clearInterval(interval);
    }, []);

    if (error) {
        return (
            <div className="api-health api-health-error">
                <span className="health-dot health-dot-error" />
                <span className="health-label">API Offline</span>
            </div>
        );
    }

    if (!status) {
        return (
            <div className="api-health">
                <span className="health-dot health-dot-loading" />
                <span className="health-label">Connecting...</span>
            </div>
        );
    }

    return (
        <div className="api-health">
            <div className="health-header">
                <span className={`health-dot ${workerRunning ? 'health-dot-active' : 'health-dot-idle'}`} />
                <span className="health-label">
                    {workerRunning ? 'Worker Active' : 'Worker Idle'}
                </span>
            </div>

            <div className="health-stats">
                <div className="health-stat">
                    <span className="stat-value">{status.rpm_limit}</span>
                    <span className="stat-label">RPM Limit</span>
                </div>
                <div className="health-stat">
                    <span className="stat-value">{status.min_interval_seconds.toFixed(1)}s</span>
                    <span className="stat-label">Interval</span>
                </div>
            </div>

            {!status.can_request_now && (
                <div className="health-cooldown">
                    ⏳ Rate limiting active
                </div>
            )}
        </div>
    );
}

export default APIHealthMeter;
