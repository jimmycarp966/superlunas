export interface OfflineCobranzaAction {
    id: string;
    payload: {
        agendaId: string;
        monto: number;
        fechaImputacion: string;
        fechaDeudaObjetivo: string;
        medioPago?: string;
        observaciones?: string;
    };
    createdAt: string;
}

const DB_NAME = "lunas-confort-offline";
const DB_VERSION = 1;
const STORE_NAME = "cobranzas_actions";

const openDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB"));
    });
};

const txComplete = (tx: IDBTransaction): Promise<void> => {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Fallo transaccion IndexedDB"));
        tx.onabort = () => reject(tx.error ?? new Error("Transaccion abortada"));
    });
};

export const enqueueCobranzaAction = async (
    action: OfflineCobranzaAction,
): Promise<void> => {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(action);
    await txComplete(tx);
    db.close();
};

export const listCobranzaActions = async (): Promise<OfflineCobranzaAction[]> => {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    const data = await new Promise<OfflineCobranzaAction[]>((resolve, reject) => {
        req.onsuccess = () => resolve((req.result ?? []) as OfflineCobranzaAction[]);
        req.onerror = () => reject(req.error ?? new Error("No se pudo leer cola offline"));
    });
    await txComplete(tx);
    db.close();
    return data.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const removeCobranzaAction = async (id: string): Promise<void> => {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await txComplete(tx);
    db.close();
};

