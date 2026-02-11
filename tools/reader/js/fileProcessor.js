/**
 * Local File Processor for Text Reader Application
 * Handles file processing entirely in the browser without server upload
 */

class LocalFileProcessor {
    constructor() {
        this.db = new TextReaderDB();
        this.chaptersPerFile = 50; // Split files into chunks of 50 chapters
    }

    /**
     * Common chapter patterns - used across multiple methods
     */
    static get CHAPTER_PATTERNS() {
        return [
            /^第?\s*([一二三四五六七八九十百千万\d]+)\s*[章节卷部篇回]\s*/, // Chinese
            /^Chapter\s+(\d+)/i, // English chapters
            /^Section\s+(\d+)/i, // Sections
            /^[IVXLCDM]+\.\s/, // Roman numerals
            /^\d+\.\d+/, // Decimal numbering
            /^PART\s+[A-Z]+/i, // PART headings
            /^PROLOGUE/i, // Prologue
            /^EPILOGUE/i // Epilogue
        ];
    }

    /**
     * Extract title from first line (max 30 characters)
     * Used for pasted text content
     */
    static extractTitle(content) {
        const firstLine = content.split('\n')[0] || '';
        return firstLine.substring(0, 30).trim() || 'Untitled';
    }

    /**
     * Extract book name from filename (without extension)
     * Used for uploaded files
     */
    static extractBookNameFromFileName(fileName) {
        if (!fileName) return 'Untitled';
        // Remove extension and decode URL-encoded characters
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        try {
            // Try to decode in case it's URL-encoded
            return decodeURIComponent(nameWithoutExt).trim() || 'Untitled';
        } catch (e) {
            return nameWithoutExt.trim() || 'Untitled';
        }
    }

    /**
     * Detect if text is valid UTF-8
     * Returns true if text appears to be valid UTF-8
     */
    static isValidUtf8(text) {
        try {
            // Try to encode and decode - if it round-trips correctly, it's valid UTF-8
            const encoded = new TextEncoder().encode(text);
            const decoded = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
            return decoded === text;
        } catch (e) {
            return false;
        }
    }

    /**
     * Convert text to UTF-8 encoding
     * Attempts to detect common encodings (GBK, Big5) and convert to UTF-8
     */
    static async convertToUtf8(arrayBuffer, fileName) {
        // First, try to detect encoding using common patterns
        const bytes = new Uint8Array(arrayBuffer);

        // Try UTF-8 first
        try {
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            const utf8Text = utf8Decoder.decode(bytes);
            // Verify it's valid by re-encoding
            if (LocalFileProcessor.isValidUtf8(utf8Text)) {
                return utf8Text;
            }
        } catch (e) {
            // Not valid UTF-8, try other encodings
        }

        // Try GBK (common Chinese encoding)
        try {
            const gbkDecoder = new TextDecoder('gbk', { fatal: false });
            const gbkText = gbkDecoder.decode(bytes);
            // Check if it contains common Chinese characters
            if (/[\u4e00-\u9fa5]/.test(gbkText) && !gbkText.includes('\uFFFD')) {
                return gbkText;
            }
        } catch (e) {
            // GBK failed
        }

        // Try Big5 (Traditional Chinese encoding)
        try {
            const big5Decoder = new TextDecoder('big5', { fatal: false });
            const big5Text = big5Decoder.decode(bytes);
            if (/[\u4e00-\u9fa5]/.test(big5Text) && !big5Text.includes('\uFFFD')) {
                return big5Text;
            }
        } catch (e) {
            // Big5 failed
        }

        // Fallback: try UTF-8 without fatal error (will replace invalid chars)
        const fallbackDecoder = new TextDecoder('utf-8', { fatal: false });
        return fallbackDecoder.decode(bytes);
    }

