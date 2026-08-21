/* ============================================================
   Veyro Native Windows Agent (Electron main process).

   Retrieves REAL system information via:
   - WMI / CIM        (Win32_* classes: CPU, GPU, RAM, board,
                       storage, OS, network, BIOS)
   - Performance      ('\Processor Information(_Total)',
                        Win32_PerfFormattedData_*)
   - nvidia-smi       (GPU usage/temperature/memory when the GPU
                       is NVIDIA — no driver present -> Unavailable)
   - Registry         (GPU VRAM qwMemorySize, OS DisplayVersion)

   Values that Windows does not expose are null — the UI renders
   "Unavailable". Nothing here is invented or simulated.

   IPC surface (registered via registerIpc):
     veyro:scan        -> full static snapshot (JSON)
     veyro:metrics     -> latest live metrics (JSON)
     veyro:applyopt    -> optimization tracking (id, on)
   ============================================================ */
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const PS = 'powershell.exe';

/* ------------------------------------------------------------
   helpers
   ------------------------------------------------------------ */

function psArgs(script) {
  return ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script];
}

function runPS(script, timeoutMs = 40000) {
  return new Promise((resolve, reject) => {
    /* force UTF-8 stdout so non-ASCII plan/process names survive */
    const cmd = '[Console]::OutputEncoding = [Text.Encoding]::UTF8;\n' + script;
    const child = spawn(PS, psArgs(cmd), { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch (e) {}
      reject(new Error('Agent scan timed out.'));
    }, timeoutMs);
    child.stdout.on('data', d => { out += d.toString(); });
    child.stderr.on('data', d => { err += d.toString(); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error('Agent scan failed (' + code + '): ' + err.slice(0, 300)));
    });
  });
}

/* ------------------------------------------------------------
   static snapshot — one PowerShell session, CIM-based
   ------------------------------------------------------------ */

