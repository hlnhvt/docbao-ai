# Daily run, started by Windows Task Scheduler (task "DocBaoAI daily").
# 1. Deletes issues older than KEEP_DAYS (scripts/publish.mjs), without needing Claude.
# 2. Asks Claude (Sonnet) to write today's issue, following scripts/daily-prompt.md.
#    If Claude fails because the CLI is too old, updates Claude Code and tries once more.
# 3. When the final check passes, commits public/data and data, then pushes main.
# Log: work/logs/daily-<date>.log

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$date = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'SE Asia Standard Time').ToString('yyyy-MM-dd')
New-Item -ItemType Directory -Force "work\logs" | Out-Null
$log = "work\logs\daily-$date.log"
function Log($msg) { "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg" | Out-File -Append -Encoding utf8 $log }

# Messages the CLI prints when it is too old for the model or the API
$VERSION_RE = 'update Claude Code|unrecognized_model|model catalog|please (update|upgrade)|newer version|version .* (is )?(no longer|not) supported|minimum (required )?version'

function Write-Issue {
  $prompt = (Get-Content -Raw -Encoding utf8 'scripts\daily-prompt.md').Replace('{{DATE}}', $date)
  # The model reads untrusted web pages, so it runs isolated from the user's own Claude settings and MCP
  # servers, with the narrow permissions in scripts/daily-settings.json: read the project, write only
  # work/ and public/data/issues/, run only the project's npm scripts. No node/shell/git, no web access.
  $out = $prompt | claude -p --model claude-sonnet-5-5 --setting-sources project `
    --settings scripts/daily-settings.json --strict-mcp-config *>&1 | Out-String
  $code = $LASTEXITCODE
  $out | Out-File -Append -Encoding utf8 $log
  Log "claude exit code $code"
  return @{ Code = $code; Out = $out }
}

function Update-Claude {
  Log "updating Claude Code (was $(claude --version))"
  claude update *>&1 | Out-File -Append -Encoding utf8 $log
  if ($LASTEXITCODE -ne 0) {
    Log "claude update failed, trying npm"
    npm install -g @anthropic-ai/claude-code@latest *>&1 | Out-File -Append -Encoding utf8 $log
  }
  Log "Claude Code now $(claude --version)"
}

Log "== start, issue date $date"

# Old issues are pruned before anything else, so deletion happens even if Claude fails
node scripts/publish.mjs *>&1 | Out-File -Append -Encoding utf8 $log

if (Test-Path "public\data\issues\$date.json") {
  Log "issue $date already exists, skip writing"
} else {
  # Temporary files from the previous run
  foreach ($dir in 'work\text', 'work\drafts') {
    if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
  }
  Log "claude: writing issue $date"
  $run = Write-Issue
  $versionProblem = $run.Out -match $VERSION_RE
  if ($run.Code -ne 0 -and $versionProblem) {
    Log "claude failed and mentions its version: update, then retry once"
    Update-Claude
    if (Test-Path 'work\drafts') { Remove-Item -Recurse -Force 'work\drafts' }
    $run = Write-Issue
  } elseif ($versionProblem) {
    # Worked, but the CLI warned it is out of date: update for tomorrow
    Update-Claude
  }
  if (-not (Test-Path "public\data\issues\$date.json")) { Log "WARNING: issue $date was not written" }
}

# Final check; push only when it passes
node scripts/publish.mjs *>&1 | Out-File -Append -Encoding utf8 $log
if ($LASTEXITCODE -ne 0) { Log "check failed, not pushing"; exit 1 }

# Only content: code changes in progress (staged or not) stay local
$paths = @('public/data', 'data') | Where-Object { Test-Path $_ }
$changed = git status --porcelain -- public/data/issues data
if ($changed) {
  git add -A -- $paths
  git commit -m "content: diem tin $date" -- $paths *>&1 | Out-File -Append -Encoding utf8 $log
  git push origin main *>&1 | Out-File -Append -Encoding utf8 $log
  Log "push exit code $LASTEXITCODE"
} else {
  # Only the timestamp in index.json moved: not worth a commit
  git restore -- public/data/index.json
  Log "nothing to commit"
}
Log "== done"
