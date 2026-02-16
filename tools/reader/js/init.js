/**
 * Initialization script for Text Reader Application
 * Handles database initialization and data synchronization
 */

// Initialize iOS viewport height handling
if (window.initializeIOSViewport) {
  window.initializeIOSViewport();
}

// Apply theme immediately using shared utility
if (window.applyTheme) {
  window.applyTheme();
}

// Application state
const appState = {
  currentPage: 1,
  itemsPerPage: 30,
  totalPages: 1,
  allBooks: [],
  expandedBooks: new Set(),
  processor: null,
  db: null,
  isProcessing: false
};

document.addEventListener('DOMContentLoaded', async function () {
  try {
    // Initialize database and processor
    appState.db = new TextReaderDB();
    await appState.db.init();
    appState.processor = new LocalFileProcessor();

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    await loadBooks();

  } catch (error) {
    console.error('Failed to initialize application:', error);
    showError('Failed to initialize application: ' + error.message);
  }
});

function setupEventListeners() {
  // File input
  const fileInput = document.getElementById('fileInput');
  const processFileBtn = document.getElementById('processFileBtn');

  if (fileInput && processFileBtn) {
    fileInput.addEventListener('change', function () {
      processFileBtn.disabled = !this.files || this.files.length === 0;
    });
  }

  // Process button
  if (processFileBtn) {
    processFileBtn.addEventListener('click', processSelectedFile);
  }

  // Navigation buttons
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', function () {
      if (appState.currentPage > 1) {
        appState.currentPage--;
        displayBooks();
        updatePagination();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', function () {
      if (appState.currentPage < appState.totalPages) {
        appState.currentPage++;
        displayBooks();
        updatePagination();
      }
    });
  }

  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', window.debounce(function () {
      appState.currentPage = 1;
      displayBooks();
      updatePagination();
    }, 300));
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

    console.log('Chapter boundaries detected:', chapterBoundaries.length);
    if (chapterBoundaries.length > 0) {
      console.log('First chapter:', chapterBoundaries[0].title);
      console.log('Last chapter:', chapterBoundaries[chapterBoundaries.length - 1].title);
    }

    // Check if we need to split based on chapter numbers or based line numbers
    let shouldSplitByChapter = false;
    if (chapterBoundaries.length > 0) {
      const lastChapterTitle = chapterBoundaries[chapterBoundaries.length - 1].title;
      const endChapterNum = window.extractChapterNumber(lastChapterTitle);

      console.log('End chapter number:', endChapterNum);

      // Split if the last chapter number is divisible by 50 (50, 100, 150, etc.)
      if (endChapterNum !== null) {
        shouldSplitByChapter = endChapterNum > 50;
        console.log('endChapterNum :', endChapterNum);
      }
    }

    console.log('Should split:', shouldSplitByChapter);

    if (shouldSplitByChapter) {
      // Use splitting functionality for files that end at chapter 49, 99, 149, etc.
      result = await appState.processor.processAndSplitFile(file, true);
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

    // Get all books with stories in a single batch query (fixes N+1 problem)
    const books = await appState.db.getAllBooksWithStories();

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
    const isExpanded = appState.expandedBooks.has(book.id);
    const folderIcon = isExpanded ? 'fa-folder-open' : 'fa-folder';
    const storiesDisplay = isExpanded ? 'block' : 'none';

    html += `
      <div class="book-item tree-item" data-book-id="${book.id}">
        <div class="book-header d-flex justify-content-between align-items-center">
          <div class="flex-grow-1 d-flex align-items-center" onclick="toggleBook('${book.id}')" style="cursor: pointer;">
            <i class="fas ${folderIcon} me-2 tree-folder-icon"></i>
            <h5 class="mb-0">
              ${window.escapeHtml(book.bookName)}
            </h5>
          </div>
          <div class="btn-group" role="group">
            <button class="btn btn-sm btn-link text-danger delete-book-btn" data-book-id="${book.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="book-stories tree-children" style="display: ${storiesDisplay}">
    `;

    // Add stories under book
    book.stories.forEach((story, index) => {
      const fileSize = window.formatFileSize(story.fileSize);
      const storyTitle = window.escapeHtml(story.extractedTitle || story.originalFileName.replace(/\.txt$/i, ''));

      html += `
        <div class="story-item d-flex justify-content-between align-items-center" onclick="window.location.href='viewer.html#view/${story.id}'" style="cursor: pointer;">
          <div class="d-flex align-items-center story-link-wrapper">
            <span class="story-title">${storyTitle}</span>
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
window.toggleBook = function (bookId) {
  if (appState.expandedBooks.has(bookId)) {
    appState.expandedBooks.delete(bookId);
  } else {
    appState.expandedBooks.add(bookId);
  }
  displayBooks();
};

function attachDeleteListeners() {
  // Use event delegation - attach listener to parent container once
  const booksList = document.getElementById('storiesList');
  if (!booksList || booksList.dataset.delegated) return;

  booksList.dataset.delegated = 'true';
  booksList.addEventListener('click', async function (e) {
    const deleteBtn = e.target.closest('.delete-book-btn');
    if (!deleteBtn) return;

    e.stopPropagation();
    const bookId = deleteBtn.dataset.bookId;

    try {
      await appState.processor.deleteBook(bookId);
      appState.expandedBooks.delete(bookId);
      await loadBooks();
      showSuccess('Book deleted successfully');
    } catch (error) {
      showError('Failed to delete book: ' + error.message);
    }
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
  // Use iOS-style toast notification
  if (window.iosModal) {
    window.iosModal.error(message);
  } else {
    // Fallback to native alert
    window.showAlert({
      title: 'Error',
      message: message
    });
  }
}

function showSuccess(message) {
  // Use iOS-style toast notification
  if (window.iosModal) {
    window.iosModal.success(message);
  } else {
    // Fallback to native alert
    window.showAlert({
      title: 'Success',
      message: message
    });
  }
}
