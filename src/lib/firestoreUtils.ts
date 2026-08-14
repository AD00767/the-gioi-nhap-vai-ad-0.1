import {
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import * as localDb from './localDb';

export function getCollectionName(refOrQuery: any): string {
  try {
    if (!refOrQuery) return '';
    if (typeof refOrQuery === 'string') return refOrQuery;
    if (refOrQuery.path) return refOrQuery.path.split('/')[0];
    if (refOrQuery.id && !refOrQuery.parent) return refOrQuery.id;
    if (refOrQuery._query?.path?.segments?.length > 0) return refOrQuery._query.path.segments[0];
    if (refOrQuery._path?.segments?.length > 0) return refOrQuery._path.segments[0];
  } catch (e) {
    console.log("getCollectionName error:", e);
  }
  return '';
}

export function getDocId(docRef: any): string {
  try {
    if (!docRef) return '';
    if (typeof docRef === 'string') return docRef;
    if (docRef.id) return docRef.id;
    if (docRef._key?.path?.segments?.length > 0) {
      const segs = docRef._key.path.segments;
      return segs[segs.length - 1];
    }
  } catch (e) {
    console.log("getDocId error:", e);
  }
  return '';
}

export function findLocalCollection(colName: string): any[] {
  switch (colName) {
    case 'users':
      return localDb.getAllUsers();
    case 'characters':
      return localDb.getAllCharacters();
    case 'prompts':
      return localDb.getAllPrompts();
    case 'feedbacks':
      return localDb.getAllFeedbacks();
    case 'comments':
      return localDb.getAllComments();
    case 'bookmarks':
      return localDb.getAllBookmarks();
    case 'follows':
      return localDb.getAllFollows();
    case 'notifications':
      return localDb.getAllNotifications();
    case 'reports':
      return localDb.getAllReports();
    case 'audit_logs':
      return localDb.getAllAuditLogs();
    case 'creator_requests':
      return localDb.getAllCreatorRequests();
    case 'creator_appeals':
      return localDb.getAllCreatorAppeals();
    case 'support_tickets':
      return localDb.getAllSupportTickets();
    case 'moderator_invites':
      return localDb.getAllModeratorInvites();
    case 'character_likes':
    case 'likes':
      return localDb.getAllLikes();
    default:
      return [];
  }
}

export function makeQuerySnapshot(items: any[]) {
  const docs = items.map(item => ({
    id: item.id || item.uid || 'doc_' + Math.random().toString(36).substring(2, 7),
    exists: () => true,
    data: () => ({ ...item }),
    get: (field: string) => item[field],
    ref: { id: item.id || item.uid }
  }));

  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    map: (callback: (doc: any) => any) => docs.map(callback)
  };
}

export function makeDocSnapshot(id: string, item: any | null) {
  return {
    id: id || item?.id || item?.uid || '',
    exists: () => !!item,
    data: () => (item ? { ...item } : null),
    get: (field: string) => item?.[field]
  };
}

// Memory cache to prevent redundant reads and save quota
const memoryCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function invalidateCache(colName: string) {
  Object.keys(memoryCache).forEach(key => {
    if (key.startsWith(`docs:${colName}`) || key.startsWith(`doc:${colName}`)) {
      delete memoryCache[key];
    }
  });
}

// Global state to track quota status
export let isQuotaExceeded = false;
export const onQuotaExceeded = (callback: (status: boolean) => void) => {
  quotaCallbacks.push(callback);
};
const quotaCallbacks: ((status: boolean) => void)[] = [];

function setQuotaExceeded(status: boolean) {
  if (isQuotaExceeded === status) return;
  isQuotaExceeded = status;
  quotaCallbacks.forEach(cb => cb(status));
}

function matchesQueryString(item: any, queryStr: string): boolean {
  if (!queryStr || queryStr === 'default') return true;
  
  // Fields we want to check for filtering
  const fieldsToCheck = [
    'recipientId',
    'senderId',
    'authorId',
    'creatorId',
    'characterId',
    'promptId',
    'userId',
    'mode'
  ];
  
  for (const field of fieldsToCheck) {
    if (item[field] !== undefined && item[field] !== null) {
      const valStr = String(item[field]);
      
      // If the field name is present in the query string (meaning there is likely a filter on it)
      if (queryStr.includes(field)) {
        // But the specific value of this item is NOT in the query string, then it is a mismatch!
        if (!queryStr.includes(valStr)) {
          return false;
        }
      }
    }
  }
  
  return true;
}

