param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(Mandatory = $true)]
    [ValidateSet("teen", "adult")]
    [string]$Age,

    [string]$OutputDirectory = "assets/3d/jack/references"
)

Add-Type -AssemblyName System.Drawing

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$outputPath = Join-Path (Get-Location) $OutputDirectory
[System.IO.Directory]::CreateDirectory($outputPath) | Out-Null

$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
$views = @(
    @{ Name = "front"; Rect = [System.Drawing.Rectangle]::FromLTRB(30, 120, 275, 940) },
    @{ Name = "side"; Rect = [System.Drawing.Rectangle]::FromLTRB(275, 120, 750, 940) },
    @{ Name = "rear"; Rect = [System.Drawing.Rectangle]::FromLTRB(745, 120, 1018, 940) },
    @{ Name = "three-quarter"; Rect = [System.Drawing.Rectangle]::FromLTRB(1040, 120, 1390, 940) },
    @{ Name = "right"; Rect = [System.Drawing.Rectangle]::FromLTRB(275, 120, 750, 940); Flip = $true }
)

try {
    foreach ($view in $views) {
        $canvas = [System.Drawing.Bitmap]::new(1200, 1200)
        $canvas.SetResolution(144, 144)
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)

        try {
            $graphics.Clear([System.Drawing.Color]::FromArgb(202, 199, 196))
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

            $filename = "jack-{0}-meshy-input-{1}.png" -f $Age, $view.Name
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

Get-ChildItem -LiteralPath $outputPath -Filter ("jack-{0}-meshy-input-*.png" -f $Age) |
    Sort-Object Name |
    Select-Object Name, Length
