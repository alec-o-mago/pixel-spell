import { parseProject, type LoadedProject } from "./file.js";

/** How often the workspace writes a recovery snapshot while there are edits. */
export const AUTOSAVE_INTERVAL_MS = 5000;

const DB_NAME = "pixel-spell-autosave";
const DB_VERSION = 1;
const STORE_NAME = "projects";
/** Refuse individual snapshots that would likely exhaust a browser quota. */
const MAX_RECORD_BYTES = 64 * 1024 * 1024;

/**
 * One unsaved project tab, serialized with the normal `.pixelspell` encoder.
 * The tab id is the IndexedDB primary key, so autosaves follow project tabs.
 */
export interface AutosaveRecord {
	id: string;
	name: string;
	bytes: Uint8Array;
	/** True for the project that was active when the snapshot was written. */
	active: boolean;
	/** Tab order at the time of the snapshot, used to restore the same order. */
	position: number;
	savedAt: number;
}

/** A parsed autosave ready to preview and restore. */
export interface RecoveredProject {
	record: AutosaveRecord;
	project: LoadedProject;
}

let databasePromise: Promise<IDBDatabase | null> | null = null;
/**
 * IndexedDB transactions are created when the queue reaches them, so a write
 * scheduled before an explicit delete always lands first.
 */
let operationQueue: Promise<void> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase | null> {
	if (databasePromise) return databasePromise;

	databasePromise = new Promise((resolve) => {
		if (typeof indexedDB === "undefined") {
			resolve(null);
			return;
		}

		try {
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onupgradeneeded = () => {
				const database = request.result;
				if (!database.objectStoreNames.contains(STORE_NAME)) {
					database.createObjectStore(STORE_NAME, { keyPath: "id" });
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
			request.onblocked = () => resolve(null);
		} catch {
			// Private browsing and sandboxed frames can reject the open call.
			resolve(null);
		}
	});

	return databasePromise;
}

function enqueue(operation: () => Promise<void>): Promise<void> {
	operationQueue = operationQueue.then(operation, operation).catch(() => {});
	return operationQueue;
}

function isAutosaveRecord(value: unknown): value is AutosaveRecord {
	if (!value || typeof value !== "object") return false;
	const record = value as Partial<AutosaveRecord>;
	return (
		typeof record.id === "string" &&
		record.id.length > 0 &&
		typeof record.name === "string" &&
		record.bytes instanceof Uint8Array &&
		record.bytes.length > 0 &&
		(record.position === undefined || typeof record.position === "number") &&
		typeof record.savedAt === "number" &&
		Number.isFinite(record.savedAt)
	);
}

async function writeRecord(record: AutosaveRecord): Promise<void> {
	const database = await openDatabase();
	if (!database) return;

	await new Promise<void>((resolve) => {
		let transaction: IDBTransaction;
		try {
			transaction = database.transaction(STORE_NAME, "readwrite");
		} catch {
			resolve();
			return;
		}
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => resolve();
		transaction.onabort = () => resolve();
		transaction.objectStore(STORE_NAME).put({
			...record,
			active: record.active === true,
		});
	});
}

async function deleteRecord(id: string): Promise<void> {
	const database = await openDatabase();
	if (!database) return;

	await new Promise<void>((resolve) => {
		let transaction: IDBTransaction;
		try {
			transaction = database.transaction(STORE_NAME, "readwrite");
		} catch {
			resolve();
			return;
		}
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => resolve();
		transaction.onabort = () => resolve();
		transaction.objectStore(STORE_NAME).delete(id);
	});
}

async function clearRecords(): Promise<void> {
	const database = await openDatabase();
	if (!database) return;

	await new Promise<void>((resolve) => {
		let transaction: IDBTransaction;
		try {
			transaction = database.transaction(STORE_NAME, "readwrite");
		} catch {
			resolve();
			return;
		}
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => resolve();
		transaction.onabort = () => resolve();
		transaction.objectStore(STORE_NAME).clear();
	});
}

async function readRecords(): Promise<AutosaveRecord[]> {
	const database = await openDatabase();
	if (!database) return [];

	return new Promise((resolve) => {
		let transaction: IDBTransaction;
		try {
			transaction = database.transaction(STORE_NAME, "readonly");
		} catch {
			resolve([]);
			return;
		}
		const request = transaction.objectStore(STORE_NAME).getAll();
		request.onsuccess = () => {
			const records = Array.isArray(request.result) ? request.result : [];
			resolve(
				records
					.filter(isAutosaveRecord)
					.map((record) => ({
						...record,
						active: record.active === true,
						position: Number.isFinite(record.position)
							? Math.round(record.position)
							: 0,
					})),
			);
		};
		request.onerror = () => resolve([]);
		transaction.onabort = () => resolve([]);
	});
}

/** Stores (or replaces) the autosave for one project tab. */
export function writeAutosave(record: AutosaveRecord): Promise<void> {
	if (record.bytes.length > MAX_RECORD_BYTES) return Promise.resolve();
	return enqueue(() => writeRecord(record));
}

/** Removes the autosave for a project that was saved or closed. */
export function deleteAutosave(id: string): Promise<void> {
	return enqueue(() => deleteRecord(id));
}

/** Removes every autosave after the user restores or discards them. */
export function clearAutosaves(): Promise<void> {
	return enqueue(clearRecords);
}

/**
 * Reads and parses every stored snapshot. Unreadable records are deleted so a
 * corrupt entry cannot prompt on every launch.
 */
export async function loadRecoveryProjects(): Promise<RecoveredProject[]> {
	try {
		const records = await readRecords();
		const recovered: RecoveredProject[] = [];
		const invalidIds: string[] = [];

		for (const record of records) {
			const project = parseProject(record.bytes);
			if (project) recovered.push({ record, project });
			else invalidIds.push(record.id);
		}

		for (const id of invalidIds) void deleteAutosave(id);

		recovered.sort(
			(a, b) =>
				a.record.position - b.record.position ||
				b.record.savedAt - a.record.savedAt,
		);
		return recovered;
	} catch {
		// Recovery is best-effort; never block startup on storage failures.
		return [];
	}
}
