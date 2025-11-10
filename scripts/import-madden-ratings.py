#!/usr/bin/env python3
"""
Import Madden Ratings into ROSTER_lookup.csv

Safely imports missing years (2002, 2007, 2008, 2013-2020, 2022) with proper team labeling.
See docs/plans/2025-01-08-madden-ratings-import-design.md for full design.
"""

import pandas as pd
import os
import sys
from datetime import datetime
from pathlib import Path
import argparse

# ============================================================================
# CONFIGURATION
# ============================================================================

BASE_DIR = Path(__file__).parent.parent
MADDEN_DIR = BASE_DIR / "data" / "Madden Old Ratings"
LOOKUP_FILE = BASE_DIR / "data" / "lookups" / "ROSTER_lookup.csv"
PREVIEW_FILE = BASE_DIR / "data" / "lookups" / "ROSTER_lookup_PREVIEW.csv"
VALIDATION_REPORT = BASE_DIR / "import_validation_report.txt"
ERROR_LOG = BASE_DIR / "import_errors.log"

# Years to import and their configurations
YEARS_CONFIG = {
    2002: {"type": "single_file", "file": "2002 Rosters.xlsx", "sheet": "Player Ratings"},
    2004: {"type": "single_file", "file": "2004 Rosters.xlsx", "sheet": "Madden NFL 2004"},
    2007: {"type": "team_files", "dir": "2007", "pattern": "*_madden_nfl_07.xlsx"},
    2008: {"type": "team_files", "dir": "2008", "pattern": "*_madden_nfl_08.xlsx"},
    2013: {"type": "single_file", "file": "2013 Roster.xlsx"},
    2014: {"type": "single_file", "file": "2014 Rosters.xlsx"},
    2015: {"type": "single_file", "file": "2015 Roster.xlsx"},
    2016: {"type": "single_file", "file": "2016 Rosters.xlsx"},
    2017: {"type": "single_file", "file": "2017 Rosters.xlsx"},
    2018: {"type": "single_file", "file": "2018 Rosters.xlsx"},
    2019: {"type": "single_file", "file": "2019 Rosters.xlsx"},
    2020: {"type": "single_file", "file": "2020 Rosters.xlsx"},
    2022: {"type": "single_file", "file": "2022 Rosters.xlsx"},
}

