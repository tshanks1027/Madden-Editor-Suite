# Madden Modding Code Protection

Code protection strategies for Madden mod packages to prevent reverse-engineering and theft.

## Why Code Protection Matters

Madden mods can be extracted from package files and redistributed without permission or attribution. Protect your code and prevent others from claiming ownership of your work.

## Code Protection Strategies

### 1. Package Obfuscation

**What to do:**
- Rename all variables to cryptic names (e.g., `a1`, `b2`, `c3`)
- Remove meaningful comments (or keep misleading ones)
- Inline small functions to hide logic
- Add dead code branches that go nowhere
- Use string concatenation instead of plain strings

**Example:**
```python
# Bad (easy to understand)
def apply_player_ratings(roster, season_adjustments):
    for player in roster:
        player.overall += season_adjustments[player.id]
    return roster

# Better (obfuscated)
def a1(b2, c3):
    for d4 in b2:
        if d4.e5 in c3:
            d4.f6 += c3[d4.e5]
    x = "x" + "y"  # dead code
    return b2
```

**Tools:**
- Python obfuscator: PyArmor, Cython
- C# obfuscator: .NET Reactor, ConfuserEx
- Generic: yapf (with aggressive settings)

### 2. String Obfuscation

**What to protect:**
- Modification descriptions
- Author names (or don't include them plainly)
- File paths
- Configuration variable names

**How:**
- Base64 encode strings
- XOR encryption with hardcoded key
- Caesar cipher (simple but better than nothing)

**Example:**
```python
# Instead of:
mod_title = "Best Madden Roster Mod"

# Use:
import base64
mod_title = base64.b64decode("QmVzdCBNYWRkZW4gUm9zdGVyIE1vZA==").decode()

# Or XOR:
def xor_encrypt(s, key):
    return ''.join(chr(ord(c) ^ key) for c in s)
```

### 3. Bytecode Compilation

**What it does:**
Converts source code to compiled bytecode, making it harder to read.

**How:**
- Python: Compile to `.pyc` files
- C#: Already compiled to MSIL (intermediate language)
- C++: Compile to binary

**Action:**
- Never distribute source code
- Always distribute compiled/packaged versions
- Remove debug symbols from compiled code

### 4. Archive Encryption

**What to do:**
- Don't distribute unencrypted mod files
- Use password-protected archives
- Use custom archive format that's harder to extract

**How:**
- 7-Zip with strong password
- Custom Python script that reads encrypted payload
- Check integrity before running (verify signatures)

**Example package structure:**
```
madden_mod_v1.exe (or .zip with password)
├── encrypted_payload.bin (AES-256)
├── decryption_script.py
└── readme.txt
```

User runs: `python decryption_script.py password123`
Outputs decrypted mod files to temp directory (never saves source)

### 5. Digital Signatures & Integrity Checks

**What it does:**
Proves the mod came from you and hasn't been modified.

**How:**
- Generate a checksum/hash of your mod
- Sign it with your private key
- Users verify with your public key
- If signature doesn't match, mod has been tampered with

**Tools:**
- Python: `hashlib` + cryptography library
- Digital signatures prevent impersonation

**Action:**
- Include hash file with every release
- Document how to verify: `sha256sum my_mod.zip`
- Users can verify they got your authentic version

### 6. Code Fragmentation

**What it does:**
Split your code across multiple files/locations to make reassembly harder.

**How:**
- Don't keep all logic in one place
- Spread functionality across many small files
- Use dynamic imports (load code at runtime)
- Keep only stub files visible

**Example:**
Instead of: `mod_logic.py` (1000 lines)

Do:
```
mod_core/
├── stub.py (10 lines, loads everything else)
├── part1.pyc (compiled)
├── part2.pyc (compiled)
├── part3.pyc (compiled)
└── loader.py (obfuscated, assembles at runtime)
```

### 7. Watermarking (Optional)

**What it does:**
Embeds information proving your ownership in the code itself.

**How:**
- Add your name/contact in binary format (not plain text)
- Include unique identifiers
- Add metadata that only you can decode

**Purpose:** If someone redistributes your mod, you can prove ownership.

## Madden-Specific Protections

### Roster File Protection

If you're distributing custom rosters:
- Don't distribute raw roster files
- Create importer script that applies changes at runtime
- Encrypt roster data
- Include integrity checks

### Gameplay Mod Protection

For gameplay adjustments:
- Distribute as compiled bytecode only
- Use parameter files that are encrypted
- Never expose the actual modifier values plainly

## Pre-Release Protection Checklist

- [ ] All variables renamed to cryptic names
- [ ] Meaningful comments removed or replaced
- [ ] Sensitive strings obfuscated (Base64 or XOR)
- [ ] Code compiled to bytecode (.pyc, MSIL, binary)
- [ ] Debug symbols removed
- [ ] Archive password-protected if distributing compressed
- [ ] Digital signature/hash created and documented
- [ ] Integrity check script included
- [ ] No unencrypted source files in distribution
- [ ] Test extraction: verify users can't easily read source
- [ ] Document your protection in SECURITY_REQUIREMENTS.md

## What NOT to Do

- ❌ Don't include plaintext source code in release
- ❌ Don't leave variable names meaningful
- ❌ Don't hardcode passwords (make them parameter-based)
- ❌ Don't distribute unencrypted sensitive data
- ❌ Don't claim obfuscation = unbreakable (it's speed bump, not wall)

## Limitations

Be realistic: determined reverse-engineers can break obfuscation. Your goal is to:
1. Make it time-consuming enough they give up
2. Have legal recourse (digital signature proves ownership)
3. Make casual copying harder
4. Maintain moral high ground (you tried to protect it)

## Ongoing Protection

- When you update your mod, re-obfuscate
- Keep obfuscation strategy fresh (don't use same obfuscator version forever)
- Monitor for unauthorized distributions
- Have a DMCA/takedown process ready
- Document all protections applied to each release

## Tools Reference

**Python obfuscation:**
- PyArmor (free tier available)
- Cython (compile to C)
- cx_Freeze (create standalone exe)

**General:**
- 7-Zip (password protection)
- GPG/OpenSSL (signing and encryption)
- hashlib (Python built-in hashing)

**Verification:**
- Document hash and signature with each release
- Example: Include `md5sum.txt` or `signature.txt`

## Documentation Template

Add to your SECURITY_REQUIREMENTS.md:
```
# Madden Mod Code Protection
- Obfuscation applied: Variable renaming, dead code, string encoding
- Distribution format: Password-protected 7z archive
- Source code: Never included in release
- Integrity check: SHA-256 hash provided
- Protected: [List specific components you protected]
- Last update: [Date]
```

This proves you took reasonable steps to protect your work.
