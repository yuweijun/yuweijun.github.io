# Text Reader

A client-side web application for reading and managing text files (.txt), specifically optimized for long-form content like novels and e-books. Supports both Chinese and English text with automatic chapter detection.

## Features

### Book Management
- **File Upload**: Upload .txt files with automatic encoding detection (UTF-8, GBK, Big5)
- **Book Organization**: Books displayed in tree-view with expandable chapters
- **Large File Handling**: Automatically splits files > 5000 lines into manageable chunks
- **Chapter-based Splitting**: Files with 50+ chapters split at chapter boundaries
- **Search & Pagination**: Filter and navigate through large book collections

### Text Viewer
- **Chapter Navigation**: Sidebar with searchable chapter list
- **Auto-scrolling**: Track current chapter based on scroll position
- **Reading Progress**: Automatically saves and restores reading position
- **Text-to-Speech**: Read aloud with adjustable speed (0.5x - 2.0x)
- **Keyboard Navigation**: Arrow keys for chapter/page navigation
- **Pinnable Sidebar**: Lock sidebar open or auto-hide
- **Mobile Responsive**: iOS-optimized with safe area handling

### 14 Color Themes
| Light Themes | Dark Themes |
|--------------|-------------|
| Maize Yellow | Nord |
| Autumn | Dracula |
| Lavender | Monokai |
| Almond | Solarized |
| Rouge | Griege Dark |
| Meadow | Midnight Cyan |
| Bamboo | Dark Green |

### Chapter Detection Patterns
- **Chinese**: `第X章`, `第X节`, `第X卷`, `第X部`, `第X篇`, `第X回`
- **English**: `Chapter X`, `Section X`, `PART X`, `PROLOGUE`, `EPILOGUE`
- **Roman numerals**: `I.`, `II.`, etc.
- **Decimal**: `1.1`, `1.2`, etc.

## Getting Started

### Requirements
- Modern web browser with IndexedDB support (Chrome, Firefox, Safari, Edge)
- No server required - runs entirely in the browser

### Installation

No build or installation required! Simply clone and open:

```bash
git clone https://github.com/your-username/txt-reader.git
cd txt-reader
```

### Running

**Option 1**: Open `index.html` directly in your browser

**Option 2**: Use a local server for best results:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000`

## Project Structure

```
txt-reader/
├── index.html          # Main page - Book library management
├── reader.html         # Reader page - Text viewing with chapters
├── css/
│   ├── index.css       # Styles for index page
│   ├── viewer.css      # Styles for viewer page
│   ├── themes.css      # Consolidated 14 color themes
│   ├── modal.css       # iOS-style modal dialogs
│   ├── utilities.css   # Shared utilities
│   └── colorscheme/    # Individual color scheme files
├── js/
│   ├── database.js     # IndexedDB wrapper (TextReaderDB class)
│   ├── fileProcessor.js # File processing and chapter detection
│   ├── utils.js        # Shared utilities (themes, escapeHtml, etc.)
│   ├── ios-utils.js    # iOS viewport fixes
│   ├── modal.js        # iOS-style modal system
│   ├── init.js         # Index page initialization
│   └── viewer.js       # Viewer page functionality
└── favicon.ico
```

## Technology Stack

- **HTML5** / **CSS3** / **Vanilla JavaScript (ES6+)**
- **Bootstrap 5.1.3** - UI components (CDN)
- **Font Awesome 6.0** - Icons (CDN)
- **IndexedDB** - Local storage for books and reading progress
- **Web Speech API** - Text-to-speech functionality

## Data Storage

All data is stored locally in the browser using IndexedDB:

| Store | Purpose |
|-------|---------|
| `books` | Book metadata (name, upload time, original file) |
| `stories` | Story content and chapters |
| `histories` | Reading progress (position, last chapter) |

**Local Storage Keys**:
- `preferredViewerTheme` - User's selected color theme
- `sidebarPinned` - Sidebar pin state

## Usage

1. **Upload Books**: Click "Upload Book" on the main page to add .txt files
2. **Browse Library**: View your books in the tree-view, expand to see chapters
3. **Read**: Click any chapter to open in the viewer
4. **Customize**: Use the theme selector (top-right) to change colors
5. **Navigate**: Use sidebar, keyboard arrows, or scroll to move through content
6. **Listen**: Click the speaker icon to enable text-to-speech

## File Requirements

- **Format**: `.txt` files only
- **Encoding**: UTF-8 recommended (GBK, Big5 auto-detected)
- **Size**: Up to 100MB per file

## License

MIT License
