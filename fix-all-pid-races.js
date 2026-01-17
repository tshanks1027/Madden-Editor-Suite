const fs = require('fs');
const Papa = require('papaparse');

const pidMappingPath = './data/lookups/PID_Portrait_Mapping.csv';

// WHITE LEGENDS (Race=1) - comprehensive list
const whiteLegends = new Set([
  // QBs
  'Roger Staubach', 'Danny White', 'Troy Aikman', 'Terry Bradshaw', 'John Elway',
  'Brett Favre', 'Dan Fouts', 'Joe Montana', 'Dan Marino', 'Joe Namath',
  'Fran Tarkenton', 'Johnny Unitas', 'Bart Starr', 'Bob Griese', 'Phil Simms',
  'Boomer Esiason', 'Jim Kelly', 'Drew Brees', 'Aaron Rodgers', 'Tom Brady',
  'Peyton Manning', 'Eli Manning', 'Matthew Stafford', 'Ben Roethlisberger',
  'Matt Ryan', 'Carson Palmer', 'Philip Rivers', 'Matt Hasselbeck', 'Kurt Warner',
  'Steve Young', 'Rich Gannon', 'Vinny Testaverde', 'Jim Plunkett', 'Ken Stabler',
  'Craig Morton', 'Ron Jaworski', 'Jim Hart', 'Brian Sipe', 'Dave Krieg',
  'Archie Manning', 'Ken Anderson', 'Dan Pastorini', 'Bob Lee', 'Jim Zorn',
  'Joe Theismann', 'Neil Lomax', 'Tommy Kramer', 'Jim McMahon', 'Jay Cutler',
  'Tony Romo', 'Andy Dalton', 'Joe Flacco', 'Sam Bradford', 'Nick Foles',
  'Case Keenum', 'Kirk Cousins', 'Jimmy Garoppolo', 'Jared Goff', 'Baker Mayfield',
  'Joe Burrow', 'Justin Herbert', 'Trevor Lawrence', 'Mac Jones', 'Tua Tagovailoa',
  'Sid Luckman', 'Otto Graham', 'Sammy Baugh', 'Bobby Layne', 'Norm Van Brocklin',
  'Y.A. Tittle', 'Sonny Jurgensen', 'Roman Gabriel', 'Len Dawson', 'Daryle Lamonica',

  // Kickers/Punters
  'Gary Anderson', 'Morten Andersen', 'Adam Vinatieri', 'Justin Tucker', 'Matt Prater',
  'Sebastian Janikowski', 'Phil Dawson', 'Jason Hanson', 'John Carney', 'Matt Stover',
  'Jeff Wilkins', 'Jay Feely', 'Robbie Gould', 'Stephen Gostkowski', 'Mason Crosby',
  'Pat McAfee', 'Shane Lechler', 'Ray Guy', 'Thomas Morstead', 'Johnny Hekker',
  'Andy Lee', 'Sam Martin', 'Britton Colquitt', 'Michael Koenen', 'Brian Moorman',
  'Sean Landeta', 'Chris Gardocki', 'Craig Hentrich', 'Bryan Barker', 'Tom Tupa',
  'Jan Stenerud', 'Nick Lowery', 'Norm Johnson', 'Eddie Murray', 'Chris Jacke',
  'Pete Stoyanovich', 'Steve Christie', 'Al Del Greco', 'Ryan Longwell', 'Jason Elam',

  // Linemen
  'Bruce Matthews', 'Steve Wisniewski', 'Matt Birk', 'Jeff Saturday', 'Kevin Mawae',
  'Tom Nalen', 'Olin Kreutz', 'Nick Mangold', 'Jason Kelce', 'Travis Frederick',
  'Alex Mack', 'Maurkice Pouncey', 'Mike Pouncey', 'David Andrews', 'Ryan Kalil',
  'Jordan Gross', 'Jake Long', 'Joe Thomas', 'Joe Staley', 'Andrew Whitworth',
  'Tyron Smith', 'Trent Williams', 'David Bakhtiari', 'Lane Johnson', 'Zack Martin',
  'Marshal Yanda', 'Kyle Long', 'Quenton Nelson', 'Wyatt Teller', 'Joel Bitonio',
  'Mike Webster', 'Dwight Stephenson', 'Jim Otto', 'Gene Upshaw', 'Art Shell',
  'Ron Mix', 'Bob Kuechenberg', 'Larry Little', 'Jim Langer', 'Jon Morris',
  'Russ Grimm', 'Joe Jacoby', 'Gary Zimmerman', 'Richmond Webb', 'Lomas Brown',

  // TEs
  'Dallas Clark', 'Tony Gonzalez', 'Jason Witten', 'Rob Gronkowski', 'Travis Kelce',
  'George Kittle', 'Zach Ertz', 'Greg Olsen', 'Antonio Gates', 'Shannon Sharpe',
  'Todd Heap', 'Brent Jones', 'Ben Coates', 'Jay Novacek', 'Keith Jackson',
  'Kellen Winslow', 'Dave Casper', 'Charlie Sanders', 'John Mackey', 'Mike Ditka',

  // WRs (white)
  'Wayne Chrebet', 'Ed McCaffrey', 'Wes Welker', 'Julian Edelman', 'Danny Amendola',
  'Cole Beasley', 'Adam Thielen', 'Cooper Kupp', 'Hunter Renfrow', 'Jordy Nelson',
  'Ricky Proehl', 'Brandon Stokley', 'Kevin Curtis', 'Chris Hogan', 'Riley Cooper',

  // RBs (white)
  'Christian McCaffrey', 'Peyton Hillis', 'Danny Woodhead', 'Rex Burkhead',
  'John Kuhn', 'Toby Gerhart', 'Brian Leonard', 'Tyler Ervin',

  // LBs
  'Bill Bates', 'Brian Urlacher', 'Luke Kuechly', 'AJ Hawk', 'Paul Posluszny',
  'Chad Greenway', 'Clay Matthews', 'Zach Thomas', 'Chris Spielman', 'Jack Lambert',
  'Jack Ham', 'Mike Singletary', 'Dick Butkus', 'Chuck Bednarik', 'Sam Huff',
  'Tommy Nobis', 'Lee Roy Jordan', 'Nick Buoniconti', 'Karl Mecklenburg', 'Bill Romanowski',

  // DL
  'Howie Long', 'Kevin Greene', 'Chris Doleman', 'Jared Allen', 'JJ Watt',
  'Joey Bosa', 'Nick Bosa', 'Chandler Jones', 'Cameron Jordan', 'Brandon Graham',
  'Trey Hendrickson', 'Maxx Crosby', 'Carl Nassib', 'Chase Young', 'Myles Garrett',
  'Dan Hampton', 'Richard Dent', 'Steve McMichael', 'Jim Marshall', 'Carl Eller',
  'Alan Page', 'Gary Larsen', 'Bob Lilly', 'Randy White', 'Harvey Martin',
  'Ed Too Tall Jones', 'John Randle', 'Chris Doleman', 'Henry Thomas',

  // DBs
  'Paul Krause (R)', 'Paul Krause', 'Brian Dawkins', 'John Lynch', 'Harrison Smith',
  'Eric Weddle', 'Tyrann Mathieu', 'Jordan Poyer', 'Jessie Bates', 'Kevin Byard',
  'Minkah Fitzpatrick', 'Budda Baker', 'Derwin James', 'Kyle Hamilton',
  'Jack Christiansen', 'Yale Lary', 'Dick LeBeau', 'Lem Barney', 'Jack Tatum',
  'Kenny Easley', 'Steve Atwater', 'LeRoy Butler', 'Darren Sharper', 'Troy Polamalu',
  'Ed Reed', 'Bob Sanders', 'Adrian Wilson', 'Kam Chancellor', 'Earl Thomas',

  // Other white legends
  'Ted Hendricks (R)', 'Ted Hendricks', 'Ken Houston (R)', 'Ken Houston',
  'Joe Jurevicius', 'Marc Bulger', 'Charlie Batch', 'Chris Chandler',
]);

