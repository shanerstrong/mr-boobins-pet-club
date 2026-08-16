param(
    [string]$Source = "evidence/3d-pet-room/jack-character-sheet.png",
    [string]$OutputDirectory = "assets/3d/jack/references"
)

Add-Type -AssemblyName System.Drawing

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$outputPath = Join-Path (Get-Location) $OutputDirectory
[System.IO.Directory]::CreateDirectory($outputPath) | Out-Null

$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)

$views = @(
    @{ Name = "front"; Rect = [System.Drawing.Rectangle]::FromLTRB(0, 15, 275, 665) },
    @{ Name = "side"; Rect = [System.Drawing.Rectangle]::FromLTRB(275, 15, 725, 665) },
    @{ Name = "right"; Rect = [System.Drawing.Rectangle]::FromLTRB(275, 15, 725, 665); Flip = $true },
    @{ Name = "three-quarter"; Rect = [System.Drawing.Rectangle]::FromLTRB(735, 15, 1060, 665) },
    @{ Name = "rear"; Rect = [System.Drawing.Rectangle]::FromLTRB(1080, 15, 1402, 665) }
)

try {
    foreach ($view in $views) {
        $canvas = [System.Drawing.Bitmap]::new(1200, 1200)
        $canvas.SetResolution(144, 144)
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)

        try {
            $graphics.Clear([System.Drawing.Color]::FromArgb(190, 187, 184))
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

            $rect = $view.Rect
            $scale = [Math]::Min(1120.0 / $rect.Width, 1120.0 / $rect.Height)
            $width = [int][Math]::Round($rect.Width * $scale)
            $height = [int][Math]::Round($rect.Height * $scale)
            $left = [int][Math]::Round((1200 - $width) / 2.0)
            $top = [int][Math]::Round((1200 - $height) / 2.0)
            $destination = [System.Drawing.Rectangle]::new($left, $top, $width, $height)

            $graphics.DrawImage(
                $sourceImage,
                $destination,
                $rect.X,
                $rect.Y,
                $rect.Width,
                $rect.Height,
                [System.Drawing.GraphicsUnit]::Pixel
            )

            if ($view.Flip) {
                $canvas.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX)
            }

            $filename = "jack-meshy-input-{0}.png" -f $view.Name
            $canvas.Save(
                (Join-Path $outputPath $filename),
                [System.Drawing.Imaging.ImageFormat]::Png
            )
        }
        finally {
            $graphics.Dispose()
            $canvas.Dispose()
        }
    }
}
finally {
    $sourceImage.Dispose()
}

Get-ChildItem -LiteralPath $outputPath -Filter "jack-meshy-input-*.png" |
    Sort-Object Name |
    Select-Object Name, Length
