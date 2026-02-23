import { NextResponse } from 'next/server';
import si from 'systeminformation';
import path from 'path';
import { checkAndTriggerShutdown } from '../thermal-shutdown/route';

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache the temperature reading for a short time since the PS script takes ~2s
let tempCache: { cpu: number | null; gpu: number | null; mb: number | null; ts: number } = {
    cpu: null, gpu: null, mb: null, ts: 0
};
const CACHE_TTL_MS = 2500; // Refresh every 2.5 seconds

/**
 * Read temperatures by directly loading LibreHardwareMonitorLib.dll via 64-bit PowerShell.
 * This avoids needing the LHM GUI running or WMI namespace registered.
 */
async function readTempsViaDll(): Promise<{ cpu: number | null; gpu: number | null; mb: number | null }> {
    const now = Date.now();
    if (now - tempCache.ts < CACHE_TTL_MS) {
        return { cpu: tempCache.cpu, gpu: tempCache.gpu, mb: tempCache.mb };
    }

    try {
        const scriptPath = path.resolve(process.cwd(), 'read_temps.ps1');
        // Use 64-bit PowerShell (SysNative) since LHM DLLs are 64-bit
        // SysNative is a virtual path that redirects to the native (64-bit) System32
        const ps64 = 'C:\\Windows\\SysNative\\WindowsPowerShell\\v1.0\\powershell.exe';
        const psFallback = 'powershell.exe';

        let stdout: string;
        try {
            const result = await execAsync(
                `"${ps64}" -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
                { timeout: 15000, cwd: process.cwd() }
            );
            stdout = result.stdout;
        } catch {
            // SysNative might not exist if already running as 64-bit
            const result = await execAsync(
                `"${psFallback}" -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
                { timeout: 15000, cwd: process.cwd() }
            );
            stdout = result.stdout;
        }

        const trimmed = stdout.trim();
        if (!trimmed) return { cpu: null, gpu: null, mb: null };

        const parsed = JSON.parse(trimmed);
        tempCache = {
            cpu: parsed.cpu_temp != null ? parsed.cpu_temp : null,
            gpu: parsed.gpu_temp != null ? parsed.gpu_temp : null,
            mb: parsed.mb_temp != null ? parsed.mb_temp : null,
            ts: now
        };
        return { cpu: tempCache.cpu, gpu: tempCache.gpu, mb: tempCache.mb };
    } catch (e) {
        console.warn('[HW-Monitor] DLL-based temperature read failed:', e);
        return { cpu: null, gpu: null, mb: null };
    }
}

/**
 * Fallback: try WMI (requires LHM GUI running as admin)
 */
async function getWmiTemperatures(): Promise<{ cpu: number | null; gpu: number | null }> {
    try {
        const psScript = `
$sensors = Get-CimInstance -Namespace "Root/LibreHardwareMonitor" -ClassName Sensor -ErrorAction SilentlyContinue
if (-not $sensors) {
    $sensors = Get-CimInstance -Namespace "Root/OpenHardwareMonitor" -ClassName Sensor -ErrorAction SilentlyContinue
}
if ($sensors) {
    $cpuTemp = $sensors | Where-Object { $_.SensorType -eq 'Temperature' -and $_.Parent -match 'cpu' } | Select-Object -First 1
    $gpuTemp = $sensors | Where-Object { $_.SensorType -eq 'Temperature' -and $_.Parent -match 'gpu' } | Select-Object -First 1
    $obj = @{}
    if ($cpuTemp) { $obj['cpu'] = [math]::Round($cpuTemp.Value, 1) }
    if ($gpuTemp) { $obj['gpu'] = [math]::Round($gpuTemp.Value, 1) }
    $obj | ConvertTo-Json -Compress
}
`;
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
        const { stdout } = await execAsync(
            `powershell.exe -NoProfile -EncodedCommand ${encoded}`,
            { timeout: 10000 }
        );
        const trimmed = stdout.trim();
        if (!trimmed) return { cpu: null, gpu: null };
        const parsed = JSON.parse(trimmed);
        return {
            cpu: parsed.cpu != null ? parsed.cpu : null,
            gpu: parsed.gpu != null ? parsed.gpu : null,
        };
    } catch {
        return { cpu: null, gpu: null };
    }
}