# Team name normalization
TEAM_NORMALIZATIONS = {
    "Arizona Cardinals": "Cardinals",
    "Atlanta Falcons": "Falcons",
    "Baltimore Ravens": "Ravens",
    "Buffalo Bills": "Bills",
    "Carolina Panthers": "Panthers",
    "Chicago Bears": "Bears",
    "Cincinnati Bengals": "Bengals",
    "Cleveland Browns": "Browns",
    "Dallas Cowboys": "Cowboys",
    "Denver Broncos": "Broncos",
    "Detroit Lions": "Lions",
    "Green Bay Packers": "Packers",
    "Houston Texans": "Texans",
    "Indianapolis Colts": "Colts",
    "Jacksonville Jaguars": "Jaguars",
    "Kansas City Chiefs": "Chiefs",
    "Miami Dolphins": "Dolphins",
    "Minnesota Vikings": "Vikings",
    "New England Patriots": "Patriots",
    "New Orleans Saints": "Saints",
    "New York Giants": "Giants",
    "New York Jets": "Jets",
    "Oakland Raiders": "Raiders",
    "Philadelphia Eagles": "Eagles",
    "Pittsburgh Steelers": "Steelers",
    "San Diego Chargers": "Chargers",
    "San Francisco 49Ers": "49ers",
    "Seattle Seahawks": "Seahawks",
    "St. Louis Rams": "Rams",
    "Tampa Bay Buccaneers": "Buccaneers",
    "Tennessee Titans": "Titans",
    "Washington Redskins": "Redskins",
    "Bucs": "Buccaneers",
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def log_error(message):
    """Log error message to file and console"""
    with open(ERROR_LOG, 'a') as f:
        f.write(f"{datetime.now()}: {message}\n")
    print(f"  [WARNING] {message}")

def normalize_team_name(team_name, year):
    """Normalize team name to short format"""
    if pd.isna(team_name) or team_name == "":
        return None

    team_str = str(team_name).strip()

    # Handle free agents
    if team_str.lower() in ["free agent", "free agents"]:
        return f"{year} Free Agents"

    # Check direct mapping
    if team_str in TEAM_NORMALIZATIONS:
        return TEAM_NORMALIZATIONS[team_str]

    # Already in short format
    return team_str

def safe_int(value, default=0):
    """Safely convert value to int"""
    if pd.isna(value):
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default

def safe_str(value, default=""):
    """Safely convert value to string"""
    if pd.isna(value):
        return default
    return str(value).strip()

# ============================================================================
# COLUMN MAPPING
# ============================================================================

def map_2002_format(df, year):
    """Map 2002 format to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = df['Team'].apply(lambda x: normalize_team_name(x, year))
    mapped['First_Name'] = df['First Name'].apply(safe_str)
    mapped['Last_Name'] = df['Last Name'].apply(safe_str)
    mapped['Player_Name'] = mapped['First_Name'] + ' ' + mapped['Last_Name']
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['Jersey'] = df['Number'].apply(safe_int)
    mapped['Age'] = df['Age'].apply(safe_int)
    mapped['Height'] = df['Height'].apply(safe_int)
    mapped['Weight'] = df['Weight'].apply(safe_int)
    mapped['POVR'] = df['Overall'].apply(safe_int)
    mapped['PSPD'] = df['Speed'].apply(safe_int)
    mapped['PACC'] = df['Acceleration'].apply(safe_int)
    mapped['PSTR'] = df['Strength'].apply(safe_int)
    mapped['PAGI'] = df['Agility'].apply(safe_int)
    mapped['PAWR'] = df['Awareness'].apply(safe_int)
    mapped['PCTH'] = df['Catching'].apply(safe_int)
    mapped['PCAR'] = df['Carrying'].apply(safe_int)
    mapped['PTHP'] = df['Throw Power'].apply(safe_int)
    mapped['PRBK'] = df['Run Block'].apply(safe_int)
    mapped['PPBK'] = df['Pass Block'].apply(safe_int)
    mapped['PTAK'] = df['Tackle'].apply(safe_int)
    mapped['PBTK'] = df['Break Tackle'].apply(safe_int)
    mapped['PJMP'] = df['Jumping'].apply(safe_int)
    mapped['PKPW'] = df['Kick Power'].apply(safe_int)
    mapped['PKAC'] = df['Kick Accuracy'].apply(safe_int)
    mapped['PINJ'] = df['Injury'].apply(safe_int)
    mapped['PSTA'] = df['Stamina'].apply(safe_int)
    mapped['PTGH'] = df['Toughness'].apply(safe_int)
    mapped['YearsPro'] = df['Years Pro'].apply(safe_str)

    return mapped

def map_2004_format(df, year):
    """Map 2004 format (single Name column) to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows

    # Split Name column into First and Last
    if 'Name' in df.columns:
        names = df['Name'].str.split(' ', n=1, expand=True)
        mapped['First_Name'] = names[0].apply(safe_str) if 0 in names.columns else ""
        mapped['Last_Name'] = names[1].apply(safe_str) if 1 in names.columns else ""
    mapped['Player_Name'] = df['Name'].apply(safe_str)

    mapped['Season_Team'] = df['Team'].apply(lambda x: normalize_team_name(x, year))
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['POVR'] = df['Overall'].apply(safe_int)
    mapped['Age'] = df['Age'].apply(safe_int)
    mapped['PSPD'] = df['Speed'].apply(safe_int)
    mapped['PSTR'] = df['Strength'].apply(safe_int)
    mapped['PAWR'] = df['Awareness'].apply(safe_int)
    mapped['PAGI'] = df['Agility'].apply(safe_int)
    mapped['PACC'] = df['Acceleration'].apply(safe_int)
    mapped['PCTH'] = df['Catching'].apply(safe_int)
    mapped['PCAR'] = df['Carrying'].apply(safe_int)
    mapped['PJMP'] = df['Jumping'].apply(safe_int)
    mapped['PTAK'] = df['Tackle'].apply(safe_int)
    mapped['PTHP'] = df['Throw Power'].apply(safe_int)
    mapped['PPBK'] = df['Pass Block'].apply(safe_int)
    mapped['PRBK'] = df['Run Block'].apply(safe_int)
    mapped['PKPW'] = df['Kick Power'].apply(safe_int)
    mapped['PKAC'] = df['Kick Accuracy'].apply(safe_int)
    mapped['PINJ'] = df['Injury'].apply(safe_int)
    mapped['PSTA'] = df['Stamina'].apply(safe_int)
    mapped['PTGH'] = df['Toughness'].apply(safe_int)

    # Map single Throw Accuracy to all three
    if 'Throw Accuracy' in df.columns:
        throw_acc = df['Throw Accuracy'].apply(safe_int)
        mapped['PTAS'] = throw_acc
        mapped['PTAM'] = throw_acc
        mapped['PTAD'] = throw_acc

    # 2004-specific columns
    if 'Break Tackle' in df.columns:
        mapped['PBTK'] = df['Break Tackle'].apply(safe_int)
    if 'Kick Return' in df.columns:
        mapped['PKRT'] = df['Kick Return'].apply(safe_int)

    return mapped

def map_2007_format(df, year, team_name):
    """Map 2007/2008 format (PLYR_ prefix) to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = [normalize_team_name(team_name, year)] * n_rows
    mapped['First_Name'] = df['PLYR_FIRSTNAME'].apply(safe_str)
    mapped['Last_Name'] = df['PLYR_LASTNAME'].apply(safe_str)
    mapped['Player_Name'] = mapped['First_Name'] + ' ' + mapped['Last_Name']
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['Jersey'] = df['PLYR_JERSEYNUM'].apply(safe_int)
    mapped['POVR'] = df['PLYR_OVERALLRATING'].apply(safe_int)
    mapped['PSPD'] = df['PLYR_SPEED'].apply(safe_int)
    mapped['PACC'] = df['PLYR_ACCELERATION'].apply(safe_int)
    mapped['PSTR'] = df['PLYR_STRENGTH'].apply(safe_int)
    mapped['PAGI'] = df['PLYR_AGILITY'].apply(safe_int)
    mapped['PAWR'] = df['PLYR_AWARENESS'].apply(safe_int)
    mapped['PCTH'] = df['PLYR_CATCHING'].apply(safe_int)
    mapped['PCAR'] = df['PLYR_CARRYING'].apply(safe_int)
    mapped['PTHP'] = df['PLYR_THROWPOWER'].apply(safe_int)
    mapped['PRBK'] = df['PLYR_RUNBLOCK'].apply(safe_int)
    mapped['PPBK'] = df['PLYR_PASSBLOCK'].apply(safe_int)
    mapped['PTAK'] = df['PLYR_TACKLE'].apply(safe_int)
    mapped['PJMP'] = df['PLYR_JUMPING'].apply(safe_int)
    mapped['PKPW'] = df['PLYR_KICKPOWER'].apply(safe_int)
    mapped['PKAC'] = df['PLYR_KICKACCURACY'].apply(safe_int)
    mapped['PINJ'] = df['PLYR_INJURY'].apply(safe_int)
    mapped['PSTA'] = df['PLYR_STAMINA'].apply(safe_int)
    mapped['PTGH'] = df['PLYR_TOUGHNESS'].apply(safe_int)
    mapped['PTRK'] = df['PLYR_TRUCKING'].apply(safe_int)
    mapped['PCOD'] = df['PLYR_ELUSIVENESS'].apply(safe_int)
    mapped['PBCV'] = df['PLYR_BCVISION'].apply(safe_int)
    mapped['PSTF'] = df['PLYR_STIFFARM'].apply(safe_int)
    mapped['PSPM'] = df['PLYR_SPINMOVE'].apply(safe_int)
    mapped['PJUM'] = df['PLYR_JUKEMOVE'].apply(safe_int)
    mapped['PIBL'] = df['PLYR_IMPACTBLOCKING'].apply(safe_int)
    mapped['PRBP'] = df['PLYR_RUNBLOCKSTRENGTH'].apply(safe_int)
    mapped['PRBF'] = df['PLYR_RUNBLOCKFOOTWORK'].apply(safe_int)
    mapped['PPBP'] = df['PLYR_PASSBLOCKSTRENGTH'].apply(safe_int)
    mapped['PPBF'] = df['PLYR_PASSBLOCKFOOTWORK'].apply(safe_int)
    mapped['PPWM'] = df['PLYR_POWERMOVES'].apply(safe_int)
    mapped['PFNM'] = df['PLYR_FINESSEMOVES'].apply(safe_int)
    mapped['PBSH'] = df['PLYR_BLOCKSHEDDING'].apply(safe_int)
    mapped['PPUR'] = df['PLYR_PURSUIT'].apply(safe_int)
    mapped['PPRC'] = df['PLYR_PLAYRECOGNITION'].apply(safe_int)
    mapped['PMCV'] = df['PLYR_MANCOVERAGE'].apply(safe_int)
    mapped['PZCV'] = df['PLYR_ZONECOVERAGE'].apply(safe_int)

    # Map single throw accuracy to all three
    if 'PLYR_THROWACCURACY' in df.columns:
        throw_acc = df['PLYR_THROWACCURACY'].apply(safe_int)
        mapped['PTAS'] = throw_acc
        mapped['PTAM'] = throw_acc
        mapped['PTAD'] = throw_acc

    return mapped

def map_2013_format(df, year):
    """Map 2013+ format to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = df['Team'].apply(lambda x: normalize_team_name(x, year))
    mapped['First_Name'] = df['First Name'].apply(safe_str)
    mapped['Last_Name'] = df['Last Name'].apply(safe_str)
    mapped['Player_Name'] = mapped['First_Name'] + ' ' + mapped['Last_Name']
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['POVR'] = df['Overall'].apply(safe_int)
    mapped['PSPD'] = df['Speed'].apply(safe_int)
    mapped['PACC'] = df['Acceleration'].apply(safe_int)
    mapped['PSTR'] = df['Strength'].apply(safe_int)
    mapped['PAGI'] = df['Agility'].apply(safe_int)
    mapped['PAWR'] = df['Awareness'].apply(safe_int)
    mapped['PCTH'] = df['Catching'].apply(safe_int)
    mapped['PCAR'] = df['Carrying'].apply(safe_int)
    mapped['PTHP'] = df['Throw Power'].apply(safe_int)
    mapped['PRBK'] = df['Run Block'].apply(safe_int)
    mapped['PPBK'] = df['Pass Block'].apply(safe_int)
    mapped['PTAK'] = df['Tackle'].apply(safe_int)
    mapped['PJMP'] = df['Jumping'].apply(safe_int)
    mapped['PKPW'] = df['Kick Power'].apply(safe_int)
    mapped['PKAC'] = df['Kick Accuracy'].apply(safe_int)
    mapped['PINJ'] = df['Injury'].apply(safe_int)
    mapped['PSTA'] = df['Stamina'].apply(safe_int)
    mapped['PTGH'] = df['Toughness'].apply(safe_int)
    mapped['PTRK'] = df['Trucking'].apply(safe_int)
    mapped['PCOD'] = df['Elusiveness'].apply(safe_int)
    mapped['PBCV'] = df['Ball Carrier Vision'].apply(safe_int)
    mapped['PSTF'] = df['Stiff Arm'].apply(safe_int)
    mapped['PSPM'] = df['Spin Move'].apply(safe_int)
    mapped['PJUM'] = df['Juke Move'].apply(safe_int)
    mapped['PIBL'] = df['Impact Blocking'].apply(safe_int)
    mapped['PPWM'] = df['Power Moves'].apply(safe_int)
    mapped['PFNM'] = df['Finesse Moves'].apply(safe_int)
    mapped['PBSH'] = df['Block Shedding'].apply(safe_int)
    mapped['PPUR'] = df['Pursuit'].apply(safe_int)
    mapped['PPRC'] = df['Play Recognition'].apply(safe_int)
    mapped['PMCV'] = df['Man Coverage'].apply(safe_int)
    mapped['PZCV'] = df['Zone Coverage'].apply(safe_int)

    # Additional 2013+ columns
    if 'Spectacular Catch' in df.columns:
        mapped['PSPC'] = df['Spectacular Catch'].apply(safe_int)
    if 'Catch in Traffic' in df.columns:
        mapped['PCIT'] = df['Catch in Traffic'].apply(safe_int)
    if 'Route Running' in df.columns:
        mapped['PSRR'] = df['Route Running'].apply(safe_int)
    if 'Hit Power' in df.columns:
        mapped['PHTP'] = df['Hit Power'].apply(safe_int)
    if 'Press' in df.columns:
        mapped['PPRS'] = df['Press'].apply(safe_int)
    if 'Release' in df.columns:
        mapped['PREL'] = df['Release'].apply(safe_int)
    if 'Throw Accuracy Short' in df.columns:
        mapped['PTAS'] = df['Throw Accuracy Short'].apply(safe_int)
    if 'Throw Accuracy Mid' in df.columns:
        mapped['PTAM'] = df['Throw Accuracy Mid'].apply(safe_int)
    if 'Throw Accuracy Deep' in df.columns:
        mapped['PTAD'] = df['Throw Accuracy Deep'].apply(safe_int)
    if 'Play Action' in df.columns:
        mapped['PPLA'] = df['Play Action'].apply(safe_int)
    if 'Throw on Run' in df.columns:
        mapped['PTOR'] = df['Throw on Run'].apply(safe_int)

    return mapped

def map_2008_format(df, year, team_name):
    """Map 2008 format (underscore names) to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = [normalize_team_name(team_name, year)] * n_rows
    mapped['First_Name'] = df['First_Name'].apply(safe_str)
    mapped['Last_Name'] = df['Last_Name'].apply(safe_str)
    mapped['Player_Name'] = mapped['First_Name'] + ' ' + mapped['Last_Name']
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['Jersey'] = df['Jersey_#'].apply(safe_int)
    mapped['POVR'] = df['Overall_Rating'].apply(safe_int)
    mapped['PSPD'] = df['Speed'].apply(safe_int)
    mapped['PACC'] = df['Acceleration'].apply(safe_int)
    mapped['PSTR'] = df['Strength'].apply(safe_int)
    mapped['PAGI'] = df['Agility'].apply(safe_int)
    mapped['PAWR'] = df['Awareness'].apply(safe_int)
    mapped['PCTH'] = df['Catching'].apply(safe_int)
    mapped['PCAR'] = df['Carrying'].apply(safe_int)
    mapped['PTHP'] = df['Throw_Power'].apply(safe_int)
    mapped['PRBK'] = df['Run_Block'].apply(safe_int)
    mapped['PPBK'] = df['Pass_Block'].apply(safe_int)
    mapped['PTAK'] = df['Tackle'].apply(safe_int)
    mapped['PJMP'] = df['Jumping'].apply(safe_int)
    mapped['PKPW'] = df['Kick_Power'].apply(safe_int)
    mapped['PKAC'] = df['Kick_Accuracy'].apply(safe_int)
    mapped['PINJ'] = df['Injury'].apply(safe_int)
    mapped['PSTA'] = df['Stamina'].apply(safe_int)
    mapped['PTRK'] = df['Trucking'].apply(safe_int)
    mapped['PCOD'] = df['Elusiveness'].apply(safe_int)
    mapped['PBCV'] = df['BC_Vision'].apply(safe_int)
    mapped['PSTF'] = df['Stiff_Arm'].apply(safe_int)
    mapped['PSPM'] = df['Spin_Move'].apply(safe_int)
    mapped['PJUM'] = df['Juke_Move'].apply(safe_int)
    mapped['PIBL'] = df['Impact_Blocking'].apply(safe_int)
    mapped['PPWM'] = df['Power_Moves'].apply(safe_int)
    mapped['PFNM'] = df['Finesse_Moves'].apply(safe_int)
    mapped['PBSH'] = df['Block_Shedding'].apply(safe_int)
    mapped['PPUR'] = df['Pursuit'].apply(safe_int)
    mapped['PPRC'] = df['Play_Recognition'].apply(safe_int)
    mapped['PMCV'] = df['Man_Coverage'].apply(safe_int)
    mapped['PZCV'] = df['Zone_Coverage'].apply(safe_int)

    # Additional 2008 columns
    if 'Spectacular_Catch' in df.columns:
        mapped['PSPC'] = df['Spectacular_Catch'].apply(safe_int)
    if 'Catch_in_Traffic' in df.columns:
        mapped['PCIT'] = df['Catch_in_Traffic'].apply(safe_int)
    if 'Route_Running' in df.columns:
        mapped['PSRR'] = df['Route_Running'].apply(safe_int)
    if 'Hit_Power' in df.columns:
        mapped['PHTP'] = df['Hit_Power'].apply(safe_int)
    if 'Press' in df.columns:
        mapped['PPRS'] = df['Press'].apply(safe_int)
    if 'Release' in df.columns:
        mapped['PREL'] = df['Release'].apply(safe_int)
    if 'Throw_Accuracy' in df.columns:
        throw_acc = df['Throw_Accuracy'].apply(safe_int)
        mapped['PTAS'] = throw_acc
        mapped['PTAM'] = throw_acc
        mapped['PTAD'] = throw_acc

    return mapped

def map_2014_format(df, year):
    """Map 2014 format (has typo 'Stength') to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = df['Team'].apply(lambda x: normalize_team_name(x, year))
    mapped['First_Name'] = df['First Name'].apply(safe_str)
    mapped['Last_Name'] = df['Last Name'].apply(safe_str)
    mapped['Player_Name'] = mapped['First_Name'] + ' ' + mapped['Last_Name']
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['Jersey'] = df['Jersey'].apply(safe_int)
    mapped['Age'] = df['Age'].apply(safe_int)
    mapped['POVR'] = df['Overall'].apply(safe_int)
    mapped['PSPD'] = df['Speed'].apply(safe_int)
    mapped['PSTR'] = df['Stength'].apply(safe_int)  # Typo in source
    mapped['PAGI'] = df['Agility'].apply(safe_int)
    mapped['PAWR'] = df['Awareness'].apply(safe_int)
    mapped['PCTH'] = df['Catching'].apply(safe_int)
    mapped['PCAR'] = df['Carrying'].apply(safe_int)
    mapped['PTHP'] = df['Throw Power'].apply(safe_int)
    mapped['PRBK'] = df['Run Block'].apply(safe_int)
    mapped['PPBK'] = df['Pass Block'].apply(safe_int)
    mapped['PTAK'] = df['Tackle'].apply(safe_int)
    mapped['PJMP'] = df['Jumping'].apply(safe_int)
    mapped['PKPW'] = df['Kick Power'].apply(safe_int)
    mapped['PKAC'] = df['Kick Accuracy'].apply(safe_int)
    mapped['PINJ'] = df['Injury'].apply(safe_int)
    mapped['PSTA'] = df['Stamina'].apply(safe_int)
    mapped['PTGH'] = df['Toughness'].apply(safe_int)
    mapped['PTRK'] = df['Trucking'].apply(safe_int)
    mapped['PCOD'] = df['Elusiveness'].apply(safe_int)
    mapped['PBCV'] = df['Ball Carrier Vision'].apply(safe_int)
    mapped['PSTF'] = df['Stiff Arm'].apply(safe_int)
    mapped['PSPM'] = df['Spin Move'].apply(safe_int)
    mapped['PJUM'] = df['Juke Move'].apply(safe_int)
    mapped['PIBL'] = df['Impact Block'].apply(safe_int)  # Note: no 'ing'
    mapped['PRBP'] = df['Run Block Strength'].apply(safe_int)
    mapped['PRBF'] = df['Run Block Footwork'].apply(safe_int)
    mapped['PPBP'] = df['Pass Block Strength'].apply(safe_int)
    mapped['PPBF'] = df['Pass Block Footwork'].apply(safe_int)
    mapped['PPWM'] = df['Power Moves'].apply(safe_int)
    mapped['PFNM'] = df['Finnesse Moves'].apply(safe_int)  # Typo in source
    mapped['PBSH'] = df['Block Shedding'].apply(safe_int)
    mapped['PPUR'] = df['Pursuit'].apply(safe_int)
    mapped['PPRC'] = df['Play Recognition'].apply(safe_int)
    mapped['PMCV'] = df['Man Cover'].apply(safe_int)  # No 'age'
    mapped['PZCV'] = df['Zone cover'].apply(safe_int)  # Lowercase 'cover'
    mapped['PSPC'] = df['Spectacular Catch'].apply(safe_int)
    mapped['PCIT'] = df['Catch in Traffic'].apply(safe_int)
    mapped['PSRR'] = df['Route Running'].apply(safe_int)
    mapped['PHTP'] = df['Hit Power'].apply(safe_int)
    mapped['PPRS'] = df['Press'].apply(safe_int)
    mapped['PREL'] = df['Release'].apply(safe_int)
    mapped['PTAS'] = df['Short Throw Accuracy'].apply(safe_int)
    mapped['PTAM'] = df['Medium Throw Accuracy'].apply(safe_int)
    mapped['PTAD'] = df['Deep Throw Accuracy'].apply(safe_int)
    mapped['PPLA'] = df['Playaction'].apply(safe_int)  # No space
    mapped['PTOR'] = df['Throw on the Run'].apply(safe_int)
    mapped['YearsPro'] = df['Years Pro'].apply(safe_str)
    mapped['College'] = df['College'].apply(safe_str)

    return mapped

def map_2015_format(df, year):
    """Map 2015 format to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = df['Team'].apply(lambda x: normalize_team_name(x, year))
    mapped['First_Name'] = df['First Name'].apply(safe_str)
    mapped['Last_Name'] = df['Last Name'].apply(safe_str)
    mapped['Player_Name'] = mapped['First_Name'] + ' ' + mapped['Last_Name']
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['Jersey'] = df['Jersey'].apply(safe_int)
    mapped['POVR'] = df['Overall'].apply(safe_int)
    mapped['PSPD'] = df['Speed'].apply(safe_int)
    mapped['PACC'] = df['Acceleration'].apply(safe_int)
    mapped['PSTR'] = df['Strength'].apply(safe_int)
    mapped['PAGI'] = df['Agility'].apply(safe_int)
    mapped['PAWR'] = df['Awareness'].apply(safe_int)
    mapped['PCTH'] = df['Catching'].apply(safe_int)
    mapped['PCAR'] = df['Carrying'].apply(safe_int)
    mapped['PTHP'] = df['Throw Power'].apply(safe_int)
    mapped['PRBK'] = df['Run Block'].apply(safe_int)
    mapped['PPBK'] = df['Pass Block'].apply(safe_int)
    mapped['PTAK'] = df['Tackle'].apply(safe_int)
    mapped['PJMP'] = df['Jumping'].apply(safe_int)
    mapped['PKPW'] = df['Kick Power'].apply(safe_int)
    mapped['PKAC'] = df['Kick Accuracy'].apply(safe_int)
    mapped['PINJ'] = df['Injury'].apply(safe_int)
    mapped['PSTA'] = df['Stamina'].apply(safe_int)
    mapped['PTGH'] = df['Toughness'].apply(safe_int)
    mapped['PTRK'] = df['Trucking'].apply(safe_int)
    mapped['PCOD'] = df['Elusiveness'].apply(safe_int)
    mapped['PBCV'] = df['Ball Carrier Vision'].apply(safe_int)
    mapped['PSTF'] = df['Stiff Arm'].apply(safe_int)
    mapped['PSPM'] = df['Spin Move'].apply(safe_int)
    mapped['PJUM'] = df['Juke Move'].apply(safe_int)
    mapped['PIBL'] = df['Impact Block'].apply(safe_int)  # No 'ing'
    mapped['PPWM'] = df['Power Move'].apply(safe_int)  # Singular
    mapped['PFNM'] = df['Finessee Move'].apply(safe_int)  # Typo + Singular
    mapped['PBSH'] = df['Block Shedding'].apply(safe_int)
    mapped['PPUR'] = df['Pursuit'].apply(safe_int)
    mapped['PPRC'] = df['Play Recognition'].apply(safe_int)
    mapped['PMCV'] = df['Man Coverage'].apply(safe_int)
    mapped['PZCV'] = df['Zone Coverage'].apply(safe_int)
    mapped['PSPC'] = df['Spectacular Catch'].apply(safe_int)
    mapped['PCIT'] = df['Catch In Traffic'].apply(safe_int)  # Capital I
    mapped['PSRR'] = df['Route Running'].apply(safe_int)
    mapped['PHTP'] = df['Hit Power'].apply(safe_int)
    mapped['PPRS'] = df['Press'].apply(safe_int)
    mapped['PREL'] = df['Release'].apply(safe_int)
    mapped['PTAS'] = df['Throw Accuracy Short'].apply(safe_int)
    mapped['PTAM'] = df['Throw Accuracy Medium'].apply(safe_int)
    mapped['PTAD'] = df['Throw Accuracy Deep'].apply(safe_int)
    mapped['PPLA'] = df['Play Action'].apply(safe_int)
    mapped['PTOR'] = df['Throw On The Run'].apply(safe_int)  # Capital letters

    return mapped

def map_2016_format(df, year):
    """Map 2016 format to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = df['Team'].apply(lambda x: normalize_team_name(x, year))
    mapped['First_Name'] = df['First Name'].apply(safe_str)
    mapped['Last_Name'] = df['Last Name'].apply(safe_str)
    mapped['Player_Name'] = mapped['First_Name'] + ' ' + mapped['Last_Name']
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['Jersey'] = df['Jersey Number'].apply(safe_int)  # Different name
    mapped['Height'] = df['Height'].apply(safe_int)
    mapped['Weight'] = df['Weight'].apply(safe_int)
    mapped['POVR'] = df['OVR'].apply(safe_int)  # Abbreviated
    mapped['PSPD'] = df['Speed'].apply(safe_int)
    mapped['PACC'] = df['Acceleration'].apply(safe_int)
    mapped['PSTR'] = df['Strength'].apply(safe_int)
    mapped['PAGI'] = df['Agility'].apply(safe_int)
    mapped['PAWR'] = df['Awareness'].apply(safe_int)
    mapped['PCTH'] = df['Catching'].apply(safe_int)
    mapped['PCAR'] = df['Carrying'].apply(safe_int)
    mapped['PTHP'] = df['Throw Power'].apply(safe_int)
    mapped['PRBK'] = df['Run Block'].apply(safe_int)
    mapped['PPBK'] = df['Pass Block'].apply(safe_int)
    mapped['PTAK'] = df['Tackle'].apply(safe_int)
    mapped['PJMP'] = df['Jumping'].apply(safe_int)
    mapped['PKPW'] = df['Kick Power'].apply(safe_int)
    mapped['PKAC'] = df['Kick Accuracy'].apply(safe_int)
    mapped['PINJ'] = df['Injury'].apply(safe_int)
    mapped['PSTA'] = df['Stamina'].apply(safe_int)
    mapped['PTGH'] = df['Toughness'].apply(safe_int)
    mapped['PTRK'] = df['Trucking'].apply(safe_int)
    mapped['PCOD'] = df['Elusiveness'].apply(safe_int)
    mapped['PBCV'] = df['Ball Carrier Vision'].apply(safe_int)
    mapped['PSTF'] = df['Stiff Arm'].apply(safe_int)
    mapped['PSPM'] = df['Spin Move'].apply(safe_int)
    mapped['PJUM'] = df['Juke Move'].apply(safe_int)
    mapped['PIBL'] = df['Impact Block'].apply(safe_int)
    mapped['PPWM'] = df['Power Moves'].apply(safe_int)
    mapped['PFNM'] = df['Finesse Moves'].apply(safe_int)
    mapped['PBSH'] = df['Block Shedding'].apply(safe_int)
    mapped['PPUR'] = df['Pursuit'].apply(safe_int)
    mapped['PPRC'] = df['Play Recognition'].apply(safe_int)
    mapped['PMCV'] = df['Man Coverage'].apply(safe_int)
    mapped['PZCV'] = df['Zone Coverage'].apply(safe_int)
    mapped['PSPC'] = df['Spectactular Catch'].apply(safe_int)  # Typo in source
    mapped['PCIT'] = df['Catch In Traffic'].apply(safe_int)
    mapped['PSRR'] = df['Route Running'].apply(safe_int)
    mapped['PHTP'] = df['Hit Power'].apply(safe_int)
    mapped['PPRS'] = df['Press'].apply(safe_int)
    mapped['PREL'] = df['Release'].apply(safe_int)
    mapped['PTAS'] = df['Throw Accuracy Short'].apply(safe_int)
    mapped['PTAM'] = df['Throw Accuracy Mid'].apply(safe_int)
    mapped['PTAD'] = df['Throw Accuracy Deep'].apply(safe_int)
    mapped['PPLA'] = df['Play Action'].apply(safe_int)
    mapped['PTOR'] = df['Throw On The Run'].apply(safe_int)

    return mapped

def map_2017_format(df, year):
    """Map 2017 format (Last Name before First Name!) to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = df['Team'].apply(lambda x: normalize_team_name(x, year))
    mapped['First_Name'] = df['First Name'].apply(safe_str)  # Column order swapped in file
    mapped['Last_Name'] = df['Last Name'].apply(safe_str)
    mapped['Player_Name'] = mapped['First_Name'] + ' ' + mapped['Last_Name']
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['POVR'] = df['Overall'].apply(safe_int)
    mapped['PSPD'] = df['Speed'].apply(safe_int)
    mapped['PSTR'] = df['Strength'].apply(safe_int)
    mapped['PAGI'] = df['Agility'].apply(safe_int)
    mapped['PACC'] = df['Acceleration'].apply(safe_int)
    mapped['PAWR'] = df['Awareness'].apply(safe_int)
    mapped['PTRK'] = df['Trucking'].apply(safe_int)
    mapped['PCOD'] = df['Elusiveness'].apply(safe_int)
    mapped['PBCV'] = df['Ball Carrier Vision'].apply(safe_int)
    mapped['PSTF'] = df['Stiff Arm'].apply(safe_int)
    mapped['PSPM'] = df['Spin Move'].apply(safe_int)
    mapped['PJUM'] = df['Juke Move'].apply(safe_int)
    mapped['PCAR'] = df['Carrying'].apply(safe_int)
    mapped['PCTH'] = df['Catching'].apply(safe_int)
    mapped['PSRR'] = df['Route Running'].apply(safe_int)
    mapped['PCIT'] = df['Catch In Traffic'].apply(safe_int)
    mapped['PSPC'] = df['Spectacular Catch'].apply(safe_int)
    mapped['PREL'] = df['Release'].apply(safe_int)
    mapped['PJMP'] = df['Jumping'].apply(safe_int)
    mapped['PTHP'] = df['Throw Power'].apply(safe_int)
    mapped['PTAS'] = df['Short Accuracy'].apply(safe_int)
    mapped['PTAM'] = df['Middle Accuracy'].apply(safe_int)
    mapped['PTAD'] = df['Deep Accuracy'].apply(safe_int)
    mapped['PTOR'] = df['Throw On The Run'].apply(safe_int)
    mapped['PPLA'] = df['Play Action'].apply(safe_int)
    mapped['PTAK'] = df['Tackle'].apply(safe_int)
    mapped['PHTP'] = df['Hit Power'].apply(safe_int)
    mapped['PPWM'] = df['Power Moves'].apply(safe_int)
    mapped['PFNM'] = df['Finesse Moves'].apply(safe_int)
    mapped['PBSH'] = df['Block Shedding'].apply(safe_int)
    mapped['PPUR'] = df['Pursuit'].apply(safe_int)
    mapped['PPRC'] = df['Play Recognition'].apply(safe_int)
    mapped['PMCV'] = df['Man Coverage'].apply(safe_int)
    mapped['PZCV'] = df['Zone Coverage'].apply(safe_int)
    mapped['PPRS'] = df['Press'].apply(safe_int)
    mapped['PKPW'] = df['Kick Power'].apply(safe_int)
    mapped['PKAC'] = df['Kick Accuracy'].apply(safe_int)
    mapped['PIBL'] = df['Impact Blocking'].apply(safe_int)
    mapped['PRBK'] = df['Run Blocking'].apply(safe_int)  # 'ing' suffix
    mapped['PPBK'] = df['Pass Blocking'].apply(safe_int)
    mapped['PTGH'] = df['Toughness'].apply(safe_int)
    mapped['PSTA'] = df['Stamina'].apply(safe_int)
    mapped['PINJ'] = df['Injury'].apply(safe_int)

    return mapped

def map_2019_2020_format(df, year):
    """Map 2019/2020 format (single Name column) to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Split Name column into First and Last
    if 'Name' in df.columns:
        names = df['Name'].str.split(' ', n=1, expand=True)
        mapped['First_Name'] = names[0].apply(safe_str) if 0 in names.columns else ""
        mapped['Last_Name'] = names[1].apply(safe_str) if 1 in names.columns else ""
    mapped['Player_Name'] = df['Name'].apply(safe_str)

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = df['Team'].apply(lambda x: normalize_team_name(x, year))
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['POVR'] = df['Overall'].apply(safe_int)
    mapped['PAWR'] = df['Awareness'].apply(safe_int)
    mapped['PAGI'] = df['Agility'].apply(safe_int)
    mapped['PSPD'] = df['Speed'].apply(safe_int)
    mapped['PACC'] = df['Acceleration'].apply(safe_int)
    mapped['PSTR'] = df['Strength'].apply(safe_int)
    mapped['PSTA'] = df['Stamina'].apply(safe_int)
    mapped['PJMP'] = df['Jumping'].apply(safe_int)
    mapped['PINJ'] = df['Injury'].apply(safe_int)
    mapped['PTHP'] = df['Throw Power'].apply(safe_int)

    # Handle different column names between 2019 and 2020
    throw_short_col = 'Throw Accuracy Short' if 'Throw Accuracy Short' in df.columns else 'Short Throw Accuracy'
    throw_mid_col = 'Throw Accuracy Mid' if 'Throw Accuracy Mid' in df.columns else 'Medium Throw Accuracy'
    throw_deep_col = 'Throw Accuracy Deep' if 'Throw Accuracy Deep' in df.columns else 'Deep Throw Accruacy'  # Typo in 2020

    if throw_short_col in df.columns:
        mapped['PTAS'] = df[throw_short_col].apply(safe_int)
    if throw_mid_col in df.columns:
        mapped['PTAM'] = df[throw_mid_col].apply(safe_int)
    if throw_deep_col in df.columns:
        mapped['PTAD'] = df[throw_deep_col].apply(safe_int)

    if 'Throw on the Run' in df.columns:
        mapped['PTOR'] = df['Throw on the Run'].apply(safe_int)
    elif 'Throw On The Run' in df.columns:
        mapped['PTOR'] = df['Throw On The Run'].apply(safe_int)

    if 'Play Action' in df.columns:
        mapped['PPLA'] = df['Play Action'].apply(safe_int)

    mapped['PCAR'] = df['Carrying'].apply(safe_int)

    bcv_col = 'Ball Carrier Vision' if 'Ball Carrier Vision' in df.columns else 'BC Vision'
    if bcv_col in df.columns:
        mapped['PBCV'] = df[bcv_col].apply(safe_int)

    mapped['PBTK'] = df['Break Tackle'].apply(safe_int) if 'Break Tackle' in df.columns else 0
    mapped['PCOD'] = df['Elusiveness'].apply(safe_int)
    mapped['PSPM'] = df['Spin Move'].apply(safe_int)
    mapped['PTRK'] = df['Trucking'].apply(safe_int)
    mapped['PJUM'] = df['Juke Move'].apply(safe_int)
    mapped['PSTF'] = df['Stiff Arm'].apply(safe_int)
    mapped['PCTH'] = df['Catching'].apply(safe_int) if 'Catching' in df.columns else df['Catch'].apply(safe_int)
    mapped['PCIT'] = df['Catch in Traffic'].apply(safe_int)
    mapped['PSPC'] = df['Spectacular Catch'].apply(safe_int)

    # Route running columns
    if 'Short Route Runing' in df.columns:  # Typo in 2019
        mapped['PSRR'] = df['Short Route Runing'].apply(safe_int)
    elif 'Short Route Running' in df.columns:
        mapped['PSRR'] = df['Short Route Running'].apply(safe_int)

    mapped['PREL'] = df['Release'].apply(safe_int)
    mapped['PRBK'] = df['Run Block'].apply(safe_int)
    mapped['PPBK'] = df['Pass Block'].apply(safe_int)

    if 'Run Block Power' in df.columns:
        mapped['PRBP'] = df['Run Block Power'].apply(safe_int)
    if 'Pass Block Power' in df.columns:
        mapped['PPBP'] = df['Pass Block Power'].apply(safe_int)
    if 'Run Block Finesse' in df.columns:
        mapped['PRBF'] = df['Run Block Finesse'].apply(safe_int)
    if 'Pass Block Finesse' in df.columns:
        mapped['PPBF'] = df['Pass Block Finesse'].apply(safe_int)

    mapped['PIBL'] = df['Impact Blocking'].apply(safe_int)
    mapped['PPWM'] = df['Power Moves'].apply(safe_int)
    mapped['PFNM'] = df['Finesse Moves'].apply(safe_int)
    mapped['PBSH'] = df['Block Shedding'].apply(safe_int)
    mapped['PTAK'] = df['Tackle'].apply(safe_int)
    mapped['PPRC'] = df['Play Recognition'].apply(safe_int)
    mapped['PPUR'] = df['Pursuit'].apply(safe_int)
    mapped['PHTP'] = df['Hit Power'].apply(safe_int)
    mapped['PMCV'] = df['Man Coverage'].apply(safe_int)
    mapped['PZCV'] = df['Zone Coverage'].apply(safe_int)
    mapped['PPRS'] = df['Press'].apply(safe_int)
    mapped['PTGH'] = df['Toughness'].apply(safe_int)
    mapped['PKAC'] = df['Kick Accuracy'].apply(safe_int)
    mapped['PKPW'] = df['Kick Power'].apply(safe_int)

    # Additional columns
    if 'Age' in df.columns:
        mapped['Age'] = df['Age'].apply(safe_int)
    if 'Height' in df.columns:
        mapped['Height'] = df['Height'].apply(safe_int)
    if 'Weight' in df.columns:
        mapped['Weight'] = df['Weight'].apply(safe_int)
    if 'Years Pro' in df.columns:
        mapped['YearsPro'] = df['Years Pro'].apply(safe_str)
    elif 'Experience' in df.columns:
        mapped['YearsPro'] = df['Experience'].apply(safe_str)
    if 'College' in df.columns:
        mapped['College'] = df['College'].apply(safe_str)
    if 'Jersey #' in df.columns:
        mapped['Jersey'] = df['Jersey #'].apply(safe_int)
    elif 'Jersey' in df.columns:
        mapped['Jersey'] = df['Jersey'].apply(safe_int)

    return mapped

def map_2022_format(df, year):
    """Map 2022 format (Rating suffix on everything) to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = df['Team'].apply(lambda x: normalize_team_name(x, year))
    mapped['First_Name'] = df['FirstName'].apply(safe_str)  # No space
    mapped['Last_Name'] = df['LastName'].apply(safe_str)
    mapped['Player_Name'] = mapped['First_Name'] + ' ' + mapped['Last_Name']
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['Jersey'] = df['JerseyNum'].apply(safe_int)
    mapped['Height'] = df['Height'].apply(safe_int)
    mapped['Weight'] = df['Weight'].apply(safe_int)
    mapped['Age'] = df['Age'].apply(safe_int)
    mapped['YearsPro'] = df['YearsPro'].apply(safe_str)
    mapped['College'] = df['College'].apply(safe_str)
    mapped['Archetype'] = df['Archetype'].apply(safe_str)
    mapped['POVR'] = df['OverallRating'].apply(safe_int)
    mapped['PSPD'] = df['SpeedRating'].apply(safe_int)
    mapped['PACC'] = df['AccelerationRating'].apply(safe_int)
    mapped['PSTR'] = df['StrengthRating'].apply(safe_int)
    mapped['PAGI'] = df['AgilityRating'].apply(safe_int)
    mapped['PAWR'] = df['AwarenessRating'].apply(safe_int)
    mapped['PCTH'] = df['CatchingRating'].apply(safe_int)
    mapped['PCAR'] = df['CarryingRating'].apply(safe_int)
    mapped['PTHP'] = df['ThrowPowerRating'].apply(safe_int)
    mapped['PKPW'] = df['KickPowerRating'].apply(safe_int)
    mapped['PKAC'] = df['KickAccuracyRating'].apply(safe_int)
    mapped['PRBK'] = df['RunBlockRating'].apply(safe_int)
    mapped['PPBK'] = df['PassBlockRating'].apply(safe_int)
    mapped['PTAK'] = df['TackleRating'].apply(safe_int)
    mapped['PBTK'] = df['BreakTackleRating'].apply(safe_int)
    mapped['PJMP'] = df['JumpingRating'].apply(safe_int)
    mapped['PINJ'] = df['InjuryRating'].apply(safe_int)
    mapped['PSTA'] = df['StaminaRating'].apply(safe_int)
    mapped['PTGH'] = df['ToughnessRating'].apply(safe_int)
    mapped['PTRK'] = df['TruckingRating'].apply(safe_int)
    mapped['PCOD'] = df['ChangeOfDirectionRating'].apply(safe_int)
    mapped['PBCV'] = df['BCVisionRating'].apply(safe_int)
    mapped['PSTF'] = df['StiffArmRating'].apply(safe_int)
    mapped['PSPM'] = df['SpinMoveRating'].apply(safe_int)
    mapped['PJUM'] = df['JukeMoveRating'].apply(safe_int)
    mapped['PIBL'] = df['ImpactBlockingRating'].apply(safe_int)
    mapped['PRBP'] = df['RunBlockPowerRating'].apply(safe_int)
    mapped['PRBF'] = df['RunBlockFinesseRating'].apply(safe_int)
    mapped['PPBP'] = df['PassBlockPowerRating'].apply(safe_int)
    mapped['PPBF'] = df['PassBlockFinesseRating'].apply(safe_int)
    mapped['PPWM'] = df['PowerMovesRating'].apply(safe_int)
    mapped['PFNM'] = df['FinesseMovesRating'].apply(safe_int)
    mapped['PBSH'] = df['BlockSheddingRating'].apply(safe_int)
    mapped['PPUR'] = df['PursuitRating'].apply(safe_int)
    mapped['PPRC'] = df['PlayRecognitionRating'].apply(safe_int)
    mapped['PMCV'] = df['ManCoverageRating'].apply(safe_int)
    mapped['PZCV'] = df['ZoneCoverageRating'].apply(safe_int)
    mapped['PSPC'] = df['SpectacularCatchRating'].apply(safe_int)
    mapped['PCIT'] = df['CatchInTrafficRating'].apply(safe_int)
    mapped['PSRR'] = df['ShortRouteRunningRating'].apply(safe_int)
    mapped['PHTP'] = df['HitPowerRating'].apply(safe_int)
    mapped['PPRS'] = df['PressRating'].apply(safe_int)
    mapped['PREL'] = df['ReleaseRating'].apply(safe_int)
    mapped['PTAS'] = df['ThrowAccuracyShortRating'].apply(safe_int)
    mapped['PTAM'] = df['ThrowAccuracyMidRating'].apply(safe_int)
    mapped['PTAD'] = df['ThrowAccuracyDeepRating'].apply(safe_int)
    mapped['PPLA'] = df['PlayActionRating'].apply(safe_int)
    mapped['PTOR'] = df['ThrowOnTheRunRating'].apply(safe_int)

    return mapped

# ============================================================================
# PARSER FUNCTIONS
# ============================================================================

def parse_single_file(year, config):
    """Parse a single Excel file with all teams"""
    file_path = MADDEN_DIR / config['file']

    if not file_path.exists():
        log_error(f"File not found: {file_path}")
        return None

    try:
        sheet_name = config.get('sheet', 0)
        df = pd.read_excel(file_path, sheet_name=sheet_name)

        # Determine format and map based on year
        if year == 2002:
            mapped = map_2002_format(df, year)
        elif year == 2004:
            mapped = map_2004_format(df, year)
        elif year == 2013:
            mapped = map_2013_format(df, year)
        elif year == 2014:
            mapped = map_2014_format(df, year)
        elif year == 2015:
            mapped = map_2015_format(df, year)
        elif year == 2016:
            mapped = map_2016_format(df, year)
        elif year == 2017:
            mapped = map_2017_format(df, year)
        elif year == 2018:
            mapped = map_2013_format(df, year)  # Same format as 2013
        elif year in [2019, 2020]:
            mapped = map_2019_2020_format(df, year)
        elif year == 2022:
            mapped = map_2022_format(df, year)
        else:
            log_error(f"No mapping function for year {year}")
            return None

        # Filter out invalid rows
        valid_mask = (mapped['First_Name'] != "") & (mapped['Last_Name'] != "") & (mapped['Season_Team'].notna())
        skipped = len(mapped) - valid_mask.sum()
        if skipped > 0:
            log_error(f"Year {year}: Skipped {skipped} rows with missing name or team")

        return mapped[valid_mask]

    except Exception as e:
        log_error(f"Error parsing {file_path}: {e}")
        return None

def parse_team_files(year, config):
    """Parse individual team files (2007/2008)"""
    dir_path = MADDEN_DIR / config['dir']

    if not dir_path.exists():
        log_error(f"Directory not found: {dir_path}")
        return None

    all_data = []
    files = list(dir_path.glob(config['pattern']))

    if not files:
        log_error(f"No files found matching pattern: {config['pattern']} in {dir_path}")
        return None

    for file_path in files:
        try:
            # Extract team name from filename
            # Example: "arizona_cardinals_madden_nfl_07.xlsx"
            filename = file_path.stem
            team_parts = filename.replace(f"_madden_nfl_{str(year)[-2:]}", "").split("_")
            team_name = " ".join(team_parts).title()

            df = pd.read_excel(file_path, sheet_name=0)

            # Use appropriate mapper based on year
            if year == 2007:
                mapped = map_2007_format(df, year, team_name)
            elif year == 2008:
                mapped = map_2008_format(df, year, team_name)
            else:
                log_error(f"No team file mapping for year {year}")
                continue

            # Filter out invalid rows
            valid_mask = (mapped['First_Name'] != "") & (mapped['Last_Name'] != "") & (mapped['Season_Team'].notna())
            skipped = len(mapped) - valid_mask.sum()
            if skipped > 0:
                log_error(f"Year {year}, Team {team_name}: Skipped {skipped} rows")

            all_data.append(mapped[valid_mask])

        except Exception as e:
            log_error(f"Error parsing {file_path}: {e}")
            continue

    if all_data:
        return pd.concat(all_data, ignore_index=True)
    return None

# ============================================================================
# MAIN WORKFLOW
# ============================================================================

def create_backup():
    """Create timestamped backup of ROSTER_lookup.csv"""
    if not LOOKUP_FILE.exists():
        print(f"[ERROR] ROSTER_lookup.csv not found at: {LOOKUP_FILE}")
        return False

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = LOOKUP_FILE.parent / f"ROSTER_lookup_BACKUP_{timestamp}.csv"

    try:
        import shutil
        shutil.copy2(LOOKUP_FILE, backup_file)
        print(f"[OK] Backup created: {backup_file.name}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to create backup: {e}")
        return False

def validate_sources(years_to_import):
    """Validate all source files exist and are readable"""
    print("\n" + "="*80)
    print("VALIDATION PHASE")
    print("="*80)

    validation_results = {}

    for year in years_to_import:
        config = YEARS_CONFIG[year]
        print(f"\n[CHECK] Validating {year}...")

        if config['type'] == 'single_file':
            file_path = MADDEN_DIR / config['file']
            if file_path.exists():
                try:
                    sheet = config.get('sheet', 0)
                    df = pd.read_excel(file_path, sheet_name=sheet, nrows=5)
                    print(f"  [OK] File found: {config['file']}")
                    print(f"       Columns: {len(df.columns)}, Sample rows: {len(df)}")
                    validation_results[year] = True
                except Exception as e:
                    print(f"  [ERROR] Error reading file: {e}")
                    validation_results[year] = False
            else:
                print(f"  [ERROR] File not found: {config['file']}")
                validation_results[year] = False

        elif config['type'] == 'team_files':
            dir_path = MADDEN_DIR / config['dir']
            if dir_path.exists():
                files = list(dir_path.glob(config['pattern']))
                if files:
                    print(f"  [OK] Directory found: {config['dir']}")
                    print(f"       Team files: {len(files)}")
                    validation_results[year] = True
                else:
                    print(f"  [ERROR] No matching files in {config['dir']}")
                    validation_results[year] = False
            else:
                print(f"  [ERROR] Directory not found: {config['dir']}")
                validation_results[year] = False

    # Save validation report
    with open(VALIDATION_REPORT, 'w') as f:
        f.write("MADDEN RATINGS IMPORT - VALIDATION REPORT\n")
        f.write("="*80 + "\n")
        f.write(f"Timestamp: {datetime.now()}\n\n")
        for year, valid in validation_results.items():
            status = "[OK] VALID" if valid else "[ERROR] INVALID"
            f.write(f"{year}: {status}\n")

    valid_count = sum(validation_results.values())
    total_count = len(validation_results)

    print(f"\n[STATS] Validation Summary: {valid_count}/{total_count} years valid")
    print(f"[INFO] Report saved to: {VALIDATION_REPORT}")

    return validation_results

def dry_run(years_to_import, validation_results):
    """Process all files and create preview without modifying original"""
    print("\n" + "="*80)
    print("DRY-RUN PHASE")
    print("="*80)

    # Clear error log
    if ERROR_LOG.exists():
        ERROR_LOG.unlink()

    all_new_data = []
    stats = {}

    for year in years_to_import:
        if not validation_results.get(year, False):
            print(f"\n[SKIP] Skipping {year} (validation failed)")
            continue

        print(f"\n[IMPORT] Processing {year}...")
        config = YEARS_CONFIG[year]

        if config['type'] == 'single_file':
            data = parse_single_file(year, config)
        elif config['type'] == 'team_files':
            data = parse_team_files(year, config)
        else:
            log_error(f"Unknown config type for year {year}")
            continue

        if data is not None and not data.empty:
            all_new_data.append(data)
            teams = data['Season_Team'].value_counts()
            stats[year] = {
                'total_players': len(data),
                'teams': len(teams),
                'team_breakdown': teams.to_dict()
            }
            print(f"  [OK] Imported {len(data)} players from {len(teams)} teams")
        else:
            print(f"  [ERROR] No data imported for {year}")
            stats[year] = {'total_players': 0, 'teams': 0}

    if not all_new_data:
        print("\n[ERROR] No data to import!")
        return None, stats

    # Combine all new data
    new_df = pd.concat(all_new_data, ignore_index=True)

    # Load existing data
    existing_df = pd.read_csv(LOOKUP_FILE, low_memory=False)

    # Check for duplicates
    print(f"\n[CHECK] Checking for duplicates...")
    duplicate_mask = new_df.apply(
        lambda row: (
            (existing_df['Year'] == row['Year']) &
            (existing_df['Last_Name'] == row['Last_Name']) &
            (existing_df['First_Name'] == row['First_Name']) &
            (existing_df['Season_Team'] == row['Season_Team'])
        ).any(),
        axis=1
    )
    duplicates = duplicate_mask.sum()
    if duplicates > 0:
        print(f"  [WARNING] Found {duplicates} duplicate players (will be skipped)")
        new_df = new_df[~duplicate_mask]
    else:
        print(f"  [OK] No duplicates found")

    # Combine with existing data
    combined_df = pd.concat([existing_df, new_df], ignore_index=True)

    # Sort
    combined_df = combined_df.sort_values(['Year', 'Season_Team', 'Last_Name'], ignore_index=True)

    # Save preview
    combined_df.to_csv(PREVIEW_FILE, index=False)

    print(f"\n[STATS] Dry-Run Summary:")
    print(f"  Existing rows: {len(existing_df)}")
    print(f"  New rows: {len(new_df)}")
    print(f"  Total rows: {len(combined_df)}")
    print(f"\n[INFO] Preview saved to: {PREVIEW_FILE}")

    return new_df, stats

def apply_import():
    """Apply the preview to ROSTER_lookup.csv"""
    print("\n" + "="*80)
    print("IMPORT PHASE")
    print("="*80)

    if not PREVIEW_FILE.exists():
        print("[ERROR] Preview file not found! Run dry-run first.")
        return False

    try:
        import shutil
        shutil.copy2(PREVIEW_FILE, LOOKUP_FILE)
        print(f"[OK] Import complete! ROSTER_lookup.csv updated.")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to apply import: {e}")
        return False

def print_detailed_stats(stats):
    """Print detailed statistics per year"""
    print("\n" + "="*80)
    print("DETAILED STATISTICS")
    print("="*80)

    for year, data in sorted(stats.items()):
        if data['total_players'] == 0:
            continue

        print(f"\n[YEAR] {year}:")
        print(f"  Total players: {data['total_players']}")
        print(f"  Teams: {data['teams']}")
        print(f"  Team breakdown:")
        for team, count in sorted(data['team_breakdown'].items()):
            print(f"    {team}: {count} players")

# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='Import Madden ratings into ROSTER_lookup.csv')
    parser.add_argument('--years', help='Comma-separated years to import (e.g., 2007,2008)', default=None)
    parser.add_argument('--skip-validation', action='store_true', help='Skip validation phase')
    parser.add_argument('--auto-approve', action='store_true', help='Skip confirmations (DANGEROUS)')
    args = parser.parse_args()

    # Determine which years to import
    if args.years:
        years_to_import = [int(y.strip()) for y in args.years.split(',')]
    else:
        years_to_import = sorted(YEARS_CONFIG.keys())

    print("="*80)
    print("MADDEN RATINGS IMPORT TOOL")
    print("="*80)
    print(f"\nYears to import: {', '.join(map(str, years_to_import))}")
    print(f"Target file: {LOOKUP_FILE}")

    if not args.auto_approve:
        response = input("\n>> Continue? (y/n): ")
        if response.lower() not in ['y', 'yes']:
            print("Cancelled.")
            return

    # Step 1: Create backup
    if not create_backup():
        return

    # Step 2: Validation
    if not args.skip_validation:
        validation_results = validate_sources(years_to_import)

        if not args.auto_approve:
            response = input("\n>> Continue to dry-run? (y/n): ")
            if response.lower() not in ['y', 'yes']:
                print("Cancelled.")
                return
    else:
        validation_results = {year: True for year in years_to_import}

    # Step 3: Dry-run
    new_data, stats = dry_run(years_to_import, validation_results)

    if new_data is None:
        return

    # Print detailed stats
    print_detailed_stats(stats)

    if not args.auto_approve:
        print(f"\n[INFO] Review the preview file: {PREVIEW_FILE}")
        response = input("\n>> Apply changes to ROSTER_lookup.csv? (y/n): ")
        if response.lower() not in ['y', 'yes']:
            print("Cancelled. Preview file preserved for review.")
            return

    # Step 4: Apply import
    if apply_import():
        print("\n[SUCCESS] Data imported successfully.")
        print(f"   Backup location: {LOOKUP_FILE.parent}")
        if ERROR_LOG.exists():
            print(f"   [WARNING] Some rows were skipped. Check: {ERROR_LOG}")
    else:
        print("\n[ERROR] Import failed. Original file unchanged.")

if __name__ == '__main__':
    main()
