#!/usr/bin/env pwsh
# Hook: Load game-dev-workflow on every prompt
# This forces Claude to see the current session state before responding

$projectRoot = "C:\Users\tshan\Documents\Dev\madden-editor-suite"
$sessionLog = "$projectRoot\.project-memory\session_log.json"
$skillFile = "$projectRoot\game-dev-workflow\SKILL.md"

Write-Host "========== MANDATORY WORKFLOW CHECK =========="
Write-Host ""

# Check if session log exists
if (Test-Path $sessionLog) {
    Write-Host "CURRENT SESSION STATE:"
    Get-Content $sessionLog
    Write-Host ""
} else {
    Write-Host "WARNING: No session_log.json found!"
    Write-Host "You MUST create one before proceeding."
    Write-Host ""
}

# Remind of workflow phases
Write-Host "WORKFLOW PHASES: Research -> Plan -> Implement -> Test -> Debug -> User Test -> Commit -> Package Test"
Write-Host ""
Write-Host "BEFORE RESPONDING:"
Write-Host "1. What phase are we in?"
Write-Host "2. What is the current task?"
Write-Host "3. Have you checked KNOWN_ISSUES.md?"
Write-Host "4. Have you checked failure_patterns.json?"
Write-Host ""
Write-Host "=============================================="
exit 0
