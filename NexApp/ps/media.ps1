$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType,Windows.Storage.Streams,ContentType=WindowsRuntime]
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$last = ''
$cover = ''
while ($true) {
  $o = @{ ok = $false }
  try {
    $s = $mgr.GetCurrentSession()
    if ($s -ne $null) {
      $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $pb = $s.GetPlaybackInfo()
      $tl = $s.GetTimelineProperties()
      $key = "$($p.Title)|$($p.Artist)"
      if ($key -ne $last) {
        $last = $key
        $cover = ''
        if ($p.Thumbnail -ne $null) {
          try {
            $st = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            $f = Join-Path $env:TEMP ('nex_cover_' + [Math]::Abs($key.GetHashCode()) + '.img')
            $in = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($st)
            $out = [System.IO.File]::Create($f)
            $in.CopyTo($out); $out.Close(); $in.Close()
            $cover = $f
          } catch {}
        }
      }
      $o = @{
        ok = $true
        app = [string]$s.SourceAppUserModelId
        title = [string]$p.Title
        artist = [string]$p.Artist
        status = [string]$pb.PlaybackStatus
        pos = [double]$tl.Position.TotalSeconds
        dur = [double]$tl.EndTime.TotalSeconds
        upd = [double]$tl.LastUpdatedTime.ToUnixTimeMilliseconds()
        cover = $cover
      }
    }
  } catch {}
  [Console]::Out.WriteLine((ConvertTo-Json $o -Compress))
  Start-Sleep -Milliseconds 1000
}
