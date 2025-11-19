#!/usr/bin/env python3
"""
Project Memory Manager

Manages the .project-memory/ directory, SQLite database, and JSON logs
for game development workflow tracking.

Usage:
  python3 project_memory_manager.py init <project_root>
  python3 project_memory_manager.py log-test <project_root> <test_result_json>
  python3 project_memory_manager.py get-history <project_root> [limit]
  python3 project_memory_manager.py analyze-patterns <project_root>
"""

import json
import sqlite3
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional


class ProjectMemoryManager:
    """Manages project memory database and logs."""

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.memory_dir = self.project_root / ".project-memory"
        self.db_path = self.memory_dir / "test_history.db"
        self.build_log_path = self.memory_dir / "build_log.json"
        self.failure_patterns_path = self.memory_dir / "failure_patterns.json"
        self.security_scans_path = self.memory_dir / "security_scans.json"
        self.session_log_path = self.memory_dir / "session_log.json"

    def init(self) -> None:
        """Initialize project memory structure."""
        self.memory_dir.mkdir(exist_ok=True)

        # Create database schema
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                phase TEXT NOT NULL,
                test_type TEXT NOT NULL,
                layer TEXT NOT NULL,
                command TEXT,
                result TEXT NOT NULL,
                error_type TEXT,
                error_message TEXT,
                duration_seconds INTEGER,
                hypothesis TEXT,
                code_hash TEXT
            )
        """)

        conn.commit()
        conn.close()

        # Initialize JSON files
        for path, template in [
            (self.build_log_path, {"builds": []}),
            (self.failure_patterns_path, {"patterns": {}, "recent_errors": []}),
            (self.security_scans_path, {"scans": []}),
            (self.session_log_path, {"current_phase": "Research", "history": []})
        ]:
            if not path.exists():
                with open(path, 'w') as f:
                    json.dump(template, f, indent=2)

        print(f"✓ Initialized project memory at {self.memory_dir}")

    def log_test(self, test_data: Dict[str, Any]) -> None:
        """Log a test result to the database."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO test_history
            (timestamp, phase, test_type, layer, command, result, error_type,
             error_message, duration_seconds, hypothesis, code_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            test_data.get("timestamp", datetime.now().isoformat()),
            test_data.get("phase", "unknown"),
            test_data.get("test_type", "unknown"),
            test_data.get("layer", "unknown"),
            test_data.get("command"),
            test_data.get("result"),
            test_data.get("error_type"),
            test_data.get("error_message"),
            test_data.get("duration_seconds"),
            test_data.get("hypothesis"),
            test_data.get("code_hash")
        ))

        conn.commit()

        # Update failure patterns
        if test_data.get("result") == "FAILED":
            self._update_failure_patterns(test_data)

        conn.close()

        print(f"✓ Logged test: {test_data.get('test_type')} - {test_data.get('result')}")

    def _update_failure_patterns(self, test_data: Dict[str, Any]) -> None:
        """Update failure patterns JSON."""
        with open(self.failure_patterns_path, 'r') as f:
            data = json.load(f)

        error_type = test_data.get("error_type", "unknown")

        # Track pattern
        if error_type not in data["patterns"]:
            data["patterns"][error_type] = []

        data["patterns"][error_type].append({
            "timestamp": test_data.get("timestamp", datetime.now().isoformat()),
            "error_message": test_data.get("error_message"),
            "layer": test_data.get("layer")
        })

        # Update recent errors (last 10)
        data["recent_errors"].append(error_type)
        data["recent_errors"] = data["recent_errors"][-10:]

        with open(self.failure_patterns_path, 'w') as f:
            json.dump(data, f, indent=2)

    def get_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get test history."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT * FROM test_history
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,))

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return results

    def get_similar_tests(self, error_type: str, layer: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Find similar tests in history."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT * FROM test_history
            WHERE error_type = ? AND layer = ?
            ORDER BY timestamp DESC
            LIMIT ?
        """, (error_type, layer, limit))

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return results

    def check_redundancy(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check if a test would be redundant."""
        history = self.get_history(limit=5)

        for past_test in history:
            if (past_test["test_type"] == test_data.get("test_type") and
                past_test["layer"] == test_data.get("layer") and
                past_test["hypothesis"] == test_data.get("hypothesis") and
                past_test["result"] == "FAILED"):
                return {
                    "is_redundant": True,
                    "last_similar": past_test,
                    "recommendation": "Skip this test, try different approach or layer"
                }

        return {
            "is_redundant": False,
            "recommendation": "This test is novel, proceed"
        }

    def update_phase(self, phase: str) -> None:
        """Update current workflow phase."""
        with open(self.session_log_path, 'r') as f:
            data = json.load(f)

        data["current_phase"] = phase
        data["history"].append({
            "phase": phase,
            "timestamp": datetime.now().isoformat()
        })

        with open(self.session_log_path, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"✓ Updated phase: {phase}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    project_root = sys.argv[2] if len(sys.argv) > 2 else "."

    manager = ProjectMemoryManager(project_root)

    if command == "init":
        manager.init()

    elif command == "log-test":
        if len(sys.argv) < 4:
            print("Usage: log-test <project_root> <test_result_json>")
            sys.exit(1)
        test_data = json.loads(sys.argv[3])
        manager.log_test(test_data)

    elif command == "get-history":
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        history = manager.get_history(limit)
        print(json.dumps(history, indent=2))

    elif command == "check-redundancy":
        if len(sys.argv) < 4:
            print("Usage: check-redundancy <project_root> <test_data_json>")
            sys.exit(1)
        test_data = json.loads(sys.argv[3])
        result = manager.check_redundancy(test_data)
        print(json.dumps(result, indent=2))

    elif command == "update-phase":
        if len(sys.argv) < 4:
            print("Usage: update-phase <project_root> <phase>")
            sys.exit(1)
        phase = sys.argv[3]
        manager.update_phase(phase)

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