const S_SCAN = `
$ErrorActionPreference = 'SilentlyContinue'
function First($x){ if($x -is [array] -and @($x).Count -gt 0){ return @($x)[0] } else { return $x } }
$res = [ordered]@{}

# ---- CPU ----
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
if($cpu){
  $res.cpu = [ordered]@{
    manufacturer    = $cpu.Manufacturer
    model           = $cpu.Name
    cores           = $cpu.NumberOfCores
    threads         = $cpu.NumberOfLogicalProcessors
    baseClockMhz    = $cpu.MaxClockSpeed
    currentClockMhz = $cpu.CurrentClockSpeed
    socket          = $cpu.SocketDesignation
    loadPct         = $null
  }
} else { $res.cpu = $null }

# ---- GPU(s) ----
$gpus = @(Get-CimInstance Win32_VideoController)
$gpuRows = @()
$regBase = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'
foreach($g in $gpus){
  $vram = [uint64]0
  Get-ChildItem $regBase -ErrorAction SilentlyContinue | Where-Object { $_.GetValue('DriverDesc') -eq $g.Name } | Select-Object -First 1 | ForEach-Object {
    $hw = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue
    if($hw.'HardwareInformation.qwMemorySize' -is [byte[]] -and $hw.'HardwareInformation.qwMemorySize'.Length -ge 8){
      $vram = [BitConverter]::ToUInt64($hw.'HardwareInformation.qwMemorySize', 0)
    }
  }
  if($vram -eq 0 -and $g.AdapterRAM){ $vram = [uint64]$g.AdapterRAM }
  $gpuRows += [ordered]@{
    name        = $g.Name
    driver      = $g.DriverVersion
    driverDate  = $g.DriverDate
    vramMB      = if($vram -gt 0){ [math]::Round($vram / 1MB) } else { $null }
    pnp         = $g.PNPDeviceID
  }
}
$res.gpu = @($gpuRows)

# ---- OS + RAM ----
$os = Get-CimInstance Win32_OperatingSystem
$mem = @(Get-CimInstance Win32_PhysicalMemory)
$res.os = [ordered]@{
  caption     = $os.Caption
  version     = $os.Version
  build       = $os.BuildNumber
  arch        = $os.OSArchitecture
  totalMemKB  = $os.TotalVisibleMemorySize
  freeMemKB   = $os.FreePhysicalMemory
  sysDrive    = $env:SystemDrive
  uptimeHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)
  displayVersion = $null
  currentBuild   = $null
}
try {
  $nv = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'
  $res.os.displayVersion = $nv.DisplayVersion
  $res.os.currentBuild = $nv.CurrentBuild
} catch {}

$res.ram = [ordered]@{
  totalMB        = [math]::Round($os.TotalVisibleMemorySize / 1024)
  usedMB         = if($os.TotalVisibleMemorySize){ [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1024) } else { $null }
  sticks         = $mem.Count
  speedMts       = (First $mem).Speed
  configuredMts  = (First $mem).ConfiguredClockSpeed
  smbiosType     = (First $mem).SMBIOSMemoryType
  manufacturer   = (First $mem).Manufacturer
}

# ---- Motherboard / BIOS ----
$mb = Get-CimInstance Win32_BaseBoard
$bio = Get-CimInstance Win32_BIOS
$res.mobo = [ordered]@{
  manufacturer = $mb.Manufacturer
  product      = $mb.Product
  serial       = $mb.SerialNumber
  bios         = $bio.SMBIOSBIOSVersion
  biosDate     = if($bio.ReleaseDate){ $bio.ReleaseDate.ToString('yyyy-MM-dd') } else { $null }
}

# ---- Storage ----
$disks = @()
foreach($d in @(Get-CimInstance Win32_DiskDrive)){
  $disks += [ordered]@{
    model     = $d.Model
    sizeMB    = if($d.Size){ [math]::Round($d.Size / 1MB) } else { $null }
    media     = $d.MediaType
    interface = $d.InterfaceType
    serial    = $d.SerialNumber
  }
}
$vols = @()
foreach($v in @(Get-CimInstance Win32_Volume -Filter 'DriveType=3')){
  if($v.Capacity -and $v.Capacity -gt 0){
    $vols += [ordered]@{
      device  = $v.DriveLetter
      label   = $v.Label
      totalMB = [math]::Round($v.Capacity / 1MB)
      freeMB  = [math]::Round($v.FreeSpace / 1MB)
      system  = ($v.DriveLetter -eq $env:SystemDrive)
    }
  }
}
$res.storage = [ordered]@{ disks = $disks; volumes = $vols }

# ---- Network ----
$nets = @()
foreach($n in @(Get-CimInstance Win32_NetworkAdapter -Filter 'PhysicalAdapter=True')){
  if($n.Name -notmatch 'Bluetooth|Virtual|Hyper-V|Loopback|Wi-Fi Direct'){
    $nets += [ordered]@{
      name      = $n.Name
      mac       = $n.MACAddress
      speedMbps = if($n.Speed -and $n.Speed -gt 0){ [math]::Round($n.Speed / 1e6) } else { $null }
    }
  }
}
$res.network = @($nets)

# ---- Computer ----
$cs = Get-CimInstance Win32_ComputerSystem
$res.pc = [ordered]@{
  name        = $env:COMPUTERNAME
  manufacturer = $cs.Manufacturer
  model       = $cs.Model
}

$res.scannedAt = (Get-Date -Format o)
$res | ConvertTo-Json -Depth 6 -Compress
`;

/* ------------------------------------------------------------
   live metrics — long-running PS loop, one JSON line per tick
   ------------------------------------------------------------ */

const S_LIVE = `
$ErrorActionPreference = 'SilentlyContinue'
$haveNvidia = Test-Path 'C:\\Windows\\System32\\nvidia-smi.exe'
while($true){
  $cpu = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime
  $os = Get-CimInstance Win32_OperatingSystem
  $gpu = @{}
  if($haveNvidia){
    $line = (& 'C:\\Windows\\System32\\nvidia-smi.exe' --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total,driver_version --format=csv,noheader,nounits) -join ' '
    if($line){
      $p = $line -split ','
      if($p.Count -ge 5){
        $gpu.usage = [int]([double]$p[0].Trim())
        $gpu.temp  = [int]([double]$p[1].Trim())
        $gpu.memUsedMB  = [int]([double]$p[2].Trim())
        $gpu.memTotalMB = [int]([double]$p[3].Trim())
        $gpu.driver = $p[4].Trim()
      }
    }
  }
  $o = [ordered]@{
    t          = (Get-Date -Format o)
    cpu        = if($cpu){ [int]$cpu } else { $null }
    memUsedMB  = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1024)
    memTotalMB = [math]::Round($os.TotalVisibleMemorySize / 1024)
    gpu        = $gpu
  }
  try { $o | ConvertTo-Json -Compress } catch {}
  Start-Sleep -Seconds 2
}
`;

