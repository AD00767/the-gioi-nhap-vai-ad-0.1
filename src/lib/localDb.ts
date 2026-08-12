/**
 * LocalStorage Database Engine for "Thế giới nhập vai_AD"
 * Completely replaces Firebase / Backend API for offline & network-resilient client storage.
 */

export interface User {
  id: string;
  uid?: string;
  numericId?: string;
  email: string;
  password?: string;
  displayName: string;
  avatar: string;
  photoURL?: string;
  bio: string;
  statusMessage?: string;
  creatorRequestStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  socialLinks: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    discord?: string;
    customLinks?: { label: string; url: string }[];
  };
  customLinks?: { label: string; url: string }[];
  role: 'ADMIN' | 'USER' | 'MOD' | 'MODERATOR' | string;
  creatorStatus: boolean;
  isLocked: boolean;
  lockReason?: string;
  strikeCount?: number;
  badges?: string[];
  permissions?: string[];
  themePreference?: 'LIGHT' | 'DARK' | 'SYSTEM';
  followerCount?: number;
  characterCount?: number;
  promptCount?: number;
  totalLikes?: number;
  totalSaves?: number;
  moderatorInviteStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface Character {
  id: string;
  numericId?: string;
  name: string;
  avatar: string;
  gender: string;
  slogan: string;
  plot: string;
  characterLink: string;
  creatorId: string;
  creatorName?: string;
  creatorAvatar?: string;
  tags: string[];
  category: string;
  views: number;
  likes: string[]; // array of userIds
  saves: string[]; // array of userIds
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Prompt {
  id: string;
  numericId?: string;
  name: string;
  purpose: string;
  content: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  tags: string[];
  category: string;
  views: number;
  copyCount: number;
  bookmarks: string[]; // array of userIds
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Feedback {
  id: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  recipientId: string;
  recipientName?: string;
  mode: 'PUBLIC' | 'PRIVATE';
  title?: string;
  content: string;
  reactions: Record<string, string>; // userId -> emoji
  replies: {
    id: string;
    senderId: string;
    senderName?: string;
    senderAvatar?: string;
    content: string;
    createdAt: string;
  }[];
  createdAt: string;
  deletedAt: string | null;
}

export interface Comment {
  id: string;
  targetType: 'character' | 'prompt' | 'feedback';
  targetId: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
  parentId?: string | null;
  reactions: Record<string, string>; // userId -> emoji
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Bookmark {
  id: string;
  userId: string;
  itemType: 'character' | 'prompt';
  itemId: string;
  createdAt: string;
}

export interface Follow {
  id: string; // `${followerId}_${creatorId}`
  followerId: string;
  creatorId: string;
  followerName?: string;
  followerAvatar?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  recipientId?: string;
  actorId?: string;
  type: string;
  title: string;
  message?: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  targetType: 'character' | 'prompt' | 'feedback' | 'comment' | 'user';
  targetId: string;
  reason: string;
  description?: string;
  evidenceUrl?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
}

const STORAGE_KEYS = {
  USERS: 'thgegioinhapvai_users',
  CHARACTERS: 'thgegioinhapvai_characters',
  PROMPTS: 'thgegioinhapvai_prompts',
  FEEDBACKS: 'thgegioinhapvai_feedbacks',
  COMMENTS: 'thgegioinhapvai_comments',
  BOOKMARKS: 'thgegioinhapvai_bookmarks',
  FOLLOWS: 'thgegioinhapvai_follows',
  NOTIFICATIONS: 'thgegioinhapvai_notifications',
  REPORTS: 'thgegioinhapvai_reports',
  AUDIT_LOGS: 'thgegioinhapvai_audit_logs',
  CURRENT_USER_ID: 'thgegioinhapvai_current_user_id',
};

// Helper function to safely parse storage
function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.log(`Error reading ${key} from localStorage:`, e);
    return defaultValue;
  }
}

// Helper function to safely set storage
function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.log(`Error writing ${key} to localStorage:`, e);
  }
}

// --- INITIAL SEEDING & CLEANUP ---
export function initLocalDb(): void {
  // Load existing data
  const existingUsers = getStorage<User[]>(STORAGE_KEYS.USERS, []);

  // Filter out any hardcoded 'user_admin' seed accounts to ensure only genuine users exist
  const cleanedUsers = existingUsers.filter(u => u.id !== 'user_admin' && u.email.toLowerCase() !== 'nhuochy259@gmail.com' || u.id !== 'user_admin');

  setStorage(STORAGE_KEYS.USERS, cleanedUsers);
}

