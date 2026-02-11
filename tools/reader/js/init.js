/**
 * Initialization script for Text Reader Application
 * Handles database initialization and data synchronization
 */

// Theme management
const themes = {
    default: 'theme-default',
    monokai: 'theme-monokai',
    solarized: 'theme-solarized',
    dracula: 'theme-dracula',
    nord: 'theme-nord',
    darkgreen: 'theme-darkgreen',
    'maize-yello': 'theme-maize-yello',
    'griege-dark': 'theme-griege-dark',
    rouge: 'theme-rouge',
    almond: 'theme-almond',
    autumn: 'theme-autumn',
    meadow: 'theme-meadow',
    lavender: 'theme-lavender',
    bamboo: 'theme-bamboo'
};

function applyTheme() {
    const savedTheme = localStorage.getItem('preferredViewerTheme') || 'default';
    if (themes[savedTheme]) {
        document.body.classList.add(themes[savedTheme]);
    }
}

// Apply theme immediately
applyTheme();

// Application state
const appState = {
    currentPage: 1,
    itemsPerPage: 30,
    totalPages: 1,
    allBooks: [],
    expandedBooks: new Set(), // Track expanded book IDs
    processor: null,
    db: null,
    isProcessing: false
};

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Text Reader Application...');

    try {
        // Initialize database and processor
        appState.db = new TextReaderDB();
        await appState.db.init();
        appState.processor = new LocalFileProcessor();
        console.log('Database and processor initialized successfully');

        // Setup event listeners
        setupEventListeners();

        // Load initial data
        await loadBooks();

        console.log('Application initialization completed');

    } catch (error) {
        console.error('Failed to initialize application:', error);
        showError('Failed to initialize application: ' + error.message);
    }
});

function setupEventListeners() {
    // Text content input
    const textContent = document.getElementById('textContent');
    const processTextBtn = document.getElementById('processTextBtn');

    if (textContent && processTextBtn) {
        textContent.addEventListener('input', function() {
            processTextBtn.disabled = this.value.trim().length === 0;
        });
    }

    // File input
    const fileInput = document.getElementById('fileInput');
    const processFileBtn = document.getElementById('processFileBtn');

    if (fileInput && processFileBtn) {
        fileInput.addEventListener('change', function() {
            processFileBtn.disabled = !this.files || this.files.length === 0;
        });
    }

    // Process buttons
    if (processTextBtn) {
        processTextBtn.addEventListener('click', processTextContent);
    }
    if (processFileBtn) {
        processFileBtn.addEventListener('click', processSelectedFile);
    }

    // Navigation buttons
    const refreshBtn = document.getElementById('refreshBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            await loadBooks();
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (appState.currentPage > 1) {
                appState.currentPage--;
                displayBooks();
                updatePagination();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            if (appState.currentPage < appState.totalPages) {
                appState.currentPage++;
                displayBooks();
                updatePagination();
            }
        });
    }

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async function() {
            if (confirm('Are you sure you want to delete all books? This cannot be undone.')) {
                try {
                    await appState.db.clearAllData();
                    await loadBooks();
                    showSuccess('All books deleted successfully');
                } catch (error) {
                    showError('Failed to clear data: ' + error.message);
                }
            }
        });
    }

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            appState.currentPage = 1;
            displayBooks();
            updatePagination();
        }, 300));
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function processTextContent() {
    const textContent = document.getElementById('textContent');
    const processTextBtn = document.getElementById('processTextBtn');

    if (!textContent || !textContent.value.trim()) {
        showError('Please enter some text content');
        return;
    }

    appState.isProcessing = true;
    if (processTextBtn) processTextBtn.disabled = true;

    try {
        showLoading('Processing text content...');

        const result = await appState.processor.processTextContent(textContent.value);

        // Clear input
        textContent.value = '';
        if (processTextBtn) processTextBtn.disabled = true;

        // Reload books
        await loadBooks();

        hideLoading();
        showSuccess('Text content processed successfully!');

        // Navigate to view
        window.location.href = `viewer.html#view/${result.storyIds[0]}`;

    } catch (error) {
        hideLoading();
        showError('Failed to process text: ' + error.message);
        if (processTextBtn) processTextBtn.disabled = false;
    } finally {
        appState.isProcessing = false;
    }
}

