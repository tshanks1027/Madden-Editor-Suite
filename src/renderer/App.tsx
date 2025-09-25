import * as React from 'react';
import { useState, useRef } from 'react';
import { RosterEditor } from './features/roster/RosterEditor';
import { SplashScreen } from './components/SplashScreen';
import './App.css';

const App: React.FC = () => {
  const [currentTool, setCurrentTool] = useState<string>('roster');
  const [currentFile, setCurrentFile] = useState<string>('');
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenFile = () => {
    // Trigger the hidden file input
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        // Pass the file path to the renderer
        setCurrentFile(file.path || file.name);
        console.log('Selected file:', file.path || file.name);
      } catch (error) {
        console.error('Error handling file:', error);
      }
    }
  };

  const tools = [
    { id: 'roster', name: 'Roster Editor', description: 'Edit player attributes, ratings, and contracts' },
    { id: 'draft', name: 'Draft Class Editor', description: 'Create and modify draft classes' },
    { id: 'coach', name: 'Coach Editor', description: 'Edit coach attributes and records' },
    { id: 'franchise', name: 'Franchise Editor', description: 'Full franchise file editing' }
  ];

  if (showSplash) {
    return <SplashScreen onClose={() => setShowSplash(false)} duration={2000} />;
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Clean Top Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img src="/assets/banner.png" alt="KNuttZ Madden Editor" className="h-8" />
          <h1 className="text-xl font-semibold">Madden Editor Suite</h1>
          <div className="flex space-x-2">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setCurrentTool(tool.id)}
                className={`px-3 py-1 text-sm rounded ${
                  currentTool === tool.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tool.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={handleOpenFile}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-1 rounded text-sm"
          >
            Open File
          </button>

          {/* Hidden file input for extensionless Madden files */}
          <input
            ref={fileInputRef}
            type="file"
            accept="*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {currentFile && (
            <span className="text-sm text-gray-300">
              {currentFile.replace(/^.*[\\/]/, '')}
            </span>
          )}
        </div>
      </header>

      {/* Main Content - Full Width */}
      <main className="flex-1 min-w-0">
          {currentTool === 'roster' && (
            <RosterEditor filePath={currentFile} />
          )}

          {currentTool !== 'roster' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-4">🚧</div>
                <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
                <p>The {tools.find(t => t.id === currentTool)?.name} is under development.</p>
                <p className="text-sm mt-2">Try the Roster Editor for now!</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;