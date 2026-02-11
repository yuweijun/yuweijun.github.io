/**
 * Viewer Script for Text Reader Application
 * Handles the text viewing functionality with chapter navigation
 */

// Auto-hide functionality variables
let db = null;
let localFileProcessor = null;
let storyId = null;

// Auto-hide functionality variables
let isSidebarHidden = false; // Start visible
let isSidebarPinned = false;
let lastScrollTop = 0;
let lastScrollLeft = 0;
let hideTimeout = null;
let isScrollingInSidebar = false;

// Color Scheme Management
const themes = {
    default: 'theme-default',
    monokai: 'theme-monokai',
    dark: 'theme-dark',
    solarized: 'theme-solarized',
    dracula: 'theme-dracula',
    nord: 'theme-nord',
    gruvbox: 'theme-gruvbox',
    onedark: 'theme-onedark',
    darkgreen: 'theme-darkgreen',
    'maize-yello': 'theme-maize-yello',
    'griege-dark': 'theme-griege-dark',
    rouge: 'theme-rouge',
    onyx: 'theme-onyx',
    almond: 'theme-almond',
    autumn: 'theme-autumn',
    aurora: 'theme-aurora',
    meadow: 'theme-meadow',
    seasky: 'theme-seasky',
    lavender: 'theme-lavender',
    bamboo: 'theme-bamboo',
    ochre: 'theme-ochre'
};

function applyTheme(theme) {
    // Remove all theme classes
    Object.values(themes).forEach(themeClass => {
        document.body.classList.remove(themeClass);
    });

    // Apply selected theme
    if (themes[theme]) {
        document.body.classList.add(themes[theme]);
    }

    // Save to localStorage
    localStorage.setItem('preferredViewerTheme', theme);
}

// Get story ID from URL hash
function getStoryIdFromUrl() {
    const hash = window.location.hash;
    if (hash.startsWith('#view/')) {
        return hash.substring(6); // Remove '#view/' prefix
    }
    return null;
}

let fileContent = '';
let chapters = [];
let currentChapter = null;
let chaptersVisible = true;
let totalPages = 1;
let filteredChapters = [];
let storySegments = [];
let currentSegmentIndex = 0;
let readingHistory = null;

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Listen for hash changes
        window.addEventListener('hashchange', handleHashChange);
        
        // Initial load
        await initializeViewer();
        
    } catch (error) {
        document.querySelector('.text-content').textContent = 'Error initializing viewer: ' + error.message;
    }
});

