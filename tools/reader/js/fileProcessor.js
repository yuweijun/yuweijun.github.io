/**
 * Local File Processor for Text Reader Application
 * Handles file processing entirely in the browser without server upload
 */

class LocalFileProcessor {
  constructor() {
    this.db = new TextReaderDB();
    this.chaptersPerFile = 50;
  }

  /**
   * Common chapter patterns - used across multiple methods
   */
  static get CHAPTER_PATTERNS() {
    return [
      /^第\s*([一二三四五六七八九十百千万零壹贰貳叁叄肆伍陆陸柒捌玖拾佰仟萬\d]+)\s*[章节卷部篇回]\s*/,
      /^Chapter\s+(\d+)/i,
      /^Section\s+(\d+)/i,
      /^[IVXLCDM]+\.\s/,
      /^\d+\.\d+/,
      /^PART\s+[A-Z]+/i,
      /^PROLOGUE/i,
      /^EPILOGUE/i
    ];
  }

  /**
   * Truncate chapter title at punctuation marks (comma, period - both English and Chinese)
   */
  static truncateTitleAtPunctuation(title) {
    const match = title.match(/[,.，。]/);
    if (match) {
      return title.substring(0, match.index).trim();
    }
    return title;
  }

  /**
   * Extract title from first line (max 30 characters)
   */
  static extractTitle(content) {
    const firstLine = content.split('\n')[0] || '';
    return firstLine.substring(0, 30).trim() || 'Untitled';
  }

  /**
   * Extract book name from filename (without extension)
   */
  static extractBookNameFromFileName(fileName) {
    if (!fileName) return 'Untitled';
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    try {
      return decodeURIComponent(nameWithoutExt).trim() || 'Untitled';
    } catch (e) {
      return nameWithoutExt.trim() || 'Untitled';
    }
  }

  /**
   * Detect if text is valid UTF-8
   */
  static isValidUtf8(text) {
    try {
      const encoded = new TextEncoder().encode(text);
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
      return decoded === text;
    } catch (e) {
      return false;
    }
  }

  /**
   * Validate if file content is UTF-8 encoded
   */
  static isUtf8Encoded(content) {
    const sample = content.substring(0, 512);
    return /[，。,.]/.test(sample);
  }

  /**
   * Convert text to UTF-8 encoding
   */
  static async convertToUtf8(arrayBuffer, fileName) {
    const bytes = new Uint8Array(arrayBuffer);

    // Try UTF-8 first
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      const utf8Text = utf8Decoder.decode(bytes);
      if (LocalFileProcessor.isValidUtf8(utf8Text)) {
        return utf8Text;
      }
    } catch (e) {
      // Not valid UTF-8
    }

    // Try GBK
    try {
      const gbkDecoder = new TextDecoder('gbk', { fatal: false });
      const gbkText = gbkDecoder.decode(bytes);
      if (/[\u4e00-\u9fa5]/.test(gbkText) && !gbkText.includes('\uFFFD')) {
        return gbkText;
      }
    } catch (e) {
      // GBK failed
    }

    // Try Big5
    try {
      const big5Decoder = new TextDecoder('big5', { fatal: false });
      const big5Text = big5Decoder.decode(bytes);
      if (/[\u4e00-\u9fa5]/.test(big5Text) && !big5Text.includes('\uFFFD')) {
        return big5Text;
      }
    } catch (e) {
      // Big5 failed
    }

