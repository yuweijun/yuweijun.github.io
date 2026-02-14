/**
 * Shared Utilities for Text Reader Application
 * Common functions used across multiple modules
 */

// Theme management - shared across init.js and viewer.js
// Sorted by background brightness (lightest to darkest)
const themes = {
  'maize-yello': 'theme-maize-yello',
  autumn: 'theme-autumn',
  lavender: 'theme-lavender',
  almond: 'theme-almond',
  rouge: 'theme-rouge',
  meadow: 'theme-meadow',
  bamboo: 'theme-bamboo',
  nord: 'theme-nord',
  dracula: 'theme-dracula',
  monokai: 'theme-monokai',
  solarized: 'theme-solarized',
  'griege-dark': 'theme-griege-dark',
  'midnight-cyan': 'theme-midnight-cyan',
  darkgreen: 'theme-darkgreen'
};

/**
 * Escape HTML characters for safe display
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML string
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convert Chinese number to Arabic numeral
 * Supports: 零一二三四五六七八九十百千万亿 and uppercase 壹贰貳叁叄肆伍陆陸柒捌玖拾佰仟萬
 * @param {string} chinese - Chinese number string
 * @returns {number} - Arabic numeral
 */
function chineseToArabic(chinese) {
  const chineseNums = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    '十': 10, '百': 100, '千': 1000, '万': 10000, '亿': 100000000,
    // Uppercase/formal variants
    '壹': 1, '贰': 2, '貳': 2, '叁': 3, '叄': 3, '肆': 4,
    '伍': 5, '陆': 6, '陸': 6, '柒': 7, '捌': 8, '玖': 9,
    '拾': 10, '佰': 100, '仟': 1000, '萬': 10000
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
 * @param {string} title - Chapter title
 * @returns {number|null} - Chapter number or null if not found
 */
function extractChapterNumber(title) {
  // Try to match Chinese number pattern: 第*章/回/节 (including uppercase variants)
  const chineseMatch = title.match(/第\s*([一二三四五六七八九十百千万零壹贰貳叁叄肆伍陆陸柒捌玖拾佰仟萬]+)\s*[章节卷部篇回]/);
  if (chineseMatch) {
    const result = chineseToArabic(chineseMatch[1]);
    console.log('Chinese match:', title, '->', chineseMatch[1], '->', result);
    return result;
  }

  // Try to match Arabic number pattern: 第123章/Chapter 123
  const arabicMatch = title.match(/第\s*(\d+)\s*[章节卷部篇回]|Chapter\s+(\d+)/i);
  if (arabicMatch) {
    const result = parseInt(arabicMatch[1] || arabicMatch[2], 10);
    console.log('Arabic match:', title, '->', result);
    return result;
  }

  console.log('No match:', title);
  return null;
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
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

/**
 * Format file size to human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Apply theme to the page
 * @param {string} theme - Theme name (optional, defaults to saved theme)
 * @param {boolean} savePreference - Whether to save the theme preference (default: true)
 */
function applyTheme(theme, savePreference = true) {
  // Disable transitions during theme change to prevent visual flash
  document.body.classList.add('no-transitions');

  // Determine which theme to apply
  const themeToApply = theme || localStorage.getItem('preferredViewerTheme') || 'maize-yello';

  // Remove all theme classes
  Object.values(window.themes).forEach(themeClass => {
    document.body.classList.remove(themeClass);
  });

  // Apply new theme class
  if (window.themes[themeToApply]) {
    document.body.classList.add(window.themes[themeToApply]);
  }

  // Save preference if requested
  if (savePreference && theme) {
    localStorage.setItem('preferredViewerTheme', themeToApply);
  }

  // Re-enable transitions after a brief delay
  setTimeout(() => {
    document.body.classList.remove('no-transitions');
  }, 50);
}

// Export for use in other modules
window.themes = themes;
window.escapeHtml = escapeHtml;
window.chineseToArabic = chineseToArabic;
window.extractChapterNumber = extractChapterNumber;
window.debounce = debounce;
window.formatFileSize = formatFileSize;
window.applyTheme = applyTheme;