async function initializeViewer() {
    // Get story ID from URL
    storyId = getStoryIdFromUrl();
    if (!storyId) {
        document.querySelector('.text-content').textContent = 'Invalid story ID';
        return;
    }

    // Initialize database and processor
    db = new TextReaderDB();
    localFileProcessor = new LocalFileProcessor();
    window.localFileProcessor = localFileProcessor;

    // Initialize database
    await db.init();
    
    // Load story data from database to get the title
    const storyData = await db.getStoryById(storyId);
    
    // Load story segments if they exist
    if (storyData && storyData.segments) {
        storySegments = storyData.segments;
    }
    
    // Load reading history
    readingHistory = await db.getReadingHistory(storyId);
    
    // Load the TXT file content
    await loadFileContent();
    
    // Initialize chapters sidebar
    const sidebar = document.getElementById('chaptersSidebar');
    if (sidebar) {
        if (isMobileView()) {
            // Mobile: start hidden, will slide from bottom when toggled
            sidebar.classList.add('hidden-bottom');
            isSidebarHidden = true;
        } else {
            // Desktop: start visible
            sidebar.classList.add('visible');
            sidebar.style.display = 'block';
            isSidebarHidden = false;
        }
    }
    
    // Add search functionality
    const searchInput = document.getElementById('chapterSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterChapters(this.value);
        });
    }
    
    // Save reading progress periodically
    setInterval(saveReadingProgress, 30000); // Save every 30 seconds
    
    // Save on page unload
    window.addEventListener('beforeunload', saveReadingProgress);

    // Load saved theme
    const savedTheme = localStorage.getItem('preferredViewerTheme') || 'default';
    applyTheme(savedTheme);

    // Add event listeners to theme options
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            const theme = this.getAttribute('data-theme');
            applyTheme(theme);
        });
    });
    
    // Setup auto-hide functionality
    setupAutoHide();
    
    // Setup pin toggle button
    const togglePinBtn = document.getElementById('togglePinBtn');
    if (togglePinBtn) {
        togglePinBtn.addEventListener('click', togglePinSidebar);
    }

    // Setup double-click and tap to toggle sidebar on content container
    const contentContainer = document.querySelector('.content-container');
    if (contentContainer) {
        // Helper function to check if point is in center area
        function isInCenterArea(rect, x, y) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const centerAreaWidth = rect.width * 0.5;
            const centerAreaHeight = rect.height * 0.5;
            const centerLeft = centerX - centerAreaWidth / 2;
            const centerRight = centerX + centerAreaWidth / 2;
            const centerTop = centerY - centerAreaHeight / 2;
            const centerBottom = centerY + centerAreaHeight / 2;

            return x >= centerLeft && x <= centerRight &&
                   y >= centerTop && y <= centerBottom;
        }

        // Double-click for desktop
        contentContainer.addEventListener('dblclick', function(e) {
            const rect = contentContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            if (isInCenterArea(rect, clickX, clickY)) {
                toggleSidebar();
            }
        });

        // Double-tap for touch devices
        let lastTapTime = 0;
        let lastTapX = 0;
        let lastTapY = 0;
        const doubleTapDelay = 300; // ms
        const doubleTapDistance = 30; // px

        contentContainer.addEventListener('touchstart', function(e) {
            const rect = contentContainer.getBoundingClientRect();
            const touch = e.touches[0];
            const tapX = touch.clientX - rect.left;
            const tapY = touch.clientY - rect.top;

            // Only process if in center area
            if (!isInCenterArea(rect, tapX, tapY)) {
                return;
            }

            const currentTime = new Date().getTime();
            const timeDiff = currentTime - lastTapTime;
            const distance = Math.sqrt(
                Math.pow(tapX - lastTapX, 2) + Math.pow(tapY - lastTapY, 2)
            );

            if (timeDiff < doubleTapDelay && distance < doubleTapDistance) {
                // Double tap detected
                e.preventDefault();
                toggleSidebar();
                lastTapTime = 0; // Reset
            } else {
                // First tap
                lastTapTime = currentTime;
                lastTapX = tapX;
                lastTapY = tapY;
            }
        }, { passive: false });

        // Tap outside sidebar to close (for mobile)
        let sidebarToggleTime = 0;
        const TOGGLE_COOLDOWN = 500; // ms

        // Track when sidebar is toggled
        const originalToggleSidebar = toggleSidebar;
        window.toggleSidebar = function() {
            sidebarToggleTime = new Date().getTime();
            return originalToggleSidebar.apply(this, arguments);
        };

        document.addEventListener('touchend', function(e) {
            if (!isMobileView()) return;

            const sidebar = document.getElementById('chaptersSidebar');
            if (!sidebar || !sidebar.classList.contains('visible')) return;

            // Don't hide if sidebar was just toggled (within cooldown period)
            const timeSinceToggle = new Date().getTime() - sidebarToggleTime;
            if (timeSinceToggle < TOGGLE_COOLDOWN) {
                return;
            }

            // Only hide when tapping on content container
            if (contentContainer.contains(e.target)) {
                hideSidebar();
            }
        }, { passive: true });
    }

    // Load saved pin state
    const savedPinState = localStorage.getItem('sidebarPinned');
    if (savedPinState === 'true') {
        isSidebarPinned = true;
        const sidebar = document.getElementById('chaptersSidebar');
        const pinIcon = document.getElementById('pinIcon');
        if (sidebar && pinIcon) {
            sidebar.classList.add('pinned');
            pinIcon.classList.remove('fa-thumbtack');
            pinIcon.classList.add('fa-lock');
            pinIcon.parentElement.title = 'Unpin sidebar';
        }
    }

    // Handle window resize to update sidebar position
    window.addEventListener('resize', function() {
        const sidebar = document.getElementById('chaptersSidebar');
        if (!sidebar) return;

        if (isMobileView()) {
            // Switching to mobile
            sidebar.style.display = 'block';
            if (isSidebarHidden) {
                sidebar.classList.add('hidden-bottom');
                sidebar.classList.remove('visible', 'hidden-left');
                // Ensure body scroll is unlocked when sidebar is hidden
                document.body.classList.remove('sidebar-open');
                document.body.style.top = '';
            } else {
                sidebar.classList.add('visible');
                sidebar.classList.remove('hidden-bottom', 'hidden-left');
                // Lock body scroll when sidebar is visible on mobile
                savedScrollPosition = window.scrollY || document.documentElement.scrollTop;
                document.body.classList.add('sidebar-open');
                document.body.style.top = `-${savedScrollPosition}px`;
            }
        } else {
            // Switching to desktop - always unlock body scroll
            document.body.classList.remove('sidebar-open');
            document.body.style.top = '';
            
            if (isSidebarHidden) {
                sidebar.classList.add('hidden-left');
                sidebar.classList.remove('visible', 'hidden-bottom');
            } else {
                sidebar.classList.add('visible');
                sidebar.style.display = 'block';
                sidebar.classList.remove('hidden-left', 'hidden-bottom');
            }
        }
    });

    // Setup pagination click handler - click in bottom 25dvh to scroll up one page
    setupPaginationClickHandler();
}

function setupPaginationClickHandler() {
    const contentContainer = document.querySelector('.content-container');
    if (!contentContainer) return;

    // Click handler for pagination
    function handlePaginationClick(e) {
        const rect = contentContainer.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const containerHeight = rect.height;

        // Check if click is in bottom 25% of the container (25dvh equivalent)
        const bottomThreshold = containerHeight * 0.75;

        if (clickY >= bottomThreshold) {
            // Scroll up one page
            const scrollAmount = containerHeight * 0.9; // 90% of viewport for overlap
            contentContainer.scrollBy({
                top: scrollAmount,
                behavior: 'smooth'
            });
        }
    }

    // Add click listener
    contentContainer.addEventListener('click', handlePaginationClick);

    // Add touch listener for mobile
    contentContainer.addEventListener('touchstart', function(e) {
        const touch = e.touches[0];
        const rect = contentContainer.getBoundingClientRect();
        const touchY = touch.clientY - rect.top;
        const containerHeight = rect.height;

        // Check if touch is in bottom 25% of the container
        const bottomThreshold = containerHeight * 0.75;

        if (touchY >= bottomThreshold) {
            e.preventDefault();
            const scrollAmount = containerHeight * 0.9;
            contentContainer.scrollBy({
                top: scrollAmount,
                behavior: 'smooth'
            });
        }
    }, { passive: false });
}

