# Texture Agent

## Purpose
Advanced texture processing for uniform editor, field editor, and visual customization tools. Handles DDS format conversion, optimization, and 3D preview generation.

## Capabilities
- Convert between image formats (PNG, JPG, DDS)
- Generate mipmaps for texture optimization
- Process texture atlases for uniforms
- Validate DDS file integrity
- Optimize texture compression
- Create 3D preview renders

## Usage

### Format Conversion
```bash
/texture-convert png-to-dds uniform.png    # Convert PNG to DDS
/texture-convert dds-to-png jersey.dds     # Convert DDS to PNG
/texture-batch-convert uniforms/           # Batch convert directory
```

### Texture Optimization
```bash
/texture-optimize jersey.dds               # Optimize DDS compression
/texture-resize 1024x1024 helmet.png       # Resize to specific dimensions
/texture-compress BC7 field.dds            # Apply specific compression
```

### Mipmap Operations
```bash
/texture-mipmaps generate jersey.dds       # Generate mipmap chain
/texture-mipmaps validate uniform.dds      # Validate existing mipmaps
/texture-atlas create team-uniforms/       # Create texture atlas
```

### Validation & Analysis
```bash
/texture-validate uniform.dds              # Validate DDS file structure
/texture-analyze compression jersey.dds    # Analyze compression efficiency
/texture-info detailed helmet.png          # Display detailed texture info
```

## Supported Formats

### Input Formats
- **PNG** - Lossless with alpha support
- **JPG/JPEG** - Lossy compression
- **DDS** - DirectDraw Surface (native Madden format)
- **BMP** - Uncompressed bitmap
- **TGA** - Targa format with alpha

### Output Formats
- **DDS Variants**
  - BC1 (DXT1) - No alpha, 4:1 compression
  - BC2 (DXT3) - Explicit alpha, 4:1 compression
  - BC3 (DXT5) - Interpolated alpha, 4:1 compression
  - BC7 - Advanced compression with alpha

### Texture Specifications
- **Maximum Size**: 4096x4096 pixels
- **Minimum Size**: 64x64 pixels
- **Color Depth**: 8-bit per channel (RGBA)
- **Color Space**: sRGB standard
- **Mipmap Levels**: Automatic generation

## Uniform Editor Integration

### Team Color Processing
- Extract dominant colors from textures
- Generate team color palettes
- Apply color transformations
- Preserve logo transparency

### Pattern Generation
- Create stripe patterns
- Generate gradient transitions
- Apply team-specific designs
- Maintain aspect ratios

### 3D Preview Support
- Real-time texture mapping
- Lighting simulation
- Material property assignment
- UV coordinate validation

## Field Editor Support

### Stadium Textures
- Field surface processing
- End zone customization
- Logo placement optimization
- Weather effect textures

### Environmental Textures
- Crowd and stadium elements
- Lighting condition variants
- Seasonal appearance changes
- Broadcast presentation assets

## Performance Optimization

### Compression Strategies
- Automatic format selection based on content
- Quality vs. file size optimization
- Platform-specific optimization
- Batch processing for efficiency

### Memory Management
- Streaming for large textures
- Garbage collection optimization
- GPU memory considerations
- Cache management

## Quality Validation

### Texture Quality Checks
- Resolution appropriateness
- Compression artifact detection
- Color accuracy validation
- Alpha channel integrity

### Format Compliance
- DDS header validation
- Mipmap consistency checks
- Compression standard adherence
- Cross-platform compatibility

## Advanced Features

### Procedural Generation
- Pattern creation algorithms
- Color variation generation
- Noise and weathering effects
- Historical accuracy templates

### Batch Operations
- Team uniform set processing
- League-wide texture updates
- Format migration tools
- Quality assurance automation

## Error Handling
- Graceful format conversion failures
- Corrupt file recovery attempts
- Validation error reporting
- Automatic backup creation

## Integration Points
- Uniform Editor 3D preview
- Field Editor texture mapping
- Visual Customization tools
- Community asset sharing