async function processSelectedFile() {
    const fileInput = document.getElementById('fileInput');
    const processFileBtn = document.getElementById('processFileBtn');

    if (!fileInput.files || fileInput.files.length === 0) {
        showError('Please select a file');
        return;
    }

    const file = fileInput.files[0];

    // Validate file
    if (file.type !== 'text/plain' && !file.name.toLowerCase().endsWith('.txt')) {
        showError('Only text files (.txt) are allowed!');
        return;
    }

    if (file.size > 100 * 1024 * 1024) {
        showError('File size exceeds 100MB limit!');
        return;
    }

    appState.isProcessing = true;
    if (processFileBtn) processFileBtn.disabled = true;

    try {
        showLoading(`Processing file: ${file.name}...`);

        // Read file content with automatic encoding detection to check chapter count
        const fileContent = await appState.processor.readFileAsText(file);

        // Validate UTF-8 encoding
        if (!LocalFileProcessor.isUtf8Encoded(fileContent)) {
            hideLoading();
            showError('上传的文本文件编码必须为UTF-8格式。请将文件转换为UTF-8编码后重新上传。');
            if (processFileBtn) processFileBtn.disabled = false;
            return;
        }

        // Detect chapters to decide if splitting is needed
        const chapterBoundaries = appState.processor.detectChapters(fileContent);
        let result;

        if (chapterBoundaries.length > 50) {
            // Use splitting functionality for files with more than 50 chapters
            result = await appState.processor.processAndSplitFile(file);
            hideLoading();
            showSuccess(`File "${file.name}" split into ${result.storyIds.length} parts successfully!`);
        } else {
            // Process normally
            result = await appState.processor.processFile(file);
            hideLoading();
            showSuccess(`File "${file.name}" processed successfully!`);
        }

        // Clear input
        fileInput.value = '';

        // Reload books
        await loadBooks();

        // Navigate to first story
        window.location.href = `viewer.html#view/${result.storyIds[0]}`;

    } catch (error) {
        hideLoading();
        showError('Failed to process file: ' + error.message);
        if (processFileBtn) processFileBtn.disabled = false;
    } finally {
        appState.isProcessing = false;
    }
}

async function loadBooks() {
    try {
        showLoading('Loading books...');

        // Get all books from database
        const books = await appState.db.getAllBooks();

        // Sort by upload time (newest first)
        books.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));

        // Load stories for each book
        for (const book of books) {
            book.stories = await appState.db.getStoriesByBookId(book.id);
            // Sort stories by split index if they are split files
            book.stories.sort((a, b) => {
                if (a.splitIndex && b.splitIndex) {
                    return a.splitIndex - b.splitIndex;
                }
                return new Date(a.uploadTime) - new Date(b.uploadTime);
            });
        }

        appState.allBooks = books;
        appState.totalPages = Math.ceil(books.length / appState.itemsPerPage);
        
        // Automatically expand the first book if there are books
        if (books.length > 0 && !appState.expandedBooks.has(books[0].id)) {
            appState.expandedBooks.add(books[0].id);
        }

        // Reset to first page if current page is invalid
        if (appState.currentPage > appState.totalPages) {
            appState.currentPage = 1;
        }

        displayBooks();
        updatePagination();
        hideLoading();

    } catch (error) {
        hideLoading();
        showError('Failed to load books: ' + error.message);
    }
}