/* ------------------------------------------------------------
   live stream cache
   ------------------------------------------------------------ */

let liveCache = { t: null, cpu: null, memUsedMB: null, memTotalMB: null, gpu: null };
let liveProc = null;

function startLive() {
  if (liveProc) return;
  liveProc = spawn(PS, psArgs(S_LIVE), { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = '';
  liveProc.stdout.on('data', d => {
    buf += d.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        if (o && typeof o === 'object' && 'cpu' in o) {
          liveCache = {
            t: o.t || null,
            cpu: typeof o.cpu === 'number' ? o.cpu : null,
            memUsedMB: typeof o.memUsedMB === 'number' ? o.memUsedMB : null,
            memTotalMB: typeof o.memTotalMB === 'number' ? o.memTotalMB : null,
            gpu: o.gpu && Object.keys(o.gpu).length ? o.gpu : null
          };
        }
      } catch (e) { /* partial line */ }
    }
  });
  liveProc.stderr.on('data', () => {});
  liveProc.on('error', () => { liveProc = null; });
  liveProc.on('exit', () => { liveProc = null; });
}

function getLive() { return liveCache; }

function stopLive() {
  if (liveProc) { try { liveProc.kill(); } catch (e) {} liveProc = null; }
}

/* ------------------------------------------------------------
   optimization — honest tracking layer.
   Veyro does not silently modify Windows here; changes are
   tracked and reversible via the UI (real registry/settings
   actions are a future native module behind this same IPC).
   ------------------------------------------------------------ */

async function applyOptimization(id, on) {
  return { ok: true, tracked: true, id: String(id), enabled: !!on };
}

/* ------------------------------------------------------------
   System Restore point — REAL Windows rollback protection.
   Creates a restore point named "Veyro Before Optimization"
   via WMI (root\default:SystemRestore). Requires System
   Protection enabled on the system drive; returns a report
   so the UI can stay honest about what happened.
   ------------------------------------------------------------ */

const S_RESTORE = `
$ErrorActionPreference = 'SilentlyContinue'
$out = [ordered]@{ created = $false; reason = ''; lastPoint = $null; lastDate = $null; systemDrive = $null }
$out.systemDrive = (Get-CimInstance Win32_OperatingSystem).SystemDrive
$pts = @(Get-ComputerRestorePoint)
if ($pts.Count -gt 0) {
  $latest = $pts | Sort-Object SequenceNumber -Descending | Select-Object -First 1
  $out.lastPoint = $latest.SequenceNumber
  $ageH = $null
  try {
    $ct = [datetime]$latest.CreationTime
    $out.lastDate = $ct.ToString('yyyy-MM-dd HH:mm:ss')
    $ageH = [math]::Round(((Get-Date) - $ct).TotalHours, 1)
  } catch { }
  if ($null -eq $ageH) { $out.reason = 'exists' }
  elseif ($ageH -lt 24) { $out.reason = 'recent:' + $ageH }
  else { $out.reason = 'old:' + $ageH }
}
if ($out.reason -eq '') {
  try {
    $r = ([wmiclass]'\\\\.\\root\\default:SystemRestore').CreateRestorePoint('Veyro Before Optimization', 0, 100)
    if ($r.ReturnValue -eq 0) { $out.created = $true; $out.reason = 'fresh' }
    else { $out.reason = 'error:' + $r.ReturnValue }
  } catch { $out.reason = 'error:' + $_.Exception.Message }
}
$out | ConvertTo-Json -Compress
`;