export async function safeGetDocs(queryOrRef: any): Promise<any> {
  const colName = getCollectionName(queryOrRef);
  const queryStr = queryOrRef?._query ? JSON.stringify(queryOrRef._query) : (queryOrRef?.id || 'default');
  const cacheKey = `docs:${colName}:${queryStr}`;

  // Check cache first
  if (memoryCache[cacheKey] && (Date.now() - memoryCache[cacheKey].timestamp) < CACHE_DURATION) {
    console.log(`[Firestore Cache] Using cached docs for ${colName}`);
    return memoryCache[cacheKey].data;
  }

  try {
    const snap = await getDocs(queryOrRef);
    
    // Sync to localDb for future fallbacks
    try {
      const localItems = findLocalCollection(colName) || [];
      const localDeletedIds = new Set(localItems.filter((i: any) => i.deletedAt).map((i: any) => i.id || i.uid));
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, ...(data || {}) };
      }).filter((item: any) => {
        if (localDeletedIds.has(item.id)) return false;
        const localItem = localItems.find((i: any) => i.id === item.id);
        if (localItem && localItem.updatedAt && item.updatedAt) {
           return new Date(localItem.updatedAt).getTime() <= new Date(item.updatedAt).getTime();
        }
        return true;
      });
      if (colName === 'users') {
        items.forEach(item => localDb.updateUser(item.id, item));
      } else if (colName === 'characters') {
        items.forEach(item => localDb.updateCharacter(item.id, item));
      } else if (colName === 'prompts') {
        items.forEach(item => localDb.updatePrompt(item.id, item));
      } else if (colName === 'feedbacks') {
        items.forEach(item => localDb.updateFeedback(item.id, item));
      } else if (colName === 'creator_requests') {
        items.forEach(item => localDb.updateCreatorRequest(item.id, item));
      }
    } catch (syncErr) {
      console.log("Background sync to localDb failed:", syncErr);
    }

    const remoteItems = snap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, ...(data || {}) };
    });

    const localItems = findLocalCollection(colName);
    const mergedMap = new Map<string, any>();

    // 1. Add remote items
    remoteItems.forEach(item => {
      if (item && item.id) {
        mergedMap.set(item.id, item);
      }
    });

    // 2. Add local items that match query filters
    localItems.forEach(item => {
      if (item && item.id) {
        if (matchesQueryString(item, queryStr)) {
          mergedMap.set(item.id, item);
        }
      }
    });

    // 3. Filter out deleted items
    const mergedList = Array.from(mergedMap.values()).filter(item => !item.deletedAt);
    const mergedSnap = makeQuerySnapshot(mergedList);

    // Update cache with merged snapshot
    memoryCache[cacheKey] = {
      data: mergedSnap,
      timestamp: Date.now()
    };

    return mergedSnap;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const isQuotaError = errorMsg.includes('Quota') || errorMsg.includes('limit exceeded') || errorMsg.includes('resource-exhausted') || errorMsg.includes('unavailable');
    
    if (isQuotaError) {
      console.warn("[Firestore Safe Wrapper] Connection unavailable or Quota limit exceeded! Falling back to local data.");
      setQuotaExceeded(true);
    } else {
      console.log("[Firestore Safe Wrapper] getDocs failed, fallback to localDb:", errorMsg);
    }

    try {
      const items = findLocalCollection(colName);
      const matchedItems = items.filter(item => matchesQueryString(item, queryStr) && !item.deletedAt);
      const fallbackSnap = makeQuerySnapshot(matchedItems);
      return fallbackSnap;
    } catch (innerErr) {
      console.error("[Firestore Safe Wrapper] getDocs fallback error:", innerErr);
      return makeQuerySnapshot([]);
    }
  }
}

