"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Activity,
    Cpu,
    MemoryStick,
    Monitor,
    Thermometer,
    Zap,
    Server,
    Battery,
    ShieldAlert,
    ShieldCheck,
    Power,
    AlertTriangle,
    XCircle,
    Flame,
    Wifi,
    ArrowUp,
    ArrowDown,
    Globe,
    Cable,
    Network
} from "lucide-react";
import clsx from "clsx";

interface SystemData {
    cpu: {
        manufacturer: string;
        brand: string;
        speed: string;
        speedMax: string;
        cores: number;
        physicalCores: number;
        load: string;
        loadCores: string[];
        temperature: number | null;
        temperatureCores: number[];
        tempMax: number | null;
    };
    memory: {
        total: number;
        free: number;
        used: number;
        active: number;
        available: number;
        usagePercentage: string;
    };
    motherboard: {
        manufacturer: string;
        model: string;
        version: string;
        serial: string;
        temperature: number | null;
    };
    graphics: {
        vendor: string;
        model: string;
        vram: number;
        temperature: number | null;
    }[];
    os: {
        platform: string;
        distro: string;
        release: string;
        kernel: string;
        arch: string;
        uptime: number;
    };
    battery: {
        hasBattery: boolean;
        percent: number;
        isCharging: boolean;
    };
    network: {
        defaultInterface: string;
        interfaces: {
            name: string;
            type: string;
            speed: number;
            ip4: string;
            ip6: string;
            mac: string;
            operstate: string;
            dhcp: boolean;
            isDefault: boolean;
        }[];
        stats: {
            iface: string;
            rxBytes: number;
            txBytes: number;
            rxSec: number;
            txSec: number;
            rxDropped: number;
            txDropped: number;
            rxErrors: number;
            txErrors: number;
        }[];
        connections: {
            total: number;
            established: number;
            listening: number;
            timeWait: number;
            closeWait: number;
        };
    };
}

interface ThermalConfig {
    enabled: boolean;
    cpuThreshold: number;
    gpuThreshold: number;
    mbThreshold: number;
    shutdownDelay: number;
    triggered: boolean;
    triggeredAt: number | null;
    triggeredBy: string | null;
    triggeredTemp: number | null;
}