function handleHashChange() {
    const newStoryId = getStoryIdFromUrl();
    if (newStoryId && newStoryId !== storyId) {
        storyId = newStoryId;
        initializeViewer();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Check if mobile view
function isMobileView() {
    return window.innerWidth <= 768;
}

// Toggle sidebar visibility
function toggleSidebar() {
    const sidebar = document.getElementById('chaptersSidebar');
    if (!sidebar) return;

    if (isMobileView()) {
        // Mobile: slide from bottom
        if (isSidebarHidden) {
            // Save scroll position and lock body scroll
            savedScrollPosition = window.scrollY || document.documentElement.scrollTop;
            document.body.classList.add('sidebar-open');
            document.body.style.top = `-${savedScrollPosition}px`;
            
            sidebar.classList.remove('hidden-bottom');
            sidebar.classList.add('visible');
            isSidebarHidden = false;
        } else {
            sidebar.classList.add('hidden-bottom');
            sidebar.classList.remove('visible');
            
            // Unlock body scroll and restore position
            document.body.classList.remove('sidebar-open');
            document.body.style.top = '';
            window.scrollTo(0, savedScrollPosition);
            
            isSidebarHidden = true;
        }
    } else {
        // Desktop: slide from left
        if (isSidebarHidden) {
            sidebar.classList.remove('hidden-left');
            sidebar.style.display = 'block';
            isSidebarHidden = false;
        } else {
            sidebar.classList.add('hidden-left');
            isSidebarHidden = true;
        }
    }
}

/**
 * Truncate chapter title to max 32 Chinese characters
 * Each Chinese character counts as 1, English characters count as 0.5
 */
function truncateChapterTitle(title) {
    const maxChars = 32;
    let charCount = 0;
    let truncateIndex = title.length;

    for (let i = 0; i < title.length; i++) {
        // Check if character is Chinese (CJK Unified Ideographs range)
        const char = title[i];
        const isChinese = /[\u4e00-\u9fa5]/.test(char);
        charCount += isChinese ? 1 : 0.5;

        if (charCount > maxChars) {
            truncateIndex = i;
            break;
        }
    }

    if (truncateIndex < title.length) {
        return title.substring(0, truncateIndex) + '...';
    }
    return title;
}

/**
 * Convert Chinese number to Arabic numeral
 * Supports: 零一二三四五六七八九十百千万亿
 */
function chineseToArabic(chinese) {
    const chineseNums = {
        '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
        '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
        '十': 10, '百': 100, '千': 1000, '万': 10000, '亿': 100000000
    };

    let result = 0;
    let temp = 0;

    for (let i = 0; i < chinese.length; i++) {
        const char = chinese[i];
        const num = chineseNums[char];

        if (num === undefined) continue;

        if (num >= 10) {
            if (temp === 0) temp = 1;
            result += temp * num;
            temp = 0;
        } else {
            temp = temp * 10 + num;
        }
    }

    return result + temp;
}

/**
 * Extract chapter number from chapter title
 * Supports both Chinese and Arabic numerals
 */
function extractChapterNumber(title) {
    // Try to match Chinese number pattern: 第*章/回/节
    const chineseMatch = title.match(/第\s*([一二三四五六七八九十百千万零]+)\s*[章节卷部篇回]/);
    if (chineseMatch) {
        return chineseToArabic(chineseMatch[1]);
    }

    // Try to match Arabic number pattern: 第123章/Chapter 123
    const arabicMatch = title.match(/第\s*(\d+)\s*[章节卷部篇回]|Chapter\s+(\d+)/i);
    if (arabicMatch) {
        return parseInt(arabicMatch[1] || arabicMatch[2], 10);
    }

    return null;
}

// Auto-hide functionality
function setupAutoHide() {
    const sidebar = document.getElementById('chaptersSidebar');
    const contentContainer = document.querySelector('.content-container');
    const textContent = document.querySelector('.text-content');

    if (!sidebar || !contentContainer) return;

    // Add auto-hide classes
    sidebar.classList.add('auto-hide');

    // Hide sidebar when clicking on text content
    if (textContent) {
        textContent.addEventListener('click', function(e) {
            if (!isSidebarPinned && !isSidebarHidden) {
                hideSidebar();
            }
        });
    }
    
    // Scroll detection for main content
    let scrollTimer = null;
    contentContainer.addEventListener('scroll', function() {
        const currentScrollTop = contentContainer.scrollTop;
        const currentScrollLeft = contentContainer.scrollLeft;

        lastScrollTop = currentScrollTop;
        lastScrollLeft = currentScrollLeft;

        // Update current chapter highlight on scroll (debounced)
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            updateCurrentChapterFromScroll();
        }, 100);
    });
    
    // Scroll detection for chapters sidebar
    const sidebarContent = document.querySelector('.chapters-sidebar-content');
    if (sidebarContent) {
        sidebarContent.addEventListener('scroll', function() {
            // Just track scrolling state, don't auto-hide
            isScrollingInSidebar = true;
            clearTimeout(hideTimeout);

            setTimeout(() => {
                isScrollingInSidebar = false;
            }, 150);
        });
    }

}

// Store scroll position when locking body
let savedScrollPosition = 0;

function showSidebar() {
    const sidebar = document.getElementById('chaptersSidebar');
    if (sidebar && !isSidebarPinned) {
        if (isMobileView()) {
            // Save scroll position and lock body scroll
            savedScrollPosition = window.scrollY || document.documentElement.scrollTop;
            document.body.classList.add('sidebar-open');
            document.body.style.top = `-${savedScrollPosition}px`;
            
            sidebar.classList.remove('hidden-bottom');
            sidebar.classList.add('visible');
        } else {
            sidebar.classList.remove('hidden-left');
            sidebar.style.display = 'block';
        }
        isSidebarHidden = false;
    }
}

function hideSidebar() {
    const sidebar = document.getElementById('chaptersSidebar');
    if (sidebar && !isSidebarPinned && !isSidebarHidden) {
        if (isMobileView()) {
            sidebar.classList.add('hidden-bottom');
            sidebar.classList.remove('visible');
            
            // Unlock body scroll and restore position
            document.body.classList.remove('sidebar-open');
            document.body.style.top = '';
            window.scrollTo(0, savedScrollPosition);
        } else {
            sidebar.classList.add('hidden-left');
        }
        isSidebarHidden = true;
    }
}

