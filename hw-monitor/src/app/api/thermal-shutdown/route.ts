import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// In-memory thermal shutdown configuration
// In production you'd persist this, but for a local monitoring tool this is fine
interface ThermalConfig {
    enabled: boolean;
    cpuThreshold: number;    // °C — shutdown if CPU temp exceeds this
    gpuThreshold: number;    // °C — shutdown if GPU temp exceeds this
    mbThreshold: number;     // °C — shutdown if motherboard temp exceeds this
    shutdownDelay: number;   // seconds — grace period before shutdown
    triggered: boolean;      // whether a shutdown has been initiated
    triggeredAt: number | null;
    triggeredBy: string | null;  // 'cpu' | 'gpu' | 'mb'
    triggeredTemp: number | null;
}

// Global config singleton (shared across API calls)
const defaultConfig: ThermalConfig = {
    enabled: false,
    cpuThreshold: 80,
    gpuThreshold: 85,
    mbThreshold: 75,
    shutdownDelay: 60,
    triggered: false,
    triggeredAt: null,
    triggeredBy: null,
    triggeredTemp: null,
};

// Use globalThis to persist across hot reloads in Next.js dev mode
const globalAny = globalThis as any;
if (!globalAny.__thermalConfig) {
    globalAny.__thermalConfig = { ...defaultConfig };
}

function getConfig(): ThermalConfig {
    return globalAny.__thermalConfig;
}

function setConfig(partial: Partial<ThermalConfig>) {
    globalAny.__thermalConfig = { ...getConfig(), ...partial };
}

/**
 * Check temperatures against thresholds and trigger shutdown if needed.
 * This is called from the /api/system route on every poll.
 */
export async function checkAndTriggerShutdown(cpuTemp: number | null, gpuTemp: number | null, mbTemp: number | null = null) {
    const config = getConfig();
    if (!config.enabled || config.triggered) return;

    let shouldShutdown = false;
    let reason = '';
    let triggerTemp = 0;

    if (cpuTemp !== null && cpuTemp >= config.cpuThreshold) {
        shouldShutdown = true;
        reason = 'cpu';
        triggerTemp = cpuTemp;
    }

    if (gpuTemp !== null && gpuTemp >= config.gpuThreshold) {
        shouldShutdown = true;
        reason = reason ? reason + '+gpu' : 'gpu';
        triggerTemp = gpuTemp;
    }

    if (mbTemp !== null && mbTemp >= config.mbThreshold) {
        shouldShutdown = true;
        reason = reason ? reason + '+mb' : 'mb';
        triggerTemp = mbTemp;
    }

    if (shouldShutdown) {
        console.warn(`[THERMAL] 🔥 THRESHOLD EXCEEDED! ${reason.toUpperCase()} temp: ${triggerTemp}°C. Initiating shutdown in ${config.shutdownDelay}s...`);
        setConfig({
            triggered: true,
            triggeredAt: Date.now(),
            triggeredBy: reason,
            triggeredTemp: triggerTemp,
        });

        try {
            const message = `THERMAL PROTECTION: ${reason.toUpperCase()} temperature reached ${triggerTemp}°C (threshold: ${reason.includes('cpu') ? config.cpuThreshold : config.gpuThreshold}°C). System shutting down in ${config.shutdownDelay} seconds.`;
            await execAsync(
                `shutdown /s /t ${config.shutdownDelay} /c "${message}"`,
                { timeout: 10000 }
            );
            console.warn(`[THERMAL] Shutdown command issued with ${config.shutdownDelay}s delay.`);
        } catch (e) {
            console.error('[THERMAL] Failed to execute shutdown command:', e);
        }
    }
}

/**
 * GET: Return current thermal shutdown configuration
 */
export async function GET() {
    return NextResponse.json(getConfig());
}

/**
 * POST: Update thermal shutdown configuration
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const config = getConfig();

        // Update allowed fields
        if (typeof body.enabled === 'boolean') {
            setConfig({ enabled: body.enabled });
        }
        if (typeof body.cpuThreshold === 'number' && body.cpuThreshold >= 30 && body.cpuThreshold <= 120) {
            setConfig({ cpuThreshold: body.cpuThreshold });
        }
        if (typeof body.gpuThreshold === 'number' && body.gpuThreshold >= 30 && body.gpuThreshold <= 120) {
            setConfig({ gpuThreshold: body.gpuThreshold });
        }
        if (typeof body.mbThreshold === 'number' && body.mbThreshold >= 30 && body.mbThreshold <= 120) {
            setConfig({ mbThreshold: body.mbThreshold });
        }
        if (typeof body.shutdownDelay === 'number' && body.shutdownDelay >= 10 && body.shutdownDelay <= 300) {
            setConfig({ shutdownDelay: body.shutdownDelay });
        }

        return NextResponse.json(getConfig());
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

/**
 * DELETE: Cancel a pending shutdown and reset triggered state
 */
export async function DELETE() {
    try {
        // Abort the pending Windows shutdown
        await execAsync('shutdown /a', { timeout: 5000 });
        console.log('[THERMAL] Shutdown cancelled by user.');
    } catch (e) {
        // May fail if no shutdown is pending, that's fine
        console.warn('[THERMAL] shutdown /a failed (no pending shutdown?):', e);
    }

    setConfig({
        triggered: false,
        triggeredAt: null,
        triggeredBy: null,
        triggeredTemp: null,
    });

    return NextResponse.json(getConfig());
}
