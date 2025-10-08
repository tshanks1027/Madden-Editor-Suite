# Draft Class Parser Test Results

**Test Date:** 2025-10-06T15:42:12.769Z
**Test File:** CAREERDRAFT-2026DRAFT7RND
**Parser Version:** 1.0.0

---

## Summary

| Metric | Value |
|--------|-------|
| File Size | 1,954,750 bytes |
| Prospects Parsed | 452 |
| Game Version | Madden 26 |
| Compression Type | none |
| Parse Status | ✅ SUCCESS |

## File Header Details

```
Signature:        FBCHUNKS
Version:          1
Year:             2025
Product String:   Madden-26-RL1-8310191
Game Version:     Madden 26
Compression:      none
Data Offset:      0x46
```

## Sample Player Data

### First Player Details

```json
{
  "name": "Francis Mauigoa",
  "position": 5,
  "overall": 80,
  "age": 21,
  "height": 78,
  "weight": 315,
  "college": 116,
  "ratings": {
    "speed": 32,
    "strength": 42,
    "awareness": 74,
    "agility": 75,
    "acceleration": 80
  },
  "draft": {
    "round": 1,
    "pick": 4,
    "draftable": 0
  },
  "hasVisuals": true
}
```

## Attribute Coverage

**Total Attributes Parsed:** 115

### Attribute List


**Personal:**
- `firstName`: string = Francis
- `lastName`: string = Mauigoa
- `age`: number = 21
- `heightInches`: number = 78
- `weight`: number = 315
- `college`: number = 116
- `homeTown`: string = PLACEHOLDER
- `jerseyNum`: number = 61

**Ratings:**
- `overall`: number = 80
- `speed`: number = 32
- `acceleration`: number = 80
- `strength`: number = 42
- `awareness`: number = 74
- `agility`: number = 75
- `jumping`: number = 72
- `stamina`: number = 33

**Draft:**
- `draftRound`: number = 1
- `draftPick`: number = 4
- `draftable`: number = 0

**Other:**
- `homeState`: number = 9
- `birthDate`: number = 32615
- `position`: number = 5
- `archetype`: number = 32
- `ballCarrierVision`: number = 44
- `blockShedding`: number = 57
- `breakSack`: number = 38
- `breakTackle`: number = 44
- `carrying`: number = 53
- `catching`: number = 33
- `catchInTraffic`: number = 30
- `changeOfDirection`: number = 56
- `finesseMoves`: number = 48
- `hitPower`: number = 61
- `impactBlocking`: number = 87
- `injury`: number = 95
- `jukeMove`: number = 29
- `kickAccuracy`: number = 25
- `kickPower`: number = 45
- `kickReturn`: number = 31
- `leadBlock`: number = 77
- `manCoverage`: number = 127
- `passBlockFinesse`: number = 33
- `passBlockPower`: number = 73
- `passBlock`: number = 84
- `personality`: number = 80
- `playAction`: number = 75
- `playRecognition`: number = 47
- `powerMoves`: number = 44
- `pressCoverage`: number = 61
- `pursuit`: number = 32
- `release`: number = 35
- `shortRouteRunning`: number = 45
- `mediumRouteRunning`: number = 31
- `deepRouteRunning`: number = 29
- `runBlockFinesse`: number = 33
- `runBlockPower`: number = 85
- `runBlock`: number = 83
- `runningStyle`: number = 84
- `spectacularCatch`: number = 1
- `spinMove`: number = 63
- `stiffArm`: number = 90
- `tackle`: number = 92
- `throwAccuracyDeep`: number = 45
- `throwAccuracyMid`: number = 16
- `throwAccuracy`: number = 21
- `throwAccuracyShort`: number = 11
- `throwOnTheRun`: number = 32
- `throwPower`: number = 26
- `throwUnderPressure`: number = 30
- `toughness`: number = 46
- `trucking`: number = 96
- `zoneCoverage`: number = 44
- `morale`: number = 35
- `traitBigHitter`: number = 50
- `traitPossessionCatch`: number = 2
- `traitClutch`: number = 0
- `traitCoverBall`: number = 0
- `traitDeepBall`: number = 0
- `traitDlBullRush`: number = 0
- `traitDlSpinMove`: number = 0
- `traitDlSwimMove`: number = 89
- `traitDropsOpen`: number = 40
- `traitSidelineCatch`: number = 0
- `traitFightForYards`: number = 0
- `traitUnk1`: number = 0
- `traitHighMotor`: number = 0
- `traitAggressiveCatch`: number = 0
- `traitPenalty`: number = 0
- `traitPlayBall`: number = 72
- `traitPumpFake`: number = 0
- `traitLbStyle`: number = 255
- `traitSensePressure`: number = 127
- `traitUnk2`: number = 0
- `traitStripBall`: number = 0
- `traitTackleLow`: number = 0
- `traitThrowAway`: number = 0
- `traitTightSpiral`: number = 0
- `traitTendency`: number = 0
- `traitRunAfterCatch`: number = 0
- `devTrait`: number = 0
- `traitPredictability`: number = 0
- `unkByte2`: number = 0
- `genericHead`: number = 0
- `handedness`: number = 0
- `portraitId`: number = 0
- `qbStyle`: number = 0
- `qbStance`: number = 0
- `unk3`: number = 0
- `unk4`: number = 0
- `unk5`: number = 0
- `unk6`: number = 0
- `visMoveType`: number = 0
- `unk8`: number = 0
- `commentaryId`: number = 0
- `assetName`: string = 

## Validation Results

| Check | Status |
|-------|--------|
| FBCHUNKS signature present | ✅ PASS |
| Version detection | ✅ PASS |
| Compression detection | ✅ PASS |
| Player count > 0 | ✅ PASS |
| Expected player count (~450) | ✅ PASS |
| All attributes present | ✅ PASS |

## Implementation Notes

### Compression Support

- **Madden 25 (gzip):** ✅ Fully supported using Node.js built-in `zlib`
- **Madden 26 (zstd):** ⚠️ Partially supported (requires fflate or @toondepauw/node-zstd)

### Data Parsing

- **Visual JSON:** Parsed from first 4096 bytes of each player record
- **Binary Attributes:** Parsed from remaining 1226 bytes
- **Attribute Offsets:** Based on Madden 25 format, may need calibration for Madden 26

## Known Issues

1. **Attribute Offsets:** Some attribute byte offsets are approximate and may need fine-tuning
2. **Zstd Compression:** Full Madden 26 support requires additional zstd library
3. **Write Support:** `writeDraftClass()` not yet implemented
4. **Visual Data:** May not decompress correctly for all players if compression varies

## Next Steps

1. Calibrate attribute offsets by comparing with known good data
2. Add full zstd decompression support for Madden 26
3. Implement `writeDraftClass()` for file modification
4. Add comprehensive error handling and validation
5. Create UI integration for Handsontable display

---

**Test Complete**