function togglePinSidebar() {
    const sidebar = document.getElementById('chaptersSidebar');
    const pinIcon = document.getElementById('pinIcon');

    if (!sidebar || !pinIcon) return;

    isSidebarPinned = !isSidebarPinned;

    if (isSidebarPinned) {
        sidebar.classList.add('pinned');
        pinIcon.classList.remove('fa-thumbtack');
        pinIcon.classList.add('fa-lock');
        pinIcon.parentElement.title = 'Unpin sidebar';
        showSidebar(); // Ensure sidebar is visible when pinned
    } else {
        sidebar.classList.remove('pinned');
        pinIcon.classList.remove('fa-lock');
        pinIcon.classList.add('fa-thumbtack');
        pinIcon.parentElement.title = 'Pin sidebar';
        // Sidebar will auto-hide based on mouse movement
    }

    // Save pin state to localStorage
    localStorage.setItem('sidebarPinned', isSidebarPinned.toString());
}

async function loadFileContent() {
    try {
        // Get story content from local database
        const storyData = await window.localFileProcessor.db.getStoryById(storyId);
        if (!storyData) {
            throw new Error('Story not found');
        }
        
        // Use processed content if available, otherwise fall back to raw content
        fileContent = storyData.processedContent || storyData.content || '';
        
        // Parse chapters regardless of content type to populate sidebar
        // Use raw content for chapter parsing since processed content already has HTML structure
        const contentForParsing = storyData.content || '';
        if (contentForParsing) {
            // Temporarily set fileContent for parsing
            const originalFileContent = fileContent;
            fileContent = contentForParsing;
            parseChapters();
            // Restore original fileContent
            fileContent = originalFileContent;
        }
        
        // If we have processed content, display it directly as HTML
        if (storyData.processedContent) {
            const textContent = document.getElementById('textContent');
            if (textContent) {
                textContent.innerHTML = fileContent;
            }
        } else {
            // Display raw content
            displayCurrentPage();
        }
        
        // Update chapters list in sidebar
        updateChaptersList();
        
        // Set initial current chapter and position
        if (readingHistory) {
            // Restore from reading history
            restoreReadingPosition(readingHistory);
        } else {
            // Set initial current chapter
            currentChapter = getCurrentChapterFromPage(0);
            setTimeout(highlightCurrentChapter, 100);
        }

    } catch (error) {
        document.querySelector('.text-content').textContent = 'Error loading file content: ' + error.message;
    }
}

function restoreReadingPosition(history) {
    console.log('Restoring reading position from history:', history);
    
    // Scroll to last position
    const contentContainer = document.querySelector('.content-container');
    if (contentContainer && history.lastScrollPosition) {
        setTimeout(() => {
            contentContainer.scrollTo({
                top: history.lastScrollPosition,
                behavior: 'smooth'
            });
        }, 500);
    }
    
    // Highlight last chapter if available
    if (history.lastChapterTitle && chapters.length > 0) {
        const matchingChapter = chapters.find(ch => 
            ch.title.includes(history.lastChapterTitle) || 
            history.lastChapterTitle.includes(ch.title)
        );
        
        if (matchingChapter) {
            currentChapter = {
                id: matchingChapter.id,
                title: matchingChapter.title,
                pageNumber: matchingChapter.pageNumber
            };
            setTimeout(highlightCurrentChapter, 1000);
        }
    }
}

async function saveReadingProgress() {
    try {
        const contentContainer = document.querySelector('.content-container');
        if (!contentContainer) return;
        
        // Get current scroll position
        const scrollPosition = contentContainer.scrollTop;
        
        // Get current chapter
        let currentChapterTitle = '';
        if (currentChapter) {
            currentChapterTitle = currentChapter.title;
        } else {
            // Try to determine current chapter from scroll position
            const currentChapterObj = getCurrentChapterFromScrollPosition(scrollPosition);
            if (currentChapterObj) {
                currentChapterTitle = currentChapterObj.title;
            }
        }
        
        // Save to database
        const historyData = {
            storyId: storyId,
            lastChapterTitle: currentChapterTitle,
            lastScrollPosition: scrollPosition
        };
        
        await db.saveReadingHistory(historyData);
        
    } catch (error) {
        // Silently handle saving errors
    }
}

function getCurrentChapterFromScrollPosition(scrollPosition) {
    if (!chapters || chapters.length === 0) return null;
    
    const textContent = document.getElementById('textContent');
    if (!textContent) return null;
    
    // Estimate character position from scroll position
    const estimatedCharPos = Math.floor((scrollPosition / textContent.scrollHeight) * fileContent.length);
    
    // Find chapter containing this position
    for (let i = chapters.length - 1; i >= 0; i--) {
        const chapter = chapters[i];
        if (estimatedCharPos >= chapter.charPosition) {
            return chapter;
        }
    }
    
    return chapters[0];
}

function parseChapters() {
    chapters = [];
    const lines = fileContent.split('\n');
    let chapterIndex = 0;

    // Common chapter patterns - must match fileProcessor.js patterns
    const chapterPatterns = [
        /^第?\s*([一二三四五六七八九十百千万\d]+)\s*[章节卷部篇回]/, // Chinese chapters
        /^Chapter\s+(\d+)/i, // English chapters
        /^Section\s+(\d+)/i, // Sections
        /^[IVXLCDM]+\.\s/, // Roman numerals
        /^\d+\.\d+/, // Decimal numbering
        /^PART\s+[A-Z]+/i, // PART headings
        /^PROLOGUE/i, // Prologue
        /^EPILOGUE/i // Epilogue
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Check for chapter patterns
        for (const pattern of chapterPatterns) {
            if (pattern.test(line)) {
                chapterIndex++;
                // Extract chapter number from title for anchor ID
                const chapterNum = extractChapterNumber(line);
                const anchorId = chapterNum !== null
                    ? `chapter-${chapterNum}`
                    : `chapter-${chapterIndex}`;
                chapters.push({
                    id: `chapter_${chapters.length}`,
                    title: line,
                    anchorId: anchorId
                });
                break;
            }
        }
    }

    // Update chapters list in sidebar
    updateChaptersList();
}

