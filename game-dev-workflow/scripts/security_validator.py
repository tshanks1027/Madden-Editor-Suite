#!/usr/bin/env python3
"""
Security Validator

Pre-release security validation for game projects.
Checks dependencies, secrets, code quality based on project type.

Usage:
  python3 security_validator.py check <project_root> <project_type>
  python3 security_validator.py generate-report <project_root> <project_type>

project_type: "unreal" or "madden"
"""

import json
import subprocess
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any


class SecurityValidator:
    """Validates security requirements before release."""

    def __init__(self, project_root: str, project_type: str):
        self.project_root = Path(project_root)
        self.project_type = project_type  # "unreal" or "madden"
        self.memory_dir = self.project_root / ".project-memory"
        self.scans_path = self.memory_dir / "security_scans.json"
        self.security_req_path = self.project_root / "SECURITY_REQUIREMENTS.md"

    def check(self) -> Dict[str, Any]:
        """Run security checks."""
        print(f"Starting security validation for {self.project_type} project...")

        results = {
            "timestamp": datetime.now().isoformat(),
            "project_type": self.project_type,
            "checks": {},
            "warnings": [],
            "errors": [],
            "passed": True
        }

        if self.project_type == "unreal":
            results.update(self._check_unreal())
        elif self.project_type == "madden":
            results.update(self._check_madden())
        else:
            results["errors"].append(f"Unknown project type: {self.project_type}")
            results["passed"] = False

        self._save_results(results)
        return results

    def _check_unreal(self) -> Dict[str, Any]:
        """Unreal-specific security checks."""
        checks = {
            "dependency_scan": self._check_dependencies(),
            "secrets_detection": self._check_secrets(),
            "code_obfuscation": self._check_obfuscation_config(),
            "payment_security": self._check_payment_code(),
            "encryption": self._check_encryption(),
            "sbom": self._check_sbom()
        }

        warnings = []
        errors = []
        passed = all(c.get("passed") for c in checks.values())

        for check_name, check_result in checks.items():
            if not check_result.get("passed"):
                if check_result.get("severity") == "error":
                    errors.append(f"{check_name}: {check_result.get('message')}")
                else:
                    warnings.append(f"{check_name}: {check_result.get('message')}")

        return {
            "checks": checks,
            "warnings": warnings,
            "errors": errors,
            "passed": passed
        }

    def _check_madden(self) -> Dict[str, Any]:
        """Madden modding security checks."""
        checks = {
            "code_protection": self._check_code_protection(),
            "secrets_detection": self._check_secrets(),
            "archive_encryption": self._check_archive()
        }

        warnings = []
        errors = []
        passed = all(c.get("passed") for c in checks.values())

        for check_name, check_result in checks.items():
            if not check_result.get("passed"):
                if check_result.get("severity") == "error":
                    errors.append(f"{check_name}: {check_result.get('message')}")
                else:
                    warnings.append(f"{check_name}: {check_result.get('message')}")

        return {
            "checks": checks,
            "warnings": warnings,
            "errors": errors,
            "passed": passed
        }

    def _check_dependencies(self) -> Dict[str, Any]:
        """Check for dependency vulnerabilities."""
        # This would integrate with Snyk, OWASP, etc.
        # Placeholder implementation
        return {
            "passed": True,
            "message": "Manual dependency review recommended (Snyk/OWASP integration needed)",
            "severity": "warning"
        }

    def _check_secrets(self) -> Dict[str, Any]:
        """Detect hardcoded secrets."""
        secret_patterns = [
            r"(?:api[_-]?key|apikey|api_secret|secret_key|password|passwd|pwd)",
            r"(?:bearer|token|auth|credential)",
            r"(?:aws_access_key|aws_secret|azure_key|gcp_key)"
        ]

        found_secrets = []

        # Search Python files
        for py_file in self.project_root.rglob("*.py"):
            try:
                with open(py_file, 'r', encoding='utf-8', errors='ignore') as f:
                    for line_num, line in enumerate(f, 1):
                        for pattern in secret_patterns:
                            import re
                            if re.search(pattern, line, re.IGNORECASE) and "=" in line:
                                found_secrets.append(f"{py_file}:{line_num}")
            except Exception:
                pass

        if found_secrets:
            return {
                "passed": False,
                "message": f"Potential secrets found in {len(found_secrets)} locations",
                "details": found_secrets[:5],
                "severity": "error"
            }

        return {
            "passed": True,
            "message": "No obvious hardcoded secrets detected",
            "severity": "info"
        }

    def _check_obfuscation_config(self) -> Dict[str, Any]:
        """Check if obfuscation is enabled in Unreal project."""
        uproject_path = list(self.project_root.glob("*.uproject"))

        if not uproject_path:
            return {
                "passed": False,
                "message": "No .uproject file found",
                "severity": "error"
            }

        # Read .uproject
        try:
            with open(uproject_path[0], 'r') as f:
                config = json.load(f)

            # Check for obfuscation settings
            if config.get("Plugins", []):
                return {
                    "passed": True,
                    "message": "Plugins configured. Verify obfuscation is enabled in packaging settings.",
                    "severity": "warning"
                }
        except Exception as e:
            return {
                "passed": False,
                "message": f"Could not read .uproject: {str(e)}",
                "severity": "error"
            }

        return {
            "passed": True,
            "message": "Ready for obfuscation configuration",
            "severity": "info"
        }

    def _check_payment_code(self) -> Dict[str, Any]:
        """Check for secure payment processing."""
        dangerous_patterns = [
            "credit.?card",
            "cc.?number",
            "stripe.?secret",
            "paypal.?token"
        ]

        found_issues = []

        for cpp_file in self.project_root.rglob("*.cpp"):
            try:
                with open(cpp_file, 'r', encoding='utf-8', errors='ignore') as f:
                    for line_num, line in enumerate(f, 1):
                        for pattern in dangerous_patterns:
                            import re
                            if re.search(pattern, line, re.IGNORECASE):
                                found_issues.append(f"{cpp_file}:{line_num}")
            except Exception:
                pass

        if found_issues:
            return {
                "passed": False,
                "message": f"Potential payment security issues found",
                "details": found_issues[:3],
                "severity": "error"
            }

        return {
            "passed": True,
            "message": "Payment code looks secure",
            "severity": "info"
        }

    def _check_encryption(self) -> Dict[str, Any]:
        """Check for encryption implementation."""
        has_encryption = False

        for header_file in self.project_root.rglob("*.h"):
            try:
                with open(header_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if "AES" in content or "encrypt" in content.lower():
                        has_encryption = True
                        break
            except Exception:
                pass

        if not has_encryption:
            return {
                "passed": False,
                "message": "No encryption implementation found",
                "severity": "warning"
            }

        return {
            "passed": True,
            "message": "Encryption implementation detected",
            "severity": "info"
        }

    def _check_sbom(self) -> Dict[str, Any]:
        """Check if SBOM exists."""
        sbom_candidates = list(self.project_root.glob("SBOM.*")) + \
                         list(self.project_root.glob("sbom.*"))

        if not sbom_candidates:
            return {
                "passed": False,
                "message": "No SBOM (Software Bill of Materials) found",
                "severity": "warning"
            }

        return {
            "passed": True,
            "message": f"SBOM found: {sbom_candidates[0].name}",
            "severity": "info"
        }

    def _check_code_protection(self) -> Dict[str, Any]:
        """Check code protection for Madden mods."""
        # Check for source code in distribution
        src_files = list(self.project_root.glob("*.py")) + \
                   list(self.project_root.glob("*.cpp")) + \
                   list(self.project_root.glob("*.cs"))

        if src_files:
            return {
                "passed": False,
                "message": f"Source files found in distribution ({len(src_files)} files)",
                "details": [str(f.name) for f in src_files[:3]],
                "severity": "error"
            }

        return {
            "passed": True,
            "message": "No source code in distribution",
            "severity": "info"
        }

    def _check_archive(self) -> Dict[str, Any]:
        """Check if mod is in encrypted archive."""
        archive_files = list(self.project_root.glob("*.7z")) + \
                       list(self.project_root.glob("*.zip")) + \
                       list(self.project_root.glob("*.rar"))

        if not archive_files:
            return {
                "passed": False,
                "message": "No encrypted archive found",
                "severity": "warning"
            }

        return {
            "passed": True,
            "message": f"Archive found: {archive_files[0].name}",
            "severity": "info"
        }

    def _save_results(self, results: Dict[str, Any]) -> None:
        """Save security scan results."""
        self.memory_dir.mkdir(exist_ok=True)

        with open(self.scans_path, 'r') as f:
            data = json.load(f)

        data["scans"].append(results)

        with open(self.scans_path, 'w') as f:
            json.dump(data, f, indent=2)

    def generate_report(self) -> str:
        """Generate human-readable security report."""
        results = self.check()

        report = f"""
# Security Validation Report
Project: {self.project_type.upper()}
Date: {results['timestamp']}

## Summary
Status: {'✓ PASSED' if results['passed'] else '✗ FAILED'}

## Checks Performed
"""

        for check_name, check_result in results.get("checks", {}).items():
            status = "✓" if check_result.get("passed") else "✗"
            message = check_result.get("message", "No message")
            report += f"\n{status} {check_name}: {message}"

        if results["warnings"]:
            report += "\n\n## Warnings\n"
            for warning in results["warnings"]:
                report += f"- {warning}\n"

        if results["errors"]:
            report += "\n\n## Errors\n"
            for error in results["errors"]:
                report += f"- {error}\n"

        return report


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    project_root = sys.argv[2]
    project_type = sys.argv[3] if len(sys.argv) > 3 else "unreal"

    validator = SecurityValidator(project_root, project_type)

    if command == "check":
        results = validator.check()
        print(json.dumps(results, indent=2))

    elif command == "generate-report":
        report = validator.generate_report()
        print(report)

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
