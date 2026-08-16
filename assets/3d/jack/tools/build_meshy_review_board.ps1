param(
    [string]$Reference = "assets/3d/jack/references/jack-meshy-input-three-quarter.png",
    [string]$EvidenceDirectory = "evidence/3d-jack"
)

Add-Type -AssemblyName System.Drawing

$referencePath = (Resolve-Path -LiteralPath $Reference).Path
$directory = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$outputPath = Join-Path $directory "jack-meshy-pro-multiview-review-board.png"

$items = @(
    @{ Label = "APPROVED REFERENCE"; Path = $referencePath },
    @{ Label = "MESHY - THREE QUARTER"; Path = Join-Path $directory "jack-meshy-pro-multiview-three-quarter.png" },
    @{ Label = "MESHY - SIDE"; Path = Join-Path $directory "jack-meshy-pro-multiview-side.png" },
    @{ Label = "MESHY - REAR"; Path = Join-Path $directory "jack-meshy-pro-multiview-rear.png" }
)

$canvas = [System.Drawing.Bitmap]::new(1200, 1400)
$canvas.SetResolution(144, 144)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$titleFont = [System.Drawing.Font]::new("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)
$labelFont = [System.Drawing.Font]::new("Segoe UI", 19, [System.Drawing.FontStyle]::Bold)
$titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 245, 245))
$labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(225, 225, 225))
$panelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(28, 31, 36))

try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(14, 16, 19))
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawString("BABY JACK - MESHY PRO MULTI-VIEW CHECK", $titleFont, $titleBrush, 48, 34)

    for ($index = 0; $index -lt $items.Count; $index++) {
        $column = $index % 2
        $row = [Math]::Floor($index / 2)
        $left = 40 + ($column * 580)
        $top = 110 + ($row * 620)
        $panel = [System.Drawing.Rectangle]::new($left, $top, 540, 580)
        $graphics.FillRectangle($panelBrush, $panel)
        $graphics.DrawString($items[$index].Label, $labelFont, $labelBrush, $left + 20, $top + 16)

        $image = [System.Drawing.Image]::FromFile($items[$index].Path)
        try {
            $scale = [Math]::Min(500.0 / $image.Width, 500.0 / $image.Height)
            $width = [int][Math]::Round($image.Width * $scale)
            $height = [int][Math]::Round($image.Height * $scale)
            $x = $left + [int][Math]::Round((540 - $width) / 2.0)
            $y = $top + 64 + [int][Math]::Round((500 - $height) / 2.0)
            $graphics.DrawImage($image, [System.Drawing.Rectangle]::new($x, $y, $width, $height))
        }
        finally {
            $image.Dispose()
        }
    }

    $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
    $panelBrush.Dispose()
    $labelBrush.Dispose()
    $titleBrush.Dispose()
    $labelFont.Dispose()
    $titleFont.Dispose()
    $graphics.Dispose()
    $canvas.Dispose()
}

Get-Item -LiteralPath $outputPath | Select-Object FullName, Length