function updateChaptersList() {
    const chapterList = document.getElementById('chapterList');
    if (!chapterList) {
        return;
    }

    chapterList.innerHTML = '';

    // Use filtered chapters if search is active, otherwise use all chapters
    const chaptersToShow = filteredChapters.length > 0 ? filteredChapters : chapters;

    chaptersToShow.forEach((chapter, index) => {
        const li = document.createElement('li');
        li.className = 'chapter-item';
        li.dataset.page = chapter.pageNumber;
        // Use extracted chapter number for data-index, fallback to array index
        const chapterNum = extractChapterNumber(chapter.title);
        li.dataset.index = chapterNum !== null ? chapterNum : index;
        li.textContent = truncateChapterTitle(chapter.title);
        li.title = chapter.title; // Show full title on hover
        li.addEventListener('click', function() {
            const chapterIndex = parseInt(this.dataset.index);
            scrollToChapter(chapterIndex);
        });
        chapterList.appendChild(li);
    });
}

function filterChapters(searchTerm) {
    if (!searchTerm.trim()) {
        filteredChapters = [];
        updateChaptersList();
        return;
    }

    const term = searchTerm.toLowerCase().trim();
    filteredChapters = chapters.filter((chapter, index) => {
        return chapter.title.toLowerCase().includes(term);
    }).map((chapter, index) => {
        return {
            ...chapter,
            originalIndex: chapters.indexOf(chapter)
        };
    });

    updateChaptersList();
}

function displayCurrentPage() {
    const textContent = document.getElementById('textContent');

    // Display entire content instead of paginated content
    if (textContent) {
        textContent.textContent = fileContent;
        textContent.style.fontSize = '18px';
    }

    // Set totalPages to 1 since we're showing entire content
    totalPages = 1;
}

function scrollToChapter(chapterIndexOrNum) {
    if (!chapters || chapters.length === 0) return;

    const contentContainer = document.querySelector('.content-container');
    if (!contentContainer) return;

    // Stop current speech if playing
    if (isSpeaking) {
        stopSpeech();
    }

    // Find chapter by anchor ID (e.g., "chapter-601") or array index
    const anchorId = `chapter-${chapterIndexOrNum}`;
    const chapter = chapters.find(ch => ch.anchorId === anchorId) || chapters[chapterIndexOrNum];

    if (!chapter) return;

    // Use anchor to navigate to chapter
    const targetAnchorId = chapter.anchorId || anchorId;
    const anchorElement = document.getElementById(targetAnchorId);

    if (anchorElement) {
        // Calculate scroll position relative to content container
        const containerRect = contentContainer.getBoundingClientRect();
        const anchorRect = anchorElement.getBoundingClientRect();
        const scrollPosition = contentContainer.scrollTop +
            (anchorRect.top - containerRect.top) - 20; // 20px offset for better visibility

        // Scroll to the chapter position with smooth animation
        contentContainer.scrollTo({
            top: Math.max(0, scrollPosition),
            behavior: 'smooth'
        });

        // Update current page and chapter tracking
        currentChapter = {
            id: chapter.id,
            title: chapter.title,
            pageNumber: chapter.pageNumber
        };
        highlightCurrentChapter();
    }
}

function findChapterTitlePosition(textContent, chapterTitle) {
    // Normalize the chapter title for better matching
    const normalizedTitle = chapterTitle.trim();

    // Try exact match first
    let position = textContent.indexOf(normalizedTitle);

    if (position === -1) {
        // Try fuzzy matching
        const simplifiedTitle = normalizedTitle
            .replace(/^[第章卷部篇回\s]+/, '')
            .replace(/^[Chapter\s]+/i, '')
            .trim();

        if (simplifiedTitle.length > 0) {
            position = textContent.indexOf(simplifiedTitle);

            if (position === -1) {
                const chapterNumberMatch = normalizedTitle.match(/[\d零一二三四五六七八九十百千万]+/);
                if (chapterNumberMatch) {
                    const chapterNumber = chapterNumberMatch[0];
                    const numberPatterns = [
                        `第${chapterNumber}[章节卷部篇回]`,
                        `Chapter\\s*${chapterNumber}`,
                        `${chapterNumber}\\s*[章节卷部篇回]`
                    ];

                    for (const pattern of numberPatterns) {
                        const regex = new RegExp(pattern, 'i');
                        const match = textContent.match(regex);
                        if (match) {
                            position = match.index;
                            break;
                        }
                    }
                }
            }
        }
    }

    return position;
}

function getCurrentChapterFromPage(page) {
    if (!chapters || chapters.length === 0) return null;

    for (let i = chapters.length - 1; i >= 0; i--) {
        const chapter = chapters[i];
        if (page >= chapter.pageNumber) {
            return {
                id: chapter.id,
                title: chapter.title,
                pageNumber: chapter.pageNumber
            };
        }
    }
    return chapters[0];
}

