/**
 * Check BLBM fields to find body type field
 */
const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function check() {
  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  console.log('Loading roster file...');
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  // Access BLBM
  const blobRec = file.BLOB?._records?.[0];
  const fields = blobRec?.fields || blobRec?._fields;
  const blbm = fields?.['BLBM']?.value || fields?.['BLBM'];

  if (!blbm?._records) {
    console.error('Could not find BLBM');
    return;
  }

  console.log(`Found ${blbm._records.length} BLBM records\n`);

  // Get first record and show ALL fields
  const firstRec = blbm._records[0];
  const f = firstRec.fields || firstRec._fields;

  console.log('=== ALL BLBM FIELD NAMES ===');
  const fieldNames = Object.keys(f || {}).sort();
  console.log(fieldNames.join(', '));

  // Show simple fields only (skip LOUT which is circular)
  console.log('\n=== BLBM FIELD VALUES (first record) ===');
  for (const key of fieldNames) {
    if (key === 'LOUT') continue; // Skip circular reference
    const val = f[key]?.value ?? f[key]?._value ?? f[key];
    console.log(`  ${key}: ${val}`);
  }

  // Get PLAY table to compare PCBT vs WLBS
  const playTable = file.PLAY;
  const players = playTable.records.map(rec => {
    const p = {};
    for (const fn in rec.fields) {
      p[fn] = rec.fields[fn].value;
    }
    return p;
  });

  console.log('\n=== PCBT (PLAY) vs WLBS (BLBM) for first 10 players ===');
  for (let i = 0; i < 10 && i < blbm._records.length; i++) {
    const rec = blbm._records[i];
    const rf = rec.fields || rec._fields;
    const wlbs = rf['WLBS']?.value ?? rf['WLBS']?._value;
    const player = players[i];
    const pcbt = player?.PCBT;
    const name = `${player?.PFNA || ''} ${player?.PLNA || ''}`.trim();
    console.log(`${i}: ${name.padEnd(20)} PCBT=${pcbt} WLBS=${wlbs}`);
  }

  // Distribution of WLBS values
  console.log('\n=== WLBS (BLBM) Distribution ===');
  const wlbsDist = {};
  for (const rec of blbm._records) {
    const rf = rec.fields || rec._fields;
    const wlbs = rf['WLBS']?.value ?? rf['WLBS']?._value;
    wlbsDist[wlbs] = (wlbsDist[wlbs] || 0) + 1;
  }
  Object.entries(wlbsDist).sort((a,b) => a[0] - b[0]).forEach(([k,v]) => {
    console.log(`  WLBS=${k}: ${v} players`);
  });

  // Distribution of PCBT values
  console.log('\n=== PCBT (PLAY) Distribution ===');
  const pcbtDist = {};
  for (const p of players) {
    pcbtDist[p.PCBT] = (pcbtDist[p.PCBT] || 0) + 1;
  }
  Object.entries(pcbtDist).sort((a,b) => a[0] - b[0]).forEach(([k,v]) => {
    console.log(`  PCBT=${k}: ${v} players`);
  });

  // Check WLBS ranges by PCBT to find the mapping
  console.log('\n=== WLBS by PCBT (to find mapping) ===');
  const wlbsByPcbt = {};
  for (let i = 0; i < players.length && i < blbm._records.length; i++) {
    const rec = blbm._records[i];
    const rf = rec.fields || rec._fields;
    const wlbs = rf['WLBS']?.value ?? rf['WLBS']?._value;
    const pcbt = players[i]?.PCBT;
    const pwgt = players[i]?.PWGT; // Weight in lbs
    if (!wlbsByPcbt[pcbt]) wlbsByPcbt[pcbt] = [];
    wlbsByPcbt[pcbt].push({ wlbs, pwgt });
  }

  for (const pcbt of [0, 1, 2, 3, 4]) {
    const entries = wlbsByPcbt[pcbt] || [];
    if (entries.length === 0) continue;
    const wlbsVals = entries.map(e => e.wlbs).filter(x => x !== undefined);
    const pwgtVals = entries.map(e => e.pwgt).filter(x => x !== undefined);
    const minW = Math.min(...wlbsVals);
    const maxW = Math.max(...wlbsVals);
    const avgW = Math.round(wlbsVals.reduce((a,b) => a+b, 0) / wlbsVals.length);
    const avgPwgt = Math.round(pwgtVals.reduce((a,b) => a+b, 0) / pwgtVals.length);
    console.log(`  PCBT=${pcbt}: WLBS range ${minW}-${maxW}, avg=${avgW} (avg PWGT=${avgPwgt} lbs)`);
  }
}

check().catch(e => console.error('Error:', e.message));
