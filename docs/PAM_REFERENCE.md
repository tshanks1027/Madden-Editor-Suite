# Madden 26 Player Appearance Morph (PAM) Reference

**Generated**: 2025-10-16
**Source**: Frosty Editor bulk export - Multiple XML schemas
**Total Asset Folders**: 142,381 GUID folders in `_AF/`

---

## Overview

PAM (Player Appearance Morph) is Madden's system for managing player face assets and character customization in the Frostbite engine. This document catalogs the PAM system discovered from Madden 26's game files.

## Key Findings

### Portrait System Architecture

**Asset Library**: `assetlibrary_playerportraits_brt.xml` (9,765 total entries)
- **Generic Faces**: 792 unique templates (see GENERIC_FACE_MAPPING.md)
- **Custom Player Scans**: Real NFL players with custom face scans
- **Face Morphing System**: `FaceMorphPortraitGeneratorData` for runtime face generation

### Player Portrait File Structure

Each player portrait consists of multiple files:

```
plpo_[PlayerName].xml                    - Main portrait metadata
plpo_[playername]_[playerid]*.xml        - Variant portraits (multiple angles/LODs)
```

**Example - Kevin Pamphile** (NFL offensive lineman):
```xml
<ImageLibraryTexture Guid="027d6c56-ec8a-5dd1-f6ea-4481ce66206b">
    <Name>content/ui/ImageAssetLibraries/global/Portraits/PlayerPortraits/assets/plpo_PamphileKevin</Name>
    <Resource>47F737B63E68F6AF</Resource>
    <CropInfo>
        <Vec4s16>
            <W>512</W>   <!-- Width -->
            <X>0</X>     <!-- X offset -->
            <Y>0</Y>     <!-- Y offset -->
            <Z>512</Z>   <!-- Height -->
        </Vec4s16>
    </CropInfo>
    <AuthoredHeight>0200</AuthoredHeight>  <!-- 512px -->
    <AuthoredWidth>0200</AuthoredWidth>    <!-- 512px -->
    <SourcePath>Raw\content\ui\ImageAssetLibraries\global\Portraits\PlayerPortraits\plpo_PamphileKevin.png</SourcePath>
    <AssetIdList Count="1">
        <member Index="0">7265</member>    <!-- AssetID for lookup -->
    </AssetIdList>
</ImageLibraryTexture>
```

## Character Portrait System

**Source File**: `ContentShared/content/FootballCharacter/Schematics/CharacterPortraits.xml`

### Key Components

#### 1. FaceMorphPortraitGeneratorData
```xml
<FaceMorphPortraitGeneratorData Guid="00000000-0000-0000-0000-00000000000b">
    <Flags>182456005</Flags>
    <DebugTexture>nullptr</DebugTexture>
    <TextureSize>
        <Vec2>
            <x>512</x>  <!-- Portrait width -->
            <y>512</y>  <!-- Portrait height -->
        </Vec2>
    </TextureSize>
    <PortraitId>30002</PortraitId>
    <ImagesToRun>1</ImagesToRun>
</FaceMorphPortraitGeneratorData>
```

- **Purpose**: Runtime face morph generation for portraits
- **Texture Resolution**: 512x512 pixels (standard)
- **PortraitId**: Unique identifier for portrait request
- **ImagesToRun**: Number of portrait angles to generate

#### 2. CustomizableObjectSpawnerData
```xml
<CustomizableObjectSpawnerData Guid="00000000-0000-0000-0000-000000000011">
    <Flags>181789384</Flags>
    <InitData>nullptr</InitData>
    <CObjType>player</CObjType>
    <Blueprint>[Ebx] ContentShared/content/FootballCharacter/Schematics/footballcharacter_bp_PlayerPortrait [06a742d4-237c-5531-9867-07cfbef743b2]</Blueprint>
    <TeamSide>-1</TeamSide>
    <GameType>4</GameType>
    <Id>0</Id>
    <UseSecondaryLane>True</UseSecondaryLane>
</CustomizableObjectSpawnerData>
```

