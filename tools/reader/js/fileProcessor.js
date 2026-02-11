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
     * Extract title from first line (max 15 characters)
     */
    static extractTitle(content) {
        const firstLine = content.split('\n')[0] || '';
        return firstLine.substring(0, 15).trim() || 'Untitled';
    }

    /**
     * Convert Chinese number to Arabic numeral
     * Supports: 零一二三四五六七八九十百千万亿
     */
    static chineseToArabic(chinese) {
        const chineseNums = {
            '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
            '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
            '十': 10, '百': 100, '千': 1000, '万': 10000, '亿': 100000000
        };

        let result = 0;
        let temp = 0;
        let lastUnit = 1;

        for (let i = 0; i < chinese.length; i++) {
            const char = chinese[i];
            const num = chineseNums[char];

            if (num === undefined) continue;

            if (num >= 10) {
                if (temp === 0) temp = 1;
                result += temp * num;
                temp = 0;
                lastUnit = num;
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
    static extractChapterNumber(title) {
        // Try to match Chinese number pattern: 第*章/回/节
        const chineseMatch = title.match(/第\s*([一二三四五六七八九十百千万零]+)\s*[章节卷部篇回]\s*/);
        if (chineseMatch) {
            return LocalFileProcessor.chineseToArabic(chineseMatch[1]);
        }

        // Try to match Arabic number pattern: 第123章/Chapter 123
        const arabicMatch = title.match(/第\s*(\d+)\s*[章节卷部篇回]|Chapter\s+(\d+)/i);
        if (arabicMatch) {
            return parseInt(arabicMatch[1] || arabicMatch[2], 10);
        }

        return null;
    }

    /**
     * Create story data object
     */
    static createStoryData(options) {
        const {
            id,
            fileName,
            originalFileName,
            fileSize,
            content,
            processedContent,
            chapters,
            extractedTitle,
            isSplitFile = false,
            splitParentFile = null,
            splitIndex = null,
            totalChunks = null
        } = options;

        return {
            id,
            fileName,
            originalFileName,
            fileSize,
            uploadTime: new Date().toISOString(),
            content,
            processedContent,
            chapters,
            extractedTitle,
            isSplitFile,
            splitParentFile,
            splitIndex,
            totalChunks
        };
    }

    /**
     * Process file locally - save directly to database without splitting
     */
    async processFile(file) {
        const fileContent = await this.readFileAsText(file);
        const storyId = this.generateStoryId();
        const storyTitle = LocalFileProcessor.extractTitle(fileContent);
        const generatedFileName = `${storyTitle}.txt`;
        const processingResult = this.processContentWithChapters(fileContent);

        const storyData = LocalFileProcessor.createStoryData({
            id: storyId,
            fileName: generatedFileName,
            originalFileName: file.name,
            fileSize: file.size,
            content: fileContent,
            processedContent: processingResult.htmlContent,
            chapters: processingResult.chapters,
            extractedTitle: storyTitle
        });

        await this.db.addStory(storyData);
        return storyId;
    }

    /**
     * Process and split large file into chunks of specified chapter count
     */
    async processAndSplitFile(file) {
        const fileContent = await this.readFileAsText(file);
        const lines = fileContent.split('\n');
        const chapterBoundaries = this.detectChapterBoundaries(lines);

        // If file has few chapters, process normally
        if (chapterBoundaries.length <= this.chaptersPerFile) {
            return [await this.processFile(file)];
        }

        const storyIds = [];
        const baseFileName = file.name.replace(/\.[^/.]+$/, "");
        const totalChunks = Math.ceil(chapterBoundaries.length / this.chaptersPerFile);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const chunkData = this.createChunkData({
                lines,
                chapterBoundaries,
                chunkIndex,
                totalChunks,
                baseFileName,
                originalFileName: file.name
            });

            await this.db.addStory(chunkData.storyData);
            storyIds.push(chunkData.storyId);
        }

        return storyIds;
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
            originalFileName
        } = options;

        const startChapterIdx = chunkIndex * this.chaptersPerFile;
        const endChapterIdx = Math.min((chunkIndex + 1) * this.chaptersPerFile,
            chapterBoundaries.length);

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

        const storyData = LocalFileProcessor.createStoryData({
            id: storyId,
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
        });

        return { storyId, storyData };
    }

    /**
     * Process text content from textarea - save directly without splitting
     */
    async processTextContent(content, fileName = 'pasted_content.txt') {
        const storyId = this.generateStoryId();
        const storyTitle = LocalFileProcessor.extractTitle(content);
        const generatedFileName = `${storyTitle}.txt`;
        const processingResult = this.processContentWithChapters(content);

        const storyData = LocalFileProcessor.createStoryData({
            id: storyId,
            fileName: generatedFileName,
            originalFileName: fileName,
            fileSize: new Blob([content]).size,
            content,
            processedContent: processingResult.htmlContent,
            chapters: processingResult.chapters,
            extractedTitle: storyTitle
        });

        await this.db.addStory(storyData);
        return storyId;
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
                // Extract chapter number from title for anchor ID
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
                // Only wrap non-empty lines in div with chapter-content-row class
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
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file, 'UTF-8');
        });
    }

    /**
     * Generate unique story ID
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
}

// Export for use in other modules
window.LocalFileProcessor = LocalFileProcessor;
