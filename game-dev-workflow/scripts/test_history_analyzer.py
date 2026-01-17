#!/usr/bin/env python3
"""
Test History Analyzer

Analyzes test history to prevent redundant testing and identify patterns.

Usage:
  python3 test_history_analyzer.py should-skip <project_root> <test_json>
  python3 test_history_analyzer.py suggest-next <project_root>
  python3 test_history_analyzer.py analyze <project_root>
  python3 test_history_analyzer.py stats <project_root>
"""

import json
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import Counter


class TestHistoryAnalyzer:
    """Analyzes test history to guide testing decisions."""

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.memory_dir = self.project_root / ".project-memory"
        self.db_path = self.memory_dir / "test_history.db"
        self.failure_patterns_path = self.memory_dir / "failure_patterns.json"

    def should_skip(self, proposed_test: Dict[str, Any]) -> Dict[str, Any]:
        """Determine if a proposed test should be skipped."""
        if not self.db_path.exists():
            return {"skip": False, "reason": "No test history exists"}

        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Check for identical recent tests
        cursor.execute("""
            SELECT * FROM test_history
            WHERE test_type = ? AND layer = ? AND result = 'FAILED'
            ORDER BY timestamp DESC
            LIMIT 5
        """, (proposed_test.get("test_type"), proposed_test.get("layer")))

        recent_similar = [dict(row) for row in cursor.fetchall()]
        conn.close()

        if not recent_similar:
            return {"skip": False, "reason": "No similar tests found"}

        # Check if code has changed since last test
        last_test = recent_similar[0]
        last_code_hash = last_test.get("code_hash")
        proposed_code_hash = proposed_test.get("code_hash")

        if last_code_hash and proposed_code_hash and last_code_hash == proposed_code_hash:
            # Same code, same test = redundant
            return {
                "skip": True,
                "reason": f"Identical test failed at {last_test['timestamp']}. Code unchanged.",
                "last_error": last_test.get("error_message"),
                "suggestion": "Modify code or try a different testing approach"
            }

        # Check if hypothesis is the same
        if last_test.get("hypothesis") == proposed_test.get("hypothesis"):
            return {
                "skip": True,
                "reason": "Same hypothesis already tested without code changes",
                "last_result": last_test.get("result"),
                "suggestion": "Try a different hypothesis or layer"
            }

        return {
            "skip": False,
            "reason": "Test appears novel or code has changed"
        }

    def suggest_next(self) -> Dict[str, Any]:
        """Suggest the next test to run based on history."""
        if not self.db_path.exists():
            return {"suggestion": "No history - start with basic build test"}

        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get recent failures
        cursor.execute("""
            SELECT * FROM test_history
            WHERE result = 'FAILED'
            ORDER BY timestamp DESC
            LIMIT 10
        """)
        recent_failures = [dict(row) for row in cursor.fetchall()]

        # Get layers already tested
        cursor.execute("""
            SELECT DISTINCT layer FROM test_history
            WHERE result = 'FAILED'
            AND timestamp > datetime('now', '-1 hour')
        """)
        tested_layers = [row["layer"] for row in cursor.fetchall()]

        conn.close()

        if not recent_failures:
            return {"suggestion": "No recent failures - run full build"}

        # Determine untested layers
        all_layers = ["compile", "link", "runtime", "integration"]
        untested = [l for l in all_layers if l not in tested_layers]

        last_error = recent_failures[0]

        suggestions = []

        if untested:
            suggestions.append(f"Test untested layer: {untested[0]}")

        # Suggest based on error type
        error_type = last_error.get("error_type", "unknown")

        if error_type == "compile_error":
            suggestions.append("Check syntax and includes")
        elif error_type == "link_error":
            suggestions.append("Verify Build.cs dependencies")
        elif error_type == "runtime_error":
            suggestions.append("Add debug logging, check object lifecycle")
        elif error_type == "undefined_reference":
            suggestions.append("Add missing module to Build.cs")

        return {
            "last_error_type": error_type,
            "last_error_layer": last_error.get("layer"),
            "tested_layers": tested_layers,
            "untested_layers": untested,
            "suggestions": suggestions,
            "avoid": "Repeating identical test without code changes"
        }

    def analyze(self) -> Dict[str, Any]:
        """Comprehensive analysis of test history."""
        if not self.db_path.exists():
            return {"error": "No test history database found"}

        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Total tests
        cursor.execute("SELECT COUNT(*) as total FROM test_history")
        total = cursor.fetchone()["total"]

        # Pass/fail ratio
        cursor.execute("""
            SELECT result, COUNT(*) as count
            FROM test_history
            GROUP BY result
        """)
        results = {row["result"]: row["count"] for row in cursor.fetchall()}

        # Most common error types
        cursor.execute("""
            SELECT error_type, COUNT(*) as count
            FROM test_history
            WHERE error_type IS NOT NULL
            GROUP BY error_type
            ORDER BY count DESC
            LIMIT 5
        """)
        common_errors = {row["error_type"]: row["count"] for row in cursor.fetchall()}

        # Tests per layer
        cursor.execute("""
            SELECT layer, COUNT(*) as count
            FROM test_history
            GROUP BY layer
        """)
        layer_distribution = {row["layer"]: row["count"] for row in cursor.fetchall()}

        # Redundancy detection
        cursor.execute("""
            SELECT test_type, layer, hypothesis, COUNT(*) as repeats
            FROM test_history
            WHERE result = 'FAILED'
            GROUP BY test_type, layer, hypothesis
            HAVING repeats > 1
            ORDER BY repeats DESC
            LIMIT 5
        """)
        redundant_tests = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return {
            "total_tests": total,
            "results": results,
            "pass_rate": results.get("SUCCESS", 0) / total if total > 0 else 0,
            "common_errors": common_errors,
            "layer_distribution": layer_distribution,
            "redundant_tests": redundant_tests,
            "recommendations": self._generate_recommendations(common_errors, redundant_tests)
        }

    def _generate_recommendations(self, common_errors: Dict, redundant_tests: List) -> List[str]:
        """Generate recommendations based on analysis."""
        recommendations = []

        if redundant_tests:
            recommendations.append(
                f"Found {len(redundant_tests)} redundant test patterns. "
                "Consider different approaches for these failure types."
            )

        if common_errors:
            top_error = list(common_errors.keys())[0] if common_errors else None
            if top_error:
                recommendations.append(
                    f"Most common error: {top_error}. "
                    "Consider adding this to KNOWN_ISSUES.md with solutions."
                )

        return recommendations

    def stats(self) -> Dict[str, Any]:
        """Get quick statistics."""
        if not self.db_path.exists():
            return {"error": "No database"}

        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM test_history")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM test_history WHERE result = 'SUCCESS'")
        passed = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM test_history WHERE result = 'FAILED'")
        failed = cursor.fetchone()[0]

        cursor.execute("""
            SELECT timestamp FROM test_history
            ORDER BY timestamp DESC LIMIT 1
        """)
        last_test = cursor.fetchone()

        conn.close()

        return {
            "total_tests": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": f"{(passed/total*100):.1f}%" if total > 0 else "N/A",
            "last_test": last_test[0] if last_test else "Never"
        }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    project_root = sys.argv[2] if len(sys.argv) > 2 else "."

    analyzer = TestHistoryAnalyzer(project_root)

    if command == "should-skip":
        if len(sys.argv) < 4:
            print("Usage: should-skip <project_root> <test_json>")
            sys.exit(1)
        test_data = json.loads(sys.argv[3])
        result = analyzer.should_skip(test_data)
        print(json.dumps(result, indent=2))

    elif command == "suggest-next":
        result = analyzer.suggest_next()
        print(json.dumps(result, indent=2))

    elif command == "analyze":
        result = analyzer.analyze()
        print(json.dumps(result, indent=2))

    elif command == "stats":
        result = analyzer.stats()
        print(json.dumps(result, indent=2))

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