export async function safeGetDoc(docRef: any): Promise<any> {
  const colName = getCollectionName(docRef);
  const docId = docRef.id || getDocId(docRef);
  const cacheKey = `doc:${colName}:${docId}`;

  // Check cache
  if (memoryCache[cacheKey] && (Date.now() - memoryCache[cacheKey].timestamp) < CACHE_DURATION) {
    console.log(`[Firestore Cache] Using cached doc for ${colName}/${docId}`);
    return memoryCache[cacheKey].data;
  }

  try {
    const snap = await getDoc(docRef);
    
    // Update cache
    memoryCache[cacheKey] = {
      data: snap,
      timestamp: Date.now()
    };

    if (snap.exists()) {
      // Sync to local
      try {
        const localItems = findLocalCollection(colName) || [];
        const localItem = localItems.find((i: any) => i.id === snap.id || i.uid === snap.id);
        if (localItem && localItem.deletedAt) {
          return makeDocSnapshot(snap.id, null); // Return not exists
        }
        const snapData = snap.data() as Record<string, any> | undefined;
        if (localItem && localItem.updatedAt && snapData?.updatedAt) {
           if (new Date(localItem.updatedAt).getTime() > new Date(snapData.updatedAt).getTime()) {
              return makeDocSnapshot(snap.id, localItem);
           }
        }
        
        const data = snap.data() as any;
        const item = { id: snap.id, ...(data || {}) };
        
        if (colName === 'users') localDb.updateUser(snap.id, item);
        else if (colName === 'characters') localDb.updateCharacter(snap.id, item);
        else if (colName === 'prompts') localDb.updatePrompt(snap.id, item);
        else if (colName === 'feedbacks') localDb.updateFeedback(snap.id, item);
      } catch (syncErr) {
        console.log("Background sync to localDb failed:", syncErr);
      }
      return snap;
    }

    const items = findLocalCollection(colName);
    const item = items.find(i => (i.id || i.uid) === docId && !i.deletedAt);
    if (item) return makeDocSnapshot(docId, item);
    return snap;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const isQuotaError = errorMsg.includes('Quota') || errorMsg.includes('limit exceeded') || errorMsg.includes('resource-exhausted') || errorMsg.includes('unavailable');
    
    if (isQuotaError) {
      console.warn(`[Firestore Safe Wrapper] getDoc Connection unavailable or Quota hit for ${colName}/${docId}`);
      setQuotaExceeded(true);
    } else {
      console.log("[Firestore Safe Wrapper] getDoc failed, fallback to localDb:", errorMsg);
    }

    try {
      const items = findLocalCollection(colName);
      const item = items.find(i => (i.id || i.uid) === docId);
      return makeDocSnapshot(docId, item);
    } catch (innerErr) {
      console.error("[Firestore Safe Wrapper] getDoc fallback error:", innerErr);
      return makeDocSnapshot('', null);
    }
  }
}

export function sanitizeData(colName: string, docId: string | null, data: any): any {
  if (!data) return data;
  let existingData: any = null;
  if (docId) {
    const col = findLocalCollection(colName) || [];
    existingData = col.find((x: any) => x.id === docId || x.uid === docId);
  }
  const result = { ...data };
  for (const key in result) {
    const val = result[key];
    if (val && typeof val === 'object' && val._methodName) {
      if (val._methodName === 'serverTimestamp') {
        result[key] = new Date().toISOString();
      } else if (val._methodName === 'increment') {
        const inc = val._operand !== undefined ? val._operand : (val.operand !== undefined ? val.operand : 0);
        const cur = existingData ? (Number(existingData[key]) || 0) : 0;
        result[key] = cur + inc;
      } else if (val._methodName === 'arrayUnion') {
        const els = val._elements || val.elements || [];
        const arr = existingData && Array.isArray(existingData[key]) ? existingData[key] : [];
        result[key] = [...new Set([...arr, ...els])];
      } else if (val._methodName === 'arrayRemove') {
        const els = val._elements || val.elements || [];
        const arr = existingData && Array.isArray(existingData[key]) ? existingData[key] : [];
        result[key] = arr.filter((e: any) => !els.includes(e));
      }
    }
  }
  return result;
}

