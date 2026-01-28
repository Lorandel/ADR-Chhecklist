export type OfflinePhotoRecord = {
  key: string
  blob: Blob
  name: string
  contentType: string
  createdAt: number
}

// Minimal IndexedDB helper (no deps)
const DB_NAME = "adr_offline_db"
const DB_VERSION = 1
const STORE = "photos"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putOfflinePhoto(rec: OfflinePhotoRecord) {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).put(rec)
    })
  } finally {
    db.close()
  }
}

export async function getOfflinePhoto(key: string): Promise<OfflinePhotoRecord | null> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as OfflinePhotoRecord) || null)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function deleteOfflinePhoto(key: string) {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).delete(key)
    })
  } finally {
    db.close()
  }
}

export async function listOfflinePhotoKeys(prefix: string): Promise<string[]> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const keys: string[] = []
      const tx = db.transaction(STORE, "readonly")
      const store = tx.objectStore(STORE)
      const req = store.openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return resolve(keys)
        const k = String((cursor.value as any)?.key || "")
        if (k.startsWith(prefix)) keys.push(k)
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}
