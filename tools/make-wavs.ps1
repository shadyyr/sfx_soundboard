# Generates four demo tones (placeholder-*.wav) into sounds/. The default
# manifest no longer references them; wire any you generate up by hand.
$ErrorActionPreference = 'Stop'
$rate = 44100
$outDir = Join-Path $PSScriptRoot "..\sounds"

function Write-Wav([string]$path, [double[]]$samples) {
  $dataLen = $samples.Count * 2
  $fs = [System.IO.File]::Create($path)
  $bw = New-Object System.IO.BinaryWriter($fs)
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
  $bw.Write([int](36 + $dataLen))
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
  $bw.Write([int]16)
  $bw.Write([int16]1)          # PCM
  $bw.Write([int16]1)          # mono
  $bw.Write([int]$rate)
  $bw.Write([int]($rate * 2))  # byte rate
  $bw.Write([int16]2)          # block align
  $bw.Write([int16]16)         # bits per sample
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
  $bw.Write([int]$dataLen)
  foreach ($s in $samples) {
    $v = [Math]::Max(-1.0, [Math]::Min(1.0, $s))
    $bw.Write([int16]([Math]::Round($v * 32767)))
  }
  $bw.Close(); $fs.Close()
}

function Attack([double]$t) { [Math]::Min(1.0, $t / 0.004) }

# 1. blip — short sine pluck at C5
$n = [int]($rate * 0.30); $s = New-Object 'double[]' $n
for ($i = 0; $i -lt $n; $i++) {
  $t = $i / $rate
  $s[$i] = [Math]::Sin(2 * [Math]::PI * 523.25 * $t) * [Math]::Exp(-14 * $t) * 0.8 * (Attack $t)
}
Write-Wav "$outDir\placeholder-blip.wav" $s

# 2. thump — low sine with downward pitch sweep
$n = [int]($rate * 0.40); $s = New-Object 'double[]' $n
$phase = 0.0
for ($i = 0; $i -lt $n; $i++) {
  $t = $i / $rate
  $f = 120 * [Math]::Exp(-9 * $t) + 45
  $phase += 2 * [Math]::PI * $f / $rate
  $s[$i] = [Math]::Sin($phase) * [Math]::Exp(-8 * $t) * 0.9 * (Attack $t)
}
Write-Wav "$outDir\placeholder-thump.wav" $s

# 3. tick — brief noise burst (differenced noise for a brighter click)
$n = [int]($rate * 0.12); $s = New-Object 'double[]' $n
$rand = New-Object System.Random 42
$prev = 0.0
for ($i = 0; $i -lt $n; $i++) {
  $t = $i / $rate
  $white = $rand.NextDouble() * 2 - 1
  $s[$i] = ($white - $prev) * [Math]::Exp(-55 * $t) * 0.55 * (Attack $t)
  $prev = $white
}
Write-Wav "$outDir\placeholder-tick.wav" $s

# 4. chime — E5 + E6 partials, longer decay
$n = [int]($rate * 0.60); $s = New-Object 'double[]' $n
for ($i = 0; $i -lt $n; $i++) {
  $t = $i / $rate
  $v = [Math]::Sin(2 * [Math]::PI * 659.25 * $t) * 0.6 + [Math]::Sin(2 * [Math]::PI * 1318.5 * $t) * 0.35
  $s[$i] = $v * [Math]::Exp(-6 * $t) * 0.7 * (Attack $t)
}
Write-Wav "$outDir\placeholder-chime.wav" $s

Get-ChildItem $outDir\*.wav | Select-Object Name, Length
