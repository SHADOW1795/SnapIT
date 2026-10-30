# SnapIT Lightweight PowerShell HTTP Server
param(
    [int]$Port = 3000
)

$Host.UI.RawUI.WindowTitle = "SnapIT Server - http://localhost:$Port"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $Root) { $Root = Get-Location }

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Error "Failed to start listener on $($prefix): $_"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ⚡ SnapIT Server Running at: http://localhost:$Port/    " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Serving static files from: $Root" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop the server.`n" -ForegroundColor Yellow

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.Url.LocalPath
        if ($rawUrl -eq "/" -or [string]::IsNullOrWhiteSpace($rawUrl)) {
            $rawUrl = "/index.html"
        }

        # Security check: prevent directory traversal
        $filePath = [System.IO.Path]::GetFullPath((Join-Path $Root $rawUrl.TrimStart('/')))
        if (-not $filePath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
            $response.StatusCode = 403
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
            continue
        }

        if (Test-Path -Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            
            $response.ContentType = $contentType
            $response.StatusCode = 200
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Cache-Control", "no-cache")

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.OutputStream.Close()
            Write-Host "[200] $($request.HttpMethod) $rawUrl" -ForegroundColor Green
        } else {
            # Fallback to index.html for query route handling (?r=slug)
            $fallbackPath = Join-Path $Root "index.html"
            if (Test-Path $fallbackPath) {
                $response.ContentType = "text/html; charset=utf-8"
                $response.StatusCode = 200
                $bytes = [System.IO.File]::ReadAllBytes($fallbackPath)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.OutputStream.Close()
                Write-Host "[200 Fallback] $($request.HttpMethod) $rawUrl" -ForegroundColor Gray
            } else {
                $response.StatusCode = 404
                $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.OutputStream.Close()
                Write-Host "[404] $($request.HttpMethod) $rawUrl" -ForegroundColor Red
            }
        }
    } catch {
        if (-not $listener.IsListening) { break }
        Write-Warning "Error processing request: $_"
    }
}
