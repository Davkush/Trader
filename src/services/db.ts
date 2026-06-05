export const DB_NAME = 'TradingTerminalDB';
export const DB_VERSION = 1;
export const STORE_DRAWINGS = 'drawings';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_DRAWINGS)) {
        db.createObjectStore(STORE_DRAWINGS, { keyPath: 'paneId' });
      }
    };
  });
};

export const saveDrawings = async (paneId: string, drawings: any[]) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_DRAWINGS, 'readwrite');
    const store = tx.objectStore(STORE_DRAWINGS);
    const request = store.put({ paneId, drawings });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
};

export const loadDrawings = async (paneId: string): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAWINGS, 'readonly');
    const store = tx.objectStore(STORE_DRAWINGS);
    const request = store.get(paneId);
    request.onsuccess = () => {
      resolve(request.result ? request.result.drawings : []);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
};
