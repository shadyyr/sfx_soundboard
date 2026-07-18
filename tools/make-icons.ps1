$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$outDir = "c:\Users\shade\OneDrive\Documents\programming\sfx_soundboard\icons"

# same shade pattern the app uses for its 16 keys
$pattern = @(0,1,0,2, 3,0,1,0, 0,2,0,3, 1,0,2,0)
$shades = @("#2D6A4F","#31795A","#4F7368","#1B4332")

function New-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml("#141E19"))
  # keep the key grid inside the maskable-icon safe zone
  $content = $size * 0.66
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

New-Icon 512 "$outDir\icon-512.png"
New-Icon 192 "$outDir\icon-192.png"
New-Icon 180 "$outDir\apple-touch-icon.png"
Get-ChildItem $outDir\*.png | Select-Object Name, Length
