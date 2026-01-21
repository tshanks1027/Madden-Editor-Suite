# Skin Tone and Archetype Research Findings

**Date:** 2026-01-20
**Status:** RESEARCH PHASE - NO CODE CHANGES YET

## Sources Analyzed

1. `C:\Users\tshan\Downloads\PAM\Gamemode\leaguevisuals.JSON` - 3,069 players with visuals data
2. `node_modules/madden-franchise/data/schemas/26/M26_677_0.gz` - Schema definitions
3. `data/lookups/archetype_lookup.csv` - Archetype ID mappings
4. External: MaddenRatings.com archetype lists

---

## Part 1: Skin Tone Findings

### Key Fields in leaguevisuals.JSON

| Field | Description | Example |
|-------|-------------|---------|
| `genericHeadName` | GENR value | "gen_7_M_N_001" |
| `genericHead` | Face picker number | 281 |
| `skinTone` | Skin tone value | 7 |
| `skinToneScale` | Additional skin parameter | -8355712 |
| `bodyType` | Body type value | 0=Standard, 2=Muscular, 3=Heavy |

### Skin Tone Distribution (3,069 players)

| Skin Tone | Player Count | Primary GENR |
|-----------|--------------|--------------|
| 1 (lightest) | 483 | gen_1_* (158), gen_2_* (83) |
| 2 | 530 | gen_2_* (489) |
| 3 | 63 | gen_3_* (48) |
| 4 | 171 | gen_4_* (147) |
| 5 | 232 | gen_5_* (204) |
| 6 | 361 | gen_6_* (286) |
| 7 (darkest) | 1,169 | gen_7_* (1,082) |
| 8 | 58 | gen_7_* (39), gen_6_* (14) |

**Finding:** GENR number correlates with skin tone, but not 1:1. There's flexibility.

### GENR Number ≠ Skin Tone (but usually matches)

Evidence from leaguevisuals.JSON:
- `gen_7_*` faces appear at skinTone 1 (135 players!)
- `gen_1_*` faces appear at skinTone 1 (158 players - most common)
- `gen_2_*` faces appear at skinTone 2 (489 players - dominant)

**CRITICAL:** The GENR number is the PRIMARY indicator, but the game allows flexibility.

### Body Variant Distribution (B/H/M/T)

| Variant | Total | Skin Tones |
|---------|-------|------------|
| B (Big/Black faces) | 1,119 | Distributed across ALL tones 1-8 |
| H (Hispanic faces) | 615 | Distributed across ALL tones 1-8 |
| M (Medium/White faces) | 504 | Distributed across ALL tones 1-8 |
| T (Tall/White faces) | 243 | Distributed across ALL tones 1-8 |
| BMH (combo) | 339 | Mostly tone 7 (201 players) |
| BHM (combo) | 106 | Mostly tone 6-7 |

**CRITICAL FINDING:** Body variant (B/H/M/T) is independent of skin tone!

A Black player (Race 7) should get:
- **B variant** for Black facial features
- **Skin tone 6-7** for dark skin

A White player (Race 1) should get:
- **M or T variant** for White facial features
- **Skin tone 1-2** for light skin

### Current Code Bug (GenericFaceService.js)

Current flow:
```
Race 7 (Black) → SKNT 6-7 → GENR_POOLS[7] (contains ALL variants!)
```

This means a Black player can get:
- `gen_7_B_N_019` ✓ Correct (B variant = Black features)
- `gen_7_H_N_01` ✗ Wrong (H variant = Hispanic features)
- `gen_7_M_N_001` ✗ Wrong (M variant = White features)

### Correct Mapping Should Be

| Race Code | Race Name | Body Variant | Skin Tone Range |
|-----------|-----------|--------------|-----------------|
| 1 | White | M, T | 1-2 |
| 5 | Hispanic | H | 3-5 |
| 7 | Black | B | 6-7 |

---

## Part 2: Archetype Findings

### PlayerType Enum (from schema 677)

