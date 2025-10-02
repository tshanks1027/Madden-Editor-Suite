#!/usr/bin/env node

/**
 * Release Manager Agent
 *
 * Tracks completed features, maintains implementation notes, and generates
 * copy-paste ready release notes for the Madden Editor Suite.
 *
 * Usage:
 *   node release-manager.js feature-complete "Feature Name" "Description"
 *   node release-manager.js generate-notes
 *   node release-manager.js add-implementation-note "Feature" "Strategy used"
 */

const fs = require('fs');
const path = require('path');

// Paths
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const RELEASE_NOTES_PATH = path.join(ROOT_DIR, 'RELEASE_NOTES.md');
const IMPLEMENTATION_JOURNAL_PATH = path.join(ROOT_DIR, 'IMPLEMENTATION_JOURNAL.md');
const MASTER_PLAN_PATH = path.join(ROOT_DIR, 'MASTER_PLAN.md');

class ReleaseManager {
  constructor() {
    this.releaseNotes = this.loadReleaseNotes();
    this.implementationJournal = this.loadImplementationJournal();
  }

  loadReleaseNotes() {
    if (fs.existsSync(RELEASE_NOTES_PATH)) {
      return fs.readFileSync(RELEASE_NOTES_PATH, 'utf-8');
    }
    return '';
  }

  loadImplementationJournal() {
    if (fs.existsSync(IMPLEMENTATION_JOURNAL_PATH)) {
      return fs.readFileSync(IMPLEMENTATION_JOURNAL_PATH, 'utf-8');
    }
    return this.createImplementationJournal();
  }

  createImplementationJournal() {
    const template = `# Implementation Journal

This file tracks HOW features were implemented - the tools, procedures, and strategies used.
This helps Claude recover from failures and understand proven approaches.

---

`;
    fs.writeFileSync(IMPLEMENTATION_JOURNAL_PATH, template);
    return template;
  }

  /**
   * Mark a feature as complete and update release notes
   */
  featureComplete(featureName, description, version = 'Unreleased') {
    const timestamp = new Date().toISOString().split('T')[0];

    // Add to implementation journal
    const journalEntry = `
## ${featureName} - ${timestamp}

**Status:** ✅ Complete

**Description:** ${description}

**Implementation Strategy:**
- [To be filled in with specific strategies, tools, and procedures used]

**Key Learnings:**
- [Document any important lessons or gotchas]

**Files Modified:**
- [List key files changed]

**Testing Approach:**
- [Document how this was tested]

---

`;

    this.implementationJournal += journalEntry;
    fs.writeFileSync(IMPLEMENTATION_JOURNAL_PATH, this.implementationJournal);

    // Update RELEASE_NOTES.md unreleased section
    const unreleasedSection = this.findUnreleasedSection();
    const featureEntry = `- ✅ ${featureName}: ${description} (${timestamp})`;

    const updatedNotes = this.releaseNotes.replace(
      /### In Development\n/,
      `### In Development\n${featureEntry}\n`
    );

    fs.writeFileSync(RELEASE_NOTES_PATH, updatedNotes);
    this.releaseNotes = updatedNotes;

    console.log(`✅ Feature marked complete: ${featureName}`);
    console.log(`📝 Updated RELEASE_NOTES.md and IMPLEMENTATION_JOURNAL.md`);
    console.log(`\n📋 Copy-paste ready entry:\n${featureEntry}`);
  }

  /**
   * Add implementation notes for a feature
   */
  addImplementationNote(featureName, strategy, tools = [], filesModified = []) {
    const timestamp = new Date().toISOString().split('T')[0];

    const note = `
## ${featureName} - Implementation Notes (${timestamp})

**Strategy:** ${strategy}

**Tools Used:**
${tools.map(tool => `- ${tool}`).join('\n') || '- [None specified]'}

**Files Modified:**
${filesModified.map(file => `- ${file}`).join('\n') || '- [None specified]'}

**Procedure:**
1. [Step-by-step procedure if applicable]

**Gotchas/Issues:**
- [Any issues encountered and how they were resolved]

---

`;

    this.implementationJournal += note;
    fs.writeFileSync(IMPLEMENTATION_JOURNAL_PATH, this.implementationJournal);

    console.log(`📝 Implementation note added for: ${featureName}`);
  }

