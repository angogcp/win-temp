# Load LibreHardwareMonitorLib.dll with all dependencies from LHM folder
$lhmDir = Join-Path $PSScriptRoot "LHM"

# Pre-load all dependency DLLs
$dllFiles = Get-ChildItem -Path $lhmDir -Filter "*.dll" | Where-Object { $_.Name -ne "LibreHardwareMonitorLib.dll" }
foreach ($dll in $dllFiles) {
    try {
        [System.Reflection.Assembly]::LoadFrom($dll.FullName) | Out-Null
    }
    catch {
        # Skip DLLs that fail to load
    }
}

# Now load the main library
try {
    [System.Reflection.Assembly]::LoadFrom((Join-Path $lhmDir "LibreHardwareMonitorLib.dll")) | Out-Null
}
catch {
    Write-Output "{`"error`":`"Failed to load LHM DLL: $($_.Exception.Message)`"}"
    exit 1
}

$computer = New-Object LibreHardwareMonitor.Hardware.Computer
$computer.IsCpuEnabled = $true
$computer.IsGpuEnabled = $true
$computer.IsMotherboardEnabled = $true
$computer.Open()

$result = @{
    cpu_temp  = $null
    gpu_temp  = $null
    mb_temp   = $null
    all_temps = New-Object System.Collections.ArrayList
}

foreach ($hw in $computer.Hardware) {
    $hw.Update()
    foreach ($sub in $hw.SubHardware) {
        $sub.Update()
        foreach ($sensor in $sub.Sensors) {
            if ($sensor.SensorType -eq [LibreHardwareMonitor.Hardware.SensorType]::Temperature -and $sensor.Value) {
                $entry = @{
                    name     = $sensor.Name
                    value    = [math]::Round($sensor.Value, 1)
                    hardware = $hw.Name
                    type     = $hw.HardwareType.ToString()
                }
                $result.all_temps.Add($entry) | Out-Null
                $hwType = $hw.HardwareType.ToString()
                if ($hwType -match 'Motherboard' -and -not $result.mb_temp) {
                    $result.mb_temp = $entry.value
                }
            }
        }
    }
    foreach ($sensor in $hw.Sensors) {
        if ($sensor.SensorType -eq [LibreHardwareMonitor.Hardware.SensorType]::Temperature -and $sensor.Value) {
            $entry = @{
                name     = $sensor.Name
                value    = [math]::Round($sensor.Value, 1)
                hardware = $hw.Name
                type     = $hw.HardwareType.ToString()
            }
            $result.all_temps.Add($entry) | Out-Null
            $hwType = $hw.HardwareType.ToString()
            if ($hwType -match 'Cpu' -and -not $result.cpu_temp) {
                $result.cpu_temp = $entry.value
            }
            if ($hwType -match 'Gpu' -and -not $result.gpu_temp) {
                $result.gpu_temp = $entry.value
            }
        }
    }
}

$computer.Close()

# Output as JSON to stdout
$json = $result | ConvertTo-Json -Depth 3 -Compress
Write-Output $json
