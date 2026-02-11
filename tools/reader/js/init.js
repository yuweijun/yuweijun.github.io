/**
 * Initialization script for Text Reader Application
 * Handles database initialization and data synchronization
 */

// Application state
const appState = {
    currentPage: 1,
    itemsPerPage: 30,
    totalPages: 1,
    allStories: [],
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
        await loadStories();
        
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
    
    if (refreshBtn) refreshBtn.addEventListener('click', loadStories);
    if (prevPageBtn) prevPageBtn.addEventListener('click', goToPreviousPage);
    if (nextPageBtn) nextPageBtn.addEventListener('click', goToNextPage);
    if (clearAllBtn) clearAllBtn.addEventListener('click', confirmClearAll);
}

async function processTextContent() {
    if (appState.isProcessing) return;

    const content = document.getElementById('textContent').value.trim();
    if (!content) {
        showError('Please enter some text content');
        return;
    }

    appState.isProcessing = true;
    const processTextBtn = document.getElementById('processTextBtn');
    if (processTextBtn) processTextBtn.disabled = true;

    try {
        showLoading('Processing text content...');

        const storyId = await appState.processor.processTextContent(content);

        // Clear input
        document.getElementById('textContent').value = '';

        // Reload stories
        await loadStories();

        hideLoading();
        showSuccess('Text content processed successfully!');

        // Navigate to viewer
        window.location.href = `viewer.html#view/${storyId}`;

    } catch (error) {
        hideLoading();
        showError('Failed to process text content: ' + error.message);
        if (processTextBtn) processTextBtn.disabled = false;
    } finally {
        appState.isProcessing = false;
    }
}

async function processSelectedFile() {
    if (appState.isProcessing) return;

    const fileInput = document.getElementById('fileInput');
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
    const processFileBtn = document.getElementById('processFileBtn');
    if (processFileBtn) processFileBtn.disabled = true;

    try {
        showLoading(`Processing file: ${file.name}...`);

        // Read file content to check chapter count
        const fileContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file, 'UTF-8');
        });

        // Detect chapters to decide if splitting is needed
        const chapterBoundaries = appState.processor.detectChapters(fileContent);
        let storyIds = [];

        if (chapterBoundaries.length > 50) {
            // Use splitting functionality for files with more than 50 chapters
            storyIds = await appState.processor.processAndSplitFile(file);
            hideLoading();
            showSuccess(`File "${file.name}" split into ${storyIds.length} parts successfully!`);
        } else {
            // Process normally
            const storyId = await appState.processor.processFile(file);
            storyIds = [storyId];
            hideLoading();
            showSuccess(`File "${file.name}" processed successfully!`);
        }

        // Clear input
        fileInput.value = '';

        // Reload stories
        await loadStories();

        // Navigate to first part if multiple parts were created
        window.location.href = `viewer.html#view/${storyIds[0]}`;

    } catch (error) {
        hideLoading();
        showError('Failed to process file: ' + error.message);
        if (processFileBtn) processFileBtn.disabled = false;
    } finally {
        appState.isProcessing = false;
    }
}

async function loadStories() {
    try {
        showLoading('Loading documents...');
        
        // Get all stories from database
        const stories = await appState.db.getAllStories();
        
        // Sort by upload time (newest first)
        stories.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
        
        appState.allStories = stories;
        appState.totalPages = Math.ceil(stories.length / appState.itemsPerPage);
        
        // Reset to first page if current page is invalid
        if (appState.currentPage > appState.totalPages) {
            appState.currentPage = 1;
        }
        
        displayStories();
        updatePagination();
        hideLoading();
        
    } catch (error) {
        hideLoading();
        showError('Failed to load documents: ' + error.message);
    }
}

