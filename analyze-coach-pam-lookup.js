// Analyze the CoachPAM_lookup.csv
const fs = require('fs');

const csv = fs.readFileSync('data/lookups/CoachPAM_lookup.csv', 'utf8');
const lines = csv.trim().split('\n');
const header = lines[0];
const data = lines.slice(1);

console.log('=== CoachPAM_lookup.csv Analysis ===\n');
console.log(`Total entries: ${data.length}\n`);

const withPamAndPid = [];
const withPamNoPid = [];
const withPidNoPam = [];
const neither = [];

data.forEach(line => {
  // Split by comma, handle trailing commas
  const parts = line.split(',');
  const lastName = (parts[0] || '').trim();
  const firstName = (parts[1] || '').trim();
  const pam = (parts[2] || '').trim();
  const pid = (parts[3] || '').trim();

  const hasPam = pam.length > 0;
  const hasPid = pid.length > 0;

  if (hasPam && hasPid) {
    withPamAndPid.push({ lastName, firstName, pam, pid });
  } else if (hasPam && !hasPid) {
    withPamNoPid.push({ lastName, firstName, pam });
  } else if (!hasPam && hasPid) {
    withPidNoPam.push({ lastName, firstName, pid });
  } else {
    neither.push({ lastName, firstName });
  }
});

console.log(`=== Coaches with PAM + PID (ready to use): ${withPamAndPid.length} ===`);
withPamAndPid.forEach(c => console.log(`  ${c.firstName} ${c.lastName}: PAM=${c.pam}, PID=${c.pid}`));

console.log(`\n=== Coaches with PAM but NO PID (need PID created): ${withPamNoPid.length} ===`);
withPamNoPid.forEach(c => console.log(`  ${c.firstName} ${c.lastName}: PAM=${c.pam}`));

console.log(`\n=== Owners with PID but NO PAM (portrait only): ${withPidNoPam.length} ===`);
withPidNoPam.forEach(c => console.log(`  ${c.firstName} ${c.lastName}: PID=${c.pid}`));

if (neither.length > 0) {
  console.log(`\n=== Neither PAM nor PID: ${neither.length} ===`);
  neither.forEach(c => console.log(`  ${c.firstName} ${c.lastName}`));
}