    // Fallback
    const fallbackDecoder = new TextDecoder('utf-8', { fatal: false });
    return fallbackDecoder.decode(bytes);
  }

  /**
   * Process file - creates a book and saves stories
   * Splits file by every 5000 lines
   */
  async processFile(file) {
    const fileContent = await this.readFileAsText(file);

    if (!LocalFileProcessor.isUtf8Encoded(fileContent)) {
      const errorMessage = "上传的文本文件编码必须为UTF-8格式";

      const bookId = this.generateStoryId();
      const bookName = LocalFileProcessor.extractBookNameFromFileName(file.name);

      const bookData = {
        id: bookId,
        bookName: bookName + " (编码错误)",
        originalFileName: file.name,
        uploadTime: new Date().toISOString()
      };

      await this.db.addBook(bookData);

      const storyId = this.generateStoryId();
      const generatedFileName = `${bookName}_error.txt`;
      const processingResult = this.processContentWithChapters(errorMessage);

      const storyData = {
        id: storyId,
        bookId: bookId,
        fileName: generatedFileName,
        originalFileName: file.name,
        fileSize: new Blob([errorMessage]).size,
        content: errorMessage,
        processedContent: processingResult.htmlContent,
        chapters: processingResult.chapters,
        extractedTitle: bookName + " (编码错误)",
        isSplitFile: false,
        splitParentFile: null,
        splitIndex: null,
        totalChunks: null
      };

      await this.db.addStory(storyData);
      return { bookId, storyIds: [storyId] };
    }

    const bookId = this.generateStoryId();
    const bookName = LocalFileProcessor.extractBookNameFromFileName(file.name);

    const bookData = {
      id: bookId,
      bookName: bookName,
      originalFileName: file.name,
      uploadTime: new Date().toISOString()
    };

    await this.db.addBook(bookData);

    let lines = fileContent.split('\n');
    // Remove trailing empty line if exists
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    const linesPerChunk = 5000;
    const totalChunks = Math.ceil(lines.length / linesPerChunk);

    // If file has 5000 lines or less, don't split
    if (totalChunks === 1) {
      const storyId = this.generateStoryId();
      const generatedFileName = `${bookName}.txt`;
      const processingResult = this.processContentWithChapters(fileContent);

      const storyData = {
        id: storyId,
        bookId: bookId,
        fileName: generatedFileName,
        originalFileName: file.name,
        fileSize: file.size,
        content: fileContent,
        processedContent: processingResult.htmlContent,
        chapters: processingResult.chapters,
        extractedTitle: bookName,
        isSplitFile: false,
        splitParentFile: null,
        splitIndex: null,
        totalChunks: null
      };

      await this.db.addStory(storyData);
      return { bookId, storyIds: [storyId] };
    }

    // Split file into chunks of 5000 lines
    const storyIds = [];
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const startLine = chunkIndex * linesPerChunk;
      const endLine = Math.min(startLine + linesPerChunk, lines.length);
      const chunkLines = lines.slice(startLine, endLine);
      const chunkContent = chunkLines.join('\n');

      const storyId = this.generateStoryId();
      const paddedIndex = (chunkIndex + 1).toString().padStart(3, '0');
      const chunkFileName = `${bookName}-${paddedIndex}.txt`;
      const chunkTitle = `${bookName} (${startLine + 1} ~ ${endLine})`;
      const processingResult = this.processContentWithChapters(chunkContent);

      const storyData = {
        id: storyId,
        bookId: bookId,
        fileName: chunkFileName,
        originalFileName: file.name,
        fileSize: new Blob([chunkContent]).size,
        content: chunkContent,
        processedContent: processingResult.htmlContent,
        chapters: processingResult.chapters,
        extractedTitle: chunkTitle,
        isSplitFile: true,
        splitParentFile: file.name,
        splitIndex: chunkIndex + 1,
        totalChunks: totalChunks
      };

      await this.db.addStory(storyData);
      storyIds.push(storyId);
    }

    return { bookId, storyIds };
  }

  /**
   * Process and split large file into chunks
   */
  async processAndSplitFile(file, forceSplit = false) {
    const fileContent = await this.readFileAsText(file);

    // fileContent should have been UTF-8 encoding, check for book encoding again
    if (!LocalFileProcessor.isUtf8Encoded(fileContent)) {
      const errorMessage = "上传的文本文件编码必须为UTF-8格式";

      const bookId = this.generateStoryId();
      const bookName = LocalFileProcessor.extractBookNameFromFileName(file.name);

      const bookData = {
        id: bookId,
        bookName: bookName + " (编码错误)",
        originalFileName: file.name,
        uploadTime: new Date().toISOString()
      };

      await this.db.addBook(bookData);

      const storyId = this.generateStoryId();
      const generatedFileName = `${bookName}_error.txt`;
      const processingResult = this.processContentWithChapters(errorMessage);

      const storyData = {
        id: storyId,
        bookId: bookId,
        fileName: generatedFileName,
        originalFileName: file.name,
        fileSize: new Blob([errorMessage]).size,
        content: errorMessage,
        processedContent: processingResult.htmlContent,
        chapters: processingResult.chapters,
        extractedTitle: bookName + " (编码错误)",
        isSplitFile: false,
        splitParentFile: null,
        splitIndex: null,
        totalChunks: null
      };

      await this.db.addStory(storyData);
      return { bookId, storyIds: [storyId] };
    }

    const lines = fileContent.split('\n');
    const chapterBoundaries = this.detectChapterBoundaries(lines);

    const bookId = this.generateStoryId();
    const bookName = LocalFileProcessor.extractBookNameFromFileName(file.name);

    const bookData = {
      id: bookId,
      bookName: bookName,
      originalFileName: file.name,
      uploadTime: new Date().toISOString()
    };

    await this.db.addBook(bookData);

    if (!forceSplit && chapterBoundaries.length <= this.chaptersPerFile) {
      const result = await this.processSingleStory(file, bookId, fileContent);
      return { bookId, storyIds: [result.storyId] };
    }

    // Split by chapter numbers at multiples of 50
    const splitPoints = [];
    for (let i = 0; i < chapterBoundaries.length; i++) {
      const chapterTitle = chapterBoundaries[i].title;
      const chapterNum = window.extractChapterNumber(chapterTitle);

      // Split at chapters that are multiples of 50 (50, 100, 150, etc.)
      if (chapterNum !== null && chapterNum % 50 === 0) {
        splitPoints.push(i + 1); // Split after this chapter
      }
    }

    // Add the end of the file as the last split point
    if (splitPoints.length === 0 || splitPoints[splitPoints.length - 1] !== chapterBoundaries.length) {
      splitPoints.push(chapterBoundaries.length);
    }

    const storyIds = [];
    const baseFileName = bookName;
    let startIdx = 0;

    for (let chunkIndex = 0; chunkIndex < splitPoints.length; chunkIndex++) {
      const endIdx = splitPoints[chunkIndex];
      const chunkData = this.createChunkDataByRange({
        lines,
        chapterBoundaries,
        startIdx,
        endIdx,
        chunkIndex,
        totalChunks: splitPoints.length,
        baseFileName,
        originalFileName: file.name,
        bookId
      });

      await this.db.addStory(chunkData.storyData);
      storyIds.push(chunkData.storyId);
      startIdx = endIdx;
    }

    return { bookId, storyIds };
  }

  /**
   * Process single story for book
   */
  async processSingleStory(file, bookId, fileContent) {
    const storyId = this.generateStoryId();
    const storyTitle = LocalFileProcessor.extractTitle(fileContent);
    const generatedFileName = `${storyTitle}.txt`;
    const processingResult = this.processContentWithChapters(fileContent);

    const storyData = {
      id: storyId,
      bookId: bookId,
      fileName: generatedFileName,
      originalFileName: file.name,
      fileSize: file.size,
      content: fileContent,
      processedContent: processingResult.htmlContent,
      chapters: processingResult.chapters,
      extractedTitle: storyTitle,
      isSplitFile: false,
      splitParentFile: null,
      splitIndex: null,
      totalChunks: null
    };

    await this.db.addStory(storyData);
    return { storyId };
  }

  /**
   * Create chunk data for split files by chapter range
   */
  createChunkDataByRange(options) {
    const {
      lines,
      chapterBoundaries,
      startIdx,
      endIdx,
      chunkIndex,
      totalChunks,
      baseFileName,
      originalFileName,
      bookId
    } = options;

    const startLineIdx = chapterBoundaries[startIdx].lineIndex;
    const endLineIdx = endIdx < chapterBoundaries.length
      ? chapterBoundaries[endIdx].lineIndex
      : lines.length;

    const chunkLines = lines.slice(startLineIdx, endLineIdx);
    const chunkContent = chunkLines.join('\n');

    // Parse actual chapter numbers from chapter titles
    const startChapterTitle = chapterBoundaries[startIdx].title;
    const endChapterTitle = chapterBoundaries[endIdx - 1].title;

    const startChapterNum = window.extractChapterNumber(startChapterTitle) || (startIdx + 1);
    const endChapterNum = window.extractChapterNumber(endChapterTitle) || endIdx;

    // Create title in format: "第 1 ~ 50 章"
    const chunkTitle = `第 ${startChapterNum} ~ ${endChapterNum} 章`;

    const paddedIndex = (chunkIndex + 1).toString().padStart(3, '0');
    const chunkFileName = `${baseFileName}-${paddedIndex}.txt`;

    const storyId = this.generateStoryId();
    const processingResult = this.processContentWithChapters(chunkContent);

    const storyData = {
      id: storyId,
      bookId: bookId,
      fileName: chunkFileName,
      originalFileName,
      fileSize: new Blob([chunkContent]).size,
      content: chunkContent,
      processedContent: processingResult.htmlContent,
      chapters: processingResult.chapters,
      extractedTitle: chunkTitle,
      isSplitFile: true,
      splitParentFile: originalFileName,
      splitIndex: chunkIndex + 1,
      totalChunks
    };

    return { storyId, storyData };
  }

  /**
   * Create chunk data for split files
   */
  createChunkData(options) {
    const {
      lines,
      chapterBoundaries,
      chunkIndex,
      totalChunks,
      baseFileName,
      originalFileName,
      bookId
    } = options;

    // All chunks use chaptersPerFile (50)
    const startChapterIdx = chunkIndex * this.chaptersPerFile;
    const endChapterIdx = Math.min((chunkIndex + 1) * this.chaptersPerFile, chapterBoundaries.length);

    const startLineIdx = chapterBoundaries[startChapterIdx].lineIndex;
    const endLineIdx = endChapterIdx < chapterBoundaries.length
      ? chapterBoundaries[endChapterIdx].lineIndex
      : lines.length;

    const chunkLines = lines.slice(startLineIdx, endLineIdx);
    const chunkContent = chunkLines.join('\n');

    // Parse actual chapter numbers from chapter titles
    const startChapterTitle = chapterBoundaries[startChapterIdx].title;
    const endChapterTitle = chapterBoundaries[endChapterIdx - 1].title;

    const startChapterNum = window.extractChapterNumber(startChapterTitle) || (startChapterIdx + 1);
    const endChapterNum = window.extractChapterNumber(endChapterTitle) || endChapterIdx;

    // Create title in format: "第 1 ~ 50 章"
    const chunkTitle = `第 ${startChapterNum} ~ ${endChapterNum} 章`;

    const paddedIndex = (chunkIndex + 1).toString().padStart(3, '0');
    const chunkFileName = `${baseFileName}-${paddedIndex}.txt`;

    const storyId = this.generateStoryId();
    const processingResult = this.processContentWithChapters(chunkContent);

    const storyData = {
      id: storyId,
      bookId: bookId,
      fileName: chunkFileName,
      originalFileName,
      fileSize: new Blob([chunkContent]).size,
      content: chunkContent,
      processedContent: processingResult.htmlContent,
      chapters: processingResult.chapters,
      extractedTitle: chunkTitle,
      isSplitFile: true,
      splitParentFile: originalFileName,
      splitIndex: chunkIndex + 1,
      totalChunks
    };

    return { storyId, storyData };
  }

  /**
   * Process text content from textarea
   */
  async processTextContent(content, fileName = 'pasted_content.txt') {
    const bookId = this.generateStoryId();
    const bookName = LocalFileProcessor.extractTitle(content);

    const bookData = {
      id: bookId,
      bookName: bookName,
      originalFileName: fileName,
      uploadTime: new Date().toISOString()
    };

    await this.db.addBook(bookData);

    const storyId = this.generateStoryId();
    const generatedFileName = `${bookName}.txt`;
    const processingResult = this.processContentWithChapters(content);

    const storyData = {
      id: storyId,
      bookId: bookId,
      fileName: generatedFileName,
      originalFileName: fileName,
      fileSize: new Blob([content]).size,
      content: content,
      processedContent: processingResult.htmlContent,
      chapters: processingResult.chapters,
      extractedTitle: bookName,
      isSplitFile: false,
      splitParentFile: null,
      splitIndex: null,
      totalChunks: null
    };

    await this.db.addStory(storyData);

    return { bookId, storyIds: [storyId] };
  }

  /**
   * Detect chapter boundaries in the content
   */
  detectChapterBoundaries(lines) {
    const chapterBoundaries = [];
    const patterns = LocalFileProcessor.CHAPTER_PATTERNS;

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();

      for (const pattern of patterns) {
        if (pattern.test(trimmedLine)) {
          chapterBoundaries.push({
            lineIndex: i,
            title: LocalFileProcessor.truncateTitleAtPunctuation(trimmedLine)
          });
          break;
        }
      }
    }

    return chapterBoundaries;
  }

  /**
   * Public method to detect chapter boundaries from file content
   */
  detectChapters(content) {
    return this.detectChapterBoundaries(content.split('\n'));
  }

  /**
   * Process content by detecting chapters and extracting chapter list
   * Uses line numbers as anchor IDs for more reliable navigation
   */
  processContentWithChapters(content) {
    const lines = content.split('\n');
    const patterns = LocalFileProcessor.CHAPTER_PATTERNS;

    let htmlContent = '';
    let chapters = [];
    let inChapterContent = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (i === 0 && trimmedLine === '') continue;

      const isChapterHeading = patterns.some(pattern => pattern.test(trimmedLine));

      if (isChapterHeading) {
        if (inChapterContent) {
          htmlContent += '</div>\n';
          inChapterContent = false;
        }

        // Use line number as anchor ID for reliable navigation
        const anchorId = `line-${i}`;

        chapters.push({
          title: LocalFileProcessor.truncateTitleAtPunctuation(trimmedLine),
          anchorId: anchorId,
          lineNumber: i
        });

        htmlContent += `<div id="${anchorId}" class="chapter-anchor"></div>\n`;
        htmlContent += `<div class="chapter-heading">${window.escapeHtml(trimmedLine)}</div>\n`;
        htmlContent += '<div class="chapter-content">\n';
        inChapterContent = true;
      } else {
        if (!inChapterContent) {
          htmlContent += '<div class="chapter-content">\n';
          inChapterContent = true;
        }
        if (line.trim() !== '') {
          htmlContent += `<div class="chapter-content-row">${window.escapeHtml(line)}</div>`;
        }
      }
    }

    if (inChapterContent) {
      htmlContent += '</div>\n';
    }

    return { htmlContent, chapters };
  }

  /**
   * Read file as text with automatic encoding detection and conversion to UTF-8
   */
  async readFileAsText(file) {
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });

    return await LocalFileProcessor.convertToUtf8(arrayBuffer, file.name);
  }

  /**
   * Generate unique ID
   */
  generateStoryId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get story content directly from database
   */
  async getStoryContent(storyId) {
    const story = await this.db.getStoryById(storyId);
    if (!story) {
      throw new Error('Story not found for ID: ' + storyId);
    }
    return story.content || '';
  }

  /**
   * Delete story
   */
  async deleteStory(storyId) {
    await this.db.deleteStory(storyId);
    return true;
  }

  /**
   * Delete book and all its stories
   */
  async deleteBook(bookId) {
    await this.db.deleteBook(bookId);
    return true;
  }
}

// Export for use in other modules
window.LocalFileProcessor = LocalFileProcessor;