function highlightCurrentChapter() {
    // Remove all active/current classes
    document.querySelectorAll('.chapter-item').forEach(item => {
        item.classList.remove('active', 'current');
    });

    if (!currentChapter) return;

    // Extract chapter number from anchorId for matching
    const chapterNum = extractChapterNumber(currentChapter.title);
    const dataIndex = chapterNum !== null ? chapterNum : chapters.findIndex(ch => ch.title === currentChapter.title);

    // Find and highlight current chapter by data-index
    const currentChapterElement = document.querySelector(
        `.chapter-item[data-index="${dataIndex}"]`
    );
    if (currentChapterElement) {
        currentChapterElement.classList.add('current');
        currentChapterElement.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
}

function updateCurrentChapterFromScroll() {
    const contentContainer = document.querySelector('.content-container');
    if (!contentContainer || !chapters || chapters.length === 0) return;

    const containerRect = contentContainer.getBoundingClientRect();
    const scrollOffset = 150; // Offset from top to trigger chapter change

    // Find which chapter anchor is currently in view
    let newCurrentIndex = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
        const anchorId = chapters[i].anchorId || `chapter-${i + 1}`;
        const anchorElement = document.getElementById(anchorId);
        if (anchorElement) {
            const anchorRect = anchorElement.getBoundingClientRect();
            // Check if anchor is above the trigger line
            if (anchorRect.top <= containerRect.top + scrollOffset) {
                newCurrentIndex = i;
                break;
            }
        }
    }

    // Update current chapter if changed
    if (!currentChapter || chapters[newCurrentIndex].title !== currentChapter.title) {
        currentChapter = {
            id: chapters[newCurrentIndex].id,
            title: chapters[newCurrentIndex].title,
            pageNumber: chapters[newCurrentIndex].pageNumber
        };
        highlightCurrentChapter();
    }
}

function navigateToPreviousChapter() {
    if (!chapters || chapters.length === 0) return;

    const contentContainer = document.querySelector('.content-container');
    if (!contentContainer) return;

    const currentScrollTop = contentContainer.scrollTop;

    let currentChapterIndex = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
        const position = getChapterScrollPosition(i);
        if (position <= currentScrollTop + 100) {
            currentChapterIndex = i;
            break;
        }
    }

    if (currentChapterIndex > 0) {
        scrollToChapter(currentChapterIndex - 1);
    }
}

function navigateToNextChapter() {
    if (!chapters || chapters.length === 0) return;

    const contentContainer = document.querySelector('.content-container');
    if (!contentContainer) return;

    const currentScrollTop = contentContainer.scrollTop;

    let currentChapterIndex = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
        const position = getChapterScrollPosition(i);
        if (position <= currentScrollTop + 100) {
            currentChapterIndex = i;
            break;
        }
    }

    if (currentChapterIndex < chapters.length - 1) {
        scrollToChapter(currentChapterIndex + 1);
    }
}

function getChapterScrollPosition(chapterIndex) {
    if (!chapters || chapterIndex >= chapters.length) return 0;

    const chapter = chapters[chapterIndex];
    const contentContainer = document.querySelector('.content-container');

    if (!contentContainer) return 0;

    // Use anchor to get scroll position
    const anchorId = chapter.anchorId || `chapter-${chapterIndex + 1}`;
    const anchorElement = document.getElementById(anchorId);

    if (anchorElement) {
        const containerRect = contentContainer.getBoundingClientRect();
        const anchorRect = anchorElement.getBoundingClientRect();
        return contentContainer.scrollTop +
            (anchorRect.top - containerRect.top) - 20;
    }

    return 0;
}

function navigateWithinChapter(direction) {
    const contentContainer = document.querySelector('.content-container');
    const textContent = document.getElementById('textContent');

    if (!contentContainer || !textContent) return;

    const containerHeight = contentContainer.clientHeight;
    const contentHeight = textContent.clientHeight;
    const scrollTop = contentContainer.scrollTop;
    const scrollAmount = containerHeight * 0.8;

    if (direction > 0) {
        if (scrollTop + containerHeight >= contentHeight - 10) {
            console.log('Reached bottom of content');
        } else {
            contentContainer.scrollBy({
                top: scrollAmount,
                behavior: 'smooth'
            });
        }
    } else if (direction < 0) {
        if (scrollTop <= 10) {
            console.log('Reached top of content');
        } else {
            contentContainer.scrollBy({
                top: -scrollAmount,
                behavior: 'smooth'
            });
        }
    }
}

// Keyboard navigation
document.addEventListener('keydown', function(e) {
    // Arrow key navigation
    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            navigateToPreviousChapter();
            break;
        case 'ArrowRight':
            e.preventDefault();
            navigateToNextChapter();
            break;
        case 'ArrowUp':
            e.preventDefault();
            navigateWithinChapter(-1);
            break;
        case 'ArrowDown':
        case ' ':
            e.preventDefault();
            navigateWithinChapter(1);
            break;
    }
    
    // Number key navigation (1-9)
    if (e.key >= '1' && e.key <= '9') {
        const chapterIndex = parseInt(e.key) - 1;
        if (chapterIndex < chapters.length) {
            e.preventDefault();
            scrollToChapter(chapterIndex);
        }
    }
});

// Speech Synthesis functionality
let speechSynthesis = window.speechSynthesis;
let speechUtterance = null;
let isSpeaking = false;
let isPaused = false;
let speechTextQueue = [];
let currentSpeechIndex = 0;
let chineseVoice = null;
let speechRate = 1.3;
const MIN_SPEECH_RATE = 0.5;
const MAX_SPEECH_RATE = 2.0;
const SPEECH_RATE_STEP = 0.1;

// Initialize speech synthesis
function initSpeechSynthesis() {
    if (!speechSynthesis) {
        console.warn('Speech synthesis not supported');
        return;
    }

    // Find Chinese male voice
    chineseVoice = selectChineseMaleVoice();

    // If voices not loaded yet, wait for them
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.onvoiceschanged = () => {
            chineseVoice = selectChineseMaleVoice();
        };
    }

    // Setup speech button
    setupSpeechButton();
}

