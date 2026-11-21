Add-Type -TypeDefinition @"
using System; using System.Text; using System.Runtime.InteropServices;
public class NexFg {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static string Get() { var h = GetForegroundWindow(); var sb = new StringBuilder(256); GetClassName(h, sb, 256); uint pid; GetWindowThreadProcessId(h, out pid); return sb.ToString() + "|" + pid; }
}
"@
$last = ''
while ($true) {
  $c = [NexFg]::Get()
  if ($c -ne $last) {
    $last = $c
    $n = ''
    try { $n = (Get-Process -Id ([int]$c.Split('|')[1]) -ErrorAction Stop).ProcessName } catch {}
    [Console]::Out.WriteLine("$c|$n")
  }
  Start-Sleep -Milliseconds 300
}