export default function Dashboard() {
    const [data, setData] = useState<SystemData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Thermal shutdown state
    const [thermalConfig, setThermalConfig] = useState<ThermalConfig>({
        enabled: false,
        cpuThreshold: 80,
        gpuThreshold: 85,
        mbThreshold: 75,
        shutdownDelay: 60,
        triggered: false,
        triggeredAt: null,
        triggeredBy: null,
        triggeredTemp: null,
    });
    const [thermalSaving, setThermalSaving] = useState(false);
    const [showThermalPanel, setShowThermalPanel] = useState(false);

    // Local UI state for threshold sliders (so we don't spam the API on every slide)
    const [localCpuThreshold, setLocalCpuThreshold] = useState(80);
    const [localGpuThreshold, setLocalGpuThreshold] = useState(85);
    const [localMbThreshold, setLocalMbThreshold] = useState(75);
    const [localShutdownDelay, setLocalShutdownDelay] = useState(60);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/system");
            if (!res.ok) throw new Error("Failed to fetch data");
            const json = await res.json();
            setData(json);
            setError("");
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const fetchThermalConfig = useCallback(async () => {
        try {
            const res = await fetch("/api/thermal-shutdown");
            if (res.ok) {
                const config = await res.json();
                setThermalConfig(config);
                // Only sync sliders if we haven't been editing them
                if (!thermalSaving) {
                    setLocalCpuThreshold(config.cpuThreshold);
                    setLocalGpuThreshold(config.gpuThreshold);
                    setLocalMbThreshold(config.mbThreshold);
                    setLocalShutdownDelay(config.shutdownDelay);
                }
            }
        } catch {
            // Silently fail — non-critical
        }
    }, [thermalSaving]);

    const saveThermalConfig = async (updates: Partial<ThermalConfig>) => {
        setThermalSaving(true);
        try {
            const res = await fetch("/api/thermal-shutdown", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            if (res.ok) {
                const config = await res.json();
                setThermalConfig(config);
            }
        } catch {
            // handle error
        } finally {
            setThermalSaving(false);
        }
    };

    const cancelShutdown = async () => {
        try {
            const res = await fetch("/api/thermal-shutdown", { method: "DELETE" });
            if (res.ok) {
                const config = await res.json();
                setThermalConfig(config);
            }
        } catch {
            // handle error
        }
    };

    const toggleEnabled = () => {
        const newEnabled = !thermalConfig.enabled;
        saveThermalConfig({ enabled: newEnabled });
    };

    const applyThresholds = () => {
        saveThermalConfig({
            cpuThreshold: localCpuThreshold,
            gpuThreshold: localGpuThreshold,
            mbThreshold: localMbThreshold,
            shutdownDelay: localShutdownDelay,
        });
    };

    // Format bytes to human-readable (e.g., 1.5 GB, 340 MB)
    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const value = bytes / Math.pow(1024, i);
        return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
    };

    // Format speed in bytes/sec to human-readable (e.g., 12.5 MB/s)
    const formatSpeed = (bytesPerSec: number): string => {
        if (bytesPerSec === 0 || bytesPerSec < 0) return '0 B/s';
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
        const value = bytesPerSec / Math.pow(1024, i);
        return `${value.toFixed(i > 1 ? 1 : 0)} ${units[Math.min(i, units.length - 1)]}`;
    };

    useEffect(() => {
        fetchData();
        fetchThermalConfig();
        const interval = setInterval(() => {
            fetchData();
            fetchThermalConfig();
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Compute countdown for active shutdown
    const shutdownCountdown = thermalConfig.triggered && thermalConfig.triggeredAt
        ? Math.max(0, thermalConfig.shutdownDelay - Math.floor((Date.now() - thermalConfig.triggeredAt) / 1000))
        : null;

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
                <div className="flex flex-col items-center">
                    <Activity className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
                    <h2 className="text-xl font-light tracking-widest text-[#a1a1aa]">INITIALIZING SYSTEMS</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-white p-6 relative overflow-hidden font-sans">
            {/* Dynamic Background */}
            <div className="absolute top-0 right-0 -m-32 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 -m-32 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px] pointer-events-none" />

            {/* Shutdown Warning Overlay */}
            {thermalConfig.triggered && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-red-950/90 border-2 border-red-500 rounded-2xl p-8 max-w-lg mx-4 text-center shadow-2xl shadow-red-500/30 animate-pulse-slow">
                        <Flame className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
                        <h2 className="text-2xl font-bold text-red-100 mb-2">⚠ THERMAL SHUTDOWN INITIATED</h2>
                        <p className="text-red-200 mb-2">
                            {thermalConfig.triggeredBy?.toUpperCase()} temperature reached{" "}
                            <span className="font-bold text-red-100 text-xl">{thermalConfig.triggeredTemp}°C</span>
                        </p>
                        <div className="my-6">
                            <p className="text-red-300 text-sm mb-1">System shutting down in</p>
                            <p className="text-6xl font-bold font-mono text-red-100">
                                {shutdownCountdown !== null ? shutdownCountdown : '—'}
                            </p>
                            <p className="text-red-400 text-xs mt-1">seconds</p>
                        </div>
                        <button
                            onClick={cancelShutdown}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 flex items-center mx-auto space-x-2 shadow-lg hover:shadow-red-500/40 active:scale-95"
                        >
                            <XCircle className="w-5 h-5" />
                            <span>ABORT SHUTDOWN</span>
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto relative z-10">
                <header className="flex justify-between items-center mb-10 pb-4 border-b border-white/5">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                            Nexus Hardware Monitor
                        </h1>
                        <p className="text-zinc-400 text-sm mt-1">Real-time Windows telemetrics & system health</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        {/* Thermal Protection Toggle Button */}
                        <button
                            onClick={() => setShowThermalPanel(!showThermalPanel)}
                            className={clsx(
                                "flex items-center space-x-2 py-2 px-4 rounded-full border text-sm font-medium tracking-wide transition-all duration-300 cursor-pointer",
                                thermalConfig.enabled
                                    ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 glow-rose"
                                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                            )}
                        >
                            {thermalConfig.enabled ? (
                                <ShieldCheck className="w-4 h-4 text-red-400" />
                            ) : (
                                <ShieldAlert className="w-4 h-4" />
                            )}
                            <span>{thermalConfig.enabled ? "THERMAL GUARD ON" : "THERMAL GUARD"}</span>
                        </button>
                        <div className="flex items-center space-x-2 text-zinc-300 bg-white/5 py-2 px-4 rounded-full border border-white/10 glass">
                            <Server className="w-4 h-4 text-emerald-400 animate-pulse" />
                            <span className="text-sm font-medium tracking-wide">SYSTEM ONLINE</span>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-100 p-4 rounded-xl mb-6 flex items-center shadow-lg">
                        <ShieldAlert className="w-5 h-5 mr-3" />
                        <p>{error}</p>
                    </div>
                )}

                {/* Thermal Protection Configuration Panel */}
                {showThermalPanel && (
                    <div className="mb-6 glass rounded-2xl p-6 border border-red-500/20 transition-all animate-slideDown">
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <h3 className="text-lg font-semibold flex items-center text-zinc-100 mb-1">
                                    <Flame className="w-5 h-5 mr-2 text-red-400" /> Thermal Shutdown Protection
                                </h3>
                                <p className="text-xs text-zinc-500">
                                    Automatically shut down the PC when temperatures exceed safe limits
                                </p>
                            </div>
                            {/* Enable/Disable Toggle */}
                            <button
                                onClick={toggleEnabled}
                                className={clsx(
                                    "relative w-14 h-7 rounded-full transition-all duration-300 cursor-pointer",
                                    thermalConfig.enabled
                                        ? "bg-red-500 shadow-lg shadow-red-500/30"
                                        : "bg-zinc-700"
                                )}
                            >
                                <div
                                    className={clsx(
                                        "absolute w-5 h-5 bg-white rounded-full top-1 transition-all duration-300 shadow",
                                        thermalConfig.enabled ? "left-8" : "left-1"
                                    )}
                                />
                            </button>
                        </div>

                        <div className={clsx(
                            "transition-opacity duration-300",
                            thermalConfig.enabled ? "opacity-100" : "opacity-40 pointer-events-none"
                        )}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* CPU Threshold */}
                                <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-zinc-400 flex items-center font-medium">
                                            <Cpu className="w-3 h-3 mr-1.5 text-blue-400" /> CPU Threshold
                                        </p>
                                        <span className={clsx(
                                            "text-sm font-mono font-bold px-2 py-0.5 rounded",
                                            data?.cpu.temperature && data.cpu.temperature >= localCpuThreshold
                                                ? "bg-red-500/20 text-red-400"
                                                : "bg-blue-500/20 text-blue-400"
                                        )}>
                                            {localCpuThreshold}°C
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="40"
                                        max="110"
                                        value={localCpuThreshold}
                                        onChange={(e) => setLocalCpuThreshold(parseInt(e.target.value))}
                                        className="thermal-slider w-full"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                        <span>40°C</span>
                                        <span>110°C</span>
                                    </div>
                                    {data?.cpu.temperature !== null && (
                                        <p className="text-xs text-zinc-500 mt-2">
                                            Current: <span className="text-zinc-300 font-mono">{data?.cpu.temperature}°C</span>
                                        </p>
                                    )}
                                </div>

                                {/* GPU Threshold */}
                                <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-zinc-400 flex items-center font-medium">
                                            <Monitor className="w-3 h-3 mr-1.5 text-rose-400" /> GPU Threshold
                                        </p>
                                        <span className={clsx(
                                            "text-sm font-mono font-bold px-2 py-0.5 rounded",
                                            data?.graphics[0]?.temperature && data.graphics[0].temperature >= localGpuThreshold
                                                ? "bg-red-500/20 text-red-400"
                                                : "bg-rose-500/20 text-rose-400"
                                        )}>
                                            {localGpuThreshold}°C
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="40"
                                        max="110"
                                        value={localGpuThreshold}
                                        onChange={(e) => setLocalGpuThreshold(parseInt(e.target.value))}
                                        className="thermal-slider w-full"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                        <span>40°C</span>
                                        <span>110°C</span>
                                    </div>
                                    {data?.graphics[0]?.temperature !== null && (
                                        <p className="text-xs text-zinc-500 mt-2">
                                            Current: <span className="text-zinc-300 font-mono">{data?.graphics[0]?.temperature}°C</span>
                                        </p>
                                    )}
                                </div>

                                {/* MB Threshold */}
                                <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-zinc-400 flex items-center font-medium">
                                            <Activity className="w-3 h-3 mr-1.5 text-violet-400" /> MB Threshold
                                        </p>
                                        <span className={clsx(
                                            "text-sm font-mono font-bold px-2 py-0.5 rounded",
                                            data?.motherboard.temperature && data.motherboard.temperature >= localMbThreshold
                                                ? "bg-red-500/20 text-red-400"
                                                : "bg-violet-500/20 text-violet-400"
                                        )}>
                                            {localMbThreshold}°C
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="30"
                                        max="100"
                                        value={localMbThreshold}
                                        onChange={(e) => setLocalMbThreshold(parseInt(e.target.value))}
                                        className="thermal-slider w-full"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                        <span>30°C</span>
                                        <span>100°C</span>
                                    </div>
                                    {data?.motherboard.temperature !== null && (
                                        <p className="text-xs text-zinc-500 mt-2">
                                            Current: <span className="text-zinc-300 font-mono">{data?.motherboard.temperature}°C</span>
                                        </p>
                                    )}
                                </div>

                                {/* Shutdown Delay */}
                                <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-zinc-400 flex items-center font-medium">
                                            <Power className="w-3 h-3 mr-1.5 text-amber-400" /> Grace Period
                                        </p>
                                        <span className="text-sm font-mono font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                                            {localShutdownDelay}s
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="300"
                                        step="10"
                                        value={localShutdownDelay}
                                        onChange={(e) => setLocalShutdownDelay(parseInt(e.target.value))}
                                        className="thermal-slider thermal-slider-amber w-full"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                        <span>10s</span>
                                        <span>300s</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">
                                        Time before shutdown after threshold breach
                                    </p>
                                </div>
                            </div>

                            {/* Apply Button */}
                            <div className="mt-4 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    {thermalConfig.enabled && (
                                        <div className="flex items-center space-x-2 text-xs">
                                            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                            <span className="text-zinc-400">
                                                Active — monitoring every 3s
                                            </span>
                                            {thermalConfig.cpuThreshold !== localCpuThreshold ||
                                                thermalConfig.gpuThreshold !== localGpuThreshold ||
                                                thermalConfig.mbThreshold !== localMbThreshold ||
                                                thermalConfig.shutdownDelay !== localShutdownDelay ? (
                                                <span className="text-amber-400 ml-2">• Unsaved changes</span>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={applyThresholds}
                                    disabled={thermalSaving}
                                    className={clsx(
                                        "px-6 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95",
                                        thermalSaving
                                            ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                            : "bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50"
                                    )}
                                >
                                    {thermalSaving ? "Saving..." : "Apply Thresholds"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {data && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* CPU Module */}
                        <div className="glass rounded-2xl p-6 transition-all hover:border-blue-500/30 group">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold flex items-center text-zinc-100 mb-1">
                                        <Cpu className="w-5 h-5 mr-2 text-blue-400" /> CPU Core
                                    </h3>
                                    <p className="text-xs text-zinc-500">{data.cpu.manufacturer} {data.cpu.brand}</p>
                                </div>
                                <div className={clsx(
                                    "px-3 py-1 rounded-full text-xs font-bold font-mono shadow-sm",
                                    parseFloat(data.cpu.load) > 80 ? "bg-red-500/20 text-red-400 glow-rose" :
                                        parseFloat(data.cpu.load) > 50 ? "bg-orange-500/20 text-orange-400 glow-orange" :
                                            "bg-blue-500/20 text-blue-400 glow"
                                )}>
                                    {data.cpu.load}% LOAD
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs text-zinc-400 mb-1 font-medium">
                                        <span>Performance</span>
                                        <span>{data.cpu.speed} / {data.cpu.speedMax} GHz</span>
                                    </div>
                                    <div className="w-full bg-zinc-800/50 rounded-full h-2 overflow-hidden shadow-inner">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-500 ease-out"
                                            style={{ width: `${(parseFloat(data.cpu.speed) / parseFloat(data.cpu.speedMax)) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                                        <p className="text-xs text-zinc-500 mb-1">Cores</p>
                                        <p className="text-lg font-semibold font-mono">{data.cpu.physicalCores} / {data.cpu.cores}t</p>
                                    </div>
                                    <div className={clsx(
                                        "bg-zinc-900/50 p-3 rounded-xl border",
                                        thermalConfig.enabled && data.cpu.temperature !== null && data.cpu.temperature >= thermalConfig.cpuThreshold
                                            ? "border-red-500/50 bg-red-900/20"
                                            : "border-white/5"
                                    )}>
                                        <p className="text-xs text-zinc-500 mb-1 flex items-center"><Thermometer className="w-3 h-3 mr-1" /> Temp</p>
                                        <p className={clsx(
                                            "text-lg font-semibold font-mono",
                                            thermalConfig.enabled && data.cpu.temperature !== null && data.cpu.temperature >= thermalConfig.cpuThreshold * 0.9
                                                ? "text-red-400"
                                                : ""
                                        )}>
                                            {data.cpu.temperature ? `${data.cpu.temperature}°C` : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Motherboard Module */}
                        <div className="glass rounded-2xl p-6 transition-all hover:border-violet-500/30 group">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold flex items-center text-zinc-100 mb-1">
                                        <Activity className="w-5 h-5 mr-2 text-violet-400" /> Motherboard
                                    </h3>
                                    <p className="text-xs text-zinc-500">{data.motherboard.manufacturer || 'Unknown Vendor'}</p>
                                </div>
                                <div className="bg-violet-500/20 text-violet-400 px-3 py-1 rounded-full text-xs font-bold font-mono glow-violet">
                                    BASEBOARD
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                    <p className="text-xs text-zinc-500 mb-1">Model</p>
                                    <p className="text-sm font-medium">{data.motherboard.model || 'Unknown'}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                                        <p className="text-xs text-zinc-500 mb-1">Version</p>
                                        <p className="text-sm font-medium">{data.motherboard.version || 'N/A'}</p>
                                    </div>
                                    <div className={clsx(
                                        "bg-zinc-900/50 p-3 rounded-xl border",
                                        thermalConfig.enabled && data.motherboard.temperature !== null && data.motherboard.temperature >= thermalConfig.mbThreshold
                                            ? "border-red-500/50 bg-red-900/20"
                                            : "border-white/5"
                                    )}>
                                        <p className="text-xs text-zinc-500 mb-1 flex items-center"><Thermometer className="w-3 h-3 mr-1" /> Temp</p>
                                        <p className={clsx(
                                            "text-lg font-semibold font-mono",
                                            thermalConfig.enabled && data.motherboard.temperature !== null && data.motherboard.temperature >= (thermalConfig.mbThreshold * 0.9)
                                                ? "text-red-400"
                                                : data.motherboard.temperature !== null && data.motherboard.temperature >= 60
                                                    ? "text-amber-400"
                                                    : ""
                                        )}>
                                            {data.motherboard.temperature !== null ? `${data.motherboard.temperature}°C` : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                                        <p className="text-xs text-zinc-500 mb-1">Status</p>
                                        <div className="flex items-center text-emerald-400">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                                            <span className="text-sm font-medium">Optimal</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Memory Module */}
                        <div className="glass rounded-2xl p-6 transition-all hover:border-emerald-500/30 group">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold flex items-center text-zinc-100 mb-1">
                                        <MemoryStick className="w-5 h-5 mr-2 text-emerald-400" /> Memory
                                    </h3>
                                    <p className="text-xs text-zinc-500">System RAM Allocation</p>
                                </div>
                                <div className={clsx(
                                    "px-3 py-1 rounded-full text-xs font-bold font-mono",
                                    parseFloat(data.memory.usagePercentage) > 85 ? "bg-red-500/20 text-red-400 glow-rose" :
                                        parseFloat(data.memory.usagePercentage) > 70 ? "bg-orange-500/20 text-orange-400 glow-orange" :
                                            "bg-emerald-500/20 text-emerald-400 glow-emerald"
                                )}>
                                    {data.memory.usagePercentage}% USED
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs text-zinc-400 mb-1 font-medium">
                                        <span>Usage</span>
                                        <span>{(data.memory.active / (1024 ** 3)).toFixed(1)} / {(data.memory.total / (1024 ** 3)).toFixed(1)} GB</span>
                                    </div>
                                    <div className="w-full bg-zinc-800/50 rounded-full h-2 overflow-hidden shadow-inner">
                                        <div
                                            className={clsx(
                                                "h-2 rounded-full transition-all duration-500 ease-out",
                                                parseFloat(data.memory.usagePercentage) > 85 ? "bg-gradient-to-r from-orange-500 to-red-500" :
                                                    "bg-gradient-to-r from-emerald-500 to-teal-400"
                                            )}
                                            style={{ width: `${data.memory.usagePercentage}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                                        <p className="text-xs text-zinc-500 mb-1">Available</p>
                                        <p className="text-lg font-semibold font-mono">{(data.memory.available / (1024 ** 3)).toFixed(1)}<span className="text-xs text-zinc-500 ml-1">GB</span></p>
                                    </div>
                                    <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                                        <p className="text-xs text-zinc-500 mb-1">Free</p>
                                        <p className="text-lg font-semibold font-mono">{(data.memory.free / (1024 ** 3)).toFixed(1)}<span className="text-xs text-zinc-500 ml-1">GB</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Graphics Module */}
                        {data.graphics.map((gpu, index) => (
                            <div key={index} className="glass rounded-2xl p-6 transition-all hover:border-rose-500/30 group">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-lg font-semibold flex items-center text-zinc-100 mb-1">
                                            <Monitor className="w-5 h-5 mr-2 text-rose-400" /> GPU {index > 0 ? `#${index + 1}` : ''}
                                        </h3>
                                        <p className="text-xs text-zinc-500">{gpu.vendor}</p>
                                    </div>
                                    <div className="bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full text-xs font-bold font-mono glow-rose">
                                        GRAPHICS
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                        <p className="text-xs text-zinc-500 mb-1">Model</p>
                                        <p className="text-sm font-medium">{gpu.model || 'Generic Display Adapter'}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className={clsx(
                                            "bg-zinc-900/50 p-3 rounded-xl border",
                                            thermalConfig.enabled && gpu.temperature !== null && gpu.temperature >= thermalConfig.gpuThreshold
                                                ? "border-red-500/50 bg-red-900/20"
                                                : "border-white/5"
                                        )}>
                                            <p className="text-xs text-zinc-500 mb-1 flex items-center"><Thermometer className="w-3 h-3 mr-1" /> Temp</p>
                                            <p className={clsx(
                                                "text-lg font-semibold font-mono",
                                                thermalConfig.enabled && gpu.temperature !== null && gpu.temperature >= thermalConfig.gpuThreshold * 0.9
                                                    ? "text-red-400"
                                                    : ""
                                            )}>
                                                {gpu.temperature ? `${gpu.temperature}°C` : 'N/A'}
                                            </p>
                                        </div>
                                        <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                                            <p className="text-xs text-zinc-500 mb-1">VRAM</p>
                                            <p className="text-lg font-semibold font-mono">
                                                {gpu.vram ? `${gpu.vram} MB` : 'Dynamic'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Network Monitor Module */}
                        <div className="glass rounded-2xl p-6 md:col-span-2 lg:col-span-3 transition-all hover:border-cyan-500/30">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold flex items-center text-zinc-100 mb-1">
                                        <Globe className="w-5 h-5 mr-2 text-cyan-400" /> Network Monitor
                                    </h3>
                                    <p className="text-xs text-zinc-500">Real-time traffic & connections</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-xs font-bold font-mono glow-cyan">
                                        {data.network.connections.established} ACTIVE
                                    </div>
                                </div>
                            </div>

                            {/* Speed Overview - Default Interface */}
                            {(() => {
                                const defaultIface = data.network.interfaces.find(i => i.isDefault);
                                const defaultStats = data.network.stats.find(s => s.iface === defaultIface?.name) || data.network.stats[0];
                                if (!defaultStats) return null;

                                return (
                                    <div className="mb-6">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {/* Download Speed */}
                                            <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                                <p className="text-xs text-zinc-500 mb-2 flex items-center">
                                                    <ArrowDown className="w-3 h-3 mr-1 text-emerald-400" /> Download
                                                </p>
                                                <p className="text-2xl font-bold font-mono text-emerald-400">
                                                    {formatSpeed(defaultStats.rxSec)}
                                                </p>
                                                <p className="text-xs text-zinc-600 mt-1">
                                                    Total: {formatBytes(defaultStats.rxBytes)}
                                                </p>
                                            </div>
                                            {/* Upload Speed */}
                                            <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                                <p className="text-xs text-zinc-500 mb-2 flex items-center">
                                                    <ArrowUp className="w-3 h-3 mr-1 text-blue-400" /> Upload
                                                </p>
                                                <p className="text-2xl font-bold font-mono text-blue-400">
                                                    {formatSpeed(defaultStats.txSec)}
                                                </p>
                                                <p className="text-xs text-zinc-600 mt-1">
                                                    Total: {formatBytes(defaultStats.txBytes)}
                                                </p>
                                            </div>
                                            {/* Connections */}
                                            <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                                <p className="text-xs text-zinc-500 mb-2 flex items-center">
                                                    <Network className="w-3 h-3 mr-1 text-cyan-400" /> Connections
                                                </p>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between">
                                                        <span className="text-xs text-zinc-400">Established</span>
                                                        <span className="text-xs font-mono text-emerald-400">{data.network.connections.established}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-xs text-zinc-400">Listening</span>
                                                        <span className="text-xs font-mono text-blue-400">{data.network.connections.listening}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-xs text-zinc-400">Time Wait</span>
                                                        <span className="text-xs font-mono text-amber-400">{data.network.connections.timeWait}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-xs text-zinc-400">Total</span>
                                                        <span className="text-xs font-mono text-zinc-300">{data.network.connections.total}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Interface Info */}
                                            <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                                <p className="text-xs text-zinc-500 mb-2 flex items-center">
                                                    {defaultIface?.type === 'wireless' ?
                                                        <Wifi className="w-3 h-3 mr-1 text-violet-400" /> :
                                                        <Cable className="w-3 h-3 mr-1 text-violet-400" />
                                                    } Primary Interface
                                                </p>
                                                <p className="text-sm font-medium text-zinc-200 truncate mb-1">{defaultIface?.name || 'Unknown'}</p>
                                                <p className="text-xs text-zinc-500 font-mono">{defaultIface?.ip4 || 'No IP'}</p>
                                                {defaultIface?.speed ? (
                                                    <p className="text-xs text-zinc-600 mt-1">
                                                        Link: {defaultIface.speed > 1000 ? `${(defaultIface.speed / 1000).toFixed(1)} Gbps` : `${defaultIface.speed} Mbps`}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* All Network Interfaces */}
                            {data.network.interfaces.filter(i => i.operstate === 'up').length > 1 && (
                                <div>
                                    <p className="text-xs text-zinc-400 font-medium mb-3">All Active Interfaces</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {data.network.interfaces
                                            .filter(iface => iface.operstate === 'up')
                                            .map((iface, idx) => {
                                                const stats = data.network.stats.find(s => s.iface === iface.name);
                                                return (
                                                    <div key={idx} className={clsx(
                                                        "bg-zinc-900/30 p-3 rounded-lg border transition-all",
                                                        iface.isDefault ? "border-cyan-500/20" : "border-white/5"
                                                    )}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center space-x-2">
                                                                {iface.type === 'wireless' ?
                                                                    <Wifi className="w-3.5 h-3.5 text-cyan-400" /> :
                                                                    <Cable className="w-3.5 h-3.5 text-cyan-400" />
                                                                }
                                                                <span className="text-xs font-medium text-zinc-300 truncate max-w-[140px]">{iface.name}</span>
                                                            </div>
                                                            {iface.isDefault && (
                                                                <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-medium">DEFAULT</span>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <span className="text-zinc-500">IP: </span>
                                                                <span className="text-zinc-300 font-mono text-[11px]">{iface.ip4 || '—'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-zinc-500">MAC: </span>
                                                                <span className="text-zinc-400 font-mono text-[10px]">{iface.mac || '—'}</span>
                                                            </div>
                                                        </div>
                                                        {stats && (
                                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-xs">
                                                                <span className="flex items-center text-emerald-400">
                                                                    <ArrowDown className="w-3 h-3 mr-0.5" />
                                                                    {formatSpeed(stats.rxSec)}
                                                                </span>
                                                                <span className="flex items-center text-blue-400">
                                                                    <ArrowUp className="w-3 h-3 mr-0.5" />
                                                                    {formatSpeed(stats.txSec)}
                                                                </span>
                                                                {(stats.rxErrors > 0 || stats.txErrors > 0) && (
                                                                    <span className="text-red-400 text-[10px]">
                                                                        {stats.rxErrors + stats.txErrors} err
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* System Info & OS Module */}
                        <div className="glass rounded-2xl p-6 md:col-span-2 lg:col-span-2 transition-all hover:border-amber-500/30">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold flex items-center text-zinc-100 mb-1">
                                        <Zap className="w-5 h-5 mr-2 text-amber-400" /> OS & Processors
                                    </h3>
                                    <p className="text-xs text-zinc-500">Windows Telemetry</p>
                                </div>
                                <div className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold font-mono glow">
                                    {data.os.platform} {data.os.release}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-center">
                                    <p className="text-xs text-zinc-500 mb-1">OS Environment</p>
                                    <p className="text-sm font-medium capitalize">{data.os.distro}</p>
                                    <p className="text-xs text-zinc-600 mt-1">Arch: {data.os.arch}</p>
                                </div>
                                <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-center">
                                    <p className="text-xs text-zinc-500 mb-1">System Uptime</p>
                                    <p className="text-xl font-semibold font-mono">
                                        {Math.floor(data.os.uptime / 3600)}<span className="text-sm font-sans mx-1">h</span>
                                        {Math.floor((data.os.uptime % 3600) / 60)}<span className="text-sm font-sans mx-1">m</span>
                                    </p>
                                </div>

                                {data.battery.hasBattery ? (
                                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-center">
                                        <p className="text-xs text-zinc-500 mb-1 flex items-center">
                                            <Battery className="w-3 h-3 mr-1" /> Battery
                                        </p>
                                        <div className="flex items-center space-x-3">
                                            <p className="text-xl font-semibold font-mono">{data.battery.percent}%</p>
                                            {data.battery.isCharging && <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">Charging</span>}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-center">
                                        <p className="text-xs text-zinc-500 mb-1">Power Supply</p>
                                        <p className="text-sm font-medium text-emerald-400">AC Connected</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* Thermal Protection Status Bar */}
                {thermalConfig.enabled && !thermalConfig.triggered && data && (
                    <div className="mt-6 bg-zinc-900/40 p-4 rounded-xl border border-red-500/10 shadow-inner flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                            <p className="text-sm text-zinc-300">
                                <span className="font-medium text-red-400">Thermal Guard Active</span>
                                {" — "}
                                CPU shutdown at <span className="font-mono text-zinc-200">{thermalConfig.cpuThreshold}°C</span>
                                {" · "}
                                GPU shutdown at <span className="font-mono text-zinc-200">{thermalConfig.gpuThreshold}°C</span>
                                {" · "}
                                MB shutdown at <span className="font-mono text-zinc-200">{thermalConfig.mbThreshold}°C</span>
                                {" · "}
                                Grace period: <span className="font-mono text-zinc-200">{thermalConfig.shutdownDelay}s</span>
                            </p>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-zinc-500">
                            {data.cpu.temperature !== null && (
                                <span>CPU: <span className={clsx(
                                    "font-mono",
                                    data.cpu.temperature >= thermalConfig.cpuThreshold * 0.9 ? "text-red-400" :
                                        data.cpu.temperature >= thermalConfig.cpuThreshold * 0.75 ? "text-amber-400" : "text-emerald-400"
                                )}>{data.cpu.temperature}°C</span></span>
                            )}
                            {data.graphics[0]?.temperature !== null && (
                                <span>GPU: <span className={clsx(
                                    "font-mono",
                                    (data.graphics[0]?.temperature ?? 0) >= thermalConfig.gpuThreshold * 0.9 ? "text-red-400" :
                                        (data.graphics[0]?.temperature ?? 0) >= thermalConfig.gpuThreshold * 0.75 ? "text-amber-400" : "text-emerald-400"
                                )}>{data.graphics[0]?.temperature}°C</span></span>
                            )}
                            {data.motherboard.temperature !== null && (
                                <span>MB: <span className={clsx(
                                    "font-mono",
                                    data.motherboard.temperature >= thermalConfig.mbThreshold * 0.9 ? "text-red-400" :
                                        data.motherboard.temperature >= thermalConfig.mbThreshold * 0.75 ? "text-amber-400" : "text-emerald-400"
                                )}>{data.motherboard.temperature}°C</span></span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
