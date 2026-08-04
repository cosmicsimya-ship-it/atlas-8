import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { TASK_NAME, STARTUP_COMMAND } from './config.mjs';
import { writeLog } from './log.mjs';
import { assertProjectRoot, getProjectRoot, pathsEqual } from './paths.mjs';
import {
  describeTaskResultCode,
  isWindows,
  resolveNpmCmd,
  runSchtasks,
} from './process-win.mjs';
import { formatServiceLine, inspectAllServices } from './services.mjs';

const PROJECT_DESC_PREFIX = 'Atlas project autostart:';

function psSingleQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTaskXmlString({ projectRoot, npmCmd, desc }) {
  const rootXml = escapeXml(projectRoot);
  const descXml = escapeXml(desc);
  const psRoot = projectRoot.replace(/'/g, "''");
  const psNpm = npmCmd.replace(/'/g, "''");
  const psCmd = `Set-Location -LiteralPath '${psRoot}'; & '${psNpm}' run atlas:start`;
  const argXml = escapeXml(
    `-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command "${psCmd.replace(/"/g, '\\"')}"`,
  );
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>${descXml}</Description></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled></LogonTrigger></Triggers>
  <Principals><Principal id="Author"><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><Enabled>true</Enabled><Hidden>true</Hidden><ExecutionTimeLimit>PT2H</ExecutionTimeLimit></Settings>
  <Actions Context="Author"><Exec><Command>powershell.exe</Command><Arguments>${argXml}</Arguments><WorkingDirectory>${rootXml}</WorkingDirectory></Exec></Actions>
</Task>`;
}

function installViaSchtasks(projectRoot, npmCmd, desc) {
  const xml = buildTaskXmlString({ projectRoot, npmCmd, desc });
  const tempDir = join(tmpdir(), 'atlas-autostart');
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
  const xmlPath = join(tempDir, `${TASK_NAME}.xml`);
  try {
    writeFileSync(xmlPath, `\ufeff${xml}`, 'utf16le');
  } catch (err) {
    return { ok: false, reason: `Cannot write temp XML: ${err.message}` };
  }
  const result = runSchtasks(['/Create', '/TN', TASK_NAME, '/XML', xmlPath, '/F']);
  try { unlinkSync(xmlPath); } catch { /* ignore */ }
  return result;
}

function printManualInstallInstructions(projectRoot, npmCmd, desc) {
  const root = projectRoot.replace(/'/g, "''");
  const npm = npmCmd.replace(/'/g, "''");
  const safeDesc = desc.replace(/'/g, "''");
  console.error('');
  console.error('To install from PowerShell (open separately, not inside Cursor):');
  console.error(`  $root = '${root}'`);
  console.error(`  $npm  = '${npm}'`);
  console.error(`  $arg  = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command \`"Set-Location -LiteralPath '$root'; & '$npm' run atlas:start\`""`);
  console.error(`  $action   = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $root`);
  console.error(`  $trigger  = New-ScheduledTaskTrigger -AtLogOn`);
  console.error(`  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden -MultipleInstances IgnoreNew`);
  console.error(`  Register-ScheduledTask -TaskName 'AtlasStartupManager' -Action $action -Trigger $trigger -Settings $settings -Description '${safeDesc}' -Force`);
}

function runPowerShell(script) {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', windowsHide: true },
  );
  return {
    ok: (result.status ?? 1) === 0,
    status: result.status ?? 1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  };
}