// Call init on module import
initLocalDb();

// --- USER OPERATIONS ---
export function getAllUsers(): User[] {
  const users = getStorage<User[]>(STORAGE_KEYS.USERS, []);
  return users.filter(u => !u.deletedAt);
}

export function getUserById(id: string): User | null {
  const users = getAllUsers();
  return users.find(u => u.id === id) || null;
}

export function getUserByEmail(email: string): User | null {
  const users = getAllUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function getUserByNumericId(numericId: string): User | null {
  const users = getAllUsers();
  return users.find(u => String(u.numericId) === String(numericId)) || null;
}

export function getCurrentUserId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
}

export function setCurrentUserId(userId: string | null): void {
  if (userId) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, userId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
  }
}

export function getCurrentUser(): User | null {
  const id = getCurrentUserId();
  if (!id) return null;
  return getUserById(id);
}

export function registerUser(
  email: string,
  password?: string,
  displayName?: string,
  role: 'ADMIN' | 'USER' = 'USER',
  creatorStatus: boolean = false
): { user: User; error?: string } {
  const users = getStorage<User[]>(STORAGE_KEYS.USERS, []);
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (existing) {
    return { user: existing, error: 'Email hoặc tên tài khoản đã tồn tại trong hệ thống.' };
  }

  const now = new Date().toISOString();
  const id = 'user_' + Math.random().toString(36).substring(2, 9);
  const numericId = Math.floor(100000000 + Math.random() * 900000000).toString();

  const newUser: User = {
    id,
    numericId,
    email,
    password: password || '123456',
    displayName: displayName || email.split('@')[0],
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
    bio: '',
    socialLinks: {},
    role,
    creatorStatus,
    isLocked: false,
    strikeCount: 0,
    badges: [],
    permissions: role === 'ADMIN' ? ['ALL'] : [],
    followerCount: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  users.push(newUser);
  setStorage(STORAGE_KEYS.USERS, users);
  setCurrentUserId(newUser.id);

  return { user: newUser };
}

export function loginUser(
  emailOrUsername: string,
  password?: string
): { user: User | null; error?: string } {
  const users = getAllUsers();
  const cleanKey = emailOrUsername.trim().toLowerCase();

  const found = users.find(
    u => u.email.toLowerCase() === cleanKey || u.displayName.toLowerCase() === cleanKey
  );

  if (!found) {
    return { user: null, error: 'Không tìm thấy tài khoản với Email/Tên đã nhập.' };
  }

  if (found.isLocked) {
    return {
      user: null,
      error: found.lockReason ? `Tài khoản đã bị khóa: ${found.lockReason}` : 'Tài khoản của bạn đã bị khóa.',
    };
  }

  if (password && found.password && found.password !== password) {
    return { user: null, error: 'Mật khẩu đăng nhập không chính xác.' };
  }

  setCurrentUserId(found.id);
  return { user: found };
}

export function updateUser(id: string, updates: Partial<User>): User | null {
  const users = getStorage<User[]>(STORAGE_KEYS.USERS, []);
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;

  users[idx] = {
    ...users[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  setStorage(STORAGE_KEYS.USERS, users);
  return users[idx];
}

// --- CHARACTER OPERATIONS ---
export function getAllCharacters(): Character[] {
  const chars = getStorage<Character[]>(STORAGE_KEYS.CHARACTERS, []);
  return chars.filter(c => !c.deletedAt);
}

export function getCharacterById(id: string): Character | null {
  const chars = getAllCharacters();
  return chars.find(c => c.id === id || c.numericId === id) || null;
}

export function createCharacter(charData: Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Character {
  const chars = getStorage<Character[]>(STORAGE_KEYS.CHARACTERS, []);
  const now = new Date().toISOString();
  const id = 'char_' + Math.random().toString(36).substring(2, 9);
  const numericId = Math.floor(200000000 + Math.random() * 800000000).toString();

  const newChar: Character = {
    ...charData,
    id,
    numericId,
    views: charData.views || 0,
    likes: charData.likes || [],
    saves: charData.saves || [],
    isPinned: charData.isPinned || false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  chars.unshift(newChar);
  setStorage(STORAGE_KEYS.CHARACTERS, chars);
  return newChar;
}

export function updateCharacter(id: string, updates: Partial<Character>): Character | null {
  const chars = getStorage<Character[]>(STORAGE_KEYS.CHARACTERS, []);
  const idx = chars.findIndex(c => c.id === id || c.numericId === id);
  if (idx === -1) return null;

  chars[idx] = {
    ...chars[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  setStorage(STORAGE_KEYS.CHARACTERS, chars);
  return chars[idx];
}

export function deleteCharacter(id: string): boolean {
  const chars = getStorage<Character[]>(STORAGE_KEYS.CHARACTERS, []);
  const idx = chars.findIndex(c => c.id === id || c.numericId === id);
  if (idx === -1) return false;

  chars[idx].deletedAt = new Date().toISOString();
  setStorage(STORAGE_KEYS.CHARACTERS, chars);
  return true;
}

export function toggleLikeCharacter(characterId: string, userId: string): { liked: boolean; likesCount: number } {
  const char = getCharacterById(characterId);
  if (!char) return { liked: false, likesCount: 0 };

  let likes = [...(char.likes || [])];
  const exists = likes.includes(userId);

  if (exists) {
    likes = likes.filter(id => id !== userId);
  } else {
    likes.push(userId);
  }

  updateCharacter(char.id, { likes });
  return { liked: !exists, likesCount: likes.length };
}

export function toggleSaveCharacter(characterId: string, userId: string): { saved: boolean; savesCount: number } {
  const char = getCharacterById(characterId);
  if (!char) return { saved: false, savesCount: 0 };

  let saves = [...(char.saves || [])];
  const exists = saves.includes(userId);

  if (exists) {
    saves = saves.filter(id => id !== userId);
  } else {
    saves.push(userId);
  }

  updateCharacter(char.id, { saves });
  return { saved: !exists, savesCount: saves.length };
}

// --- PROMPT OPERATIONS ---
export function getAllPrompts(): Prompt[] {
  const prompts = getStorage<Prompt[]>(STORAGE_KEYS.PROMPTS, []);
  return prompts.filter(p => !p.deletedAt);
}

export function getPromptById(id: string): Prompt | null {
  const prompts = getAllPrompts();
  return prompts.find(p => p.id === id || p.numericId === id) || null;
}

export function createPrompt(promptData: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Prompt {
  const prompts = getStorage<Prompt[]>(STORAGE_KEYS.PROMPTS, []);
  const now = new Date().toISOString();
  const id = 'prompt_' + Math.random().toString(36).substring(2, 9);
  const numericId = Math.floor(300000000 + Math.random() * 700000000).toString();

  const newPrompt: Prompt = {
    ...promptData,
    id,
    numericId,
    views: promptData.views || 0,
    copyCount: promptData.copyCount || 0,
    bookmarks: promptData.bookmarks || [],
    isPinned: promptData.isPinned || false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  prompts.unshift(newPrompt);
  setStorage(STORAGE_KEYS.PROMPTS, prompts);
  return newPrompt;
}

export function updatePrompt(id: string, updates: Partial<Prompt>): Prompt | null {
  const prompts = getStorage<Prompt[]>(STORAGE_KEYS.PROMPTS, []);
  const idx = prompts.findIndex(p => p.id === id || p.numericId === id);
  if (idx === -1) return null;

  prompts[idx] = {
    ...prompts[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  setStorage(STORAGE_KEYS.PROMPTS, prompts);
  return prompts[idx];
}

export function deletePrompt(id: string): boolean {
  const prompts = getStorage<Prompt[]>(STORAGE_KEYS.PROMPTS, []);
  const idx = prompts.findIndex(p => p.id === id || p.numericId === id);
  if (idx === -1) return false;

  prompts[idx].deletedAt = new Date().toISOString();
  setStorage(STORAGE_KEYS.PROMPTS, prompts);
  return true;
}

export function incrementPromptCopy(id: string): number {
  const prompt = getPromptById(id);
  if (!prompt) return 0;
  const newCount = (prompt.copyCount || 0) + 1;
  updatePrompt(prompt.id, { copyCount: newCount });
  return newCount;
}

export function toggleBookmarkPrompt(promptId: string, userId: string): { bookmarked: boolean; count: number } {
  const prompt = getPromptById(promptId);
  if (!prompt) return { bookmarked: false, count: 0 };

  let bookmarks = [...(prompt.bookmarks || [])];
  const exists = bookmarks.includes(userId);

  if (exists) {
    bookmarks = bookmarks.filter(id => id !== userId);
  } else {
    bookmarks.push(userId);
  }

  updatePrompt(prompt.id, { bookmarks });
  return { bookmarked: !exists, count: bookmarks.length };
}

// --- FEEDBACK OPERATIONS ---
export function getAllFeedbacks(): Feedback[] {
  const list = getStorage<Feedback[]>(STORAGE_KEYS.FEEDBACKS, []);
  return list.filter(f => !f.deletedAt);
}

export function createFeedback(fData: Omit<Feedback, 'id' | 'createdAt' | 'deletedAt'>): Feedback {
  const list = getStorage<Feedback[]>(STORAGE_KEYS.FEEDBACKS, []);
  const now = new Date().toISOString();
  const newF: Feedback = {
    ...fData,
    id: 'feedback_' + Math.random().toString(36).substring(2, 9),
    reactions: fData.reactions || {},
    replies: fData.replies || [],
    createdAt: now,
    deletedAt: null,
  };
  list.unshift(newF);
  setStorage(STORAGE_KEYS.FEEDBACKS, list);
  return newF;
}

export function addFeedbackReply(feedbackId: string, reply: { senderId: string; senderName?: string; senderAvatar?: string; content: string }): Feedback | null {
  const list = getStorage<Feedback[]>(STORAGE_KEYS.FEEDBACKS, []);
  const idx = list.findIndex(f => f.id === feedbackId);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  list[idx].replies.push({
    id: 'reply_' + Math.random().toString(36).substring(2, 9),
    ...reply,
    createdAt: now,
  });

  setStorage(STORAGE_KEYS.FEEDBACKS, list);
  return list[idx];
}

export function updateFeedback(id: string, updates: Partial<Feedback>): Feedback | null {
  const list = getStorage<Feedback[]>(STORAGE_KEYS.FEEDBACKS, []);
  const idx = list.findIndex(f => f.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    ...updates,
  };
  setStorage(STORAGE_KEYS.FEEDBACKS, list);
  return list[idx];
}

export function deleteFeedback(id: string): boolean {
  const list = getStorage<Feedback[]>(STORAGE_KEYS.FEEDBACKS, []);
  const idx = list.findIndex(f => f.id === id);
  if (idx === -1) return false;
  list[idx].deletedAt = new Date().toISOString();
  setStorage(STORAGE_KEYS.FEEDBACKS, list);
  return true;
}

// --- COMMENT OPERATIONS ---
export function getComments(targetType: 'character' | 'prompt' | 'feedback', targetId: string): Comment[] {
  const comments = getStorage<Comment[]>(STORAGE_KEYS.COMMENTS, []);
  return comments.filter(c => !c.deletedAt && c.targetType === targetType && c.targetId === targetId);
}

export function createComment(cData: Omit<Comment, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Comment {
  const comments = getStorage<Comment[]>(STORAGE_KEYS.COMMENTS, []);
  const now = new Date().toISOString();
  const newC: Comment = {
    ...cData,
    id: 'comment_' + Math.random().toString(36).substring(2, 9),
    reactions: cData.reactions || {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  comments.push(newC);
  setStorage(STORAGE_KEYS.COMMENTS, comments);
  return newC;
}

export function updateComment(id: string, updates: Partial<Comment>): Comment | null {
  const comments = getStorage<Comment[]>(STORAGE_KEYS.COMMENTS, []);
  const idx = comments.findIndex(c => c.id === id);
  if (idx === -1) return null;
  comments[idx] = {
    ...comments[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setStorage(STORAGE_KEYS.COMMENTS, comments);
  return comments[idx];
}

export function deleteComment(id: string): boolean {
  const comments = getStorage<Comment[]>(STORAGE_KEYS.COMMENTS, []);
  const idx = comments.findIndex(c => c.id === id);
  if (idx === -1) return false;
  comments[idx].deletedAt = new Date().toISOString();
  setStorage(STORAGE_KEYS.COMMENTS, comments);
  return true;
}

// --- FOLLOW OPERATIONS ---
export function checkIsFollowing(followerId: string, creatorId: string): boolean {
  if (!followerId || !creatorId) return false;
  const follows = getStorage<Follow[]>(STORAGE_KEYS.FOLLOWS, []);
  return follows.some(f => f.followerId === followerId && f.creatorId === creatorId);
}

export function toggleFollow(followerId: string, creatorId: string, followerInfo?: { displayName?: string; avatar?: string }): { following: boolean; count: number } {
  if (followerId === creatorId) {
    return { following: false, count: getFollowerCount(creatorId) };
  }

  const follows = getStorage<Follow[]>(STORAGE_KEYS.FOLLOWS, []);
  const existingIdx = follows.findIndex(f => f.followerId === followerId && f.creatorId === creatorId);
  let isFollowing = false;

  if (existingIdx !== -1) {
    follows.splice(existingIdx, 1);
    isFollowing = false;
  } else {
    follows.push({
      id: `${followerId}_${creatorId}`,
      followerId,
      creatorId,
      followerName: followerInfo?.displayName,
      followerAvatar: followerInfo?.avatar,
      createdAt: new Date().toISOString(),
    });
    isFollowing = true;

    // Create notification
    addNotification({
      userId: creatorId,
      actorId: followerId,
      type: 'FOLLOW',
      title: 'Người theo dõi mới',
      message: `${followerInfo?.displayName || 'Một người dùng'} đã bắt đầu theo dõi bạn.`,
    });
  }

  setStorage(STORAGE_KEYS.FOLLOWS, follows);

  // Update creator follower count in user record
  const count = getFollowerCount(creatorId);
  updateUser(creatorId, { followerCount: count });

  return { following: isFollowing, count };
}

export function getFollowerCount(creatorId: string): number {
  const follows = getStorage<Follow[]>(STORAGE_KEYS.FOLLOWS, []);
  return follows.filter(f => f.creatorId === creatorId).length;
}

export function getAllComments(): Comment[] {
  return getStorage<Comment[]>(STORAGE_KEYS.COMMENTS, []);
}

export function getAllBookmarks(): Bookmark[] {
  return getStorage<Bookmark[]>(STORAGE_KEYS.BOOKMARKS, []);
}

export function createBookmark(data: any): Bookmark {
  const bookmarks = getStorage<Bookmark[]>(STORAGE_KEYS.BOOKMARKS, []);
  const newB: Bookmark = {
    id: data.id || 'bookmark_' + Math.random().toString(36).substring(2, 9),
    userId: data.userId || '',
    itemType: data.itemType || 'character',
    itemId: data.itemId || '',
    createdAt: data.createdAt || new Date().toISOString(),
  };
  bookmarks.push(newB);
  setStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);

  // Sync to underlying Character or Prompt saves/bookmarks arrays!
  if (newB.itemType === 'character') {
    const char = getCharacterById(newB.itemId);
    if (char) {
      const saves = Array.from(new Set([...(char.saves || []), newB.userId]));
      updateCharacter(newB.itemId, { saves });
    }
  } else if (newB.itemType === 'prompt') {
    const prompt = getPromptById(newB.itemId);
    if (prompt) {
      const bmarks = Array.from(new Set([...(prompt.bookmarks || []), newB.userId]));
      updatePrompt(newB.itemId, { bookmarks: bmarks });
    }
  }

  return newB;
}

export function deleteBookmark(id: string): boolean {
  const bookmarks = getStorage<Bookmark[]>(STORAGE_KEYS.BOOKMARKS, []);
  const idx = bookmarks.findIndex(b => b.id === id);
  if (idx === -1) return false;
  const b = bookmarks[idx];
  bookmarks.splice(idx, 1);
  setStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);

  // Sync back to Character or Prompt saves/bookmarks arrays
  if (b.itemType === 'character') {
    const char = getCharacterById(b.itemId);
    if (char) {
      const saves = (char.saves || []).filter(uid => uid !== b.userId);
      updateCharacter(b.itemId, { saves });
    }
  } else if (b.itemType === 'prompt') {
    const prompt = getPromptById(b.itemId);
    if (prompt) {
      const bmarks = (prompt.bookmarks || []).filter(uid => uid !== b.userId);
      updatePrompt(b.itemId, { bookmarks: bmarks });
    }
  }

  return true;
}

export function getAllFollows(): Follow[] {
  return getStorage<Follow[]>(STORAGE_KEYS.FOLLOWS, []);
}

export function createFollow(data: any): Follow {
  const follows = getStorage<Follow[]>(STORAGE_KEYS.FOLLOWS, []);
  const newF: Follow = {
    id: data.id || `${data.followerId}_${data.creatorId}`,
    followerId: data.followerId || '',
    creatorId: data.creatorId || '',
    followerName: data.followerName || '',
    followerAvatar: data.followerAvatar || '',
    createdAt: data.createdAt || new Date().toISOString(),
  };
  follows.push(newF);
  setStorage(STORAGE_KEYS.FOLLOWS, follows);

  const count = getFollowerCount(newF.creatorId);
  updateUser(newF.creatorId, { followerCount: count });

  return newF;
}

export function deleteFollow(id: string): boolean {
  const follows = getStorage<Follow[]>(STORAGE_KEYS.FOLLOWS, []);
  const idx = follows.findIndex(f => f.id === id || `${f.followerId}_${f.creatorId}` === id);
  if (idx === -1) return false;
  const f = follows[idx];
  follows.splice(idx, 1);
  setStorage(STORAGE_KEYS.FOLLOWS, follows);

  const count = getFollowerCount(f.creatorId);
  updateUser(f.creatorId, { followerCount: count });

  return true;
}

export function getFollowedCreators(followerId: string): User[] {
  const follows = getStorage<Follow[]>(STORAGE_KEYS.FOLLOWS, []);
  const creatorIds = follows.filter(f => f.followerId === followerId).map(f => f.creatorId);
  const users = getAllUsers();
  return users.filter(u => creatorIds.includes(u.id));
}

// --- NOTIFICATIONS ---
export function getAllNotifications(): NotificationItem[] {
  return getStorage<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
}

export function getUserNotifications(userId: string): NotificationItem[] {
  const notifs = getAllNotifications();
  return notifs.filter(n => n.userId === userId || n.recipientId === userId);
}

export function addNotification(data: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>): NotificationItem {
  const notifs = getStorage<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const newN: NotificationItem = {
    ...data,
    id: 'notif_' + Math.random().toString(36).substring(2, 9),
    read: false,
    createdAt: new Date().toISOString(),
  };
  notifs.unshift(newN);
  setStorage(STORAGE_KEYS.NOTIFICATIONS, notifs);
  return newN;
}

export function markNotificationAsRead(id: string): void {
  const notifs = getStorage<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const item = notifs.find(n => n.id === id);
  if (item) {
    item.read = true;
    setStorage(STORAGE_KEYS.NOTIFICATIONS, notifs);
  }
}

export function markAllNotificationsAsRead(userId: string): void {
  const notifs = getStorage<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  notifs.forEach(n => {
    if (n.userId === userId || n.recipientId === userId) {
      n.read = true;
    }
  });
  setStorage(STORAGE_KEYS.NOTIFICATIONS, notifs);
}

// --- REPORTS & AUDIT LOGS ---
export function getAllReports(): ReportItem[] {
  return getStorage<ReportItem[]>(STORAGE_KEYS.REPORTS, []);
}

export function createReport(reportData: Omit<ReportItem, 'id' | 'status' | 'createdAt'>): ReportItem {
  const reports = getAllReports();
  const newR: ReportItem = {
    ...reportData,
    id: 'report_' + Math.random().toString(36).substring(2, 9),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  reports.unshift(newR);
  setStorage(STORAGE_KEYS.REPORTS, reports);
  return newR;
}

export function updateReportStatus(id: string, status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED'): void {
  const reports = getAllReports();
  const item = reports.find(r => r.id === id);
  if (item) {
    item.status = status;
    setStorage(STORAGE_KEYS.REPORTS, reports);
  }
}

export function getAllAuditLogs(): AuditLogItem[] {
  return getStorage<AuditLogItem[]>(STORAGE_KEYS.AUDIT_LOGS, []);
}

export function addAuditLog(log: Omit<AuditLogItem, 'id' | 'createdAt'>): void {
  const logs = getAllAuditLogs();
  logs.unshift({
    ...log,
    id: 'audit_' + Math.random().toString(36).substring(2, 9),
    createdAt: new Date().toISOString(),
  });
  setStorage(STORAGE_KEYS.AUDIT_LOGS, logs);
}
