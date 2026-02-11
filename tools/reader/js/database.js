/**
 * Local Browser Database for Text Reader Application
 * Using IndexedDB for storing books, stories and reading history
 */

class TextReaderDB {
    constructor() {
        this.dbName = 'TextReaderDB';
        this.version = 2; // Upgraded to version 2 for books table
        this.db = null;
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Database initialization failed:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                // Create books store (new in version 2)
                if (!db.objectStoreNames.contains('books')) {
                    const booksStore = db.createObjectStore('books', { keyPath: 'id' });
                    booksStore.createIndex('bookName', 'bookName', { unique: false });
                    booksStore.createIndex('uploadTime', 'uploadTime', { unique: false });
                    console.log('Books store created');
                }

                // Create stories store
                if (!db.objectStoreNames.contains('stories')) {
                    const storiesStore = db.createObjectStore('stories', { keyPath: 'id' });
                    storiesStore.createIndex('fileName', 'fileName', { unique: false });
                    storiesStore.createIndex('uploadTime', 'uploadTime', { unique: false });
                    storiesStore.createIndex('bookId', 'bookId', { unique: false });
                    console.log('Stories store created');
                } else if (oldVersion < 2) {
                    // Add bookId index to existing stories store
                    const transaction = event.target.transaction;
                    const storiesStore = transaction.objectStore('stories');
                    if (!storiesStore.indexNames.contains('bookId')) {
                        storiesStore.createIndex('bookId', 'bookId', { unique: false });
                        console.log('BookId index added to stories store');
                    }
                }

                // Create histories store
                if (!db.objectStoreNames.contains('histories')) {
                    const historiesStore = db.createObjectStore('histories', { keyPath: 'id' });
                    historiesStore.createIndex('storyId', 'storyId', { unique: false });
                    historiesStore.createIndex('lastReadTime', 'lastReadTime', { unique: false });
                    console.log('Histories store created');
                }
            };
        });
    }

    /**
     * Add a book to the database
     */
    async addBook(bookData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['books'], 'readwrite');
            const store = transaction.objectStore('books');

            const book = {
                id: bookData.id || Date.now().toString(),
                bookName: bookData.bookName,
                uploadTime: bookData.uploadTime || new Date().toISOString(),
                originalFileName: bookData.originalFileName || ''
            };

            const request = store.add(book);

            request.onsuccess = () => {
                resolve(book);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get all books
     */
    async getAllBooks() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['books'], 'readonly');
            const store = transaction.objectStore('books');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get a book by ID
     */
    async getBookById(bookId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['books'], 'readonly');
            const store = transaction.objectStore('books');
            const request = store.get(bookId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Delete a book and all its stories
     */
    async deleteBook(bookId) {
        if (!this.db) await this.init();

        // First delete all stories belonging to this book
        const stories = await this.getStoriesByBookId(bookId);
        for (const story of stories) {
            await this.deleteStory(story.id);
        }

        // Then delete the book
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['books'], 'readwrite');
            const store = transaction.objectStore('books');
            const request = store.delete(bookId);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get stories by book ID
     */
    async getStoriesByBookId(bookId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stories'], 'readonly');
            const store = transaction.objectStore('stories');
            const index = store.index('bookId');
            const request = index.getAll(bookId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Add a story to the database
     */
    async addStory(storyData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stories'], 'readwrite');
            const store = transaction.objectStore('stories');

            const story = {
                id: storyData.id || Date.now().toString(),
                bookId: storyData.bookId || null, // Foreign key to books table
                fileName: storyData.fileName,
                originalFileName: storyData.originalFileName,
                fileSize: storyData.fileSize,
                uploadTime: storyData.uploadTime || new Date().toISOString(),
                content: storyData.content || '',
                processedContent: storyData.processedContent || '',
                chapters: storyData.chapters || [],
                extractedTitle: storyData.extractedTitle || '',
                isSplitFile: storyData.isSplitFile || false,
                splitParentFile: storyData.splitParentFile || null,
                splitIndex: storyData.splitIndex || null,
                totalChunks: storyData.totalChunks || null
            };

            const request = store.add(story);

            request.onsuccess = () => {
                resolve(story);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get all stories
     */
    async getAllStories() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stories'], 'readonly');
            const store = transaction.objectStore('stories');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get a story by ID
     */
    async getStoryById(storyId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stories'], 'readonly');
            const store = transaction.objectStore('stories');
            const request = store.get(storyId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Update a story
     */
    async updateStory(story) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stories'], 'readwrite');
            const store = transaction.objectStore('stories');
            const request = store.put(story);

            request.onsuccess = () => {
                console.log('Story updated successfully:', story.id);
                resolve(story);
            };

            request.onerror = () => {
                console.error('Failed to update story:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Delete a story
     */
    async deleteStory(storyId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stories'], 'readwrite');
            const store = transaction.objectStore('stories');
            const request = store.delete(storyId);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Add or update reading history
     */
    async saveReadingHistory(historyData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['histories'], 'readwrite');
            const store = transaction.objectStore('histories');

            const history = {
                id: historyData.id || `${historyData.storyId}_${Date.now()}`,
                storyId: historyData.storyId,
                lastChapterTitle: historyData.lastChapterTitle,
                lastScrollPosition: historyData.lastScrollPosition || 0,
                lastReadTime: new Date().toISOString(),
                totalTimeRead: historyData.totalTimeRead || 0
            };

            const request = store.put(history);

            request.onsuccess = () => {
                console.log('Reading history saved:', history.id);
                resolve(history);
            };

            request.onerror = () => {
                console.error('Failed to save reading history:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get reading history for a story
     */
    async getReadingHistory(storyId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['histories'], 'readonly');
            const store = transaction.objectStore('histories');
            const index = store.index('storyId');
            const request = index.getAll(storyId);

            request.onsuccess = () => {
                const histories = request.result;
                if (histories.length > 0) {
                    histories.sort((a, b) => new Date(b.lastReadTime) - new Date(a.lastReadTime));
                    resolve(histories[0]);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get all reading histories
     */
    async getAllHistories() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['histories'], 'readonly');
            const store = transaction.objectStore('histories');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Clear all data (for testing/debugging)
     */
    async clearAllData() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['books', 'stories', 'histories'], 'readwrite');
            const booksStore = transaction.objectStore('books');
            const storiesStore = transaction.objectStore('stories');
            const historiesStore = transaction.objectStore('histories');

            const booksRequest = booksStore.clear();
            const storiesRequest = storiesStore.clear();
            const historiesRequest = historiesStore.clear();

            let completed = 0;
            const checkCompletion = () => {
                completed++;
                if (completed === 3) {
                    console.log('All data cleared successfully');
                    resolve();
                }
            };

            booksRequest.onsuccess = checkCompletion;
            booksRequest.onerror = () => reject(booksRequest.error);

            storiesRequest.onsuccess = checkCompletion;
            storiesRequest.onerror = () => reject(storiesRequest.error);

            historiesRequest.onsuccess = checkCompletion;
            historiesRequest.onerror = () => reject(historiesRequest.error);
        });
    }
}

// Export for use in other modules
window.TextReaderDB = TextReaderDB;
