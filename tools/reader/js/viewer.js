/**
 * Viewer Script for Text Reader Application
 * Handles the text viewing functionality with chapter navigation
 */

// Initialize iOS viewport height handling
if (window.initializeIOSViewport) {
  window.initializeIOSViewport();
}

// Auto-hide functionality variables
let db = null;
let localFileProcessor = null;
let storyId = null;

// Auto-hide functionality variables
let isSidebarHidden = false;
let isSidebarPinned = false;
let lastScrollTop = 0;
let isScrollingInSidebar = false;

// Get story ID from URL hash
function getStoryIdFromUrl() {
  const hash = window.location.hash;
  if (hash.startsWith('#view/')) {
    return hash.substring(6);
  }
  return null;
}

let fileContent = '';
let chapters = [];
let currentChapter = null;
let totalPages = 1;
let filteredChapters = [];
let readingHistory = null;
let currentBookId = null;
let allBookStories = [];

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

  // Store bookId and load all stories in the book for cross-story search
  currentBookId = storyData ? storyData.bookId : null;
  if (currentBookId) {
    allBookStories = await db.getStoriesByBookId(currentBookId);
    // Sort by splitIndex if available
    allBookStories.sort((a, b) => {
      if (a.splitIndex && b.splitIndex) {
        return a.splitIndex - b.splitIndex;
      }
      return 0;
    });
  }

  // Load reading history
  readingHistory = await db.getReadingHistory(storyId);

  // Load the TXT file content
  await loadFileContent();

  // Initialize chapters sidebar
  const sidebar = document.getElementById('chaptersSidebar');
  if (sidebar) {
    if (isMobileView()) {
      sidebar.classList.add('hidden-bottom');
      isSidebarHidden = true;
    } else {
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
  setInterval(saveReadingProgress, 30000);

  // Save on page unload
  window.addEventListener('beforeunload', saveReadingProgress);

  // Load saved theme
  const savedTheme = localStorage.getItem('preferredViewerTheme') || 'maize-yello';
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
    const doubleTapDelay = 300;
    const doubleTapDistance = 30;

    contentContainer.addEventListener('touchstart', function(e) {
      const rect = contentContainer.getBoundingClientRect();
      const touch = e.touches[0];
      const tapX = touch.clientX - rect.left;
      const tapY = touch.clientY - rect.top;

      if (!isInCenterArea(rect, tapX, tapY)) {
        return;
      }

      const currentTime = new Date().getTime();
      const timeDiff = currentTime - lastTapTime;
      const distance = Math.sqrt(
        Math.pow(tapX - lastTapX, 2) + Math.pow(tapY - lastTapY, 2)
      );

      if (timeDiff < doubleTapDelay && distance < doubleTapDistance) {
        e.preventDefault();
        toggleSidebar();
        lastTapTime = 0;
      } else {
        lastTapTime = currentTime;
        lastTapX = tapX;
        lastTapY = tapY;
      }
    }, { passive: false });

    // Tap outside sidebar to close (for mobile)
    let sidebarToggleTime = 0;
    const TOGGLE_COOLDOWN = 500;

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

      const timeSinceToggle = new Date().getTime() - sidebarToggleTime;
      if (timeSinceToggle < TOGGLE_COOLDOWN) {
        return;
      }

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
      sidebar.style.display = 'block';
      if (isSidebarHidden) {
        sidebar.classList.add('hidden-bottom');
        sidebar.classList.remove('visible', 'hidden-left');
        document.body.classList.remove('sidebar-open');
        document.body.style.top = '';
      } else {
        sidebar.classList.add('visible');
        sidebar.classList.remove('hidden-bottom', 'hidden-left');
        savedScrollPosition = window.scrollY || document.documentElement.scrollTop;
        document.body.classList.add('sidebar-open');
        document.body.style.top = `-${savedScrollPosition}px`;
      }
    } else {
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

  // Setup pagination click handler
  setupPaginationClickHandler();
}

function setupPaginationClickHandler() {
  const contentContainer = document.querySelector('.content-container');
  if (!contentContainer) return;

  // Bottom 20% area triggers pagination
  const BOTTOM_TAP_THRESHOLD = 0.80; // Bottom 20% of screen

  function handlePaginationClick(e) {
    const rect = contentContainer.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const containerHeight = rect.height;
    const bottomThreshold = containerHeight * BOTTOM_TAP_THRESHOLD;

    // Check if click is in bottom pagination zone
    if (clickY >= bottomThreshold) {
      const scrollAmount = containerHeight * 0.9;
      contentContainer.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });
    }
  }

  contentContainer.addEventListener('click', handlePaginationClick);

  let touchStartY = 0;
  let touchStartTime = 0;
  let isInPaginationZone = false;
  let hasMoved = false;

  contentContainer.addEventListener('touchstart', function(e) {
    const touch = e.touches[0];
    const rect = contentContainer.getBoundingClientRect();
    const touchY = touch.clientY - rect.top;
    const containerHeight = rect.height;
    const bottomThreshold = containerHeight * BOTTOM_TAP_THRESHOLD;

    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    hasMoved = false;

    // Check if touch is in bottom pagination zone
    isInPaginationZone = (touchY >= bottomThreshold);
  }, { passive: true });

  contentContainer.addEventListener('touchmove', function(e) {
    // Mark that user has moved - this means it's not a tap
    hasMoved = true;
    // Don't prevent default - allow normal browser scrolling behavior
  }, { passive: true });

  contentContainer.addEventListener('touchend', function(e) {
    if (!isInPaginationZone || hasMoved) {
      isInPaginationZone = false;
      hasMoved = false;
      return;
    }

    const touch = e.changedTouches[0];
    const touchEndY = touch.clientY;
    const touchDuration = Date.now() - touchStartTime;
    const moveDistance = Math.abs(touchEndY - touchStartY);

    // Only trigger pagination if it's a tap (short duration, minimal movement, no drag)
    if (touchDuration < 300 && moveDistance < 10) {
      e.preventDefault();
      const rect = contentContainer.getBoundingClientRect();
      const containerHeight = rect.height;
      const scrollAmount = containerHeight * 0.9;
      contentContainer.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });
    }

    isInPaginationZone = false;
    hasMoved = false;
  }, { passive: false });
}

