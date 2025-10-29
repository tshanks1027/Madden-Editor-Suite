/**
 * Test PID (PresentationId) encoding in M26 franchise files
 */

const Franchise = require('madden-franchise');

const FRANCHISE_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';

async function testPIDEncoding() {
  try {
    const franchise = await Franchise.create(FRANCHISE_FILE, { gameYearOverride: 26 });
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    console.log('\n=== Testing PID Encoding ===\n');

    const testPlayers = ['Abanikanda', 'Abdullah', 'Smith'];

    for (const lastName of testPlayers) {
      const player = playerTable.records.find(r => r.LastName && r.LastName.includes(lastName));

      if (!player) continue;

      console.log(`\n--- ${player.FirstName} ${player.LastName} ---`);
      console.log('PresentationId value:', player.PresentationId);
      console.log('PresentationId type:', typeof player.PresentationId);

      const field = player.fieldsArray.find(f => f.key === 'PresentationId');
      if (field) {
        console.log('Field value:', field.value);
        console.log('Field value type:', typeof field.value);
        console.log('Field offset type:', field.offset?.type);
        console.log('Field offset length:', field.offset?.length);
        console.log('Field offset isReference:', field.offset?.isReference);
        console.log('Field offset enum:', field.offset?.enum ? 'YES' : 'NO');

        // If it's a binary string, analyze it
        if (typeof field.value === 'string' && field.value.match(/^[01]+$/)) {
          console.log('Binary string detected!');
          console.log('Binary length:', field.value.length);
          console.log('Full binary:', field.value);

          // Try extracting last 16 bits (like College was last 8)
          if (field.value.length >= 16) {
            const last16 = field.value.substring(field.value.length - 16);
            const id16 = parseInt(last16, 2);
            console.log(`Last 16 bits: ${last16} = ${id16}`);
          }

          // Try last 15 bits
          if (field.value.length >= 15) {
            const last15 = field.value.substring(field.value.length - 15);
            const id15 = parseInt(last15, 2);
            console.log(`Last 15 bits: ${last15} = ${id15}`);
          }

          // Try last 14 bits
          if (field.value.length >= 14) {
            const last14 = field.value.substring(field.value.length - 14);
            const id14 = parseInt(last14, 2);
            console.log(`Last 14 bits: ${last14} = ${id14}`);
          }

          // Try last 13 bits
          if (field.value.length >= 13) {
            const last13 = field.value.substring(field.value.length - 13);
            const id13 = parseInt(last13, 2);
            console.log(`Last 13 bits: ${last13} = ${id13}`);
          }
        }

        // Try parsing as integer and masking
        if (typeof field.value === 'number' || !isNaN(parseInt(field.value))) {
          const intVal = typeof field.value === 'number' ? field.value : parseInt(field.value);
          console.log('As integer:', intVal);
          console.log('Masked 0xFFFF:', intVal & 0xFFFF);
          console.log('Masked 0x7FFF:', intVal & 0x7FFF);
          console.log('Masked 0x3FFF:', intVal & 0x3FFF);
          console.log('Masked 0x1FFF:', intVal & 0x1FFF);
        }
      }
    }

    console.log('\n=== DONE ===\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testPIDEncoding();
