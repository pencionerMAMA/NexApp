Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class NexAudio {
  static IAudioEndpointVolume Vol() {
    var en = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(en.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var id = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref id, 23, 0, out epv));
    return epv;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, Guid.Empty)); }
  }
  public static bool Mute {
    get { bool m; Marshal.ThrowExceptionForHR(Vol().GetMute(out m)); return m; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, Guid.Empty)); }
  }
}
"@

$null = [Windows.Devices.Radios.Radio,Windows.System.Devices,ContentType=WindowsRuntime]
$null = [Windows.Devices.WiFi.WiFiAdapter,Windows.System.Devices,ContentType=WindowsRuntime]
$null = [Windows.Security.Credentials.PasswordCredential,Windows.Security.Credentials,ContentType=WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
$null = [Windows.Devices.Bluetooth.BluetoothDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]

$script:wifi = $null
function GetRadio($kind) {
  $null = Await ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus])
  $rs = Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
  $rs | Where-Object { [string]$_.Kind -eq $kind } | Select-Object -First 1
}
function GetWifi() {
  if ($script:wifi -eq $null) {
    $null = Await ([Windows.Devices.WiFi.WiFiAdapter]::RequestAccessAsync()) ([Windows.Devices.WiFi.WiFiAccessStatus])
    $ads = Await ([Windows.Devices.WiFi.WiFiAdapter]::FindAllAdaptersAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.WiFi.WiFiAdapter]])
    if ($ads.Count -gt 0) { $script:wifi = $ads[0] }
  }
  if ($script:wifi -eq $null) { throw 'Wi-Fi адаптер не найден' }
  $script:wifi
}
function CurrentSsid() {
  $t = (netsh wlan show interfaces) -join "`n"
  if ($t -match '(?m)^\s*SSID\s*:\s*(.+)$') { return $matches[1].Trim() }
  return ''
}
function RadioState($kind) { $r = GetRadio $kind; if ($r) { return [string]$r.State } return 'None' }

