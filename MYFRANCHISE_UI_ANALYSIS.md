# MyFranchise UI Structure Analysis

**Purpose**: This document analyzes the UI organization and design patterns used by MyFranchise editor to inform our Madden Editor Suite design.

**Note**: This is research for UI CONCEPTS only - no code from MyFranchise will be copied.

---

## Table of Contents

- [Overview](#overview)
- [Main Navigation Structure](#main-navigation-structure)
- [Tab System](#tab-system)
- [Feature Organization](#feature-organization)
- [Table Editor Interface](#table-editor-interface)
- [Key UI Patterns](#key-ui-patterns)
- [What Works Well](#what-works-well)
- [Potential Improvements](#potential-improvements)

---

## Overview

**Application Type**: Electron desktop application
**UI Framework**: Vanilla JavaScript with Handsontable for data grids
**Architecture**: Service-based with navigation routing

MyFranchise uses a **horizontal tab-based navigation** system similar to a web browser, allowing users to have multiple tables/views open simultaneously.

---

## Main Navigation Structure

MyFranchise organizes its UI into 5 main sections:

###  1. Home
- **Purpose**: Welcome screen, file management, recent files
- **Service**: `welcomeService`
- **Available for**: All Madden versions (19-26), all franchise formats

### 2. Schedule Editor
- **Purpose**: Visual schedule management
- **Service**: `scheduleService`
- **Available for**: Madden 19-26, franchise format only
- **Features**: Custom schedule editing, game management

### 3. Abilities Editor
- **Purpose**: Player abilities management (X-Factors, Superstar abilities)
- **Service**: `abilityEditorService`
- **Available for**: Madden 20 only
- **Note**: Version-specific feature

### 4. Schemas
- **Purpose**: Schema version management and viewing
- **Service**: `schemaViewerService`
- **Available for**: All Madden versions (19-26), all formats
- **Features**: Schema inspection, version switching

### 5. Open Table... (Table Editor)
- **Purpose**: Direct table data editing with Handsontable grid
- **Service**: `tableEditorService`
- **Available for**: All Madden versions (19-26), all formats
- **Features**: Multi-tab support, advanced search, field references

**Hidden/Experimental**:
- League Editor (mentioned but not actively used)

---

## Tab System

### Tab Types

1. **Main Navigation Tabs** (Static)
   - Home, Schedule, Abilities, Schemas, Open Table...
   - Always visible when file is open
   - Cannot be closed
   - Single instance per type

2. **Table Editor Tabs** (Dynamic)
   - Multiple tabs can be open simultaneously
   - Each tab represents a specific table view
   - Can be closed individually
   - Tab name shows: `TableID - TableName` (e.g., "40 - Player")
   - Browser-style behavior: middle-click to close

3. **New Tab Button** (Special)
   - "+" button always visible on right
   - Creates new table editor tabs
   - Appears after all other tabs

### Tab Features

- **Tab Persistence**: Tabs remember last position (row/column) when switching
- **Navigation History**: Each tab maintains its own navigation history
- **Active Tab Highlighting**: Clear visual indication of active tab
- **Horizontal Scrolling**: Tab bar scrolls horizontally when too many tabs open
- **Keyboard Shortcuts**: Standard browser-style shortcuts supported

---

## Feature Organization

### Home Screen
- Recent files list
- "Open File" button
- Quick actions: Open Table Editor, Schedule Editor, Schema Viewer
- Application version and update notifications

### Table Editor (Primary Feature)

**Layout**:
```
┌─────────────────────────────────────────────────┐
│  [Back] [Table Selector ▼] [Jump to Column]    │
├─────────────────────────────────────────────────┤
│  ⭐ Pinned Tables: Player | Team | Coach        │
├─────────────────────────────────────────────────┤
│                                                  │
│    [Handsontable Data Grid]                    │
│                                                  │
│    - Sortable columns                          │
│    - Inline editing                             │
│    - Reference cell highlighting                │
│    - Context menus                              │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Components**:

1. **Table Selector Dropdown**
   - Lists all available tables
   - Searchable
   - Shows table name and ID

2. **Pinned Tables**
   - Quick access to frequently used tables
   - User-configurable
   - Persists across sessions

3. **Jump to Column**
   - Modal dialog
   - Select column + enter row number
   - Quickly navigate large tables

4. **Reference Editor**
   - Special modal for editing reference fields
   - Shows table selector + row index
   - Binary representation visible
   - "Change" button to apply

5. **Blob Editor**
   - Modal for editing blob/binary data
   - Hex editor interface

6. **Reference Modal**
   - Shows which tables reference a specific record
   - Helps understand data relationships
   - Click to navigate to referencing table

### Schedule Editor

**Layout**:
- Visual calendar-style interface
- Week-by-week view
- Game cards with team matchups
- Editable game properties

### Schema Viewer

**Layout**:
- List of all tables with metadata
- Field definitions for each table
- Type information
- Schema version details

---

## Table Editor Interface

### Data Grid (Handsontable)

**Features Used**:
- Column sorting
- Column resizing
- Cell editing with validation
- Custom cell renderers for:
  - References (shows linked table/record)
  - Enums (dropdown selection)
  - Booleans (checkbox)
  - Numbers (with min/max validation)
  - Strings (with max length)
- Context menus
- Keyboard navigation
- Copy/paste support

### Field Type Handling

| Type | Renderer | Editor |
|------|----------|--------|
| int/uint | Text | Number input with min/max |
| bool | Checkbox | Toggle |
| string | Text | Text input with maxLength |
| reference | Text with link | Reference modal |
| enum | Text | Dropdown select |
| float | Text | Number input (decimal) |
| blob | "Edit Blob" button | Blob editor modal |

---

## Key UI Patterns

### 1. Service-Based Architecture
Each major feature is a "service" with:
- `start()` method to initialize
- `onClose()` method for cleanup
- Event emitter for cross-service communication
- Navigation data configuration

### 2. Modal Dialogs
Used for:
- Jump to column
- Reference editing
- Blob editing
- Schema management
- Settings/preferences

### 3. Context-Sensitive Actions
- Menus enable/disable based on active view
- Save button only enabled in table editor
- Export/Import only available in table editor

### 4. Search Functionality
- Global search across all tables (league editor concept)
- Per-table search (in table editor)
- Schema search (in schema viewer)

### 5. Notifications System
- Top-right notification banners
- Types: Updates, errors, warnings, success
- Dismissable or auto-hide
- Action buttons (e.g., "Update" button)

---

## What Works Well

### Strengths of MyFranchise UI

1. **Browser-Style Tabs**
   - Familiar interaction pattern
   - Multiple tables open simultaneously
   - Easy switching between contexts
   - Remembers position per tab

2. **Table Pinning**
   - Quick access to frequently used tables (Player, Team, Coach)
   - Reduces clicks for common operations
   - Persistent user preference

3. **Reference Handling**
   - Visual indication of reference fields
   - Modal editor makes relationships clear
   - "Show References" feature helps understand data flow

4. **Handsontable Integration**
   - Mature, well-tested data grid
   - Handles large datasets
   - Familiar Excel-like interface
   - Built-in features (sort, copy/paste, etc.)

5. **Schema Version Management**
   - Critical for supporting multiple Madden versions
   - Schema viewer helps users understand structure
   - Auto-detection with manual override option

6. **Simple, Focused Design**
   - Not overloaded with features
   - Clean visual hierarchy
   - Purpose-built for franchise editing

---

## Potential Improvements

### Areas Where Our UI Could Improve

1. **Table Discovery**
   - Current: Flat dropdown list of 3000+ tables
   - Improvement: Categorized/grouped table selector
   - Improvement: Search with filters (by category, by record count)
   - Improvement: "Recently used" tables list

2. **Guided Workflows**
   - Current: User must know table names and relationships
   - Improvement: Wizard-style interfaces for common tasks
   - Improvement: "Edit Player" flow that touches multiple tables
   - Improvement: Contextual help/documentation

3. **Data Visualization**
   - Current: Raw table view only
   - Improvement: Charts/graphs for stats
   - Improvement: Team depth chart visualization
   - Improvement: Season schedule calendar view

4. **Batch Operations**
   - Current: Edit one cell at a time
   - Improvement: Bulk update operations
   - Improvement: Formula/expression editor
   - Improvement: Copy attributes from one player to many

5. **Validation & Safety**
   - Current: Can corrupt files with bad edits
   - Improvement: Pre-save validation checks
   - Improvement: Undo/redo system
   - Improvement: "Test in game" before saving
   - Improvement: Backup management

6. **Entity-Centric Views**
   - Current: Table-centric (see all players in grid)
   - Improvement: Player-centric (see one player, all attributes)
   - Improvement: Team-centric (see team + roster + depth chart)
   - Improvement: Switch between grid and form views

---

## Summary

**Key Takeaways for Our UI Design**:

1. **Keep the tab system** - it's proven and effective
2. **Categorize tables** - don't present 3000+ tables as flat list
3. **Add guided workflows** - help users accomplish common tasks
4. **Maintain raw table access** - power users need it
5. **Layer on convenience features** - entity views, wizards, visualizations
6. **Prioritize safety** - validation, backups, undo

**Philosophy**:
- Start with simple, working foundation (like MyFranchise)
- Layer on advanced features without hiding the raw data
- Progressive disclosure: Simple for beginners, powerful for experts

