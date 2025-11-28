# PowerShell script to start all dev services in one terminal
# Usage: .\dev.ps1

Write-Host "Starting Docker..." -ForegroundColor Cyan
Set-Location backend
docker compose up -d
Set-Location ..

Write-Host "Waiting for Docker services to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host "Starting backend and mobile..." -ForegroundColor Cyan
Write-Host ""

$rootDir = Get-Location

# Start backend as a job
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev
} -ArgumentList $rootDir

# Start worker as a job
$workerJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev:worker
} -ArgumentList $rootDir

# Start a background task to continuously receive and display backend output
$backendOutputTask = Start-Job -ScriptBlock {
    param($job)
    while ($job.State -eq 'Running') {
        $output = Receive-Job -Job $job -ErrorAction SilentlyContinue
        if ($output) {
            Write-Host "[BACKEND] $output" -ForegroundColor Green
        }
        Start-Sleep -Milliseconds 100
    }
    # Get any remaining output
    $remaining = Receive-Job -Job $job -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Host "[BACKEND] $remaining" -ForegroundColor Green
    }
} -ArgumentList $backendJob

# Start a background task to continuously receive and display worker output
$workerOutputTask = Start-Job -ScriptBlock {
    param($job)
    while ($job.State -eq 'Running') {
        $output = Receive-Job -Job $job -ErrorAction SilentlyContinue
        if ($output) {
            Write-Host "[WORKER] $output" -ForegroundColor Magenta
        }
        Start-Sleep -Milliseconds 100
    }
    # Get any remaining output
    $remaining = Receive-Job -Job $job -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Host "[WORKER] $remaining" -ForegroundColor Magenta
    }
} -ArgumentList $workerJob

try {
    Set-Location mobile
    # Run expo in foreground (this will show its output)
    npx expo start
} finally {
    Write-Host "`nStopping services..." -ForegroundColor Yellow
    Stop-Job $backendJob, $workerJob, $backendOutputTask, $workerOutputTask -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $workerJob, $backendOutputTask, $workerOutputTask -ErrorAction SilentlyContinue
    Set-Location $rootDir
    Set-Location backend
    docker compose down
    Set-Location ..
}