export async function safeAddDoc(colRef: any, data: any): Promise<any> {
  const colName = getCollectionName(colRef);
  invalidateCache(colName);
  try {
    const docRef = await addDoc(colRef, data);
    try {
      const cleanData = sanitizeData(colName, null, data);
      if (colName === 'feedbacks') {
        localDb.createFeedback({ ...cleanData, id: docRef.id });
      } else if (colName === 'prompts') {
        localDb.createPrompt({ ...cleanData, id: docRef.id });
      } else if (colName === 'characters') {
        localDb.createCharacter({ ...cleanData, id: docRef.id });
      } else if (colName === 'comments') {
        localDb.createComment({ ...cleanData, id: docRef.id });
      } else if (colName === 'notifications') {
        localDb.addNotification({ ...cleanData, id: docRef.id });
      } else if (colName === 'reports') {
        localDb.createReport({ ...cleanData, id: docRef.id });
      } else if (colName === 'bookmarks') {
        localDb.createBookmark({ ...cleanData, id: docRef.id });
      } else if (colName === 'follows') {
        localDb.createFollow({ ...cleanData, id: docRef.id });
      } else if (colName === 'creator_requests') {
        localDb.createCreatorRequest({ ...cleanData, id: docRef.id });
      } else if (colName === 'creator_appeals') {
        localDb.createCreatorAppeal({ ...cleanData, id: docRef.id });
      } else if (colName === 'support_tickets') {
        localDb.createSupportTicket({ ...cleanData, id: docRef.id });
      }
    } catch (localErr) {
      console.log("Local sync failed after Firestore add:", localErr);
    }
    return docRef;
  } catch (err: any) {
    console.log("[Firestore Safe Wrapper] addDoc failed, fallback local ID:", err?.message || err);
    const newId = colName + '_' + Math.random().toString(36).substring(2, 9);
    const cleanData = sanitizeData(colName, null, data);
    
    // Add to localDb if possible
    if (colName === 'feedbacks') {
      localDb.createFeedback({ ...cleanData, id: newId });
    } else if (colName === 'prompts') {
      localDb.createPrompt({ ...cleanData, id: newId });
    } else if (colName === 'characters') {
      localDb.createCharacter({ ...cleanData, id: newId });
    } else if (colName === 'comments') {
      localDb.createComment({ ...cleanData, id: newId });
    } else if (colName === 'notifications') {
      localDb.addNotification({ ...cleanData, id: newId });
    } else if (colName === 'reports') {
      localDb.createReport({ ...cleanData, id: newId });
    } else if (colName === 'bookmarks') {
      localDb.createBookmark({ ...cleanData, id: newId });
    } else if (colName === 'follows') {
      localDb.createFollow({ ...cleanData, id: newId });
    } else if (colName === 'creator_requests') {
      localDb.createCreatorRequest({ ...cleanData, id: newId });
    } else if (colName === 'creator_appeals') {
      localDb.createCreatorAppeal({ ...cleanData, id: newId });
    } else if (colName === 'support_tickets') {
      localDb.createSupportTicket({ ...cleanData, id: newId });
    }

    return { id: newId };
  }
}

export async function safeUpdateDoc(docRef: any, data: any): Promise<any> {
  const colName = getCollectionName(docRef);
  const docId = getDocId(docRef);

  try {
    await updateDoc(docRef, data);
  } catch (err: any) {
    console.log("[Firestore Safe Wrapper] updateDoc failed, fallback local update:", err?.message || err);
  }

  const cleanData = sanitizeData(colName, docId, data);
  
  // Always sync localDb to ensure UI state remains consistent even when Firestore errors
  if (colName === 'feedbacks') {
    localDb.updateFeedback(docId, cleanData);
  } else if (colName === 'prompts') {
    localDb.updatePrompt(docId, cleanData);
  } else if (colName === 'characters') {
    localDb.updateCharacter(docId, cleanData);
  } else if (colName === 'users') {
    localDb.updateUser(docId, cleanData);
  } else if (colName === 'comments') {
    localDb.updateComment(docId, cleanData);
  } else if (colName === 'creator_requests') {
    localDb.updateCreatorRequest(docId, cleanData);
  }
}

export async function safeDeleteDoc(docRef: any): Promise<any> {
  const colName = getCollectionName(docRef);
  const docId = getDocId(docRef);

  try {
    await deleteDoc(docRef);
  } catch (err: any) {
    console.log("[Firestore Safe Wrapper] deleteDoc failed, fallback local delete:", err?.message || err);
  }

  // Always sync localDb delete
  if (colName === 'feedbacks') {
    localDb.deleteFeedback(docId);
  } else if (colName === 'prompts') {
    localDb.deletePrompt(docId);
  } else if (colName === 'characters') {
    localDb.deleteCharacter(docId);
  } else if (colName === 'comments') {
    localDb.deleteComment(docId);
  } else if (colName === 'bookmarks') {
    localDb.deleteBookmark(docId);
  } else if (colName === 'follows') {
    localDb.deleteFollow(docId);
  }
}

export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<any> {
  const colName = getCollectionName(docRef);
  const docId = getDocId(docRef);

  try {
    await setDoc(docRef, data, options);
  } catch (err: any) {
    console.log("[Firestore Safe Wrapper] setDoc failed, fallback local set:", err?.message || err);
  }

  const cleanData = sanitizeData(colName, docId, data);

  if (colName === 'users') {
    localDb.updateUser(docId, cleanData);
  } else if (colName === 'creator_requests') {
    localDb.updateCreatorRequest(docId, cleanData);
  }
}