- **CObjType**: "player" - Identifies as player character type
- **Blueprint**: References `footballcharacter_bp_PlayerPortrait` schema
- **TeamSide**: -1 (neutral/both sides)
- **GameType**: 4 (likely franchise/career mode)

#### 3. RosterCreationData
```xml
<RosterCreationData Guid="00000000-0000-0000-0000-000000000003">
    <RosterIndex>0</RosterIndex>
    <SleeveTemperatureFahrenheit>0</SleeveTemperatureFahrenheit>
    <NameplateIndirectPlacement>...</NameplateIndirectPlacement>
    <StrandHairType>StrandHair_HighPriority</StrandHairType>
    <NumPrideStickers>0</NumPrideStickers>
    <UniqueId>0</UniqueId>
    <DepthValue>0</DepthValue>
    <NameplateIndirectTexture>0</NameplateIndirectTexture>
    <TeamFaction>TeamFaction_Home</TeamFaction>
    <ClothPriority>0</ClothPriority>
    <FieldPosition>0</FieldPosition>
    <CaptainPatchLevel>CaptainPatch_None</CaptainPatchLevel>
    <IsCaptain>False</IsCaptain>
</RosterCreationData>
```

- **StrandHairType**: Hair rendering system (strand-based hair simulation)
- **CaptainPatchLevel**: Captain badge on jersey
- **SleeveTemperatureFahrenheit**: Dynamic sleeve length based on weather
- **NameplateIndirectTexture**: Jersey nameplate rendering

## Football Character Blueprint System

### Player Blueprints Found

1. **footballcharacter_bp_Player** - Main gameplay player
2. **footballcharacter_bp_PlayerPortrait** - Portrait rendering
3. **footballcharacter_bp_PlayerNIS** - Non-interactive sequence player (cutscenes)
4. **footballcharacter_bp_PlayerSideline** - Sideline character
5. **footballcharacter_bp_FrontEnd** - Menu/front-end player model
6. **footballcharacter_bp_LegacyCreatePlayer** - Create-a-player system
7. **footballcharacter_bp_Coach** - Coach character
8. **footballcharacter_bp_NarrativeGameplaySkeleton** - Story mode skeletal system

### Character Asset Pipeline

```
Source PNG → ImageLibraryTexture → AssetID → Portrait Request → Face Morph Generation → In-Game Render
```

## Asset Naming Conventions

