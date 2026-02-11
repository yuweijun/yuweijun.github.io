/**
 * Local Browser Database for Text Reader Application
 * Using IndexedDB for storing stories and reading history
 */

class TextReaderDB {
    constructor() {
        this.dbName = 'TextReaderDB';
        this.version = 1;
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

                // Create stories store
                if (!db.objectStoreNames.contains('stories')) {
                    const storiesStore = db.createObjectStore('stories', { keyPath: 'id' });
                    storiesStore.createIndex('fileName', 'fileName', { unique: false });
                    storiesStore.createIndex('uploadTime', 'uploadTime', { unique: false });
                    console.log('Stories store created');
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
     * Add a story to the database
     */
    async addStory(storyData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stories'], 'readwrite');
            const store = transaction.objectStore('stories');
            
            const story = {
                id: storyData.id || Date.now().toString(),
                fileName: storyData.fileName,
                originalFileName: storyData.originalFileName,
                fileSize: storyData.fileSize,
                uploadTime: storyData.uploadTime || new Date().toISOString(),
                content: storyData.content || '', // Store the actual content
                processedContent: storyData.processedContent || '', // Store the HTML formatted content
                chapters: storyData.chapters || [], // Store chapter objects array
                extractedTitle: storyData.extractedTitle || '' // Store the extracted title
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
    async updateStory(storyId, updates) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stories'], 'readwrite');
            const store = transaction.objectStore('stories');
            const getRequest = store.get(storyId);

            getRequest.onsuccess = () => {
                const story = getRequest.result;
                if (story) {
                    // Merge updates
                    Object.assign(story, updates);
                    const putRequest = store.put(story);
                    
                    putRequest.onsuccess = () => {
                        resolve(story);
                    };
                    
                    putRequest.onerror = () => {
                        reject(putRequest.error);
                    };
                } else {
                    reject(new Error('Story not found'));
                }
            };

            getRequest.onerror = () => {
                reject(getRequest.error);
            };
        });
    }

    /**
     * Update an existing story
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
                // Return the most recent history entry
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
            const transaction = this.db.transaction(['stories', 'histories'], 'readwrite');
            const storiesStore = transaction.objectStore('stories');
            const historiesStore = transaction.objectStore('histories');

            const storiesRequest = storiesStore.clear();
            const historiesRequest = historiesStore.clear();

            let completed = 0;
            const checkCompletion = () => {
                completed++;
                if (completed === 2) {
                    console.log('All data cleared successfully');
                    resolve();
                }
            };

            storiesRequest.onsuccess = checkCompletion;
            storiesRequest.onerror = () => reject(storiesRequest.error);
            
            historiesRequest.onsuccess = checkCompletion;
            historiesRequest.onerror = () => reject(historiesRequest.error);
        });
    }
}

// Export for use in other modules
window.TextReaderDB = TextReaderDB;