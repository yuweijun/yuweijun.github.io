/**
 * Local Browser Database for Text Reader Application
 * Using IndexedDB for storing books, stories and reading history
 */

class TextReaderDB {
  constructor() {
    this.dbName = 'TextReaderDB';
    this.version = 2;
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
        }

        // Create stories store
        if (!db.objectStoreNames.contains('stories')) {
          const storiesStore = db.createObjectStore('stories', { keyPath: 'id' });
          storiesStore.createIndex('fileName', 'fileName', { unique: false });
          storiesStore.createIndex('uploadTime', 'uploadTime', { unique: false });
          storiesStore.createIndex('bookId', 'bookId', { unique: false });
        } else if (oldVersion < 2) {
          const transaction = event.target.transaction;
          const storiesStore = transaction.objectStore('stories');
          if (!storiesStore.indexNames.contains('bookId')) {
            storiesStore.createIndex('bookId', 'bookId', { unique: false });
          }
        }

        // Create histories store
        if (!db.objectStoreNames.contains('histories')) {
          const historiesStore = db.createObjectStore('histories', { keyPath: 'id' });
          historiesStore.createIndex('storyId', 'storyId', { unique: false });
          historiesStore.createIndex('lastReadTime', 'lastReadTime', { unique: false });
        }
      };
    });
  }

  /**
   * Generic database operation wrapper
   * Reduces boilerplate Promise code
   */
  async executeDBOperation(storeName, mode, operation) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Add a book to the database
   */
  async addBook(bookData) {
    const book = {
      id: bookData.id || Date.now().toString(),
      bookName: bookData.bookName,
      uploadTime: bookData.uploadTime || new Date().toISOString(),
      originalFileName: bookData.originalFileName || ''
    };

    await this.executeDBOperation('books', 'readwrite', store => store.add(book));
    return book;
  }

  /**
   * Get all books
   */
  async getAllBooks() {
    return this.executeDBOperation('books', 'readonly', store => store.getAll());
  }

  /**
   * Get a book by ID
   */
  async getBookById(bookId) {
    return this.executeDBOperation('books', 'readonly', store => store.get(bookId));
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
    await this.executeDBOperation('books', 'readwrite', store => store.delete(bookId));
    return true;
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
   * Get all books with their stories in a single batch query
   * Fixes N+1 query problem when loading books list
   */
  async getAllBooksWithStories() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['books', 'stories'], 'readonly');
      const booksStore = transaction.objectStore('books');
      const storiesStore = transaction.objectStore('stories');

      const booksRequest = booksStore.getAll();
      const storiesRequest = storiesStore.getAll();

      let books = null;
      let stories = null;

      booksRequest.onsuccess = () => {
        books = booksRequest.result;
        if (stories !== null) {
          resolve(combineResults());
        }
      };

      storiesRequest.onsuccess = () => {
        stories = storiesRequest.result;
        if (books !== null) {
          resolve(combineResults());
        }
      };

      booksRequest.onerror = () => reject(booksRequest.error);
      storiesRequest.onerror = () => reject(storiesRequest.error);

      function combineResults() {
        // Group stories by bookId
        const storiesByBookId = {};
        for (const story of stories) {
          const bookId = story.bookId;
          if (!storiesByBookId[bookId]) {
            storiesByBookId[bookId] = [];
          }
          storiesByBookId[bookId].push(story);
        }

        // Attach stories to books and sort
        for (const book of books) {
          book.stories = storiesByBookId[book.id] || [];
          // Sort stories by split index if they are split files
          book.stories.sort((a, b) => {
            if (a.splitIndex && b.splitIndex) {
              return a.splitIndex - b.splitIndex;
            }
            return new Date(a.uploadTime) - new Date(b.uploadTime);
          });
        }

        // Sort books by upload time (newest first)
        books.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));

        return books;
      }
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
        bookId: storyData.bookId || null,
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
   * Get a story by ID
   */
  async getStoryById(storyId) {
    return this.executeDBOperation('stories', 'readonly', store => store.get(storyId));
  }

  /**
   * Update a story
   */
  async updateStory(story) {
    try {
      await this.executeDBOperation('stories', 'readwrite', store => store.put(story));
      return story;
    } catch (error) {
      console.error('Failed to update story:', error);
      throw error;
    }
  }

  /**
   * Delete a story
   */
  async deleteStory(storyId) {
    await this.executeDBOperation('stories', 'readwrite', store => store.delete(storyId));
    return true;
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