function handleHashChange() {
  const newStoryId = getStoryIdFromUrl();
  if (newStoryId && newStoryId !== storyId) {
    storyId = newStoryId;
    initializeViewer();
  }
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
    if (isSidebarHidden) {
      savedScrollPosition = window.scrollY || document.documentElement.scrollTop;
      document.body.classList.add('sidebar-open');
      document.body.style.top = `-${savedScrollPosition}px`;

      sidebar.classList.remove('hidden-bottom');
      sidebar.classList.add('visible');
      isSidebarHidden = false;
    } else {
      sidebar.classList.add('hidden-bottom');
      sidebar.classList.remove('visible');

      document.body.classList.remove('sidebar-open');
      document.body.style.top = '';
      window.scrollTo(0, savedScrollPosition);

      isSidebarHidden = true;
    }
  } else {
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
 */
function truncateChapterTitle(title) {
  const maxChars = 32;
  let charCount = 0;
  let truncateIndex = title.length;

  for (let i = 0; i < title.length; i++) {
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

// Auto-hide functionality
function setupAutoHide() {
  const sidebar = document.getElementById('chaptersSidebar');
  const contentContainer = document.querySelector('.content-container');
  const textContent = document.querySelector('.text-content');

  if (!sidebar || !contentContainer) return;

  sidebar.classList.add('auto-hide');

  if (textContent) {
    textContent.addEventListener('click', function(e) {
      if (!isSidebarPinned && !isSidebarHidden) {
        hideSidebar();
      }
    });
  }

  let scrollTimer = null;
  contentContainer.addEventListener('scroll', function() {
    const currentScrollTop = contentContainer.scrollTop;
    lastScrollTop = currentScrollTop;

    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      updateCurrentChapterFromScroll();
    }, 100);
  });

  const sidebarContent = document.querySelector('.chapters-sidebar-content');
  if (sidebarContent) {
    let sidebarScrollTimer = null;
    sidebarContent.addEventListener('scroll', function() {
      isScrollingInSidebar = true;

      // Add scrolling class to disable hover during scroll
      sidebarContent.classList.add('scrolling');

      // Clear previous timer
      clearTimeout(sidebarScrollTimer);

      // Remove scrolling class after scroll stops
      sidebarScrollTimer = setTimeout(() => {
        isScrollingInSidebar = false;
        sidebarContent.classList.remove('scrolling');
      }, 150);
    });
  }

  // Also add scrolling detection for chapter list
  const chapterList = document.querySelector('.chapter-list');
  if (chapterList) {
    let chapterListScrollTimer = null;
    chapterList.addEventListener('scroll', function() {
      // Add scrolling class to disable hover during scroll
      chapterList.classList.add('scrolling');

      // Clear previous timer
      clearTimeout(chapterListScrollTimer);

      // Remove scrolling class after scroll stops
      chapterListScrollTimer = setTimeout(() => {
        chapterList.classList.remove('scrolling');
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
    showSidebar();
  } else {
    sidebar.classList.remove('pinned');
    pinIcon.classList.remove('fa-lock');
    pinIcon.classList.add('fa-thumbtack');
    pinIcon.parentElement.title = 'Pin sidebar';
  }

  localStorage.setItem('sidebarPinned', isSidebarPinned.toString());
}

/**
 * Load a different story by ID and optionally scroll to a specific chapter
 * Used when clicking cross-story search results
 */
async function loadStoryById(newStoryId, targetAnchorId, targetChapterTitle) {
  try {
    // Update current story ID
    storyId = newStoryId;
    
    // Update URL hash without triggering hashchange reload
    history.replaceState(null, '', `reader.html#view/${newStoryId}`);
    
    // Clear search input and filtered results
    const searchInput = document.getElementById('chapterSearch');
    if (searchInput) {
      searchInput.value = '';
    }
    filteredChapters = [];
    
    // Load the new story content
    const storyData = await db.getStoryById(newStoryId);
    if (!storyData) {
      throw new Error('Story not found');
    }
    
    fileContent = storyData.processedContent || storyData.content || '';
    
    // Update chapters from new story
    if (storyData.chapters && storyData.chapters.length > 0) {
      chapters = storyData.chapters.map((ch, index) => ({
        id: `chapter_${index}`,
        title: ch.title,
        anchorId: ch.anchorId,
        lineNumber: ch.lineNumber
      }));
    } else {
      chapters = [];
    }
    
    // Render new content
    const textContent = document.getElementById('textContent');
    if (textContent) {
      if (storyData.processedContent) {
        textContent.innerHTML = fileContent;
      } else {
        textContent.textContent = fileContent;
      }
    }
    
    // Update chapter list in sidebar
    updateChaptersList();
    
    // Find and set current chapter
    if (targetChapterTitle) {
      const matchingChapter = chapters.find(ch => ch.title === targetChapterTitle);
      if (matchingChapter) {
        currentChapter = {
          id: matchingChapter.id,
          title: matchingChapter.title
        };
      }
    }
    
    // Scroll to the target chapter after content is rendered
    setTimeout(() => {
      if (targetAnchorId) {
        const anchorElement = document.getElementById(targetAnchorId);
        const contentContainer = document.querySelector('.content-container');
        
        if (anchorElement && contentContainer) {
          const containerRect = contentContainer.getBoundingClientRect();
          const anchorRect = anchorElement.getBoundingClientRect();
          const scrollPosition = contentContainer.scrollTop +
            (anchorRect.top - containerRect.top) - 20;
          
          contentContainer.scrollTo({
            top: Math.max(0, scrollPosition),
            behavior: 'smooth'
          });
        }
      }
      
      highlightCurrentChapter();
    }, 100);
    
  } catch (error) {
    console.error('Error loading story:', error);
    document.querySelector('.text-content').textContent = 'Error loading story: ' + error.message;
  }
}

async function loadFileContent() {
  try {
    const storyData = await window.localFileProcessor.db.getStoryById(storyId);
    if (!storyData) {
      throw new Error('Story not found');
    }

    fileContent = storyData.processedContent || storyData.content || '';

    // Use pre-parsed chapters from story data (with line-based anchors)
    if (storyData.chapters && storyData.chapters.length > 0) {
      chapters = storyData.chapters.map((ch, index) => ({
        id: `chapter_${index}`,
        title: ch.title,
        anchorId: ch.anchorId,
        lineNumber: ch.lineNumber
      }));
    } else {
      // Fallback: parse chapters if not available in story data
      const contentForParsing = storyData.content || '';
      if (contentForParsing) {
        const originalFileContent = fileContent;
        fileContent = contentForParsing;
        parseChapters();
        fileContent = originalFileContent;
      }
    }

    if (storyData.processedContent) {
      const textContent = document.getElementById('textContent');
      if (textContent) {
        textContent.innerHTML = fileContent;
      }
    } else {
      displayCurrentPage();
    }

    updateChaptersList();

    if (readingHistory) {
      restoreReadingPosition(readingHistory);
    } else {
      currentChapter = getCurrentChapterFromPage(0);
      setTimeout(highlightCurrentChapter, 100);
    }

  } catch (error) {
    document.querySelector('.text-content').textContent = 'Error loading file content: ' + error.message;
  }
}

function restoreReadingPosition(history) {
  const contentContainer = document.querySelector('.content-container');
  if (contentContainer && history.lastScrollPosition) {
    setTimeout(() => {
      contentContainer.scrollTo({
        top: history.lastScrollPosition,
        behavior: 'smooth'
      });
    }, 500);
  }

  if (history.lastChapterTitle && chapters.length > 0) {
    const matchingChapter = chapters.find(ch =>
      ch.title.includes(history.lastChapterTitle) ||
      history.lastChapterTitle.includes(ch.title)
    );

    if (matchingChapter) {
      currentChapter = {
        id: matchingChapter.id,
        title: matchingChapter.title
      };
      setTimeout(highlightCurrentChapter, 1000);
    }
  }
}

async function saveReadingProgress() {
  try {
    const contentContainer = document.querySelector('.content-container');
    if (!contentContainer) return;

    const scrollPosition = contentContainer.scrollTop;

    let currentChapterTitle = '';
    if (currentChapter) {
      currentChapterTitle = currentChapter.title;
    } else {
      const currentChapterObj = getCurrentChapterFromScrollPosition(scrollPosition);
      if (currentChapterObj) {
        currentChapterTitle = currentChapterObj.title;
      }
    }

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

  const estimatedCharPos = Math.floor((scrollPosition / textContent.scrollHeight) * fileContent.length);

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

  const chapterPatterns = LocalFileProcessor.CHAPTER_PATTERNS;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const pattern of chapterPatterns) {
      if (pattern.test(line)) {
        // Use line number as anchor ID
        const anchorId = `line-${i}`;
        chapters.push({
          id: `chapter_${chapters.length}`,
          title: line,
          anchorId: anchorId,
          lineNumber: i
        });
        break;
      }
    }
  }

  updateChaptersList();
}

function updateChaptersList() {
  const chapterList = document.getElementById('chapterList');
  if (!chapterList) {
    return;
  }

  chapterList.innerHTML = '';

  const chaptersToShow = filteredChapters.length > 0 ? filteredChapters : chapters;

  chaptersToShow.forEach((chapter, displayIndex) => {
    const li = document.createElement('li');
    li.className = 'chapter-item';
    
    // Check if this is a cross-story result
    if (chapter.isCurrentStory === false) {
      // Cross-story chapter - load and render the other story
      li.classList.add('cross-story-chapter');
      li.dataset.storyId = chapter.storyId;
      li.dataset.anchorId = chapter.anchorId;
      li.innerHTML = `<span class="chapter-title-text">${truncateChapterTitle(chapter.title)}</span><span class="story-indicator">${truncateChapterTitle(chapter.storyTitle)}</span>`;
      li.title = `${chapter.title} (${chapter.storyTitle})`;
      li.addEventListener('click', async function() {
        const targetStoryId = chapter.storyId;
        const targetAnchorId = chapter.anchorId;
        const targetChapterTitle = chapter.title;
        
        // Load the new story without page navigation
        await loadStoryById(targetStoryId, targetAnchorId, targetChapterTitle);
      });
    } else {
      // Current story chapter
      const actualIndex = chapter.originalIndex !== undefined ? chapter.originalIndex : chapters.indexOf(chapter);
      li.dataset.index = actualIndex;
      li.textContent = truncateChapterTitle(chapter.title);
      li.title = chapter.title;
      li.addEventListener('click', function() {
        const chapterIndex = parseInt(this.dataset.index);
        scrollToChapter(chapterIndex);
      });
    }
    
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
  
  // First, search current story's chapters
  const currentStoryResults = chapters.filter((chapter) => {
    return chapter.title.toLowerCase().includes(term);
  }).map((chapter) => {
    return {
      ...chapter,
      originalIndex: chapters.indexOf(chapter),
      isCurrentStory: true,
      storyId: storyId
    };
  });

  // Then, search other stories in the same book
  const otherStoryResults = [];
  if (allBookStories && allBookStories.length > 1) {
    for (const story of allBookStories) {
      // Skip current story (already searched)
      if (story.id === storyId) continue;
      
      if (story.chapters && story.chapters.length > 0) {
        const matchedChapters = story.chapters.filter((ch) => {
          return ch.title.toLowerCase().includes(term);
        }).map((ch, index) => {
          return {
            title: ch.title,
            anchorId: ch.anchorId,
            lineNumber: ch.lineNumber,
            isCurrentStory: false,
            storyId: story.id,
            storyTitle: story.extractedTitle || story.fileName
          };
        });
        otherStoryResults.push(...matchedChapters);
      }
    }
  }

  // Combine results: current story first, then other stories
  filteredChapters = [...currentStoryResults, ...otherStoryResults];

  updateChaptersList();
}

function displayCurrentPage() {
  const textContent = document.getElementById('textContent');

  if (textContent) {
    textContent.textContent = fileContent;
    textContent.style.fontSize = '18px';
  }

  totalPages = 1;
}

function scrollToChapter(chapterIndexOrNum) {
  if (!chapters || chapters.length === 0) return;

  const contentContainer = document.querySelector('.content-container');
  if (!contentContainer) return;

  if (isSpeaking) {
    stopSpeech();
  }

  const anchorId = `chapter-${chapterIndexOrNum}`;
  const chapter = chapters.find(ch => ch.anchorId === anchorId) || chapters[chapterIndexOrNum];

  if (!chapter) return;

  const targetAnchorId = chapter.anchorId || anchorId;
  const anchorElement = document.getElementById(targetAnchorId);

  if (anchorElement) {
    const containerRect = contentContainer.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    const scrollPosition = contentContainer.scrollTop +
      (anchorRect.top - containerRect.top) - 20;

    contentContainer.scrollTo({
      top: Math.max(0, scrollPosition),
      behavior: 'smooth'
    });

    currentChapter = {
      id: chapter.id,
      title: chapter.title
    };
    highlightCurrentChapter();
  }
}

function getCurrentChapterFromPage(page) {
  if (!chapters || chapters.length === 0) return null;

  // Return the first chapter when initially loading the page
  return {
    id: chapters[0].id,
    title: chapters[0].title
  };
}

function highlightCurrentChapter() {
  document.querySelectorAll('.chapter-item').forEach(item => {
    item.classList.remove('active', 'current');
  });

  if (!currentChapter) return;

  // Find the actual index of the current chapter in the chapters array
  const dataIndex = chapters.findIndex(ch => ch.title === currentChapter.title);

  if (dataIndex === -1) return;

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
  const scrollOffset = 150;

  let newCurrentIndex = 0;
  for (let i = chapters.length - 1; i >= 0; i--) {
    const anchorId = chapters[i].anchorId || `chapter-${i + 1}`;
    const anchorElement = document.getElementById(anchorId);
    if (anchorElement) {
      const anchorRect = anchorElement.getBoundingClientRect();
      if (anchorRect.top <= containerRect.top + scrollOffset) {
        newCurrentIndex = i;
        break;
      }
    }
  }

  if (!currentChapter || chapters[newCurrentIndex].title !== currentChapter.title) {
    currentChapter = {
      id: chapters[newCurrentIndex].id,
      title: chapters[newCurrentIndex].title
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

  // Use the anchorId stored in chapter data (line-based)
  const anchorId = chapter.anchorId;
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
  const scrollAmount = containerHeight * 0.8;

  if (direction > 0) {
    contentContainer.scrollBy({
      top: scrollAmount,
      behavior: 'smooth'
    });
  } else if (direction < 0) {
    contentContainer.scrollBy({
      top: -scrollAmount,
      behavior: 'smooth'
    });
  }
}

// Keyboard navigation
document.addEventListener('keydown', function(e) {
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

// Wake Lock to prevent screen sleep during TTS
let wakeLock = null;

// Screen dimming for energy saving during long TTS playback
let speechStartTime = null;
let screenDimTimer = null;
let isScreenDimmed = false;
const SCREEN_DIM_DELAY = 5 * 60 * 1000; // 5 minutes in milliseconds
const SCREEN_DIM_OPACITY = 0.3;

function createScreenDimOverlay() {
  let overlay = document.getElementById('screenDimOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'screenDimOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: black;
      opacity: 0;
      pointer-events: none;
      z-index: 9999;
      transition: opacity 1s ease;
    `;
    document.body.appendChild(overlay);
    
    // Touch to brighten screen temporarily
    overlay.addEventListener('touchstart', brightenScreenTemporarily);
    overlay.addEventListener('click', brightenScreenTemporarily);
  }
  return overlay;
}

function dimScreen() {
  if (!isMobileView() || !isSpeaking || isPaused) return;
  
  const overlay = createScreenDimOverlay();
  overlay.style.pointerEvents = 'auto';
  overlay.style.opacity = (1 - SCREEN_DIM_OPACITY).toString();
  isScreenDimmed = true;
}

function brightenScreen() {
  const overlay = document.getElementById('screenDimOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
  }
  isScreenDimmed = false;
}

function brightenScreenTemporarily() {
  if (!isSpeaking || isPaused) {
    brightenScreen();
    return;
  }
  
  // Brighten for 10 seconds then dim again
  brightenScreen();
  
  clearTimeout(screenDimTimer);
  screenDimTimer = setTimeout(() => {
    if (isSpeaking && !isPaused && isMobileView()) {
      dimScreen();
    }
  }, 10000); // 10 seconds
}

function startScreenDimTimer() {
  if (!isMobileView()) return;
  
  speechStartTime = Date.now();
  clearTimeout(screenDimTimer);
  
  screenDimTimer = setTimeout(() => {
    if (isSpeaking && !isPaused) {
      dimScreen();
    }
  }, SCREEN_DIM_DELAY);
}

function stopScreenDimTimer() {
  clearTimeout(screenDimTimer);
  screenDimTimer = null;
  speechStartTime = null;
  brightenScreen();
}

// Silent audio to keep browser active in background
let silentAudio = null;
let silentAudioContext = null;

function createSilentAudio() {
  if (silentAudio) return silentAudio;
  
  // Create a silent audio element
  silentAudio = document.createElement('audio');
  silentAudio.id = 'silentBackgroundAudio';
  silentAudio.loop = true;
  silentAudio.playsinline = true;
  silentAudio.setAttribute('playsinline', '');
  silentAudio.setAttribute('webkit-playsinline', '');
  
  // Create silent audio using Web Audio API and convert to blob
  try {
    silentAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = silentAudioContext.sampleRate;
    const duration = 1; // 1 second of silence
    const numChannels = 1;
    const numFrames = sampleRate * duration;
    
    // Create audio buffer with silence
    const audioBuffer = silentAudioContext.createBuffer(numChannels, numFrames, sampleRate);
    
    // Convert to WAV blob
    const wavBlob = audioBufferToWav(audioBuffer);
    silentAudio.src = URL.createObjectURL(wavBlob);
  } catch (e) {
    // Fallback: use a data URI for minimal silent audio
    // This is a tiny valid MP3 file (silence)
    silentAudio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAbD/k2jlAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+M4wAADCAHkCAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/jOMQoAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/jOMQoAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';
  }
  
  document.body.appendChild(silentAudio);
  return silentAudio;
}

// Helper function to convert AudioBuffer to WAV blob
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Write silence (zeros)
  const offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = 0; // silence
      view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), sample, true);
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

async function startSilentAudio() {
  const audio = createSilentAudio();
  try {
    // Resume audio context if suspended (required for autoplay)
    if (silentAudioContext && silentAudioContext.state === 'suspended') {
      await silentAudioContext.resume();
    }
    await audio.play();
  } catch (e) {
    console.warn('Silent audio play failed:', e.message);
  }
}

function stopSilentAudio() {
  if (silentAudio) {
    silentAudio.pause();
    silentAudio.currentTime = 0;
  }
}

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch (err) {
      // Wake lock request failed (e.g., low battery, tab not visible)
      console.warn('Wake lock request failed:', err.message);
    }
  }
}

async function releaseWakeLock() {
  if (wakeLock !== null) {
    try {
      await wakeLock.release();
      wakeLock = null;
    } catch (err) {
      console.warn('Wake lock release failed:', err.message);
    }
  }
}

// Re-acquire wake lock when page becomes visible again
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && isSpeaking && !isPaused) {
    await requestWakeLock();
  }
});

function initSpeechSynthesis() {
  if (!speechSynthesis) {
    console.warn('Speech synthesis not supported');
    return;
  }

  chineseVoice = selectChineseMaleVoice();

  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = () => {
      chineseVoice = selectChineseMaleVoice();
    };
  }

  setupSpeechButton();
}

function selectChineseMaleVoice() {
  const voices = speechSynthesis.getVoices();

  const chineseVoices = voices.filter(voice =>
    voice.lang.includes('zh') || voice.lang.includes('cmn')
  );

  if (chineseVoices.length === 0) {
    return null;
  }

  const maleVoice = chineseVoices.find(voice => {
    const name = voice.name.toLowerCase();
    return name.includes('male') ||
           name.includes('nan') ||
           name.includes('nanxing') ||
           name.includes('xiansheng') ||
           name.includes('yong') ||
           name.includes('wei') ||
           name.includes('qiang') ||
           name.includes('gang');
  });

  if (maleVoice) {
    return maleVoice;
  }

  const nonFemaleVoice = chineseVoices.find(voice => {
    const name = voice.name.toLowerCase();
    return !name.includes('female') &&
           !name.includes('nv') &&
           !name.includes('nvxing');
  });

  if (nonFemaleVoice) {
    return nonFemaleVoice;
  }

  return chineseVoices[0];
}

function setupSpeechButton() {
  const speechBtn = document.getElementById('speechBtn');
  if (speechBtn) {
    speechBtn.addEventListener('click', toggleSpeech);
  }

  const speedDownBtn = document.getElementById('speechSpeedDownBtn');
  const speedUpBtn = document.getElementById('speechSpeedUpBtn');

  if (speedDownBtn) {
    speedDownBtn.addEventListener('click', decreaseSpeechSpeed);
  }
  if (speedUpBtn) {
    speedUpBtn.addEventListener('click', increaseSpeechSpeed);
  }
}

function decreaseSpeechSpeed() {
  const newRate = Math.max(MIN_SPEECH_RATE, speechRate - SPEECH_RATE_STEP);
  if (newRate !== speechRate) {
    speechRate = Math.round(newRate * 10) / 10;
    applySpeechSpeedChange();
  }
}

function increaseSpeechSpeed() {
  const newRate = Math.min(MAX_SPEECH_RATE, speechRate + SPEECH_RATE_STEP);
  if (newRate !== speechRate) {
    speechRate = Math.round(newRate * 10) / 10;
    applySpeechSpeedChange();
  }
}

function applySpeechSpeedChange() {
  if (isSpeaking) {
    const wasPaused = isPaused;
    const currentIndex = currentSpeechIndex;

    speechSynthesis.cancel();

    isPaused = false;
    updateSpeechButton();

    currentSpeechIndex = currentIndex;
    speakNext();

    if (wasPaused) {
      setTimeout(() => {
        speechSynthesis.pause();
        isPaused = true;
        updateSpeechButton();
      }, 100);
    }
  }
}

function getTextForSpeech() {
  const textContent = document.getElementById('textContent');
  if (!textContent) return [];

  const text = textContent.innerText || textContent.textContent || '';
  return text.split('\n').filter(line => line.trim().length > 0);
}

function toggleSpeech() {
  if (!speechSynthesis) {
    showAlert('Speech synthesis not supported in this browser');
    return;
  }

  if (isSpeaking && !isPaused) {
    pauseSpeech();
  } else if (isSpeaking && isPaused) {
    resumeSpeech();
  } else {
    startSpeech();
  }
}

async function startSpeech() {
  speechTextQueue = getTextForSpeech();
  if (speechTextQueue.length === 0) return;

  const contentContainer = document.querySelector('.content-container');
  const scrollTop = contentContainer ? contentContainer.scrollTop : 0;

  currentSpeechIndex = getTextIndexFromScrollPosition(scrollTop);

  isSpeaking = true;
  isPaused = false;
  updateSpeechButton();

  // Request wake lock to prevent screen sleep
  await requestWakeLock();

  // Start silent audio to keep browser active in background
  await startSilentAudio();

  // Start screen dim timer for mobile energy saving
  startScreenDimTimer();

  speakNext();
}

async function pauseSpeech() {
  if (speechSynthesis) {
    speechSynthesis.cancel();
    isPaused = true;
    updateSpeechButton();

    // Release wake lock when paused to save battery
    await releaseWakeLock();

    // Stop silent audio when paused
    stopSilentAudio();

    // Stop dim timer and brighten screen when paused
    stopScreenDimTimer();
  }
}

async function resumeSpeech() {
  if (speechSynthesis) {
    isPaused = false;
    updateSpeechButton();

    // Re-acquire wake lock when resuming
    await requestWakeLock();

    // Restart silent audio when resuming
    await startSilentAudio();

    // Restart screen dim timer when resuming
    startScreenDimTimer();

    speakNext();
  }
}

async function stopSpeech() {
  if (speechSynthesis) {
    speechSynthesis.cancel();
  }
  isSpeaking = false;
  isPaused = false;
  currentSpeechIndex = 0;
  updateSpeechButton();

  // Stop silent audio when stopped
  stopSilentAudio();

  // Stop dim timer and brighten screen when stopped
  stopScreenDimTimer();

  // Release wake lock when speech stops
  await releaseWakeLock();
}

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

  speechUtterance.onend = () => {
    if (isSpeaking && !isPaused) {
      currentSpeechIndex++;
      checkAutoScroll();
      setTimeout(() => speakNext(), 0);
    }
  };

  speechUtterance.onerror = (event) => {
    if (event.error !== 'canceled' && event.error !== 'interrupted') {
      console.error('Speech error:', event.error);
    }
  };

  highlightSpeechLine(currentSpeechIndex);

  speechSynthesis.speak(speechUtterance);
}

function getTextIndexFromScrollPosition(scrollTop) {
  const textContent = document.getElementById('textContent');
  if (!textContent) return 0;

  const lines = speechTextQueue;
  const totalHeight = textContent.scrollHeight;
  const approximateIndex = Math.floor((scrollTop / totalHeight) * lines.length);

  return Math.max(0, Math.min(approximateIndex, lines.length - 1));
}

function highlightSpeechLine(index) {
  document.querySelectorAll('.speech-highlight').forEach(el => {
    el.classList.remove('speech-highlight');
  });

  const textContent = document.getElementById('textContent');
  if (!textContent || !speechTextQueue[index]) return;

  const targetText = speechTextQueue[index].trim();
  if (!targetText) return;

  const contentDivs = textContent.querySelectorAll('.chapter-content');
  if (contentDivs.length === 0) {
    highlightInElement(textContent, targetText);
    return;
  }

  for (const div of contentDivs) {
    if (highlightInElement(div, targetText)) {
      return;
    }
  }
}

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

    if (trimmedText === targetText || nodeText.includes(targetText)) {
      const parent = node.parentElement;
      if (parent && parent !== element) {
        parent.classList.add('speech-highlight');
        scrollToSpeechLine(parent);
        return true;
      } else if (nodeText.includes(targetText)) {
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

function scrollToSpeechLine(element) {
  const contentContainer = document.querySelector('.content-container');
  if (!contentContainer || !element) return;

  const containerRect = contentContainer.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  const lineHeight = parseInt(getComputedStyle(element).lineHeight) || 24;
  const visibleHeight = containerRect.height;
  const elementTop = elementRect.top - containerRect.top;

  if (elementTop > visibleHeight - lineHeight * 2) {
    const scrollAmount = elementTop - lineHeight;
    contentContainer.scrollBy({
      top: scrollAmount,
      behavior: 'smooth'
    });
  }
}

function checkAutoScroll() {
  const contentContainer = document.querySelector('.content-container');
  if (!contentContainer) return;

  const containerHeight = contentContainer.clientHeight;

  const highlighted = document.querySelector('.speech-highlight');
  if (!highlighted) return;

  const elementRect = highlighted.getBoundingClientRect();
  const containerRect = contentContainer.getBoundingClientRect();
  const elementTop = elementRect.top - containerRect.top;
  const lineHeight = parseInt(getComputedStyle(highlighted).lineHeight) || 24;

  if (elementTop > containerHeight - lineHeight * 2) {
    contentContainer.scrollBy({
      top: lineHeight * 2,
      behavior: 'smooth'
    });
  }
}

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
