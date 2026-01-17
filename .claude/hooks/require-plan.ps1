#!/usr/bin/env pwsh
# PreToolUse hook: Block Edit/Write unless an approved plan exists
# This is ENFORCEMENT, not suggestion

param(
    [string]$ToolName
)

$projectRoot = "C:\Users\tshan\Documents\Dev\madden-editor-suite"
$planFile = "$projectRoot\.project-memory\current_plan.md"
$sessionLog = "$projectRoot\.project-memory\session_log.json"

# Only check for Edit and Write tools
if ($ToolName -notmatch "^(Edit|Write)$") {
    # Allow other tools
    Write-Output '{"decision": "allow"}'
    exit 0
}

# Check if plan file exists
if (-not (Test-Path $planFile)) {
    Write-Output '{
        "decision": "block",
        "reason": "BLOCKED: No plan file exists at .project-memory/current_plan.md. You MUST create a plan before editing code. Use the Write tool to create .project-memory/current_plan.md first with: 1) What you will change, 2) Why, 3) Expected outcome. Then get user approval."
    }'
    exit 0
}

# Check if plan is approved (look for "APPROVED" in the file)
$planContent = Get-Content $planFile -Raw
if ($planContent -notmatch "APPROVED") {
    Write-Output '{
        "decision": "block",
        "reason": "BLOCKED: Plan exists but is not approved. The user must add APPROVED to .project-memory/current_plan.md before you can edit code. Show them the plan and ask for approval."
    }'
    exit 0
}

# Plan exists and is approved - allow the edit
Write-Output '{"decision": "allow"}'
exit 0
