# Check LHM WMI namespace
Write-Output "=== WMI Check ==="
try {
    $sensors = Get-CimInstance -Namespace "Root/LibreHardwareMonitor" -ClassName Sensor -ErrorAction Stop
    $temps = $sensors | Where-Object { $_.SensorType -eq 'Temperature' } | Select-Object -First 10 Name, Value, Parent
    if ($temps) {
        $temps | Format-Table -AutoSize
    } else {
        Write-Output "No temperature sensors found in WMI"
    }
} catch {
    Write-Output "WMI namespace not available: $($_.Exception.Message)"
}

# Check LHM HTTP server on common ports
Write-Output "`n=== HTTP API Check ==="
foreach ($port in @(8085, 8086, 8087, 8088)) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:$port/data.json" -UseBasicParsing -TimeoutSec 2
        Write-Output "Port $port : HTTP $($resp.StatusCode) - Found LHM HTTP API!"
        Write-Output $resp.Content.Substring(0, [math]::Min(800, $resp.Content.Length))
        break
    } catch {
        Write-Output "Port $port : Not available"
    }
}

# Check systeminformation result
Write-Output "`n=== Node systeminformation check ==="
Write-Output "(run 'node check.js' separately)"