// Select Chinese male voice
function selectChineseMaleVoice() {
    const voices = speechSynthesis.getVoices();

    // Filter Chinese voices
    const chineseVoices = voices.filter(voice =>
        voice.lang.includes('zh') || voice.lang.includes('cmn')
    );

    if (chineseVoices.length === 0) {
        return null;
    }

    // Try to find male voice by name patterns
    const maleVoice = chineseVoices.find(voice => {
        const name = voice.name.toLowerCase();
        // Common patterns for male voices in Chinese TTS
        return name.includes('male') ||
               name.includes('nan') ||     // 男
               name.includes('nanxing') || // 男性
               name.includes('xiansheng') || // 先生
               name.includes('yong') ||    // 勇/永 (common in male names)
               name.includes('wei') ||     // 伟
               name.includes('qiang') ||   // 强
               name.includes('gang');      // 刚
    });

    if (maleVoice) {
        console.log('Selected Chinese male voice:', maleVoice.name);
        return maleVoice;
    }

    // If no male voice found, try to avoid female-sounding names
    const nonFemaleVoice = chineseVoices.find(voice => {
        const name = voice.name.toLowerCase();
        return !name.includes('female') &&
               !name.includes('nv') &&      // 女
               !name.includes('nvxing');    // 女性
    });

    if (nonFemaleVoice) {
        console.log('Selected Chinese voice (non-female):', nonFemaleVoice.name);
        return nonFemaleVoice;
    }

    // Fall back to first Chinese voice
    console.log('Selected default Chinese voice:', chineseVoices[0].name);
    return chineseVoices[0];
}

// Setup speech button event listener
function setupSpeechButton() {
    const speechBtn = document.getElementById('speechBtn');
    if (speechBtn) {
        speechBtn.addEventListener('click', toggleSpeech);
    }

    // Setup speed control buttons
    const speedDownBtn = document.getElementById('speechSpeedDownBtn');
    const speedUpBtn = document.getElementById('speechSpeedUpBtn');

    if (speedDownBtn) {
        speedDownBtn.addEventListener('click', decreaseSpeechSpeed);
    }
    if (speedUpBtn) {
        speedUpBtn.addEventListener('click', increaseSpeechSpeed);
    }
}

// Decrease speech speed
function decreaseSpeechSpeed() {
    const newRate = Math.max(MIN_SPEECH_RATE, speechRate - SPEECH_RATE_STEP);
    if (newRate !== speechRate) {
        speechRate = Math.round(newRate * 10) / 10;
        console.log('Speech speed decreased to:', speechRate);
        applySpeechSpeedChange();
    }
}

// Increase speech speed
function increaseSpeechSpeed() {
    const newRate = Math.min(MAX_SPEECH_RATE, speechRate + SPEECH_RATE_STEP);
    if (newRate !== speechRate) {
        speechRate = Math.round(newRate * 10) / 10;
        console.log('Speech speed increased to:', speechRate);
        applySpeechSpeedChange();
    }
}

// Apply speed change immediately
function applySpeechSpeedChange() {
    // If currently speaking, restart with new speed immediately
    if (isSpeaking) {
        const wasPaused = isPaused;
        const currentIndex = currentSpeechIndex;

        // Cancel current speech
        speechSynthesis.cancel();

        // Reset state
        isPaused = false;
        updateSpeechButton();

        // Resume from current position with new speed
        currentSpeechIndex = currentIndex;
        speakNext();

        // If it was paused, pause again
        if (wasPaused) {
            setTimeout(() => {
                speechSynthesis.pause();
                isPaused = true;
                updateSpeechButton();
            }, 100);
        }
    }
}

// Get all text content for speech
function getTextForSpeech() {
    const textContent = document.getElementById('textContent');
    if (!textContent) return [];

    // Get all text nodes, split by paragraphs or lines
    const text = textContent.innerText || textContent.textContent || '';
    return text.split('\n').filter(line => line.trim().length > 0);
}

// Toggle speech play/pause
function toggleSpeech() {
    if (!speechSynthesis) {
        alert('Speech synthesis not supported in this browser');
        return;
    }

    if (isSpeaking && !isPaused) {
        // Currently speaking - pause it
        pauseSpeech();
    } else if (isSpeaking && isPaused) {
        // Currently paused - resume it
        resumeSpeech();
    } else {
        // Not speaking - start fresh
        startSpeech();
    }
}

// Start speech from current position
function startSpeech() {
    speechTextQueue = getTextForSpeech();
    if (speechTextQueue.length === 0) return;

    // Get current scroll position to determine where to start
    const contentContainer = document.querySelector('.content-container');
    const scrollTop = contentContainer ? contentContainer.scrollTop : 0;

    // Find the text index closest to current scroll position
    currentSpeechIndex = getTextIndexFromScrollPosition(scrollTop);

    isSpeaking = true;
    isPaused = false;
    updateSpeechButton();
    speakNext();
}

// Pause speech
function pauseSpeech() {
    if (speechSynthesis) {
        speechSynthesis.cancel(); // Cancel current utterance
        isPaused = true;
        updateSpeechButton();
    }
}

// Resume speech
function resumeSpeech() {
    if (speechSynthesis) {
        isPaused = false;
        updateSpeechButton();
        speakNext(); // Start from current index
    }
}

// Stop speech
function stopSpeech() {
    if (speechSynthesis) {
        speechSynthesis.cancel();
    }
    isSpeaking = false;
    isPaused = false;
    currentSpeechIndex = 0;
    updateSpeechButton();
}

