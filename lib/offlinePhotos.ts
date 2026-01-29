export type PendingPhotoRecord = {
  id: string
  checklistKey: string
  name: string
  contentType: string
  blob: Blob
  createdAt: number
}

const DB_NAME = "adr_offline_photos_v1"
const STORE = "photos"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" })
        os.createIndex("checklistKey", "checklistKey", { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putPendingPhoto(rec: PendingPhotoRecord): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(rec)
  })
  db.close()
}

export async function getPendingPhoto(id: string): Promise<PendingPhotoRecord | null> {
  const db = await openDb()
  const out = await new Promise<PendingPhotoRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as PendingPhotoRecord) || null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return out
}

export async function deletePendingPhoto(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).delete(id)
  })
  db.close()
}

export async function listPendingPhotos(checklistKey: string): Promise<PendingPhotoRecord[]> {
  const db = await openDb()
  const out = await new Promise<PendingPhotoRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const idx = tx.objectStore(STORE).index("checklistKey")
    const req = idx.getAll(checklistKey)
    req.onsuccess = () => resolve((req.result as PendingPhotoRecord[]) || [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return out
}