function Handle($r) {
  switch ($r.cmd) {
    'copy-sel' {
      if (-not ('NexKb' -as [type])) { Add-Type 'using System;using System.Runtime.InteropServices;public class NexKb{[DllImport("user32.dll")]public static extern void keybd_event(byte k,byte s,uint f,UIntPtr e);}' }
      foreach ($k in 0x11, 0x10, 0x5B, 0x12) { [NexKb]::keybd_event([byte]$k, 0, 2, [UIntPtr]::Zero) }
      Start-Sleep -Milliseconds 60
      [NexKb]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero); [NexKb]::keybd_event(0x43, 0, 0, [UIntPtr]::Zero)
      [NexKb]::keybd_event(0x43, 0, 2, [UIntPtr]::Zero); [NexKb]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
      Start-Sleep -Milliseconds 220
      return @{}
    }
    'copy-sel' {
      if (-not ('NexKb' -as [type])) { Add-Type 'using System;using System.Runtime.InteropServices;public class NexKb{[DllImport("user32.dll")]public static extern void keybd_event(byte k,byte s,uint f,UIntPtr e);}' }
      foreach ($k in 0x11, 0x10, 0x5B, 0x12) { [NexKb]::keybd_event([byte]$k, 0, 2, [UIntPtr]::Zero) }
      Start-Sleep -Milliseconds 60
      [NexKb]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero); [NexKb]::keybd_event(0x43, 0, 0, [UIntPtr]::Zero)
      [NexKb]::keybd_event(0x43, 0, 2, [UIntPtr]::Zero); [NexKb]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
      Start-Sleep -Milliseconds 220
      return @{}
    }
    'vol-get' { return @{ vol = [math]::Round([NexAudio]::Volume * 100); mute = [NexAudio]::Mute } }
    'vol-set' { [NexAudio]::Volume = [float]([double]$r.v / 100); if ([NexAudio]::Mute) { [NexAudio]::Mute = $false }; return @{} }
    'mute' { [NexAudio]::Mute = -not [NexAudio]::Mute; return @{ mute = [NexAudio]::Mute } }
    'media' {
      $m = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
      $s = $m.GetCurrentSession()
      if ($s) {
        if ($r.a -eq 'toggle') { $null = Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
        elseif ($r.a -eq 'next') { $null = Await ($s.TrySkipNextAsync()) ([bool]) }
        elseif ($r.a -eq 'prev') { $null = Await ($s.TrySkipPreviousAsync()) ([bool]) }
      }
      return @{}
    }
    'radios' { return @{ wifi = (RadioState 'WiFi'); bt = (RadioState 'Bluetooth'); ssid = (CurrentSsid) } }
    'radio-set' {
      $rad = GetRadio $r.kind
      if (-not $rad) { throw 'Адаптер не найден' }
      $st = [Windows.Devices.Radios.RadioState]::Off
      if ($r.on) { $st = [Windows.Devices.Radios.RadioState]::On }
      $res = Await ($rad.SetStateAsync($st)) ([Windows.Devices.Radios.RadioAccessStatus])
      return @{ res = [string]$res }
    }
    'wifi-scan' {
      $ad = GetWifi
      AwaitA ($ad.ScanAsync())
      $list = @()
      $seen = @{}
      foreach ($n in $ad.NetworkReport.AvailableNetworks) {
        if ($n.Ssid -and -not $seen.ContainsKey($n.Ssid)) {
          $seen[$n.Ssid] = 1
          $auth = [string]$n.SecuritySettings.NetworkAuthenticationType
          $list += @{ ssid = $n.Ssid; bars = [int]$n.SignalBars; secure = ($auth -notmatch '^(Open|None)') }
        }
      }
      return @{ current = (CurrentSsid); nets = $list }
    }
    'wifi-connect' {
      $ad = GetWifi
      $n = $ad.NetworkReport.AvailableNetworks | Where-Object { $_.Ssid -eq $r.ssid } | Select-Object -First 1
      if (-not $n) { AwaitA ($ad.ScanAsync()); $n = $ad.NetworkReport.AvailableNetworks | Where-Object { $_.Ssid -eq $r.ssid } | Select-Object -First 1 }
      if (-not $n) { throw 'Сеть не найдена' }
      if ($r.pass) {
        $c = New-Object Windows.Security.Credentials.PasswordCredential
        $c.Password = $r.pass
        $res = Await ($ad.ConnectAsync($n, [Windows.Devices.WiFi.WiFiReconnectionKind]::Automatic, $c)) ([Windows.Devices.WiFi.WiFiConnectionResult])
      } else {
        $res = Await ($ad.ConnectAsync($n, [Windows.Devices.WiFi.WiFiReconnectionKind]::Automatic)) ([Windows.Devices.WiFi.WiFiConnectionResult])
      }
      return @{ status = [string]$res.ConnectionStatus }
    }
    'wifi-disconnect' { (GetWifi).Disconnect(); return @{} }
    'bt-list' {
      $sel = [Windows.Devices.Bluetooth.BluetoothDevice]::GetDeviceSelectorFromPairingState($true)
      $devs = Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($sel)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
      $list = @()
      foreach ($d in $devs) {
        $con = $false
        try {
          $bd = Await ([Windows.Devices.Bluetooth.BluetoothDevice]::FromIdAsync($d.Id)) ([Windows.Devices.Bluetooth.BluetoothDevice])
          $con = ([string]$bd.ConnectionStatus -eq 'Connected')
          $bd.Dispose()
        } catch {}
        $list += @{ name = [string]$d.Name; connected = $con }
      }
      return @{ devs = $list }
    }
    'bright-get' { $b = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Select-Object -First 1; return @{ v = [int]$b.CurrentBrightness } }
    'bright-set' {
      $m = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Select-Object -First 1
      Invoke-CimMethod -InputObject $m -MethodName WmiSetBrightness -Arguments @{ Timeout = [uint32]1; Brightness = [byte]$r.v } | Out-Null
      return @{}
    }
    'dnd' {
      $k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings'
      if (-not (Test-Path $k)) { New-Item $k -Force | Out-Null }
      $val = 1
      if ($r.on) { $val = 0 }
      Set-ItemProperty -Path $k -Name 'NOC_GLOBAL_SETTING_TOASTS_ENABLED' -Value $val -Type DWord
      return @{}
    }
    default { throw ('Неизвестная команда ' + $r.cmd) }
  }
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  if (-not $line.Trim()) { continue }
  $r = $line | ConvertFrom-Json
  try { $d = Handle $r; $o = @{ id = $r.id; ok = $true; data = $d } }
  catch { $o = @{ id = $r.id; ok = $false; err = $_.Exception.Message } }
  [Console]::Out.WriteLine((ConvertTo-Json $o -Compress -Depth 6))
}
