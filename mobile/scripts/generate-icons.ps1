# Genera los assets de la app (icono, icono adaptativo Android, splash, favicon)
# dibujando un dado blanco sobre el gradiente de marca con GDI+ (System.Drawing).
# Reproducible: ejecutar con `powershell -File scripts/generate-icons.ps1`.

Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot '..\assets'
if (-not (Test-Path $assets)) { New-Item -ItemType Directory -Force $assets | Out-Null }

function New-RoundedPath([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc(($x + $w - $d), $y, $d, $d, 270, 90)
  $p.AddArc(($x + $w - $d), ($y + $h - $d), $d, $d, 0, 90)
  $p.AddArc($x, ($y + $h - $d), $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function New-Die([string]$path, [int]$size, [string]$mode, [double]$dieScale) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)

  if ($mode -eq 'gradient') {
    $c1 = [System.Drawing.ColorTranslator]::FromHtml('#a855f7')
    $c2 = [System.Drawing.ColorTranslator]::FromHtml('#ec4899')
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)
    $g.FillRectangle($brush, $rect)
  }
  elseif ($mode -eq 'transparent') {
    $g.Clear([System.Drawing.Color]::Transparent)
  }
  else {
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml($mode))
  }

  $dieSize = [int]($size * $dieScale)
  $half = [int](($size - $dieSize) / 2)
  $x = $half
  $y = $half
  $radius = [int]($dieSize * 0.20)

  $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
  $offX = [int]($dieSize * 0.04)
  $offY = [int]($dieSize * 0.06)
  $sp = New-RoundedPath ($x + $offX) ($y + $offY) $dieSize $dieSize $radius
  $g.FillPath($shadow, $sp)

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $bp = New-RoundedPath $x $y $dieSize $dieSize $radius
  $g.FillPath($white, $bp)

  $pip = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#7c3aed'))
  $pad = [int]($dieSize * 0.26)
  $pr = [int]($dieSize * 0.085)
  $cx = $x + [int]($dieSize / 2)
  $cy = $y + [int]($dieSize / 2)
  $pts = @(
    @(($x + $pad), ($y + $pad)),
    @(($x + $dieSize - $pad), ($y + $pad)),
    @($cx, $cy),
    @(($x + $pad), ($y + $dieSize - $pad)),
    @(($x + $dieSize - $pad), ($y + $dieSize - $pad))
  )
  foreach ($pt in $pts) {
    $g.FillEllipse($pip, ($pt[0] - $pr), ($pt[1] - $pr), ($pr * 2), ($pr * 2))
  }

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Output ("OK " + $path)
}

New-Die (Join-Path $assets 'icon.png') 1024 'gradient' 0.58
New-Die (Join-Path $assets 'adaptive-icon.png') 1024 'transparent' 0.52
New-Die (Join-Path $assets 'splash-icon.png') 1024 'transparent' 0.42
New-Die (Join-Path $assets 'favicon.png') 48 'gradient' 0.62