function displayStories() {
    const storiesList = document.getElementById('storiesList');
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');
    
    // Hide loading and empty states
    if (loadingState) loadingState.style.display = 'none';
    
    if (appState.allStories.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (storiesList) storiesList.style.display = 'none';
        const paginationControls = document.getElementById('paginationControls');
        if (paginationControls) paginationControls.style.display = 'none';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    if (storiesList) storiesList.style.display = 'block';
    
    // Calculate pagination
    const startIndex = (appState.currentPage - 1) * appState.itemsPerPage;
    const endIndex = Math.min(startIndex + appState.itemsPerPage, appState.allStories.length);
    const pageStories = appState.allStories.slice(startIndex, endIndex);
    
    // Generate HTML for stories
    let html = '';
    pageStories.forEach(story => {
        const uploadDate = new Date(story.uploadTime).toLocaleString();
        const fileSize = formatFileSize(story.fileSize);
        
        html += `
            <div class="story-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h5 class="mb-2">
                            <a href="viewer.html#view/${story.id}" class="text-decoration-none">
                                <i class="fas fa-file-alt text-primary"></i>
                                ${escapeHtml(story.customTitle || story.extractedTitle || story.originalFileName.replace(/\.txt$/i, ''))}
                                ${story.isSplitFile ? `<span class="badge bg-info ms-2">Part ${story.splitIndex}/${story.totalChunks}</span>` : ''}
                            </a>
                        </h5>
                        <div class="file-info">
                            <i class="fas fa-calendar"></i> ${uploadDate} |
                            <i class="fas fa-weight-hanging"></i> ${fileSize}
                            ${story.segmentCount && story.segmentCount > 1 ? 
                                `| <i class="fas fa-cut"></i> ${story.segmentCount} segments` : ''}
                            ${story.isSplitFile ? 
                                `| <i class="fas fa-code-branch"></i> Split from ${story.splitParentFile}` : ''}
                        </div>
                    </div>
                    <div class="btn-group" role="group">
                        <a href="viewer.html#view/${story.id}" class="btn btn-sm btn-outline-primary">
                            <i class="fas fa-eye"></i> View
                        </a>
                        <button class="btn btn-sm btn-outline-secondary rename-btn" 
                                data-story-id="${story.id}"
                                data-original-name="${escapeHtml(story.customTitle || story.extractedTitle || story.originalFileName.replace(/\.txt$/i, ''))}">
                            <i class="fas fa-edit"></i> Rename
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" 
                                data-story-id="${story.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    if (storiesList) storiesList.innerHTML = html;
    
    // Add event listeners to delete and rename buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            const storyId = this.getAttribute('data-story-id');
            confirmDeleteStory(storyId);
        });
    });
    
    document.querySelectorAll('.rename-btn').forEach(button => {
        button.addEventListener('click', function() {
            const storyId = this.getAttribute('data-story-id');
            const originalName = this.getAttribute('data-original-name');
            showRenameDialog(storyId, originalName);
        });
    });
}

function updatePagination() {
    const paginationControls = document.getElementById('paginationControls');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');
    
    if (appState.totalPages <= 1) {
        if (paginationControls) paginationControls.style.display = 'none';
        return;
    }
    
    if (paginationControls) paginationControls.style.display = 'flex';
    if (prevBtn) prevBtn.disabled = appState.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = appState.currentPage >= appState.totalPages;
    if (pageInfo) pageInfo.textContent = `Page ${appState.currentPage} of ${appState.totalPages}`;
}

function goToPreviousPage() {
    if (appState.currentPage > 1) {
        appState.currentPage--;
        displayStories();
        updatePagination();
    }
}

function goToNextPage() {
    if (appState.currentPage < appState.totalPages) {
        appState.currentPage++;
        displayStories();
        updatePagination();
    }
}

function showRenameDialog(storyId, currentName) {
    const modalHtml = `
        <div class="modal fade" id="renameModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Rename Document</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="renameInput" class="form-label">New name:</label>
                            <input type="text" class="form-control" id="renameInput" 
                                   value="${currentName}" maxlength="100">
                            <div class="form-text">Enter a new name for this document</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirmRenameBtn">Rename</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('renameModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add new modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modalElement = document.getElementById('renameModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    
    // Focus the input field
    setTimeout(() => {
        document.getElementById('renameInput').focus();
        document.getElementById('renameInput').select();
    }, 100);
    
    // Handle rename confirmation
    document.getElementById('confirmRenameBtn').addEventListener('click', async function() {
        const newName = document.getElementById('renameInput').value.trim();
        if (newName && newName !== currentName) {
            try {
                await renameStory(storyId, newName);
                modal.hide();
                showSuccess('Document renamed successfully');
                await loadStories();
            } catch (error) {
                showError('Failed to rename document: ' + error.message);
            }
        } else {
            modal.hide();
        }
    });
    
    // Handle Enter key in input
    document.getElementById('renameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('confirmRenameBtn').click();
        }
    });
}

async function renameStory(storyId, newName) {
    try {
        // Get the story from database
        const story = await appState.db.getStoryById(storyId);
        if (!story) {
            throw new Error('Story not found');
        }
        
        // Update the story title
        story.customTitle = newName;
        
        // Save updated story
        await appState.db.updateStory(story);
        
    } catch (error) {
        throw new Error('Failed to rename story: ' + error.message);
    }
}

async function confirmDeleteStory(storyId) {
    const story = appState.allStories.find(s => s.id === storyId);
    if (!story) return;
    
    showConfirmDialog(
        `Are you sure you want to delete "${escapeHtml(story.customTitle || story.extractedTitle || story.originalFileName.replace(/\.txt$/i, ''))}"?`,
        async () => {
            try {
                await appState.processor.deleteStory(storyId);
                showSuccess('Document deleted successfully');
                await loadStories();
            } catch (error) {
                showError('Failed to delete document: ' + error.message);
            }
        }
    );
}

async function confirmClearAll() {
    if (appState.allStories.length === 0) return;
    
    showConfirmDialog(
        `Are you sure you want to delete all ${appState.allStories.length} documents? This action cannot be undone.`,
        async () => {
            try {
                showLoading('Clearing all documents...');
                await appState.db.clearAllData();
                showSuccess('All documents cleared successfully');
                await loadStories();
                hideLoading();
            } catch (error) {
                hideLoading();
                showError('Failed to clear documents: ' + error.message);
            }
        }
    );
}

// Utility functions
function showLoading(message) {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">${message}</p>
        `;
        loadingState.style.display = 'block';
    }
    
    const emptyState = document.getElementById('emptyState');
    const storiesList = document.getElementById('storiesList');
    
    if (emptyState) emptyState.style.display = 'none';
    if (storiesList) storiesList.style.display = 'none';
}

function hideLoading() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.style.display = 'none';
}

function showError(message) {
    alert('Error: ' + message);
}

function showSuccess(message) {
    console.log('Success:', message);
}

function showConfirmDialog(message, onConfirm) {
    const modalBody = document.getElementById('confirmModalBody');
    const confirmBtn = document.getElementById('confirmActionBtn');
    const modalElement = document.getElementById('confirmModal');
    
    if (modalBody) modalBody.textContent = message;
    
    if (confirmBtn) {
        confirmBtn.onclick = function() {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
            onConfirm();
        };
    }
    
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Utility function to format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Global utility functions
 */
window.TextReaderUtils = {
    formatFileSize: formatFileSize,
    db: new TextReaderDB()
};