// Minimal IndexedDB helper for storing photos offline (no external deps)

export type OfflinePhotoRecord = {
  id: string
  blob: Blob
  name: string
  contentType: string
  createdAt: number
}

const DB_NAME = "adr_offline_photos_db"
const STORE = "photos"
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbPutPhoto(rec: OfflinePhotoRecord): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(rec)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function idbGetPhoto(id: string): Promise<OfflinePhotoRecord | null> {
  const db = await openDb()
  const out = await new Promise<OfflinePhotoRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as OfflinePhotoRecord) || null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return out
}

export async function idbDeletePhoto(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
