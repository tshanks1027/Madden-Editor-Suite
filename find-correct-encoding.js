/**
 * Find which bit extraction gives correct college ID
 * Abanikanda should be Pittsburgh (ID 167)
 */

const binaryString = "10000000000000000000011110110000";
const targetId = 167;  // Pittsburgh

console.log('\nSearching for bit extraction that gives college ID 167 (Pittsburgh):\n');
console.log('Binary string:', binaryString);
console.log('Target ID:', targetId, '=', targetId.toString(2).padStart(8, '0'), 'in binary\n');

// Try all possible contiguous bit ranges
for (let start = 0; start <= 24; start++) {
  for (let length = 8; length <= 16; length++) {
    if (start + length > 32) continue;

    const bits = binaryString.substring(start, start + length);
    const value = parseInt(bits, 2);

    if (value === targetId) {
      console.log(`✓ MATCH! Bits [${start}:${start + length}] (length ${length}): ${bits} = ${value}`);
    }
  }
}

// Also try with bit operations
console.log('\n--- Testing bit operations ---');

const fullValue = parseInt(binaryString, 2);
console.log('Full value:', fullValue);

// Try different masks
const masks = [
  { name: '0xFF (last 8 bits)', mask: 0xFF },
  { name: '0x1FF (last 9 bits)', mask: 0x1FF },
  { name: '0x3FF (last 10 bits)', mask: 0x3FF },
  { name: '0x7FF (last 11 bits)', mask: 0x7FF },
  { name: '0xFFF (last 12 bits)', mask: 0xFFF },
];

masks.forEach(({ name, mask }) => {
  const masked = fullValue & mask;
  if (masked === targetId) {
    console.log(`✓ MATCH! ${name}: ${fullValue} & ${mask.toString(16)} = ${masked}`);
  } else {
    console.log(`  ${name}: ${masked}`);
  }
});

// Try shifts
console.log('\n--- Testing right shifts ---');
for (let shift = 0; shift <= 24; shift++) {
  const shifted = (fullValue >> shift) & 0xFF;
  if (shifted === targetId) {
    console.log(`✓ MATCH! Shift right ${shift} bits, mask 0xFF: ${shifted}`);
  }
}

console.log();
