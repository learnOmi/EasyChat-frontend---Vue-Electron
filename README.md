# EasyChat
 
A modern desktop chat application built with Electron and Vue, providing a seamless cross-platform messaging experience.
 
## Overview
 
EasyChat is a feature-rich Electron-based desktop application that combines the power of Vue.js for the frontend with Electron's cross-platform capabilities. It delivers a native-like user experience while leveraging web technologies for rapid development and maintenance.
 
## Key Features
 
- **Cross-Platform Support**: Runs seamlessly on Windows, macOS, and Linux
- **Real-Time Communication**: WebSocket integration for instant messaging
- **Local Data Persistence**: SQLite database for reliable offline data storage
- **Modern UI/UX**: Built with Vue 3 and contemporary design principles
- **Secure Architecture**: Implements CSP policies and secure IPC communication
- **Multi-Window Management**: Support for multiple chat windows
- **File & Media Handling**: Built-in file server and media processing pipeline
- **State Management**: Efficient Pinia integration for application state
 
## Tech Stack
 
### Core Technologies
- **Electron**: Desktop application framework
- **Vue 3**: Progressive JavaScript framework
- **Electron Vite**: Fast build tool optimized for Electron
 
### Key Components
- **Vue Router**: Client-side routing and navigation
- **Pinia**: State management library
- **SQLite**: Local database for data persistence
- **WebSocket**: Real-time bidirectional communication
- **IPC**: Inter-process communication for secure data exchange
 
### Development Tools
- **ESLint**: Code quality and linting
- **Prettier**: Code formatting
- **Electron Builder**: Application packaging and distribution
 
## Project Architecture
 
easy-chat/  
├── src/  
│ ├── main/ # Main process (Node.js environment)  
│ │ ├── db/ # Database layer  
│ │ ├── ipc.js # IPC communication handler  
│ │ ├── wsClient.js # WebSocket client  
│ │ └── store.js # Main process state  
│ ├── preload/ # Preload scripts (secure bridge)  
│ └── renderer/ # Renderer process (Vue.js application)  
└── resources/ # Application assets  


## Quick Start

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/learnOmi/EasyChat-frontend---Vue-Electron.git

# Navigate to project directory
cd EasyChat-frontend---Vue-Electron

# Install dependencies
npm install
```

## Development
 
```bash
# Start development server
npm run dev
```

## Building for Production
 
```bash
# Build for Windows
npm run build:win
 
# Build for macOS
npm run build:mac
 
# Build for Linux
npm run build:linux
```

## Development Workflow
 
1. **Main Process**: Handles OS-level operations, IPC communication, database management, and WebSocket connections
2. **Preload Scripts**: Securely expose APIs from main process to renderer process
3. **Renderer Process**: Vue.js application managing UI, user interactions, and state via Pinia