async function ensureRestorePoint() {
  const raw = await runPS(S_RESTORE, 30000);
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { created: false, reason: 'error:parse' };
  }
}

/* ------------------------------------------------------------
   Power tools — small real Windows utilities (Wave 1).
   Each returns JSON via stdout. Scripts are read-only except
   the explicitly actioned tools (clean/apply/set), which are
   reversible or low-risk and surface via the UI with confirm.
   ------------------------------------------------------------ */

const S_STARTUP = `
$ErrorActionPreference = 'SilentlyContinue'
$rows = @()
$areas = @(
  @{ key='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; scope='USER' },
  @{ key='HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; scope='MACHINE' }
)
foreach($a in $areas){
  if(Test-Path $a.key){
    $p = Get-ItemProperty -Path $a.key
    $p.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
      $cmd = [string]$_.Value
      $rows += [ordered]@{ name=$_.Name; command=$cmd; scope=$a.scope; enabled=(-not $cmd.StartsWith('veydroff::')) }
    }
  }
}
$sf = [Environment]::GetFolderPath('Startup')
$sfm = 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp'
Get-ChildItem $sf, $sfm -File -ErrorAction SilentlyContinue | ForEach-Object {
  $rows += [ordered]@{ name=$_.BaseName; command=$_.FullName; scope='STARTUP FOLDER'; enabled=$true }
}
$rows | ConvertTo-Json -Compress
`;

const S_STARTUP_TOGGLE = `
$ErrorActionPreference = 'SilentlyContinue'
$out = [ordered]@{ ok=$false; why='' }
try {
  if($scope -eq 'STARTUP FOLDER'){
    if(-not $enable){
      $dst = $command + '.disabled'
      if(Test-Path $command){ Rename-Item -LiteralPath $command -NewName (Split-Path $dst -Leaf) -Force; $out.ok=$true }
    } else {
      $dst = $command -replace '\\.disabled$',''
      if(Test-Path ($dst + '.disabled')){ Rename-Item -LiteralPath ($dst + '.disabled') -NewName (Split-Path $dst -Leaf) -Force; $out.ok=$true }
    }
    $out | ConvertTo-Json -Compress; exit
  }
  $key = if($scope -eq 'MACHINE'){ 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' } else { 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' }
  $value = $command
  if($enable){ $value = $command -replace '^veydroff::','' } else { $value = 'veydroff::' + $command }
  Set-ItemProperty -Path $key -Name $name -Value $value
  $out.ok = $true
  $out.why = 'marker'
  $out | ConvertTo-Json -Compress
} catch { $out.why = $_.Exception.Message; $out | ConvertTo-Json -Compress }
`;

const S_JUNK = `
$ErrorActionPreference = 'SilentlyContinue'
function Sz($p){ $s=(Get-ChildItem -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum; if($s){$s}else{0} }
$out = [ordered]@{}
$items = @()
$dirs = @{
  'Windows Temp' = 'C:\\Windows\\Temp'
  'User Temp'    = $env:TEMP
  'Chrome Cache' = "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cache"
  'Edge Cache'   = "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Cache"
  'Recycle Bin'  = 'C:\\$Recycle.Bin\\'
  'Thumbnails'   = "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer"
}
foreach($k in $dirs.Keys){
  if(Test-Path $dirs[$k]){
    $items += [ordered]@{ name=$k; path=$dirs[$k]; bytes=(Sz $dirs[$k]) }
  }
}
$out.items = $items
$out.total = ($items | Measure-Object -Property bytes -Sum).Sum
$out | ConvertTo-Json -Compress
`;

const S_JUNK_CLEAN = `
$ErrorActionPreference = 'SilentlyContinue'
$freed = 0
Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue | ForEach-Object {
  if($_.PSIsContainer){
    $freed += (Get-ChildItem -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    $freed += $_.Length
    Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
  }
}
[ordered]@{ ok=$true; freed=[int64]$freed } | ConvertTo-Json -Compress
`;

