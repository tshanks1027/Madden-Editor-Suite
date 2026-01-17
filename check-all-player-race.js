const fs = require('fs');
const Papa = require('papaparse');
const content = fs.readFileSync('./data/lookups/ALL_PLAYER_LOOKUP.csv', 'utf8');
const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });

const withRace = parsed.data.filter(r => r.Race && r.Race.trim() !== '');
const withPhoto = parsed.data.filter(r => (r.Wiki_Image_URL && r.Wiki_Image_URL.trim() !== '') || (r.PFR_Image_URL && r.PFR_Image_URL.trim() !== ''));
const withBothPhotoAndRace = parsed.data.filter(r => r.Race && r.Race.trim() !== '' && ((r.Wiki_Image_URL && r.Wiki_Image_URL.trim() !== '') || (r.PFR_Image_URL && r.PFR_Image_URL.trim() !== '')));

console.log('Total rows:', parsed.data.length);
console.log('With Race:', withRace.length);
console.log('With Photo URL:', withPhoto.length);
console.log('With both Race AND Photo:', withBothPhotoAndRace.length);
console.log('');

const noRaceWithPhoto = parsed.data.filter(r => (!r.Race || r.Race.trim() === '') && ((r.Wiki_Image_URL && r.Wiki_Image_URL.trim() !== '') || (r.PFR_Image_URL && r.PFR_Image_URL.trim() !== '')));
console.log('Have Photo but NO race assigned:', noRaceWithPhoto.length);
console.log('');
console.log('Sample rows with photo but NO race:');
noRaceWithPhoto.slice(0, 10).forEach(r => {
  const url = r.Wiki_Image_URL || r.PFR_Image_URL || '';
  console.log(`  ${r['First Name']} ${r['Last Name']} - ${url.substring(0, 80)}...`);
});