// HISPANIC/PACIFIC ISLANDER LEGENDS (Race=5)
const hispanicLegends = new Set([
  'Anthony Munoz', 'Tony Gonzalez', 'Tony Romo', 'Mark Sanchez',
  'Jim Plunkett', 'Jeff Garcia', 'Tony Casillas', 'Jesse Sapolu',
  'Junior Seau', 'Manu Tuiasosopo', 'Marcus Mariota', 'Tua Tagovailoa',
  'Jordan Mailata', 'Penei Sewell', 'Zach Banner', 'Vita Vea', 'Danny Shelton',
  'Haloti Ngata', 'Star Lotulelei', 'Akiem Hicks', 'Poona Ford',
  'Ma\'a Tanuvasa', 'Chris Mims', 'Manu Tuiasosopo',
]);

// BLACK LEGENDS (Race=7) - for reference, these will be confirmed
const blackLegends = new Set([
  // These were already correctly set, just confirming key ones
  'Willie Anderson', 'Steve Atwater', 'Tim Brown', 'Terrell Davis',
  'Randall McDaniel', 'Lorenzo Neal', 'Willie Roaf', 'Shannon Sharpe',
  'Bruce Smith', 'Michael Strahan', 'Aeneas Williams', 'Bryant Young',
  'Mel Blount', 'Dermontti Dawson', 'Marcus Allen', 'Bobby Bell',
  'Keith Bulluck', 'Corey Dillon', 'Donald Driver', 'Merton Hanks',
  'Marvin Harrison', 'John Henderson', 'Torry Holt', 'Willie Lanier',
  'Ty Law', 'Deuce McAllister', 'Herman Moore', 'Christian Okoye',
  'Clinton Portis', 'Drew Pearson', 'Emmitt Smith', 'Barry Sanders',
  'Walter Payton', 'Jim Brown', 'Eric Dickerson', 'Marshall Faulk',
  'LaDainian Tomlinson', 'Adrian Peterson', 'Randy Moss', 'Terrell Owens',
  'Calvin Johnson', 'DeAndre Hopkins', 'Julio Jones', 'Deion Sanders',
  'Rod Woodson', 'Champ Bailey', 'Charles Woodson', 'Ed Reed', 'Ray Lewis',
  'Lawrence Taylor', 'Derrick Thomas', 'Reggie White', 'Deacon Jones',
  'Mean Joe Greene', 'Michael Irvin', 'Jerry Rice', 'Cris Carter',
  'Andre Johnson', 'Larry Fitzgerald', 'Steve Smith', 'Anquan Boldin',
  'Reggie Wayne', 'Chad Johnson', 'Brandon Marshall', 'Dez Bryant',
  'Odell Beckham Jr', 'AJ Green', 'Mike Evans', 'Antonio Brown',
  'Tyreek Hill', 'Davante Adams', 'Stefon Diggs', 'DK Metcalf',
  'Alan Page', 'Gino Marchetti', 'Carl Eller', 'John Randle', 'Warren Sapp',
]);

