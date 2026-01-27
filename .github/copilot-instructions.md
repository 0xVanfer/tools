# Copilot Instructions for ETH Dev Tools

## Development Server

- **Do NOT start a new dev server** (`npm run dev`) on each request
- The dev server is typically already running at `http://localhost:5173/`
- Only start the dev server if explicitly requested or if verified it's not running
- If ports 5173-5176 are occupied, kill existing processes first before starting a new one:
    ```bash
    pkill -f "vite"; lsof -ti:5173,5174,5175,5176 | xargs kill -9 2>/dev/null
    ```

## Project Structure

- **Vue 3 + Vite** project
- Source code in `src/`
- Reference implementations in `referrence/` (for comparison)
- Documentation in `docs/`

## Key Directories

- `src/views/` - Page components
- `src/components/` - Reusable UI components
- `src/utils/` - Utility functions (api.js, decoder.js, etc.)
- `src/composables/` - Vue composables
- `src/config/` - Configuration files

## Build Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Code Style

- Use Vue 3 Composition API with `<script setup>`
- CSS variables defined in `src/styles/variables.css`
- Follow existing component patterns in the codebase
