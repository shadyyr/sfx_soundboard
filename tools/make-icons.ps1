$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$outDir = Join-Path $PSScriptRoot "..\icons"

# same shade pattern the app uses for its 16 keys
$pattern = @(0,1,0,2, 3,0,1,0, 0,2,0,3, 1,0,2,0)
$shades = @("#2D6A4F","#31795A","#4F7368","#1B4332")

function New-Icon([int]$size, [string]$path, [double]$contentRatio) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml("#141E19"))
  $content = $size * $contentRatio
  $origin = ($size - $content) / 2
  $gap = $content * 0.07
  $cell = ($content - 3 * $gap) / 4
  $radius = $cell * 0.24
  for ($r = 0; $r -lt 4; $r++) {
    for ($c = 0; $c -lt 4; $c++) {
      $x = $origin + $c * ($cell + $gap)
      $y = $origin + $r * ($cell + $gap)
      $shade = $shades[$pattern[$r * 4 + $c]]
      $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($shade))
      $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
      $d = [float]($radius * 2)
      $gp.AddArc([float]$x, [float]$y, $d, $d, 180, 90)
      $gp.AddArc([float]($x + $cell - $d), [float]$y, $d, $d, 270, 90)
      $gp.AddArc([float]($x + $cell - $d), [float]($y + $cell - $d), $d, $d, 0, 90)
      $gp.AddArc([float]$x, [float]($y + $cell - $d), $d, $d, 90, 90)
      $gp.CloseFigure()
      $g.FillPath($brush, $gp)
      $brush.Dispose(); $gp.Dispose()
    }
  }
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# regular icons: grid fills 66% of the canvas
New-Icon 512 (Join-Path $outDir "icon-512.png") 0.66
New-Icon 192 (Join-Path $outDir "icon-192.png") 0.66
New-Icon 180 (Join-Path $outDir "apple-touch-icon.png") 0.66
# maskable: a square's corners must stay inside the 40%-radius safe circle,
# so the grid may span at most size * 0.8 / sqrt(2) = 0.566 — use 0.52
New-Icon 512 (Join-Path $outDir "icon-512-maskable.png") 0.52
Get-ChildItem (Join-Path $outDir "*.png") | Select-Object Name, Length