function parseTaskJson(raw) {
  if (!raw || raw === '{}' || raw === 'null') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function queryScheduledTask() {
  if (!isWindows()) return null;

  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$t = Get-ScheduledTask -TaskName ${psSingleQuote(TASK_NAME)}
if (-not $t) { Write-Output '{}'; exit 0 }
$info = Get-ScheduledTaskInfo -TaskName ${psSingleQuote(TASK_NAME)}
$action = $t.Actions | Select-Object -First 1
[PSCustomObject]@{
  Name = $t.TaskName
  Enabled = ($t.State -ne 'Disabled')
  Description = [string]$t.Description
  WorkingDirectory = [string]$action.WorkingDirectory
  Command = [string]$action.Execute
  Arguments = [string]$action.Arguments
  LastRunTime = if ($info.LastRunTime) { $info.LastRunTime.ToString('yyyy-MM-dd HH:mm:ss') } else { 'N/A' }
  LastResultCode = [int]$info.LastTaskResult
  NextRunTime = if ($info.NextRunTime) { $info.NextRunTime.ToString('yyyy-MM-dd HH:mm:ss') } else { 'N/A' }
  TaskStatus = [string]$t.State
} | ConvertTo-Json -Compress
`.trim();

  const result = runPowerShell(script);
  const data = parseTaskJson(result.stdout);
  if (!data || !data.Name) return null;

  let projectPath = data.WorkingDirectory || '';
  if (data.Description && String(data.Description).startsWith(PROJECT_DESC_PREFIX)) {
    projectPath = String(data.Description).slice(PROJECT_DESC_PREFIX.length).trim();
  }

  return {
    name: data.Name,
    installed: true,
    enabled: Boolean(data.Enabled),
    projectPath,
    workingDirectory: data.WorkingDirectory || '',
    command: `${data.Command || ''} ${data.Arguments || ''}`.trim(),
    startupCommand: STARTUP_COMMAND,
    lastRunTime: data.LastRunTime || 'N/A',
    lastResultCode: Number(data.LastResultCode),
    lastResultText: describeTaskResultCode(Number(data.LastResultCode)),
    nextRunTime: data.NextRunTime || 'N/A',
    taskStatus: data.TaskStatus || 'Unknown',
    description: data.Description || '',
  };
}

export function installAutostart(options = {}) {
  if (!isWindows()) {
    console.error('unsupported platform');
    process.exitCode = 1;
    return { ok: false, reason: 'unsupported platform' };
  }

  const projectRoot = assertProjectRoot(options.root ?? getProjectRoot());
  const existing = queryScheduledTask();

  if (existing) {
    if (pathsEqual(existing.projectPath, projectRoot)) {
      console.log('Atlas Autostart');
      console.log(`Task: ${TASK_NAME}`);
      console.log('Installed: yes (already configured for this project)');
      console.log(`Project: ${projectRoot}`);
      return { ok: true, alreadyInstalled: true, task: existing };
    }

    console.error('Atlas Autostart install blocked');
    console.error(`Task "${TASK_NAME}" already exists for a different project:`);
    console.error(`  Registered: ${existing.projectPath}`);
    console.error(`  Current:    ${projectRoot}`);
    console.error('Run atlas:autostart:remove on the other project first, or remove manually in Task Scheduler.');
    process.exitCode = 1;
    return { ok: false, reason: 'task bound to different project' };
  }

  const npmCmd = resolveNpmCmd();
  const desc = `${PROJECT_DESC_PREFIX} ${projectRoot}`;

  // Try PowerShell Register-ScheduledTask first (cleaner, no UAC for user-level tasks)
  const psScript = `
$ErrorActionPreference = 'Stop'
$root = ${psSingleQuote(projectRoot)}
$npm = ${psSingleQuote(npmCmd)}
$desc = ${psSingleQuote(desc)}
$arg = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command \`"Set-Location -LiteralPath '$root'; & '$npm' run atlas:start\`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName ${psSingleQuote(TASK_NAME)} -Action $action -Trigger $trigger -Settings $settings -Description $desc -Force | Out-Null
Write-Output 'OK'
`.trim();

  let create = runPowerShell(psScript);

  if (!create.ok) {
    const errText = create.output || '';
    const isAccessDenied =
      errText.toLowerCase().includes('access') ||
      errText.includes('engellendi') ||
      errText.includes('0x80070005');

    if (isAccessDenied) {
      // Try XML+schtasks fallback
      const fallback = installViaSchtasks(projectRoot, npmCmd, desc);
      if (!fallback.ok) {
        const combinedError = [errText, fallback.output || fallback.reason || '']
          .filter(Boolean)
          .join(' | ');
        writeLog(`Autostart install failed: ${combinedError}`, { root: projectRoot, level: 'error' });
        console.error('');
        console.error('Failed to create scheduled task.');
        console.error(`Reason: ${combinedError}`);
        console.error('This Windows session is returning 0x80070005 (Access Denied) for task registration.');
        console.error('Open an elevated PowerShell window and run:');
        console.error('  npm run atlas:autostart:install');
        printManualInstallInstructions(projectRoot, npmCmd, desc);
        process.exitCode = 1;
        return { ok: false, reason: combinedError };
      }
      create = fallback;
    } else {
      writeLog(`Autostart install failed: ${errText}`, { root: projectRoot, level: 'error' });
      console.error(`Failed to create scheduled task: ${errText || 'unknown error'}`);
      process.exitCode = 1;
      return { ok: false, reason: errText };
    }
  }

  writeLog(`Autostart task installed for ${projectRoot}`, { root: projectRoot });
  console.log('Atlas Autostart');
  console.log(`Task: ${TASK_NAME}`);
  console.log('Installed: yes');
  console.log('Enabled: yes');
  console.log(`Project: ${projectRoot}`);
  console.log(`Command: ${STARTUP_COMMAND}`);
  console.log('Trigger: At user logon');
  return { ok: true, task: queryScheduledTask() };
}

export function removeAutostart(options = {}) {
  if (!isWindows()) {
    console.error('unsupported platform');
    process.exitCode = 1;
    return { ok: false, reason: 'unsupported platform' };
  }

  const projectRoot = assertProjectRoot(options.root ?? getProjectRoot());
  const existing = queryScheduledTask();

  if (!existing) {
    console.log('Atlas Autostart');
    console.log(`Task: ${TASK_NAME}`);
    console.log('Installed: no');
    console.log('Nothing to remove.');
    return { ok: true, removed: false };
  }

  if (!pathsEqual(existing.projectPath, projectRoot)) {
    console.error('Refusing to remove task registered for a different project:');
    console.error(`  Registered: ${existing.projectPath}`);
    console.error(`  Current:    ${projectRoot}`);
    process.exitCode = 1;
    return { ok: false, reason: 'different project' };
  }

  const psScript = `
$ErrorActionPreference = 'Stop'
Unregister-ScheduledTask -TaskName ${psSingleQuote(TASK_NAME)} -Confirm:$false
Write-Output 'OK'
`.trim();
  const del = runPowerShell(psScript);

  if (!del.ok) {
    const fallback = runSchtasks(['/Delete', '/TN', TASK_NAME, '/F']);
    if (!fallback.ok) {
      console.error(`Failed to remove scheduled task: ${del.output || fallback.output}`);
      process.exitCode = 1;
      return { ok: false, reason: del.output || fallback.output };
    }
  }

  writeLog('Autostart task removed', { root: projectRoot });
  console.log('Atlas Autostart');
  console.log(`Task: ${TASK_NAME}`);
  console.log('Installed: no');
  console.log('Removed successfully.');
  console.log('Note: Running Atlas services were not stopped.');
  return { ok: true, removed: true };
}

export async function autostartStatus(options = {}) {
  if (!isWindows()) {
    console.error('unsupported platform');
    process.exitCode = 1;
    return { ok: false, reason: 'unsupported platform' };
  }

  const projectRoot = assertProjectRoot(options.root ?? getProjectRoot());
  const task = queryScheduledTask();
  const services = await inspectAllServices(projectRoot);

  console.log('Atlas Autostart');
  console.log(`Task: ${TASK_NAME}`);
  console.log(`Installed: ${task ? 'yes' : 'no'}`);

  if (task) {
    console.log(`Enabled: ${task.enabled ? 'yes' : 'no'}`);
    console.log(`Project: ${task.projectPath}`);
    console.log(`Working directory: ${task.workingDirectory}`);
    console.log(`Command: ${task.startupCommand}`);
    console.log(`Task action: ${task.command}`);
    console.log(`Last run: ${task.lastRunTime}`);
    console.log(
      `Last result: ${Number.isNaN(task.lastResultCode) ? task.lastResultText : `${task.lastResultText} (${task.lastResultCode})`}`,
    );
    console.log(`Next run: ${task.nextRunTime}`);
    console.log(`Autostart open: ${task.enabled ? 'yes' : 'no'}`);
    console.log(
      `Project path match: ${pathsEqual(task.projectPath, projectRoot) ? 'yes' : 'no — mismatch'}`,
    );
  } else {
    console.log('Enabled: no');
    console.log(`Project (current): ${projectRoot}`);
    console.log('Autostart open: no');
  }

  console.log('\nAtlas Services');
  for (const s of services) {
    console.log(formatServiceLine(s));
  }

  return { ok: true, task, services, projectRoot };
}

export function runAutostartTaskNow() {
  if (!isWindows()) return { ok: false, reason: 'unsupported platform' };
  const existing = queryScheduledTask();
  if (!existing) return { ok: false, reason: 'task not installed' };

  const script = `
$ErrorActionPreference = 'Stop'
Start-ScheduledTask -TaskName ${psSingleQuote(TASK_NAME)}
Write-Output 'OK'
`.trim();
  const started = runPowerShell(script);
  if (started.ok) return started;
  return runSchtasks(['/Run', '/TN', TASK_NAME]);
}
