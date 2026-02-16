# AGENTS.md

This file provides guidance for AI agents working on the txt-reader project.

## Project Overview

Text Reader is a **client-side only** web application for reading .txt files. It has:
- **No backend server** - all data stored in IndexedDB
- **No build system** - pure HTML/CSS/JavaScript
- **No package manager** - dependencies loaded via CDN

## Architecture

### Key Components

| File | Class/Module | Responsibility |
|------|--------------|----------------|
| `js/database.js` | `TextReaderDB` | IndexedDB operations for books, stories, histories |
| `js/fileProcessor.js` | `LocalFileProcessor` | File upload, encoding detection, chapter parsing |
| `js/viewer.js` | (inline) | Reader UI, navigation, TTS, theme switching |
| `js/utils.js` | (exports) | Shared utilities: `themes`, `escapeHtml`, `escapeRegex` |
| `js/modal.js` | (inline) | iOS-style modal dialog system |

### Data Flow

```
User uploads .txt file
    → FileProcessor detects encoding
    → FileProcessor splits into chapters
    → TextReaderDB stores book + stories
    → UI renders book list

User opens a story
    → reader.html loads story from IndexedDB
    → Renders content with chapter navigation
    → Saves/restores reading progress via histories store
```

### IndexedDB Schema (version 2)

```javascript
// books store
{ id, bookName, uploadTime, originalFileName }

// stories store  
{ id, bookId, fileName, content, chapters, chapterCount, lineCount }

// histories store
{ id, storyId, lastChapterTitle, lastScrollPosition, timestamp }
```

## Coding Standards

### JavaScript
- Use ES6+ features (classes, async/await, arrow functions)
- No TypeScript - plain JavaScript only
- Follow existing class-based patterns in `database.js` and `fileProcessor.js`
- Use `const` by default, `let` when reassignment needed

### CSS
- Use CSS custom properties (variables) for theming
- Follow BEM-like naming: `.component`, `.component-element`, `.component--modifier`
- Themes defined in `css/themes.css` with `[data-theme="name"]` selectors
- Mobile-first approach with iOS safe area considerations

### HTML
- Semantic HTML5 elements
- Bootstrap 5 classes for layout and components
- Font Awesome icons via `<i class="fas fa-*">` or `<i class="far fa-*">`

## Common Tasks

### Adding a New Theme

1. Add theme CSS to `css/themes.css`:
```css
[data-theme="theme-name"] {
  --bg-color: #...;
  --text-color: #...;
  --sidebar-bg: #...;
  --sidebar-text: #...;
  --chapter-hover: #...;
  --accent-color: #...;
}
```

2. Add theme to `themes` array in `js/utils.js`:
```javascript
export const themes = [
  // ... existing themes
  { name: 'theme-name', label: 'Theme Label', dark: false }
];
```

### Adding Chapter Detection Pattern

Edit `js/fileProcessor.js`, update the `chapterPatterns` array in `LocalFileProcessor`:

```javascript
this.chapterPatterns = [
  // ... existing patterns
  /^YOUR_PATTERN_HERE/i
];
```

### Modifying Database Schema

1. Increment version in `js/database.js`:
```javascript
const request = indexedDB.open('TextReaderDB', 3); // bump version
```

2. Handle migration in `onupgradeneeded`:
```javascript
if (event.oldVersion < 3) {
  // Add new object store or index
}
```

## Testing

No automated test suite. Manual testing recommended:

1. **Upload Testing**: Test with various file sizes and encodings
2. **Chapter Detection**: Verify correct chapter splitting
3. **Theme Testing**: Check all themes render correctly
4. **Mobile Testing**: Test on iOS Safari for viewport issues
5. **Storage Testing**: Verify IndexedDB operations work correctly

Use `test.html` for file processing debugging.

## Important Files

| Priority | File | Notes |
|----------|------|-------|
| High | `js/database.js` | Core data layer - changes affect all features |
| High | `js/fileProcessor.js` | File handling - encoding and chapter logic |
| High | `js/viewer.js` | Main reader interface |
| Medium | `css/themes.css` | All theme definitions |
| Medium | `js/utils.js` | Shared utilities |
| Low | `css/colorscheme/*.css` | Legacy individual theme files |

## External Dependencies

Loaded via CDN - ensure these remain accessible:

- Bootstrap 5.1.3: `https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/`
- Font Awesome 6.0: `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/`

## Browser APIs Used

- **IndexedDB** - Primary data storage
- **FileReader** - Reading uploaded files
- **TextDecoder** - Encoding detection/conversion
- **SpeechSynthesis** - Text-to-speech
- **LocalStorage** - User preferences

## Gotchas

1. **Encoding Detection**: Chinese text may be GBK/Big5, not UTF-8
2. **Large Files**: Files > 5000 lines are automatically split
3. **iOS Safari**: Requires special viewport handling (`ios-utils.js`)
4. **IndexedDB Async**: All database operations are async - use await
5. **No CORS**: Files loaded via file:// may have limitations - use local server
