import React, { useState, useEffect, useCallback } from 'react';
import { RosterGrid } from '../../components/DataGrid/RosterGrid';
import { usePositionFields } from '../../hooks/usePositionFields';

interface RosterEditorProps {
  filePath?: string;
}

export const RosterEditor: React.FC<RosterEditorProps> = ({ filePath }) => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [lookupReady, setLookupReady] = useState(false);

  // Position fields hook
  const {
    getRecommendedFields,
    getFieldCategories,
    isFieldVisible,
    visibleFields
  } = usePositionFields(selectedPosition, showAllColumns);

  // Check if lookup service is ready
  useEffect(() => {
    const checkLookupStatus = async () => {
      try {
        const ready = await window.electronAPI.lookup.isReady();
        setLookupReady(ready);

        if (!ready) {
          // Try to reload lookup service
          await window.electronAPI.lookup.reload();
          const retryReady = await window.electronAPI.lookup.isReady();
          setLookupReady(retryReady);
        }
      } catch (error) {
        console.error('Failed to check lookup status:', error);
        setError('Failed to initialize lookup system');
      }
    };

    checkLookupStatus();
  }, []);

  // Load roster file when filePath changes
  useEffect(() => {
    if (filePath && lookupReady) {
      loadRosterFile(filePath);
    }
  }, [filePath, lookupReady]);

  const loadRosterFile = async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      // First validate the file
      const validation = await window.electronAPI.file.validateMaddenFile(path);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid Madden file');
      }

      // Parse the roster file
      const rosterData = await window.electronAPI.parser.parseRosterFile(path);
      setPlayers(rosterData.players || []);

      console.log(`Loaded ${rosterData.players?.length || 0} players from roster file`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load roster file';
      setError(errorMessage);
      console.error('Error loading roster file:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerChange = useCallback((updatedPlayer: any) => {
    setPlayers(prevPlayers =>
      prevPlayers.map(player =>
        player.PGID === updatedPlayer.PGID ? updatedPlayer : player
      )
    );
  }, []);

  const handleSaveRoster = async () => {
    if (!filePath) {
      setError('No file path specified');
      return;
    }

    setLoading(true);
    try {
      // Create backup first
      await window.electronAPI.file.createBackup(filePath);

      // Build updated roster file
      const rosterBuffer = await window.electronAPI.parser.buildRosterFile(
        players,
        { version: 26 } // Assuming Madden 26
      );

      // Save the file
      await window.electronAPI.file.saveFile(filePath, rosterBuffer);

      console.log('Roster saved successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save roster';
      setError(errorMessage);
      console.error('Error saving roster:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate sample data for testing if no file is loaded
  useEffect(() => {
    if (!filePath && players.length === 0 && lookupReady) {
      const samplePlayers = [
        {
          PGID: 1,
          PLNA: 'Smith',
          PFNA: 'John',
          PPOS: 0, // QB
          TGID: 1, // Bears
          POVR: 85,
          PAGE: 25,
          PSPD: 80,
          PSTR: 75,
          PAWR: 90,
          PACC: 82,
          PAGI: 78,
          PHGT: 75,
          PWGT: 225,
          PINJ: 95,
          PTHP: 88,
          PTHA: 92,
          PCOL: 4, // Alabama
          PHSN: 8, // Florida
          PSXP: 0 // Blank portrait
        },
        {
          PGID: 2,
          PLNA: 'Johnson',
          PFNA: 'Mike',
          PPOS: 1, // HB
          TGID: 2, // Bengals
          POVR: 82,
          PAGE: 23,
          PSPD: 92,
          PSTR: 70,
          PAWR: 75,
          PACC: 95,
          PAGI: 90,
          PHGT: 70,
          PWGT: 200,
          PINJ: 88,
          PCAR: 85,
          PCTH: 78,
          PCOL: 10, // Arizona State
          PHSN: 4, // California
          PSXP: 0
        }
      ];
      setPlayers(samplePlayers);
    }
  }, [filePath, players.length, lookupReady]);

  if (!lookupReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Initializing lookup system...</p>
          <p className="text-sm text-gray-500">Loading position, team, and college data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Simple Header Controls */}
      <div className="bg-gray-800 border-b border-gray-700 p-3">
        <div className="flex flex-wrap items-center gap-4">
          {/* Position Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300">Position:</label>
            <select
              className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 focus:border-blue-500"
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
            >
              <option value="">All Positions</option>
              <option value="QB">Quarterbacks</option>
              <option value="HB">Running Backs</option>
              <option value="WR">Wide Receivers</option>
              <option value="TE">Tight Ends</option>
              <option value="LT">Left Tackles</option>
              <option value="LG">Left Guards</option>
              <option value="C">Centers</option>
              <option value="RG">Right Guards</option>
              <option value="RT">Right Tackles</option>
              <option value="DT">Defensive Tackles</option>
              <option value="LEDG">Left Ends</option>
              <option value="REDG">Right Ends</option>
              <option value="SAM">SAM Linebackers</option>
              <option value="Mike">Mike Linebackers</option>
              <option value="WILL">WILL Linebackers</option>
              <option value="CB">Cornerbacks</option>
              <option value="FS">Free Safeties</option>
              <option value="SS">Strong Safeties</option>
              <option value="K">Kickers</option>
              <option value="P">Punters</option>
            </select>
          </div>

          {/* Column Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showAllColumns"
              checked={showAllColumns}
              onChange={(e) => setShowAllColumns(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="showAllColumns" className="text-sm text-gray-300">
              Show All 131 Fields
            </label>
          </div>

          {/* Save Button */}
          {filePath && (
            <button
              onClick={handleSaveRoster}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-1 rounded transition-colors"
            >
              {loading ? 'Saving...' : 'Save Roster'}
            </button>
          )}

          {/* Stats */}
          <div className="ml-auto text-sm text-gray-300">
            {players.length} players • {visibleFields.length} visible fields
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-3 bg-red-900 border border-red-700 rounded text-red-100">
            <div className="font-medium">Error</div>
            <div className="text-sm">{error}</div>
          </div>
        )}

        {/* Position Info */}
        {selectedPosition && (
          <div className="mt-3 text-sm text-gray-400">
            Showing fields for: <span className="text-blue-400">{selectedPosition}</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
          <span className="text-gray-400">Loading...</span>
        </div>
      )}

      {/* Roster Grid */}
      {!loading && players.length > 0 && (
        <div className="flex-1 min-h-0">
          <RosterGrid
            players={players}
            onPlayerChange={handlePlayerChange}
            selectedPosition={selectedPosition}
            showAllColumns={showAllColumns}
          />
        </div>
      )}

      {/* Empty State */}
      {!loading && players.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-400">
            <p className="text-lg mb-2">No players loaded</p>
            <p className="text-sm">Open a roster file to begin editing</p>
          </div>
        </div>
      )}
    </div>
  );
};