// Speak next line
function speakNext() {
    if (!isSpeaking || isPaused || currentSpeechIndex >= speechTextQueue.length) {
        if (currentSpeechIndex >= speechTextQueue.length) {
            stopSpeech();
        }
        return;
    }

    const text = speechTextQueue[currentSpeechIndex];

    speechUtterance = new SpeechSynthesisUtterance(text);

    if (chineseVoice) {
        speechUtterance.voice = chineseVoice;
    }
    speechUtterance.lang = 'zh-CN';
    speechUtterance.rate = speechRate;
    speechUtterance.pitch = 1.0;

    // Handle speech end
    speechUtterance.onend = () => {
        if (isSpeaking && !isPaused) {
            currentSpeechIndex++;
            checkAutoScroll();
            // Use setTimeout to prevent stack overflow on long texts
            setTimeout(() => speakNext(), 0);
        }
    };

    // Handle speech error
    speechUtterance.onerror = (event) => {
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
            console.error('Speech error:', event.error);
        }
    };

    // Highlight current speaking line
    highlightSpeechLine(currentSpeechIndex);

    speechSynthesis.speak(speechUtterance);
}

// Get text index from scroll position
function getTextIndexFromScrollPosition(scrollTop) {
    const textContent = document.getElementById('textContent');
    if (!textContent) return 0;

    const lines = speechTextQueue;
    const totalHeight = textContent.scrollHeight;
    const approximateIndex = Math.floor((scrollTop / totalHeight) * lines.length);

    return Math.max(0, Math.min(approximateIndex, lines.length - 1));
}

// Highlight the currently speaking line
function highlightSpeechLine(index) {
    // Remove previous highlight
    document.querySelectorAll('.speech-highlight').forEach(el => {
        el.classList.remove('speech-highlight');
    });

    const textContent = document.getElementById('textContent');
    if (!textContent || !speechTextQueue[index]) return;

    const targetText = speechTextQueue[index].trim();
    if (!targetText) return;

    // Get all chapter-content divs
    const contentDivs = textContent.querySelectorAll('.chapter-content');
    if (contentDivs.length === 0) {
        // Fallback: try to find in entire text content
        highlightInElement(textContent, targetText);
        return;
    }

    // Search in each content div
    for (const div of contentDivs) {
        if (highlightInElement(div, targetText)) {
            return;
        }
    }
}

// Helper function to highlight text within an element
function highlightInElement(element, targetText) {
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    while (node = walker.nextNode()) {
        const nodeText = node.textContent;
        const trimmedText = nodeText.trim();

        // Check for exact match or if target is part of this node
        if (trimmedText === targetText || nodeText.includes(targetText)) {
            const parent = node.parentElement;
            if (parent && parent !== element) {
                parent.classList.add('speech-highlight');
                scrollToSpeechLine(parent);
                return true;
            } else if (nodeText.includes(targetText)) {
                // Wrap the matching text in a span
                const span = document.createElement('span');
                span.className = 'speech-highlight';
                const beforeText = nodeText.substring(0, nodeText.indexOf(targetText));
                const afterText = nodeText.substring(nodeText.indexOf(targetText) + targetText.length);

                const parent = node.parentNode;
                if (beforeText) {
                    parent.insertBefore(document.createTextNode(beforeText), node);
                }
                span.textContent = targetText;
                parent.insertBefore(span, node);
                if (afterText) {
                    parent.insertBefore(document.createTextNode(afterText), node);
                }
                parent.removeChild(node);

                scrollToSpeechLine(span);
                return true;
            }
        }
    }
    return false;
}

// Scroll to keep speech line visible
function scrollToSpeechLine(element) {
    const contentContainer = document.querySelector('.content-container');
    if (!contentContainer || !element) return;

    const containerRect = contentContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    // Check if element is in the last two lines of visible area
    const lineHeight = parseInt(getComputedStyle(element).lineHeight) || 24;
    const visibleHeight = containerRect.height;
    const elementTop = elementRect.top - containerRect.top;

    // If element is below the visible area or in the last 2 lines
    if (elementTop > visibleHeight - lineHeight * 2) {
        // Scroll up to keep previous line visible
        const scrollAmount = elementTop - lineHeight;
        contentContainer.scrollBy({
            top: scrollAmount,
            behavior: 'smooth'
        });
    }
}

// Check if auto-scroll is needed
function checkAutoScroll() {
    const contentContainer = document.querySelector('.content-container');
    if (!contentContainer) return;

    const containerHeight = contentContainer.clientHeight;
    const scrollTop = contentContainer.scrollTop;
    const scrollHeight = contentContainer.scrollHeight;

    // Get current highlighted element
    const highlighted = document.querySelector('.speech-highlight');
    if (!highlighted) return;

    const elementRect = highlighted.getBoundingClientRect();
    const containerRect = contentContainer.getBoundingClientRect();
    const elementTop = elementRect.top - containerRect.top;
    const lineHeight = parseInt(getComputedStyle(highlighted).lineHeight) || 24;

    // If element is in the last 2 lines of visible area, scroll
    if (elementTop > containerHeight - lineHeight * 2) {
        // Scroll to show the previous line at the top
        contentContainer.scrollBy({
            top: lineHeight * 2,
            behavior: 'smooth'
        });
    }
}

// Update speech button icon
function updateSpeechButton() {
    const speechIcon = document.getElementById('speechIcon');
    if (!speechIcon) return;

    if (isSpeaking) {
        if (isPaused) {
            speechIcon.className = 'fas fa-play';
        } else {
            speechIcon.className = 'fas fa-pause';
        }
    } else {
        speechIcon.className = 'fas fa-play';
    }
}

// Initialize speech synthesis when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initSpeechSynthesis();
});

// Stop speech when leaving page
window.addEventListener('beforeunload', () => {
    stopSpeech();
});