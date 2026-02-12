/**
 * Shared Utilities for Text Reader Application
 * Common functions used across multiple modules
 */

// Theme management - shared across init.js and viewer.js
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
 * Supports: 零一二三四五六七八九十百千万亿
 * @param {string} chinese - Chinese number string
 * @returns {number} - Arabic numeral
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
 * @param {string} title - Chapter title
 * @returns {number|null} - Chapter number or null if not found
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

// Export for use in other modules
window.themes = themes;
window.escapeHtml = escapeHtml;
window.chineseToArabic = chineseToArabic;
window.extractChapterNumber = extractChapterNumber;
window.debounce = debounce;
window.formatFileSize = formatFileSize;
