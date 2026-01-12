# React Dashboard

A modern React dashboard built with Vite, featuring a clean and responsive design.

## Tech Stack

- **Framework**: React
- **Build Tool**: Vite
- **Package Manager**: Yarn
- **Linter**: Biome
- **Deployment**: CloudFront via GitHub Actions

## Prerequisites

- Node.js (22.14.0 recommended)
- Yarn package manager (4.7.0 recommended)
- [Biome VS Code Extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) (for development)

## Getting Started

1. Clone the repository:
   ```bash
   git clone git@github.com:ai-mauna/dashboard.git
   cd dashboard
   ```

2. Open the project in Cursor:
   ```bash
   cursor mauna-dashboard.code-workspace
   ```
   > **Note**: Using the workspace file ensures you benefit from the pre-configured Biome settings for linting and formatting.

3. Install dependencies:
   ```bash
   yarn
   ```

4. Start the development server:
   ```bash
   yarn dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser to see the application.

## Development

- The development server runs on port 5173
- Hot Module Replacement (HMR) is enabled by default
- Biome is configured for linting and formatting

### Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn preview` - Preview production build locally
- `yarn format` - Format your code with biome
- `yarn lint` - Lint your code with biome

## Deployment

This project is automatically deployed to CloudFront via GitHub Actions. The deployment process is triggered on pushes to the main branch.
