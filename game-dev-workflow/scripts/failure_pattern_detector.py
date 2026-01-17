#!/usr/bin/env python3
"""
Failure Pattern Detector

Automatically groups and analyzes errors to identify patterns and solutions.

Usage:
  python3 failure_pattern_detector.py detect <project_root> <error_message>
  python3 failure_pattern_detector.py patterns <project_root>
  python3 failure_pattern_detector.py solutions <project_root> <error_type>
  python3 failure_pattern_detector.py add-solution <project_root> <error_type> <solution>
"""

import json
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple


class FailurePatternDetector:
    """Detects and categorizes failure patterns."""

    # Error classification patterns
    ERROR_PATTERNS = {
        "compile_syntax": [
            r"error C\d+:",
            r"syntax error",
            r"expected.*before",
            r"missing.*semicolon",
        ],
        "compile_type": [
            r"cannot convert",
            r"type mismatch",
            r"incompatible types",
            r"no matching function",
        ],
        "compile_include": [
            r"cannot open include file",
            r"No such file or directory",
            r"file not found",
            r"missing.*include",
        ],
        "link_unresolved": [
            r"unresolved external symbol",
            r"undefined reference",
            r"LNK2019",
            r"LNK2001",
        ],
        "link_duplicate": [
            r"already defined",
            r"multiple definition",
            r"LNK2005",
        ],
        "runtime_null": [
            r"null pointer",
            r"NullReferenceException",
            r"accessed None",
            r"nullptr",
        ],
        "runtime_access": [
            r"access violation",
            r"segmentation fault",
            r"SIGSEGV",
        ],
        "runtime_assertion": [
            r"assertion failed",
            r"check failed",
            r"ensure failed",
        ],
        "shader_error": [
            r"shader compilation",
            r"HLSL error",
            r"material.*error",
        ],
    }

    # Known solutions for error types
    DEFAULT_SOLUTIONS = {
        "compile_include": [
            "Add missing #include directive",
            "Check include paths in project settings",
            "Verify file exists at expected location",
        ],
        "link_unresolved": [
            "Add module to PublicDependencyModuleNames in Build.cs",
            "Verify library is linked in project settings",
            "Check if function is actually implemented",
        ],
        "link_duplicate": [
            "Check header guards (#pragma once or #ifndef)",
            "Move implementation to .cpp file",
            "Use inline for header-defined functions",
        ],
        "runtime_null": [
            "Add null check before accessing object",
            "Verify object is initialized",
            "Check object lifecycle and ownership",
        ],
        "shader_error": [
            "Check shader syntax",
            "Verify texture/sampler bindings",
            "Check for platform-specific shader issues",
        ],
    }

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.memory_dir = self.project_root / ".project-memory"
        self.patterns_path = self.memory_dir / "failure_patterns.json"
        self.db_path = self.memory_dir / "test_history.db"

    def _load_patterns(self) -> Dict[str, Any]:
        """Load failure patterns from JSON."""
        if not self.patterns_path.exists():
            return {"patterns": {}, "solutions": self.DEFAULT_SOLUTIONS.copy(), "recent_errors": []}

        with open(self.patterns_path, 'r') as f:
            data = json.load(f)
            # Ensure solutions exist
            if "solutions" not in data:
                data["solutions"] = self.DEFAULT_SOLUTIONS.copy()
            return data

    def _save_patterns(self, data: Dict[str, Any]) -> None:
        """Save failure patterns to JSON."""
        self.memory_dir.mkdir(exist_ok=True)
        with open(self.patterns_path, 'w') as f:
            json.dump(data, f, indent=2)

    def detect(self, error_message: str) -> Dict[str, Any]:
        """Detect error type and suggest solutions."""
        error_type = self._classify_error(error_message)

        data = self._load_patterns()

        # Record this error
        if error_type not in data["patterns"]:
            data["patterns"][error_type] = []

        data["patterns"][error_type].append({
            "timestamp": datetime.now().isoformat(),
            "message": error_message[:500]  # Truncate long messages
        })

        # Update recent errors
        data["recent_errors"].append(error_type)
        data["recent_errors"] = data["recent_errors"][-20:]  # Keep last 20

        self._save_patterns(data)

        # Get solutions
        solutions = data.get("solutions", {}).get(error_type, [])
        if not solutions:
            solutions = ["No known solutions - investigate manually"]

        # Check for recurring pattern
        error_count = len(data["patterns"].get(error_type, []))
        is_recurring = error_count > 2

        return {
            "error_type": error_type,
            "confidence": self._get_confidence(error_message, error_type),
            "solutions": solutions,
            "occurrence_count": error_count,
            "is_recurring": is_recurring,
            "recommendation": self._get_recommendation(error_type, is_recurring)
        }

    def _classify_error(self, error_message: str) -> str:
        """Classify an error message into a type."""
        error_lower = error_message.lower()

        for error_type, patterns in self.ERROR_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, error_message, re.IGNORECASE):
                    return error_type

        # Fallback classification based on keywords
        if "compile" in error_lower or "syntax" in error_lower:
            return "compile_unknown"
        elif "link" in error_lower or "undefined" in error_lower:
            return "link_unknown"
        elif "runtime" in error_lower or "crash" in error_lower:
            return "runtime_unknown"

        return "unknown"

    def _get_confidence(self, error_message: str, error_type: str) -> str:
        """Get confidence level of classification."""
        patterns = self.ERROR_PATTERNS.get(error_type, [])
        matches = sum(1 for p in patterns if re.search(p, error_message, re.IGNORECASE))

        if matches >= 2:
            return "high"
        elif matches == 1:
            return "medium"
        return "low"

    def _get_recommendation(self, error_type: str, is_recurring: bool) -> str:
        """Get recommendation based on error type and history."""
        if is_recurring:
            return f"This error type ({error_type}) keeps occurring. Consider adding to KNOWN_ISSUES.md with root cause."

        layer_map = {
            "compile_syntax": "compile",
            "compile_type": "compile",
            "compile_include": "compile",
            "link_unresolved": "link",
            "link_duplicate": "link",
            "runtime_null": "runtime",
            "runtime_access": "runtime",
            "runtime_assertion": "runtime",
            "shader_error": "compile",
        }

        layer = layer_map.get(error_type, "unknown")
        return f"Focus debugging on the {layer} layer"

    def patterns(self) -> Dict[str, Any]:
        """Get all detected patterns and statistics."""
        data = self._load_patterns()

        stats = {}
        for error_type, occurrences in data.get("patterns", {}).items():
            stats[error_type] = {
                "count": len(occurrences),
                "first_seen": occurrences[0]["timestamp"] if occurrences else None,
                "last_seen": occurrences[-1]["timestamp"] if occurrences else None,
            }

        # Find most common
        sorted_stats = sorted(stats.items(), key=lambda x: x[1]["count"], reverse=True)

        return {
            "pattern_stats": stats,
            "most_common": sorted_stats[:5] if sorted_stats else [],
            "recent_errors": data.get("recent_errors", [])[-10:],
            "total_unique_patterns": len(stats)
        }

    def solutions(self, error_type: str) -> Dict[str, Any]:
        """Get solutions for a specific error type."""
        data = self._load_patterns()

        solutions = data.get("solutions", {}).get(error_type, [])
        default = self.DEFAULT_SOLUTIONS.get(error_type, [])

        return {
            "error_type": error_type,
            "custom_solutions": solutions,
            "default_solutions": default,
            "all_solutions": list(set(solutions + default))
        }

    def add_solution(self, error_type: str, solution: str) -> Dict[str, Any]:
        """Add a new solution for an error type."""
        data = self._load_patterns()

        if "solutions" not in data:
            data["solutions"] = {}

        if error_type not in data["solutions"]:
            data["solutions"][error_type] = []

        if solution not in data["solutions"][error_type]:
            data["solutions"][error_type].append(solution)
            self._save_patterns(data)
            return {"status": "added", "error_type": error_type, "solution": solution}

        return {"status": "exists", "error_type": error_type, "solution": solution}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    project_root = sys.argv[2] if len(sys.argv) > 2 else "."

    detector = FailurePatternDetector(project_root)

    if command == "detect":
        if len(sys.argv) < 4:
            print("Usage: detect <project_root> <error_message>")
            sys.exit(1)
        error_message = sys.argv[3]
        result = detector.detect(error_message)
        print(json.dumps(result, indent=2))

    elif command == "patterns":
        result = detector.patterns()
        print(json.dumps(result, indent=2))

    elif command == "solutions":
        if len(sys.argv) < 4:
            print("Usage: solutions <project_root> <error_type>")
            sys.exit(1)
        error_type = sys.argv[3]
        result = detector.solutions(error_type)
        print(json.dumps(result, indent=2))

    elif command == "add-solution":
        if len(sys.argv) < 5:
            print("Usage: add-solution <project_root> <error_type> <solution>")
            sys.exit(1)
        error_type = sys.argv[3]
        solution = sys.argv[4]
        result = detector.add_solution(error_type, solution)
        print(json.dumps(result, indent=2))

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
