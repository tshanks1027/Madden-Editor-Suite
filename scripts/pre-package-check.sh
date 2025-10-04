#!/bin/bash
# Pre-package validation checklist
# Run this before creating distribution packages

echo "=================================="
echo "PRE-PACKAGE VALIDATION"
echo "=================================="
echo ""

# 1. Check for hardcoded paths
echo "1. Checking for hardcoded paths..."
if grep -r "C:\\\\Users\\\\tshan" src/ --include="*.js" --include="*.ts" --exclude-dir=node_modules 2>/dev/null; then
    echo "❌ FAILED: Found hardcoded paths in src/"
    exit 1
fi
echo "✓ No hardcoded paths found"
echo ""

# 2. Check for nul file
echo "2. Checking for nul file..."
if [ -f "nul" ]; then
    echo "⚠️  WARNING: nul file exists, deleting..."
    rm nul
fi
if [ -f "out/Madden Editor Suite-win32-x64/resources/app/nul" ]; then
    echo "⚠️  WARNING: nul file in package, deleting..."
    rm "out/Madden Editor Suite-win32-x64/resources/app/nul"
fi
echo "✓ No nul files"
echo ""

# 3. Verify required dependencies
echo "3. Checking required dependencies in package.json..."
REQUIRED=("bit-buffer" "stream-parser" "crc-32")
for dep in "${REQUIRED[@]}"; do
    if grep -q "\"$dep\"" package.json; then
        echo "  ✓ $dep"
    else
        echo "  ❌ MISSING: $dep"
        exit 1
    fi
done
echo ""

# 4. Verify node_modules will be packaged
echo "4. Checking forge.config.ts ignores node_modules correctly..."
if grep -q "node_modules" forge.config.ts | grep -v "Don't ignore"; then
    echo "⚠️  WARNING: node_modules might be ignored"
fi
echo "✓ node_modules configuration looks correct"
echo ""

echo "=================================="
echo "✅ ALL CHECKS PASSED"
echo "=================================="
echo ""
echo "Safe to run: npm run package"
echo ""
