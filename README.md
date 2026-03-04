# teXlab — Natural Language to LaTeX

teXlab is a minimal, fast, and precise tool that converts natural language descriptions into production-ready LaTeX code. Whether you need a complex TikZ flowchart, a Venn diagram, or a data-heavy table, teXlab handles the syntax so you can focus on the content.

## Features

- **Natural Language Input**: Describe your diagram or table in plain English.
- **TikZ & Tabular Support**: High-quality generation for flowcharts, diagrams, and tables.
- **Copy-to-Clipboard**: Instantly copy generated code to your editor.
- **Responsive Design**: Works on all screen sizes with a clean, minimal aesthetic.
- **OpenRouter Integrated**: Powered by state-of-the-art LLMs via OpenRouter.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd texlab-ai-generator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory and add your OpenRouter API key:
   ```env
   OPEN_ROUTER_API=your_open_router_key_here
   ```

4. Start the development server:
   To run both the frontend and the secure backend API locally, use the Vercel CLI:
   ```bash
   npx vercel dev
   ```
   *Alternately, you can run `npm run dev`, but you will need to host the API endpoint separately.*

## Tech Stack

- **Framework**: [React](https://reactjs.org/) with [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **API**: [OpenRouter](https://openrouter.ai/)

## License

MIT © 2026 teXlab