    /**
     * Convert Chinese number to Arabic numeral
     */
    static chineseToArabic(chinese) {
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
     */
    static extractChapterNumber(title) {
        const chineseMatch = title.match(/第\s*([一二三四五六七八九十百千万零]+)\s*[章节卷部篇回]\s*/);
        if (chineseMatch) {
            return LocalFileProcessor.chineseToArabic(chineseMatch[1]);
        }

        const arabicMatch = title.match(/第\s*(\d+)\s*[章节卷部篇回]|Chapter\s+(\d+)/i);
        if (arabicMatch) {
            return parseInt(arabicMatch[1] || arabicMatch[2], 10);
        }

        return null;
    }

    /**
     * Process file - creates a book and saves stories
     * Uses filename (without extension) as book name for uploaded files
     */
    async processFile(file) {
        const fileContent = await this.readFileAsText(file);

        // Create book first
        const bookId = this.generateStoryId();
        // Use filename (without extension) as book name for uploaded files
        const bookName = LocalFileProcessor.extractBookNameFromFileName(file.name);

        const bookData = {
            id: bookId,
            bookName: bookName,
            originalFileName: file.name,
            uploadTime: new Date().toISOString()
        };

        await this.db.addBook(bookData);

        // Create story
        const storyId = this.generateStoryId();
        const generatedFileName = `${bookName}.txt`;
        const processingResult = this.processContentWithChapters(fileContent);

        const storyData = {
            id: storyId,
            bookId: bookId, // Foreign key to book
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

    /**
     * Process and split large file into chunks
     * Uses filename (without extension) as book name for uploaded files
     */
    async processAndSplitFile(file) {
        const fileContent = await this.readFileAsText(file);
        const lines = fileContent.split('\n');
        const chapterBoundaries = this.detectChapterBoundaries(lines);

        // Create book first
        const bookId = this.generateStoryId();
        // Use filename (without extension) as book name for uploaded files
        const bookName = LocalFileProcessor.extractBookNameFromFileName(file.name);

        const bookData = {
            id: bookId,
            bookName: bookName,
            originalFileName: file.name,
            uploadTime: new Date().toISOString()
        };

        await this.db.addBook(bookData);

        // If file has few chapters, process as single story
        if (chapterBoundaries.length <= this.chaptersPerFile) {
            const result = await this.processSingleStory(file, bookId, fileContent);
            return { bookId, storyIds: [result.storyId] };
        }

        // Split file into chunks
        const storyIds = [];
        const baseFileName = bookName;
        const totalChunks = Math.ceil(chapterBoundaries.length / this.chaptersPerFile);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const chunkData = this.createChunkData({
                lines,
                chapterBoundaries,
                chunkIndex,
                totalChunks,
                baseFileName,
                originalFileName: file.name,
                bookId
            });

            await this.db.addStory(chunkData.storyData);
            storyIds.push(chunkData.storyId);
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

        const startChapterIdx = chunkIndex * this.chaptersPerFile;
        const endChapterIdx = Math.min((chunkIndex + 1) * this.chaptersPerFile, chapterBoundaries.length);

        const startLineIdx = chapterBoundaries[startChapterIdx].lineIndex;
        const endLineIdx = endChapterIdx < chapterBoundaries.length
            ? chapterBoundaries[endChapterIdx].lineIndex
            : lines.length;

        const chunkLines = lines.slice(startLineIdx, endLineIdx);
        const chunkContent = chunkLines.join('\n');

        const paddedIndex = (chunkIndex + 1).toString().padStart(3, '0');
        const chunkFileName = `${baseFileName}-${paddedIndex}.txt`;
        const chunkTitle = `${baseFileName}-${paddedIndex}`;

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
     * Uses first 30 characters of first line as book name for pasted content
     */
    async processTextContent(content, fileName = 'pasted_content.txt') {
        // Create book first
        const bookId = this.generateStoryId();
        // Use first 30 characters of first line as book name for pasted content
        const bookName = LocalFileProcessor.extractTitle(content);

        const bookData = {
            id: bookId,
            bookName: bookName,
            originalFileName: fileName,
            uploadTime: new Date().toISOString()
        };

        await this.db.addBook(bookData);

        // Create story
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
                    chapterBoundaries.push({ lineIndex: i, title: trimmedLine });
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
     */
    processContentWithChapters(content) {
        const lines = content.split('\n');
        const patterns = LocalFileProcessor.CHAPTER_PATTERNS;

        let htmlContent = '';
        let chapters = [];
        let chapterIndex = 0;
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

                chapterIndex++;
                const chapterNum = LocalFileProcessor.extractChapterNumber(trimmedLine);
                const anchorId = chapterNum !== null
                    ? `chapter-${chapterNum}`
                    : `chapter-${chapterIndex}`;

                chapters.push({ title: trimmedLine, anchorId });

                htmlContent += `<div id="${anchorId}" class="chapter-anchor"></div>\n`;
                htmlContent += `<div class="chapter-heading">${this.escapeHtml(trimmedLine)}</div>\n`;
                htmlContent += '<div class="chapter-content">\n';
                inChapterContent = true;
            } else {
                if (!inChapterContent) {
                    htmlContent += '<div class="chapter-content">\n';
                    inChapterContent = true;
                }
                if (line.trim() !== '') {
                    htmlContent += `<div class="chapter-content-row">${this.escapeHtml(line)}</div>`;
                }
            }
        }

        if (inChapterContent) {
            htmlContent += '</div>\n';
        }

        return { htmlContent, chapters };
    }

    /**
     * Escape HTML characters for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Read file as text with automatic encoding detection and conversion to UTF-8
     */
    async readFileAsText(file) {
        // Read as ArrayBuffer first to detect encoding
        const arrayBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });

        // Convert to UTF-8 with automatic encoding detection
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
     * Delete story and all its segments
     */
    async deleteStory(storyId) {
        await this.db.deleteStory(storyId);
        console.log('Story deleted:', storyId);
        return true;
    }

    /**
     * Delete book and all its stories
     */
    async deleteBook(bookId) {
        await this.db.deleteBook(bookId);
        console.log('Book deleted:', bookId);
        return true;
    }
}

// Export for use in other modules
window.LocalFileProcessor = LocalFileProcessor;