const S_STORAGE = `
$ErrorActionPreference = 'SilentlyContinue'
$root = if($root){ $root } else { $env:SystemDrive + '\\' }
$rows = @()
Get-ChildItem -LiteralPath $root -Directory -Force -ErrorAction SilentlyContinue | Select-Object -First 40 | ForEach-Object {
  $s = (Get-ChildItem -LiteralPath $_.FullName -Recurse -Depth 3 -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  $rows += [ordered]@{ name=$_.Name; path=$_.FullName; bytes=if($s){$s}else{0} }
}
$rows | Sort-Object bytes -Descending | ConvertTo-Json -Compress
`;

const S_DUPES = `
$ErrorActionPreference = 'SilentlyContinue'
$root = if($root){ $root } else { $env:TEMP }
$map = @{}
Get-ChildItem -LiteralPath $root -File -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 4096 -and $_.Length -lt 50MB } | Select-Object -First 2000 | ForEach-Object {
  $h = (Get-FileHash -LiteralPath $_.FullName -Algorithm MD5 -ErrorAction SilentlyContinue).Hash
  if($map.ContainsKey($h)){ $map[$h] = @($map[$h]) + $_.FullName } else { $map[$h] = $_.FullName }
}
$groups = @()
foreach($h in $map.Keys){
  if($map[$h] -is [array] -and $map[$h].Count -gt 1){
    $groups += [ordered]@{ hash=$h; count=$map[$h].Count; files=$map[$h] }
  }
}
if($groups.Count -gt 0){ $groups | ConvertTo-Json -Depth 5 -Compress } else { '[]' }
`;

const S_POWER = `
$ErrorActionPreference = 'SilentlyContinue'
$out = [ordered]@{ }
$active = (powercfg /getactivescheme 2>$null | Out-String)
$out.activeRaw = $active.Trim()
$plans = @()
$wmi = @(Get-CimInstance -Namespace root\cimv2\power -ClassName Win32_PowerPlan -ErrorAction SilentlyContinue)
if($wmi.Count -gt 0){
  foreach($p in $wmi){
    $g = ($p.InstanceID -split '\{')[-1].TrimEnd('}')
    $plans += [ordered]@{ guid=$g; name=$p.ElementName; active=($p.IsActive -eq $true) }
  }
} else {
  $txt = (cmd /c "powercfg /list" 2>$null | Out-String)
  if(-not $txt.Trim()){ $txt = (powercfg /list 2>$null | Out-String) }
  if($txt.Trim()){
    [regex]::Matches($txt, '([0-9a-fA-F]{8}-[0-9a-fA-F-]{27,})\\s+\\((.*?)\\)\\s*(\\*)?') | ForEach-Object {
      $plans += [ordered]@{ guid=$_.Groups[1].Value; name=$_.Groups[2].Value; active=($_.Groups[3].Value -eq '*') }
    }
  }
}
$out.plans = $plans
$out | ConvertTo-Json -Compress
`;

const S_POWER_SET = `
$ErrorActionPreference = 'SilentlyContinue'
$r = (powercfg /setactive $guid 2>&1 | Out-String)
[ordered]@{ ok=($LASTEXITCODE -eq 0); raw=$r.Trim() } | ConvertTo-Json -Compress
`;

const S_POWER_HP = `
$ErrorActionPreference = 'SilentlyContinue'
$out = [ordered]@{ ok=$false; guid=$null }
$before = @(Get-CimInstance -Namespace root\cimv2\power -ClassName Win32_PowerPlan -ErrorAction SilentlyContinue).InstanceID
$r = (powercfg /duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>&1 | Out-String)
if($r -match '([0-9a-f]{8}-[0-9a-f-]{27,})'){
  $out.guid = $matches[1]; $out.ok = $true
} else {
  $new = @(Get-CimInstance -Namespace root\cimv2\power -ClassName Win32_PowerPlan -ErrorAction SilentlyContinue) | Where-Object { $before -notcontains $_.InstanceID } | Select-Object -First 1
  if($new){ $out.guid = ($new.InstanceID -split '\{')[1].TrimEnd('}'); $out.ok = $true }
}
if($out.ok){ powercfg /setactive $out.guid 2>$null }
$out | ConvertTo-Json -Compress
`;

