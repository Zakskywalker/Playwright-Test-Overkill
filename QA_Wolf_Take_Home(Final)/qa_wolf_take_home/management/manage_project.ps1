# manage_project.ps1
# PowerShell GUI to allow clearing logs or deleting node_modules with confirmations
[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')

$caption = 'Project Maintenance'
$msg = "WARNING: Choose an action`n`nYes = Clear all logs`nNo = Delete node_modules`nCancel = Cancel"
$buttons = [System.Windows.Forms.MessageBoxButtons]::YesNoCancel
$icon = [System.Windows.Forms.MessageBoxIcon]::Warning

$res = [System.Windows.Forms.MessageBox]::Show($msg, $caption, $buttons, $icon)

$projectRoot = (Get-Item -Path (Join-Path $PSScriptRoot '..')).FullName
$buildDir = Join-Path $projectRoot 'build'
$nodeModules = Join-Path $projectRoot 'node_modules'

function Clear-Logs {
    # Remove .log and report.html files under build/ recursively
    if (-Not (Test-Path $buildDir)) {
        [System.Windows.Forms.MessageBox]::Show('No build folder found. Nothing to clear.','Result',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)
        return
    }
    try {
        Get-ChildItem -Path $buildDir -Recurse -Include '*.log','report.html' -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
        [System.Windows.Forms.MessageBox]::Show('Logs cleared.','Result',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)
    } catch {
        [System.Windows.Forms.MessageBox]::Show('Failed to clear logs: ' + $_.Exception.Message,'Error',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

function Delete-NodeModules {
    if (-Not (Test-Path $nodeModules)) {
        [System.Windows.Forms.MessageBox]::Show('node_modules folder not found.','Result',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)
        return
    }
    try {
        Remove-Item -LiteralPath $nodeModules -Recurse -Force -ErrorAction SilentlyContinue
        [System.Windows.Forms.MessageBox]::Show('node_modules deleted.','Result',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)
    } catch {
        [System.Windows.Forms.MessageBox]::Show('Failed to delete node_modules: ' + $_.Exception.Message,'Error',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

if ($res -eq [System.Windows.Forms.DialogResult]::Yes) {
    $confirm = [System.Windows.Forms.MessageBox]::Show('Are you SURE you want to CLEAR all logs?','Confirm',[System.Windows.Forms.MessageBoxButtons]::YesNo,[System.Windows.Forms.MessageBoxIcon]::Question)
    if ($confirm -eq [System.Windows.Forms.DialogResult]::Yes) { Clear-Logs } else { [System.Windows.Forms.MessageBox]::Show('Operation cancelled.','Result',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information) }
} elseif ($res -eq [System.Windows.Forms.DialogResult]::No) {
    $confirm = [System.Windows.Forms.MessageBox]::Show('Are you SURE you want to DELETE node_modules? This cannot be undone.','Confirm',[System.Windows.Forms.MessageBoxButtons]::YesNo,[System.Windows.Forms.MessageBoxIcon]::Warning)
    if ($confirm -eq [System.Windows.Forms.DialogResult]::Yes) { Delete-NodeModules } else { [System.Windows.Forms.MessageBox]::Show('Operation cancelled.','Result',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information) }
} else {
    [System.Windows.Forms.MessageBox]::Show('Cancelled.','Result',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)
}