```
0 = QB_FieldGeneral
1 = QB_StrongArm
2 = QB_Improviser
3 = QB_Scrambler
4 = QB_PureScrambler
5 = HB_PowerBack
6 = HB_ElusiveBack
7 = HB_ReceivingBack
...
14 = WR_DeepThreat
15 = WR_Playmaker
...
22 = TE_Blocking
23 = TE_VerticalThreat
...
27 = C_PassProtector
28 = C_Power
...
39 = DE_SmallerSpeedRusher
40 = DE_PowerRusher
...
51 = MLB_FieldGeneral
...
54 = CB_MantoMan
55 = CB_Slot
56 = CB_Zone
...
80 = Invalid_
```

### Archetype by Position (from MaddenRatings.com)

**Quarterbacks (0-4):**
- Field General, Strong Arm, Improviser, Scrambler, Pure Scrambler

**Running Backs (5-11):**
- Power Back, Elusive Back, Receiving Back, Power Blocking, Power Receiving, Elusive Power, Elusive Receiving

**Wide Receivers (14-21):**
- Deep Threat, Playmaker, Physical Route Runner, Shifty Route Runner, Physical Blocker, Gadget Receiver, Physical, Slot

**Tight Ends (22-26):**
- Blocking, Vertical Threat, Physical Route Runner, Possession Blocking, Possession

**Offensive Line (27-38):**
- Pass Protector, Power, Well-Rounded, Agile (for C, G, OT)

**Defensive Line (39-46):**
- Speed Rusher, Power Rusher, Pure Power, Run Stopper, Nose Tackle

**Linebackers (47-53):**
- OLB: Speed Rusher, Power Rusher, Pass Coverage, Run Stopper
- MLB: Field General, Pass Coverage, Run Stopper

**Defensive Backs (54-60):**
- CB: Man-to-Man, Slot, Zone, Hybrid Corner
- S: Zone, Hybrid, Run Support

**Special Teams (61-67):**
- K/P: Accurate, Power
- KR/PR: Balanced
- LS: Power, Accurate

### Archetype vs OVR Relationship

**KEY DISCOVERY (from franchise file analysis):**

The franchise file stores MULTIPLE OVR calculations - one for EACH archetype:

| Field | Description |
|-------|-------------|
| `OverallGrade0` | OVR if archetype 0 (e.g., Field General for QB) |
| `OverallGrade1` | OVR if archetype 1 (e.g., Strong Arm for QB) |
| `OverallGrade2` | OVR if archetype 2 (e.g., Improviser for QB) |
| `OverallGrade3` | OVR if archetype 3 (e.g., Scrambler for QB) |
| `OverallGrade4` | OVR if archetype 4 (position-dependent) |
| `PlayerType` | The assigned archetype (e.g., `QB_StrongArm`) |
| `OverallRating` | Matches OverallGrade for the assigned PlayerType |

**Example from test QB (all ratings = 80):**
```
PlayerType: QB_StrongArm
OverallGrade0: 66  (Field General OVR)
OverallGrade1: 67  (Strong Arm OVR) ← Current archetype
OverallGrade2: 67  (Improviser OVR)
OverallGrade3: 65  (Scrambler OVR)
OverallRating: 67  ← Matches OverallGrade1
```

**This proves:** Same player attributes + different archetype = different OVR

Archetype determines which attributes are weighted more heavily:
- **QB Field General** → Accuracy stats weighted heavily
- **QB Scrambler** → Speed/Agility weighted heavily
- **HB Power Back** → Trucking/Strength weighted heavily
- **HB Elusive Back** → Juke/Spin/Elusiveness weighted heavily
- **WR Deep Threat** → Speed/Deep Route weighted heavily
- **WR Slot** → Short Route Running weighted heavily

The archetype affects:
1. OVR calculation weights (stored in OverallGrade0-4)
2. Available abilities/X-factors
3. Superstar progression paths

---

## Part 3: Test Plan

### Test 1: Skin Tone Isolation Test

Create roster with 10 players, varying ONE variable at a time:

**Group A - Same GENR, Different Skin Tone:**
| Player | GENR | SKNT | Expected Result |
|--------|------|------|-----------------|
| Test1 | gen_7_B_N_019 | 1 | Very dark face, light skin body? |
| Test2 | gen_7_B_N_019 | 4 | Very dark face, medium skin body? |
| Test3 | gen_7_B_N_019 | 7 | Very dark face, dark skin body |