export async function GET() {
    try {
        const [
            cpu,
            mem,
            osInfo,
            currentLoad,
            temp,
            battery,
            graphics,
            baseboard,
            networkInterfaces,
            networkStats,
            networkDefaultIface,
            networkConnections
        ] = await Promise.all([
            si.cpu(),
            si.mem(),
            si.osInfo(),
            si.currentLoad(),
            si.cpuTemperature(),
            si.battery(),
            si.graphics(),
            si.baseboard(),
            si.networkInterfaces(),
            si.networkStats(),
            si.networkInterfaceDefault(),
            si.networkConnections()
        ]);

        // Step 1: Try native systeminformation
        let resolvedCpuTemp = temp.main || temp.cores?.[0] || null;
        let resolvedGpuTemps = graphics.controllers.map(g => g.temperatureGpu || null);

        // Step 2: Try DLL-based reading (most reliable, and only source for MB temp)
        let dllTemps = await readTempsViaDll();

        // Step 3: If DLL also failed, try WMI as last resort
        if (!dllTemps.cpu && !dllTemps.gpu && (resolvedCpuTemp === null || resolvedGpuTemps.every(t => t === null))) {
            const wmiTemps = await getWmiTemperatures();
            if (wmiTemps.cpu && !resolvedCpuTemp) dllTemps.cpu = wmiTemps.cpu;
            if (wmiTemps.gpu) dllTemps.gpu = wmiTemps.gpu;
        }

        // Resolve final temps
        if (!resolvedCpuTemp && dllTemps.cpu) resolvedCpuTemp = dllTemps.cpu;

        // Format the response
        const data = {
            cpu: {
                manufacturer: cpu.manufacturer,
                brand: cpu.brand,
                speed: cpu.speed,
                speedMax: cpu.speedMax,
                cores: cpu.cores,
                physicalCores: cpu.physicalCores,
                load: currentLoad.currentLoad.toFixed(1),
                loadCores: currentLoad.cpus.map(c => c.load.toFixed(1)),
                temperature: resolvedCpuTemp,
                temperatureCores: temp.cores || [],
                tempMax: temp.max || null
            },
            memory: {
                total: mem.total,
                free: mem.free,
                used: mem.used,
                active: mem.active,
                available: mem.available,
                usagePercentage: ((mem.active / mem.total) * 100).toFixed(1)
            },
            motherboard: {
                manufacturer: baseboard.manufacturer,
                model: baseboard.model,
                version: baseboard.version,
                serial: baseboard.serial,
                temperature: dllTemps.mb,
            },
            graphics: graphics.controllers.map((g, i) => ({
                vendor: g.vendor,
                model: g.model,
                vram: g.vram,
                temperature: g.temperatureGpu || dllTemps.gpu || null
            })),
            os: {
                platform: osInfo.platform,
                distro: osInfo.distro,
                release: osInfo.release,
                kernel: osInfo.kernel,
                arch: osInfo.arch,
                uptime: si.time().uptime
            },
            battery: {
                hasBattery: battery.hasBattery,
                percent: battery.percent,
                isCharging: battery.isCharging
            },
            network: {
                defaultInterface: networkDefaultIface,
                interfaces: (Array.isArray(networkInterfaces) ? networkInterfaces : []).map(iface => ({
                    name: iface.iface,
                    type: iface.type,
                    speed: iface.speed,
                    ip4: iface.ip4,
                    ip6: iface.ip6,
                    mac: iface.mac,
                    operstate: iface.operstate,
                    dhcp: iface.dhcp,
                    isDefault: iface.iface === networkDefaultIface,
                })),
                stats: (Array.isArray(networkStats) ? networkStats : []).map(stat => ({
                    iface: stat.iface,
                    rxBytes: stat.rx_bytes,
                    txBytes: stat.tx_bytes,
                    rxSec: stat.rx_sec >= 0 ? stat.rx_sec : 0,
                    txSec: stat.tx_sec >= 0 ? stat.tx_sec : 0,
                    rxDropped: stat.rx_dropped,
                    txDropped: stat.tx_dropped,
                    rxErrors: stat.rx_errors,
                    txErrors: stat.tx_errors,
                })),
                connections: {
                    total: networkConnections.length,
                    established: networkConnections.filter(c => c.state === 'ESTABLISHED').length,
                    listening: networkConnections.filter(c => c.state === 'LISTEN' || c.state === 'LISTENING').length,
                    timeWait: networkConnections.filter(c => c.state === 'TIME_WAIT').length,
                    closeWait: networkConnections.filter(c => c.state === 'CLOSE_WAIT').length,
                }
            }
        };

        // Check thermal shutdown thresholds on every poll
        const finalGpuTemp = data.graphics[0]?.temperature ?? null;
        const finalMbTemp = data.motherboard.temperature ?? null;
        checkAndTriggerShutdown(resolvedCpuTemp, finalGpuTemp, finalMbTemp).catch(() => { });

        return NextResponse.json(data);
    } catch (error) {
        console.error("Failed to read system information", error);
        return NextResponse.json({ error: 'Failed to read system info' }, { status: 500 });
    }
}
