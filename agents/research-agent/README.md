# Research Agent

## Purpose
Deep analysis and reverse engineering of Madden file formats, community tool research, and documentation of binary structures for all 17 editing tools.

## Capabilities
- Reverse engineer Madden binary file formats
- Document file structure specifications
- Research existing community tools for compatibility
- Analyze file version differences across Madden releases
- Create parser implementation guides
- Validate file format assumptions

## Usage

### File Format Analysis
```bash
/research-format roster           # Analyze roster file structure
/research-format franchise        # Analyze franchise file structure
/research-format uniform          # Analyze uniform file structure
/research-format draft            # Analyze draft class structure
/research-format texture          # Analyze DDS texture format
```

### Version Comparison
```bash
/research-versions roster 24-25   # Compare roster formats between versions
/research-versions uniform 20-25  # Compare uniform formats across years
/research-compatibility all       # Check cross-version compatibility
```

### Community Tool Research
```bash
/research-tools existing          # Catalog existing Madden editors
/research-tools formats          # Document community file standards
/research-tools integration      # Research integration possibilities
```

### Binary Analysis
```bash
/analyze-binary sample.ros       # Deep dive into binary structure
/analyze-headers franchise.fra   # Analyze file headers
/analyze-checksums draft.dcl     # Validate checksum algorithms
```

## Research Areas

### File Formats
1. **Roster Files (.ros)**
   - Player attribute storage
   - Team assignment data
   - Statistical records
   - Binary encoding methods

2. **Franchise Files (.fra)**
   - Complete season data
   - Historical records
   - Team financial data
   - Schedule information

3. **Draft Class Files (.dcl)**
   - Player generation algorithms
   - Attribute distributions
   - Positional requirements
   - Realistic stat ranges

4. **Uniform Files (.uni)**
   - Color palette storage
   - Texture reference system
   - Pattern definitions
   - Equipment mappings

5. **Texture Files (.dds)**
   - DirectDraw Surface format
   - Mipmap structures
   - Compression algorithms
   - Alpha channel handling

### Community Integration
- **Existing Tools Analysis**
  - Popular roster editors
  - Uniform customization tools
  - Draft class generators
  - File format converters

- **Compatibility Standards**
  - Import/export formats
  - File naming conventions
  - Metadata preservation
  - Version compatibility

### Historical Research
- **Format Evolution**
  - Changes between Madden versions
  - Deprecated fields
  - New feature additions
  - Backward compatibility

- **Community Standards**
  - Modding conventions
  - File sharing formats
  - Quality standards
  - Documentation practices

## Research Methodology

### Binary Analysis Process
1. **Hex Dump Analysis**
   - Identify repeating patterns
   - Locate string storage
   - Find numeric data types
   - Map file sections

2. **Pattern Recognition**
   - Player record structures
   - Team data organization
   - Statistical storage methods
   - Checksum locations

3. **Validation Testing**
   - Modify values and observe effects
   - Test file integrity checks
   - Verify parsing accuracy
   - Document edge cases

### Documentation Standards
- **File Structure Maps**
  - Byte-level field definitions
  - Data type specifications
  - Field relationship mapping
  - Version differences

- **Parser Implementation Guides**
  - Reading algorithms
  - Writing procedures
  - Validation methods
  - Error handling

## Research Outputs

### Documentation Deliverables
- Binary file format specifications
- Parser implementation guides
- Community tool compatibility matrix
- Version migration guides
- Testing data sets

### Code Artifacts
- Sample file parsers
- Validation utilities
- Format conversion tools
- Test data generators
- Documentation examples

## Quality Assurance
- Peer review of research findings
- Community validation of discoveries
- Cross-reference with existing knowledge
- Practical testing of theories
- Documentation accuracy verification