**Group B - Different GENR, Same Skin Tone:**
| Player | GENR | SKNT | Expected Result |
|--------|------|------|-----------------|
| Test4 | gen_1_B_N_011 | 7 | Light face, dark skin body? |
| Test5 | gen_4_B_N_01 | 7 | Medium face, dark skin body? |
| Test6 | gen_7_B_N_019 | 7 | Dark face, dark skin body |

**Group C - Different Variant, Same Skin Tone:**
| Player | GENR | SKNT | Expected Result |
|--------|------|------|-----------------|
| Test7 | gen_7_B_N_019 | 7 | Black facial features |
| Test8 | gen_7_H_N_01 | 7 | Hispanic facial features |
| Test9 | gen_7_M_N_001 | 7 | White facial features |

### Test 2: Archetype vs OVR Test

Create players with same ratings but different archetypes:

| Player | Position | Archetype | Ratings | Expected OVR |
|--------|----------|-----------|---------|--------------|
| TestQB1 | QB | Field General | 85 THP, 85 SAC | Higher OVR |
| TestQB2 | QB | Scrambler | 85 THP, 85 SAC | Lower OVR |
| TestHB1 | HB | Power Back | 85 TRK, 85 SPD | Higher OVR |
| TestHB2 | HB | Elusive Back | 85 TRK, 85 SPD | Lower OVR |

---

## Part 4: User Testing Feedback (2026-01-21)

### Archetype Test Results
- Archetypes set in roster file (PLTY) were NOT preserved when loading into franchise
- The game recalculates/assigns archetypes based on player attributes
- **Finding:** Franchise stores OVR for ALL archetypes (OverallGrade0-4), PlayerType determines which is shown

**User Direction:** "For archetypes we need to first load the proper ones when we load a roster or draft class"
- Current issue: Proper archetypes aren't being loaded when opening roster/draft class
- Need to ensure PLTY values are loaded and displayed correctly

### Skin Tone Test Results
- Initial test was invalid - test players had PAM assigned which overrides GENR/SKNT
- After clearing PAM (PEPS), test was valid

**User Direction:** "Forget trying to match a bunch of stuff. We have settings for each game generic face. If so we need to make sure all the settings link together and match the generic face assigned to the player."

### Proposed Fix - Simpler Generic Face Approach

**Current (complex):** Derive GENR/SKNT from race with many fallbacks

**Proposed (simple):**
1. Player has `PGHE` (face picker index, e.g., 42)
2. Look up face 42 in `generic-face-catalog.json` → {genr: "gen_3_B_N_01", sknt: 3}
3. Copy ALL settings to BLBM: GENR, SKNT
4. No derivation from race needed - catalog is definitive

**Files involved:**
- `data/lookups/generic-face-catalog.json` - face picker # → {genr, sknt}
- `data/lookups/generic-face-complete-mapping.json` - complete data with cnid, gnhd, asnm too
- `src/main/parsers/GenericFaceService.js` - needs simplification

---

## Part 4.5: Next Steps (Pending User Approval)

1. **Run Test 1** to confirm skin tone behavior in-game
2. **Run Test 2** to confirm archetype-OVR relationship
3. **Document exact mapping** from Race → (Variant, SkinTone)
4. **ONLY THEN** modify GenericFaceService.js to filter by variant

---

---

## Part 5: Position ID Reference (PPOS field)

**Important:** Position IDs in roster files:

| PPOS | Position |
|------|----------|
| 0 | QB |
| 1 | HB |
| 2 | FB |
| 3 | WR |
| 4 | TE |
| 5 | LT |
| 6 | LG |
| 7 | C |
| 8 | RG |
| 9 | RT |
| 10 | LEDG |
| 11 | REDG |
| 12 | DT |
| 13 | SAM |
| 14 | Mike |
| 15 | WILL |
| 16 | CB |
| 17 | FS |
| 18 | SS |
| 19 | K |
| 20 | P |
| 21 | LS |

**Note:** Position 11 is REDG (Right Edge), NOT CB! CB is position 16.

---

## External Resources

- [Madden Ratings - Archetypes](https://www.maddenratings.com/lists/default)
- [MUT.GG Player Database](https://www.mut.gg/players/)
- [Clutch Points - Superstar Archetypes](https://clutchpoints.com/gaming/madden-26-superstar-all-positions-archetypes)
