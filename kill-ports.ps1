# Kill processes on specific ports
$ports = @(3001, 5173)

# Kill node and vite processes first
Get-Process -Name "node","npm","vite" -ErrorAction SilentlyContinue | Stop-Process -Force

Start-Sleep -Seconds 2

# Kill anything on the ports
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            try {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
                Write-Host "Killed process $($conn.OwningProcess) on port $port"
            } catch {
                Write-Host "Could not kill process: $_"
            }
        }
    }
}

Start-Sleep -Seconds 1
Write-Host "Ports cleared"
