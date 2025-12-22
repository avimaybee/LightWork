/**
 * LightWork Cron Worker
 * Autonomous image processing - wakes up every 60 seconds
 */

import type { Env } from './types';
import { processImages } from './lib/processor';

export default {
    async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
        void event;
        console.log('✨ LightWork Cron Worker started at', new Date().toISOString());

        if (!env.GEMINI_API_KEY) {
            console.warn('✨ Skipping run: GEMINI_API_KEY not configured');
            return;
        }

        await processImages(env, _ctx);
    },
};
