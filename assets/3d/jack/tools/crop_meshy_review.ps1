param(
    [string]$EvidenceDirectory = "evidence/3d-jack"
)

Add-Type -AssemblyName System.Drawing

$directory = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$views = @("three-quarter", "side", "rear")
$crop = [System.Drawing.Rectangle]::new(350, 250, 550, 550)

foreach ($view in $views) {
    $inputPath = Join-Path $directory "jack-meshy-pro-multiview-raw-$view.png"
    $outputPath = Join-Path $directory "jack-meshy-pro-multiview-$view.png"
    $source = [System.Drawing.Image]::FromFile($inputPath)
    $output = [System.Drawing.Bitmap]::new($crop.Width, $crop.Height)
    $output.SetResolution(144, 144)
    $graphics = [System.Drawing.Graphics]::FromImage($output)

    try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage(
            $source,
            [System.Drawing.Rectangle]::new(0, 0, $crop.Width, $crop.Height),
            $crop,
            [System.Drawing.GraphicsUnit]::Pixel
        )
        $output.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $output.Dispose()
        $source.Dispose()
    }
}

Get-ChildItem -LiteralPath $directory -Filter "jack-meshy-pro-multiview-*.png" |
    Sort-Object Name |
    Select-Object Name, Length
