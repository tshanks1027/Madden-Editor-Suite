import '@testing-library/jest-dom';

// Mock Electron APIs
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  send: jest.fn(),
  removeAllListeners: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: {
    ipcRenderer: mockIpcRenderer,
  },
  writable: true,
});

// Mock file system operations
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock Three.js for uniform editor tests
jest.mock('three', () => ({
  Scene: jest.fn(),
  PerspectiveCamera: jest.fn(),
  WebGLRenderer: jest.fn(() => ({
    setSize: jest.fn(),
    render: jest.fn(),
    domElement: document.createElement('canvas'),
  })),
  Mesh: jest.fn(),
  MeshBasicMaterial: jest.fn(),
  BoxGeometry: jest.fn(),
}));

// Console error suppression for testing
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});