const S_NET = `
$ErrorActionPreference = 'SilentlyContinue'
$out = [ordered]@{}
$hosts = 'one.one.one.one','dns.google','cloudflare.com','example.com'
$pings = @()
foreach($h in $hosts){
  $t = Test-Connection -ComputerName $h -Count 2 -ErrorAction SilentlyContinue
  if($t){
    $ms = ($t | Measure-Object -Property ResponseTime -Average).Average
    $pings += [ordered]@{ host=$h; ms=[int]$ms; ok=$true }
  } else { $pings += [ordered]@{ host=$h; ms=$null; ok=$false } }
}
$out.pings = $pings
$adapters = @()
Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4Address } | ForEach-Object {
  $adapters += [ordered]@{ name=$_.InterfaceAlias; ip=$_.IPv4Address.IPAddress; gateway=if($_.IPv4DefaultGateway){$_.IPv4DefaultGateway.NextHop}else{$null} }
}
$out.adapters = $adapters
$out | ConvertTo-Json -Compress
`;

const S_NET_FLUSH = `
$ErrorActionPreference = 'SilentlyContinue'
$r = (ipconfig /flushdns 2>&1 | Out-String)
[ordered]@{ ok=($LASTEXITCODE -eq 0); raw=($r -split "\`r?\`n" | Select-String -Pattern 'DNS|Erfolgreich|successfully' | Select-Object -First 1).ToString() } | ConvertTo-Json -Compress
`;

const S_UNINSTALL = `
$ErrorActionPreference = 'SilentlyContinue'
$rows = @()
$keys = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
foreach($k in $keys){
  Get-ItemProperty $k -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | ForEach-Object {
    $sz = $null
    if($_.EstimatedSize){ $sz = [int64]$_.EstimatedSize * 1024 }
    $rows += [ordered]@{ name=$_.DisplayName; version=$_.DisplayVersion; publisher=$_.Publisher; sizeBytes=$sz; uninstallString=$_.UninstallString; quiet=$_.QuietUninstallString }
  }
}
$rows | Sort-Object name | ConvertTo-Json -Compress
`;

const S_SERVICES = `
$ErrorActionPreference = 'SilentlyContinue'
$rows = @()
Get-Service | Where-Object { $_.Name -notmatch '^dwm|^WSearch' } | Sort-Object Status, DisplayName | Select-Object -First 60 | ForEach-Object {
  $st = $_.Status.ToString()
  $rows += [ordered]@{ name=$_.Name; display=$_.DisplayName; status=$st; startType=$_.StartType.ToString() }
}
$rows | ConvertTo-Json -Compress
`;

const S_SERVICE_SET = `
$ErrorActionPreference = 'SilentlyContinue'
try {
  switch($action){
    'start' { Start-Service $name -ErrorAction Stop }
    'stop'  { Stop-Service $name -Force -ErrorAction Stop }
    'auto'  { Set-Service $name -StartupType Automatic -ErrorAction Stop }
    'manual'{ Set-Service $name -StartupType Manual -ErrorAction Stop }
    'off'   { Set-Service $name -StartupType Disabled -ErrorAction Stop; Stop-Service $name -Force -ErrorAction Stop }
  }
  $s = Get-Service $name -ErrorAction SilentlyContinue
  [ordered]@{ ok=$true; status=if($s){$s.Status.ToString()}else{'?'} } | ConvertTo-Json -Compress
} catch { [ordered]@{ ok=$false; why=$_.Exception.Message } | ConvertTo-Json -Compress }
`;

const S_SHUTDOWN = `
$ErrorActionPreference = 'SilentlyContinue'
if($cmd -eq 'cancel'){
  $r = (shutdown /a 2>&1 | Out-String)
  [ordered]@{ ok=$true; raw=$r.Trim() } | ConvertTo-Json -Compress
  exit
}
$sec = [int]([double]$mins * 60)
if($sec -le 0){ $sec = 0 }
$sdArgs = @('/s','/t',"$sec") 
if($cmd -eq 'restart'){ $sdArgs = @('/r','/t',"$sec") }
$r = (shutdown @sdArgs 2>&1 | Out-String)
[ordered]@{ ok=($LASTEXITCODE -eq 0); raw=$r.Trim() } | ConvertTo-Json -Compress
`;