  /**
   * Generate copy-paste ready release notes
   */
  generateReleaseNotes(version = 'Next Release') {
    const timestamp = new Date().toISOString().split('T')[0];

    // Extract completed features from implementation journal
    const completedFeatures = this.extractCompletedFeatures();

    const releaseNote = `
## Release ${version} - ${timestamp}

### New Features
${completedFeatures.features.map(f => `- ${f}`).join('\n')}

### Improvements
${completedFeatures.improvements.map(i => `- ${i}`).join('\n') || '- [None]'}

### Bug Fixes
${completedFeatures.bugFixes.map(b => `- ${b}`).join('\n') || '- [None]'}

### Technical Changes
${completedFeatures.technical.map(t => `- ${t}`).join('\n') || '- [None]'}

### Known Issues
- [List any known issues]

### Installation
1. Download the installer for your platform
2. Run the installer
3. Launch Madden Editor Suite

### Credits
- Continued development by tshanks1027
- Community testing and feedback

---

`;

    console.log('\n📋 COPY-PASTE READY RELEASE NOTES:\n');
    console.log('=' .repeat(80));
    console.log(releaseNote);
    console.log('=' .repeat(80));

    return releaseNote;
  }

  /**
   * Extract completed features from implementation journal
   */
  extractCompletedFeatures() {
    const features = [];
    const improvements = [];
    const bugFixes = [];
    const technical = [];

    // Parse implementation journal for completed items
    const completedPattern = /## (.+) - \d{4}-\d{2}-\d{2}\n\n\*\*Status:\*\* ✅ Complete/g;
    let match;

    while ((match = completedPattern.exec(this.implementationJournal)) !== null) {
      const featureName = match[1];

      // Categorize based on keywords
      if (featureName.toLowerCase().includes('bug') || featureName.toLowerCase().includes('fix')) {
        bugFixes.push(featureName);
      } else if (featureName.toLowerCase().includes('improve') || featureName.toLowerCase().includes('enhance')) {
        improvements.push(featureName);
      } else if (featureName.toLowerCase().includes('refactor') || featureName.toLowerCase().includes('optimize')) {
        technical.push(featureName);
      } else {
        features.push(featureName);
      }
    }

    return { features, improvements, bugFixes, technical };
  }

  /**
   * Find unreleased section in RELEASE_NOTES.md
   */
  findUnreleasedSection() {
    const unreleasedMatch = this.releaseNotes.match(/## \[Unreleased\]([\s\S]*?)##/);
    return unreleasedMatch ? unreleasedMatch[1] : '';
  }

  /**
   * List all pending features from MASTER_PLAN.md
   */
  listPendingFeatures() {
    if (!fs.existsSync(MASTER_PLAN_PATH)) {
      console.log('❌ MASTER_PLAN.md not found');
      return;
    }

    const masterPlan = fs.readFileSync(MASTER_PLAN_PATH, 'utf-8');
    const checkboxPattern = /- \[ \] (.+)/g;
    const pending = [];
    let match;

    while ((match = checkboxPattern.exec(masterPlan)) !== null) {
      pending.push(match[1]);
    }

    console.log('\n📋 PENDING FEATURES:\n');
    pending.forEach((feature, index) => {
      console.log(`${index + 1}. ${feature}`);
    });
    console.log(`\nTotal: ${pending.length} pending features`);
  }

  /**
   * Show implementation history for reference
   */
  showImplementationHistory() {
    console.log('\n📚 IMPLEMENTATION HISTORY:\n');
    console.log(this.implementationJournal);
  }
}

// CLI Interface
const [,, command, ...args] = process.argv;

const manager = new ReleaseManager();

switch (command) {
  case 'feature-complete':
    const [featureName, description, version] = args;
    if (!featureName || !description) {
      console.error('Usage: node release-manager.js feature-complete "Feature Name" "Description" [version]');
      process.exit(1);
    }
    manager.featureComplete(featureName, description, version);
    break;

  case 'add-implementation-note':
    const [feature, strategy] = args;
    if (!feature || !strategy) {
      console.error('Usage: node release-manager.js add-implementation-note "Feature" "Strategy"');
      process.exit(1);
    }
    manager.addImplementationNote(feature, strategy);
    break;

  case 'generate-notes':
    const [releaseVersion] = args;
    manager.generateReleaseNotes(releaseVersion || 'Next Release');
    break;

  case 'list-pending':
    manager.listPendingFeatures();
    break;

  case 'show-history':
    manager.showImplementationHistory();
    break;

  default:
    console.log(`
Madden Editor Suite - Release Manager

Commands:
  feature-complete "Feature" "Description" [version]
    Mark a feature as complete and update release notes

  add-implementation-note "Feature" "Strategy"
    Add implementation details for a completed feature

  generate-notes [version]
    Generate copy-paste ready release notes

  list-pending
    List all pending features from MASTER_PLAN.md

  show-history
    Show complete implementation history

Examples:
  node release-manager.js feature-complete "Roster Editor" "Complete roster editing functionality"
  node release-manager.js add-implementation-note "Roster Editor" "Used madden-franchise parser with IPC handlers"
  node release-manager.js generate-notes "v0.1.0"
  node release-manager.js list-pending
  node release-manager.js show-history
`);
}