// Load and process PID_Portrait_Mapping.csv
const pidContent = fs.readFileSync(pidMappingPath, 'utf8');
const pidParsed = Papa.parse(pidContent, { header: true, skipEmptyLines: true });

let whiteUpdated = 0;
let hispanicUpdated = 0;
let blackConfirmed = 0;
let unchanged = 0;

for (const row of pidParsed.data) {
  const playerName = (row['Player Name'] || '').trim();
  const currentRace = row['Race'];

  if (whiteLegends.has(playerName)) {
    if (currentRace !== '1') {
      row['Race'] = '1';
      whiteUpdated++;
      console.log(`WHITE: ${playerName} (was ${currentRace})`);
    }
  } else if (hispanicLegends.has(playerName)) {
    if (currentRace !== '5') {
      row['Race'] = '5';
      hispanicUpdated++;
      console.log(`HISPANIC: ${playerName} (was ${currentRace})`);
    }
  } else if (blackLegends.has(playerName)) {
    row['Race'] = '7';
    blackConfirmed++;
  } else {
    // Keep as is (default 7)
    unchanged++;
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`White legends updated: ${whiteUpdated}`);
console.log(`Hispanic legends updated: ${hispanicUpdated}`);
console.log(`Black legends confirmed: ${blackConfirmed}`);
console.log(`Unchanged (defaulted to black): ${unchanged}`);

// Write back
const output = Papa.unparse(pidParsed.data, { header: true });
fs.writeFileSync(pidMappingPath, output, 'utf8');
console.log(`\nSaved updated PID_Portrait_Mapping.csv`);

// Verify Staubach specifically
const staubach = pidParsed.data.find(r => r['Player Name'] === 'Roger Staubach');
if (staubach) {
  console.log(`\nVerification - Roger Staubach: PID=${staubach.PID}, Race=${staubach.Race}`);
}
