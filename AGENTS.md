# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Static GitHub Pages website (yuweijun.github.io / 4e00.com) - a developer documentation portal and toolkit collection. No build system; all content is served as static HTML/CSS/JS.

## Architecture

- **Entry point**: `index.html` - Links to all documentation sections
- **Styling**: `css/main.css` - Single stylesheet for the entire site
- **Dependencies**: Bower (jQuery 1.11.2, Bootstrap 3.3.4) - legacy, not actively used

### Content Sections

| Directory | Content |
|-----------|---------|
| `vim-zh/`, `vim-en/` | Vim documentation (Chinese/English), generated from `.cnx` files |
| `git-zh/` | Git Chinese documentation |
| `algorithms/` | Data structure visualizations (JS-based interactive demos) |
| `tools/` | Developer utilities (JS shell, cheatsheets, ASCII table, etc.) |
| `manpages/`, `manpages-zh/` | Linux man pages (English/Chinese) |
| `java/` | Java documentation and articles |
| `gnu/` | GNU Bash and Sed references |
| `ace/` | Ace code editor with syntax highlighting |
| `js/` | Custom DOM library (`d.js`) |

## Documentation Generation

### Vim Chinese Documentation (`vim-zh/`)

Converts vim help files (`.cnx`) to HTML:

```bash
# Step 1: Convert .cnx files to HTML using vim's TOhtml
./vimtohtml.sh

# Step 2: Post-process HTML with Ruby script
./vimtohtml.rb
```

The Ruby script adds navigation, anchors, and cross-reference links.

## Conventions

- Blog content (`/blog/`) is gitignored and maintained separately
- HTML files follow a consistent template with site header/footer
- Chinese pages often have `-zh` suffix or live in `*-zh/` directories
- Links use absolute paths from root (e.g., `/tools/vim-cheatsheet.html`)