### Player Portraits (Custom Scans)
- **Pattern**: `plpo_[LastName][FirstName]`
- **Examples**:
  - `plpo_PamphileKevin` (Kevin Pamphile #7265)
  - `plpo_BradyTom` (hypothetical Tom Brady)
  - `plpo_MahomesPatrick` (hypothetical Patrick Mahomes)

### Generic Faces
- **Pattern**: `plpo_generic_[category]_[variant]_[number]`
- **Categories**: 1-7 (see GENERIC_FACE_MAPPING.md)
- **Total**: 792 unique generic face templates

### Legacy System Naming
- **Pattern**: `plpo_generic_[race]_[build]_[number]`
- **Race Codes**: bla, dbl, lat, lbl, whi (Black, Dark Black, Latino, Light Black, White)
- **Build Codes**: h, m, t (Heavy, Medium, Thin)

## Asset Storage Structure

### _AF Folder (Asset Files)
- **Location**: `C:\Users\tshan\Downloads\_AF\`
- **Total Folders**: 142,381 GUID-named asset folders
- **Structure**: Each GUID folder contains binary asset data (meshes, textures, animations)

### Content Folder
- **Player Portraits**: `content/ui/ImageAssetLibraries/global/Portraits/PlayerPortraits/assets/`
- **Character Schemas**: `ContentShared/content/FootballCharacter/Schematics/`
- **Cameras**: `content/FootballCharacter/Cameras/Portrait_Camera`
- **Lighting**: `content/lighting/FrontEndGame/VE_HDR_PortraitLighting`

## MeshVariation System

Found in multiple XMLs - controls character model LOD (Level of Detail) and mesh variants:

```
MeshVariationDb_Win32.xml  - Platform-specific mesh variations
```

Examples found:
- `storymode_fallbackfemale_body_lschar_common_brt\MeshVariationDb_Win32.xml`
- `pancakeplate_rbp_prop_brt\MeshVariationDb_Win32.xml`
- `walkietalkie_prop_brt\MeshVariationDb_Win32.xml`

**Purpose**: Different mesh quality levels for performance optimization

## Loadout System

**LoadoutSlotEnum** - Character customization slots:
- Helmet
- Jersey
- Pants
- Shoes
- Gloves
- Facemask
- Visor
- Pads (shoulder, knee, elbow)
- Accessories (arm sleeves, wristbands, towel, mouthguard)

**Total Slots**: 17 loadout slots (from ArrayBuilderEntityData analysis)

## Next Steps for Integration

### 1. Face Assignment in Roster Generator
```javascript
// Pseudo-code for face assignment
function assignFace(player) {
  if (player.hasCustomScan) {
    return lookupCustomScan(player.nflId); // AssetId from asset library
  } else {
    const category = determineEthnicity(player.ethnicity);
    const faceId = selectRandomGeneric(category);
    return faceId; // Index into generic face array
  }
}
```

### 2. AssetId Mapping
- Parse `assetlibrary_playerportraits_brt.xml` completely
- Build lookup table: `PlayerName → AssetId`
- Build generic face array: `Category/Number → AssetId`
- Create franchise file field mapping: `FaceId field → AssetId`

### 3. Portrait Extraction
- Use Frosty Tool Suite to extract actual PNG files from GUID folders
- Map Resource GUIDs to actual texture files
- Create image library for editor preview

### 4. Face Morph Parameters
- Research franchise file face morph fields (head shape, jaw, nose, eyes, etc.)
- Map morph values to Frostbite face customization system
- Enable face editing in roster generator

## Key References

### Frostbite Engine Types
- **ImageLibraryTexture**: Texture asset metadata
- **MeshVariationDb**: Mesh LOD and variant database
- **CustomizableObjectSpawnerData**: Character spawning system
- **FaceMorphPortraitGeneratorData**: Runtime face generation
- **LoadoutSlotEnum**: Equipment slot enumeration

### File Formats
- **XML**: Metadata and schemas (human-readable)
- **Ebx**: Entity Blueprint XML (Frostbite scene format)
- **BRT**: Build Resource Table (asset compilation)
- **Resource**: Binary asset data (textures, meshes, etc.)

## Known Limitations

1. **No Direct PAM Field**: PAM may not be a single field in franchise files - likely composite of:
   - FaceId (generic vs custom)
   - AssetId (portrait reference)
   - FaceMorph values (sliders for customization)
   - HeadMorph values (head shape parameters)

2. **Binary Assets**: _AF GUID folders contain binary data - requires Frosty Tool Suite for extraction

3. **Schema Complexity**: Frostbite schemas are highly interconnected - full reverse engineering would require significant effort

## Conclusion

The PAM system in Madden 26 is **NOT** a single field but rather a complex system involving:
- **Asset Library**: Portrait texture references (9,765 entries)
- **Generic Faces**: 792 template faces for created players
- **Face Morph System**: Runtime face customization
- **Character Blueprints**: Different character rendering contexts (gameplay, menus, cutscenes)
- **Loadout System**: 17 equipment slots for full character customization

For the roster generator, we should focus on:
1. Mapping AssetIds from the asset library to franchise file face fields
2. Creating a generic face assignment algorithm based on player ethnicity
3. Extracting portrait images for editor preview
4. Documenting face morph parameters for future face editing features

## Related Documentation

- **GENERIC_FACE_MAPPING.md** - Complete list of 792 generic face templates
- **RESEARCH_FINDINGS.md** - madden-franchise library analysis
- **Frosty Export Location**: `C:\Users\tshan\Downloads\`