const S_PROCESSES = `
$ErrorActionPreference = 'SilentlyContinue'
$rows = @()
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 30 | ForEach-Object {
  $pt = $null
  try { $pt = ($_ | Get-Process -Id $_.Id -ErrorAction Stop).TotalProcessorTime.TotalSeconds } catch {}
  $rows += [ordered]@{ name=$_.ProcessName; pid=$_.Id; memMB=[math]::Round($_.WorkingSet64/1MB); cpuSec=[int]$pt; desc=$_.MainWindowTitle }
}
$rows | ConvertTo-Json -Compress
`;

const S_PROCESS_KILL = `
$ErrorActionPreference = 'SilentlyContinue'
try { Stop-Process -Id $procId -Force -ErrorAction Stop; [ordered]@{ ok=$true } | ConvertTo-Json -Compress }
catch { [ordered]@{ ok=$false; why=$_.Exception.Message } | ConvertTo-Json -Compress }
`;

const S_TOOLS = {
  startup: S_STARTUP,
  startupToggle: S_STARTUP_TOGGLE,
  junk: S_JUNK,
  junkClean: S_JUNK_CLEAN,
  storage: S_STORAGE,
  dupes: S_DUPES,
  power: S_POWER,
  powerSet: S_POWER_SET,
  powerHp: S_POWER_HP,
  net: S_NET,
  netFlush: S_NET_FLUSH,
  uninstall: S_UNINSTALL,
  services: S_SERVICES,
  serviceSet: S_SERVICE_SET,
  shutdown: S_SHUTDOWN,
  processes: S_PROCESSES,
  processKill: S_PROCESS_KILL
};

/* param-name map per tool so tool() can inject typed assignments in front of
   the script (trailing tokens after -Command never reach param()) */
const ARG_NAMES = {
  junkClean: ['path'],
  storage: ['root'],
  dupes: ['root'],
  powerSet: ['guid'],
  startupToggle: ['name', 'command', 'scope', 'enable'],
  serviceSet: ['name', 'action'],
  shutdown: ['cmd', 'mins'],
  processKill: ['procId']
};

function psAssign(n, v) {
  if (v === undefined || v === null) return '$' + n + ' = $null';
  if (typeof v === 'boolean') return '$' + n + ' = $' + String(v).toLowerCase();
  return '$' + n + " = '" + String(v).replace(/'/g, "''") + "'";
}

const ARG_TIMEOUT = { storage: 120000, dupes: 120000 };

async function tool(name, arg) {
  const script = S_TOOLS[name];
  if (!script) return { ok: false, msg: 'Unknown tool: ' + name };
  try {
    let cmd = script;
    if (arg !== undefined) {
      const names = ARG_NAMES[name] || ['arg'];
      let pairs;
      if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
        pairs = names.map(n => [n, arg[n] !== undefined ? arg[n] : null]);
      } else {
        pairs = [[names[0], arg]];
      }
      cmd = pairs.map(p => psAssign(p[0], p[1])).join('\n') + '\n' + cmd;
    }
    const raw = await runPS(cmd, ARG_TIMEOUT[name] || 45000);
    return { ok: true, data: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

/* ------------------------------------------------------------
   IPC registration
   ------------------------------------------------------------ */

function registerIpc(ipcMain) {
  ipcMain.handle('veyro:scan', () => scanStatic());
  ipcMain.handle('veyro:metrics', () => getLive());
  ipcMain.handle('veyro:applyopt', (e, id, on) => applyOptimization(id, on));
  ipcMain.handle('veyro:restorepoint', () => ensureRestorePoint());
  ipcMain.handle('veyro:tool', (e, name, arg) => tool(name, arg));
}

async function scanStatic() {
  const raw = await runPS(S_SCAN);
  if (!raw) throw new Error('No data returned by Windows.');;
  return JSON.parse(raw);
}

module.exports = { scanStatic, startLive, stopLive, getLive, applyOptimization, ensureRestorePoint, tool, registerIpc, psArgs };