function displayBooks() {
    const booksList = document.getElementById('storiesList');
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');

    // Hide loading and empty states
    if (loadingState) loadingState.style.display = 'none';

    if (appState.allBooks.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (booksList) booksList.style.display = 'none';
        const paginationControls = document.getElementById('paginationControls');
        if (paginationControls) paginationControls.style.display = 'none';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (booksList) booksList.style.display = 'block';

    // Filter books based on search
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filteredBooks = appState.allBooks;
    if (searchTerm) {
        filteredBooks = appState.allBooks.filter(book =>
            book.bookName.toLowerCase().includes(searchTerm) ||
            book.stories.some(story =>
                story.extractedTitle.toLowerCase().includes(searchTerm)
            )
        );
    }

    // Calculate pagination
    const startIndex = (appState.currentPage - 1) * appState.itemsPerPage;
    const endIndex = Math.min(startIndex + appState.itemsPerPage, filteredBooks.length);
    const pageBooks = filteredBooks.slice(startIndex, endIndex);

    // Generate HTML for books
    let html = '';
    pageBooks.forEach(book => {
        const uploadDate = new Date(book.uploadTime).toLocaleString();
        const isExpanded = appState.expandedBooks.has(book.id);
        const expandIcon = isExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
        const storiesDisplay = isExpanded ? 'block' : 'none';

        html += `
            <div class="book-item" data-book-id="${book.id}">
                <div class="book-header d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1" onclick="toggleBook('${book.id}')" style="cursor: pointer;">
                        <h5 class="mb-1">
                            <i class="fas ${expandIcon} me-2 text-muted"></i>
                            <i class="fas fa-book text-primary me-2"></i>
                            ${escapeHtml(book.bookName)}
                        </h5>
                    </div>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-link text-danger delete-book-btn" data-book-id="${book.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="book-stories ms-4 mt-2" style="display: ${storiesDisplay}">
        `;

        // Add stories under book
        book.stories.forEach(story => {
            const fileSize = formatFileSize(story.fileSize);
            const storyTitle = escapeHtml(story.extractedTitle || story.originalFileName.replace(/\.txt$/i, ''));
            const splitBadge = story.isSplitFile ? ` <span class="badge bg-info">Part ${story.splitIndex}/${story.totalChunks}</span>` : '';

            html += `
                <div class="story-item d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div class="d-flex align-items-center">
                        <a href="viewer.html#view/${story.id}" class="text-decoration-none">
                            <i class="fas fa-file-alt text-muted me-2"></i>
                            ${storyTitle}
                        </a>
                    </div>
                    <div class="text-muted small">
                        ${fileSize}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    if (booksList) booksList.innerHTML = html;

    // Attach event listeners to delete buttons
    attachDeleteListeners();
}

// Toggle book expand/collapse
window.toggleBook = function(bookId) {
    if (appState.expandedBooks.has(bookId)) {
        appState.expandedBooks.delete(bookId);
    } else {
        appState.expandedBooks.add(bookId);
    }
    displayBooks();
};

function attachDeleteListeners() {
    // Delete book buttons
    document.querySelectorAll('.delete-book-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const bookId = this.dataset.bookId;
            const book = appState.allBooks.find(b => b.id === bookId);

            if (confirm(`Are you sure you want to delete "${book?.bookName || 'this book'}" and all its parts?`)) {
                try {
                    await appState.processor.deleteBook(bookId);
                    appState.expandedBooks.delete(bookId);
                    await loadBooks();
                    showSuccess('Book deleted successfully');
                } catch (error) {
                    showError('Failed to delete book: ' + error.message);
                }
            }
        });
    });

    // Delete story buttons
    document.querySelectorAll('.delete-story-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const storyId = this.dataset.storyId;

            if (confirm('Are you sure you want to delete this story?')) {
                try {
                    await appState.processor.deleteStory(storyId);
                    await loadBooks();
                    showSuccess('Story deleted successfully');
                } catch (error) {
                    showError('Failed to delete story: ' + error.message);
                }
            }
        });
    });
}

function updatePagination() {
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const paginationControls = document.getElementById('paginationControls');

    if (appState.totalPages <= 1) {
        if (paginationControls) paginationControls.style.display = 'none';
        return;
    }

    if (paginationControls) paginationControls.style.display = 'flex';
    if (currentPageEl) currentPageEl.textContent = appState.currentPage;
    if (totalPagesEl) totalPagesEl.textContent = appState.totalPages;

    if (prevPageBtn) prevPageBtn.disabled = appState.currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = appState.currentPage >= appState.totalPages;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(message = 'Loading...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    if (loadingText) loadingText.textContent = message;
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function showError(message) {
    const toast = document.getElementById('errorToast');
    const toastBody = toast?.querySelector('.toast-body');

    if (toastBody) toastBody.textContent = message;
    if (toast) {
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    } else {
        alert(message);
    }
}

function showSuccess(message) {
    const toast = document.getElementById('successToast');
    const toastBody = toast?.querySelector('.toast-body');

    if (toastBody) toastBody.textContent = message;
    if (toast) {
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    } else {
        alert(message);
    }
}
