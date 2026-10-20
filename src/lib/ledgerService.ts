import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Ledger, LedgerMember, Transaction } from './schemas';
import { ensureLedgerDefaults } from '../features/auth/seedDefaults';

// Character set avoiding ambiguous characters (0, O, 1, I)
const INVITE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates an uppercase alphanumeric invite code of specified length.
 * When a seed (e.g. user UID) is provided, produces a stable, deterministic invite code.
 */
export function generateInviteCode(length: number = 6, seed?: string): string {
  const charsLen = INVITE_CHARS.length;
  if (!seed) {
    let result = '';
    for (let i = 0; i < length; i++) {
      const randIdx = Math.floor(Math.random() * charsLen);
      result += INVITE_CHARS[randIdx];
    }
    return result;
  }

  // Deterministic 32-bit FNV-1a hash variation using seed (e.g. user UID)
  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2f;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ (ch << 3), 0x01000193);
  }

  let result = '';
  for (let i = 0; i < length; i++) {
    const val = Math.abs((h1 ^ (h2 << (i * 5)) ^ (i * 0x5bd1e995)) >>> 0);
    result += INVITE_CHARS[val % charsLen];
  }
  return result;
}

/**
 * Formats a ready-to-send WhatsApp invite message.
 */
export function formatWhatsAppInviteText(
  ledgerName: string,
  inviteCode: string,
  origin: string = 'https://catat-8897d.web.app'
): string {
  const joinUrl = `${origin.replace(/\/+$/, '')}/join?code=${inviteCode}`;
  return (
    `Yuk kelola keuangan keluarga bareng di Catat! 👨‍👩‍👧‍👦\n\n` +
    `Buka link ini untuk bergabung ke Buku Kas "${ledgerName}":\n` +
    `${joinUrl}\n\n` +
    `Atau masukkan kode gabung: *${inviteCode}* di aplikasi Catat.`
  );
}

/**
 * Creates an in-memory initial Ledger object.
 */
export function createInitialLedger(
  owner: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null },
  name?: string
): Ledger {
  const now = Date.now();
  const ownerName = owner.displayName?.trim() || owner.email?.split('@')[0] || 'Keluarga';
  const ledgerName = name?.trim() || `Keluarga ${ownerName}`;
  const inviteCode = generateInviteCode(6, owner.uid);

  const ownerMember: LedgerMember = {
    uid: owner.uid,
    name: ownerName,
    email: owner.email || '',
    photoURL: owner.photoURL || undefined,
    role: 'owner',
    joinedAt: now,
  };

  return {
    id: owner.uid,
    name: ledgerName,
    ownerUid: owner.uid,
    inviteCode,
    members: {
      [owner.uid]: ownerMember,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Preserves existing ledger integrity (invite code, members, createdAt)
 * when re-initializing or re-activating an existing ledger document.
 */
export function reconcileOrPreserveLedger(
  existing: Ledger,
  owner: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null },
  name?: string
): Ledger {
  const ownerName = owner.displayName?.trim() || owner.email?.split('@')[0] || 'Keluarga';
  const ownerMember: LedgerMember = existing.members?.[owner.uid] || {
    uid: owner.uid,
    name: ownerName,
    email: owner.email || '',
    photoURL: owner.photoURL || undefined,
    role: 'owner',
    joinedAt: existing.createdAt || Date.now(),
  };

  return {
    ...existing,
    id: existing.id || owner.uid,
    name: name?.trim() || existing.name || `Keluarga ${ownerName}`,
    ownerUid: existing.ownerUid || owner.uid,
    inviteCode: existing.inviteCode || generateInviteCode(6, owner.uid),
    members: {
      ...existing.members,
      [owner.uid]: ownerMember,
    },
    createdAt: existing.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Immutably adds a member to a ledger object.
 */
export function addMemberToLedger(ledger: Ledger, member: LedgerMember): Ledger {
  return {
    ...ledger,
    members: {
      ...ledger.members,
      [member.uid]: member,
    },
    updatedAt: Date.now(),
  };
}

/**
 * Finds if any transaction in the ledger matches the given referenceKey.
 */
export function findDuplicateReceipt(
  transactions: Transaction[],
  referenceKey: string | null | undefined
): Transaction | null {
  if (!referenceKey) return null;
  const cleanRef = referenceKey.trim().toLowerCase();
  return (
    transactions.find(
      (tx) => tx.referenceKey && tx.referenceKey.trim().toLowerCase() === cleanRef
    ) ?? null
  );
}

/**
 * Fetches a ledger by its document ID.
 */
export async function getLedgerById(ledgerId: string): Promise<Ledger | null> {
  const snap = await getDoc(doc(db, 'ledgers', ledgerId));
  if (!snap.exists()) return null;
  return snap.data() as Ledger;
}

/**
 * Queries a ledger by invite code.
 */
export async function getLedgerByInviteCode(code: string): Promise<Ledger | null> {
  const cleanCode = code.trim().toUpperCase();
  const q = query(collection(db, 'ledgers'), where('inviteCode', '==', cleanCode));
  const snap = await getDocs(q);
  if (snap.empty || !snap.docs[0]) return null;
  const firstDoc = snap.docs[0];
  return { id: firstDoc.id, ...firstDoc.data() } as Ledger;
}

/**
 * Joins an active user into a ledger using the invite code.
 */
export async function joinLedgerByCode(
  code: string,
  user: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null }
): Promise<Ledger> {
  const cleanCode = code.trim().toUpperCase();
  const ledger = await getLedgerByInviteCode(cleanCode);
  if (!ledger) {
    throw new Error('Kode undangan tidak ditemukan atau sudah kadaluarsa.');
  }

  const member: LedgerMember = {
    uid: user.uid,
    name: user.displayName?.trim() || user.email?.split('@')[0] || 'Anggota',
    email: user.email || '',
    photoURL: user.photoURL || undefined,
    role: 'member',
    joinedAt: Date.now(),
  };

  const ledgerRef = doc(db, 'ledgers', ledger.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ledgerRef);
    if (!snap.exists()) {
      throw new Error('Buku kas tidak ditemukan.');
    }
    const currentData = snap.data() as Ledger;
    const updatedMembers = {
      ...currentData.members,
      [user.uid]: member,
    };
    tx.update(ledgerRef, {
      members: updatedMembers,
      updatedAt: Date.now(),
    });
  });

  // Update user's activeLedgerId & permanent familyLedgerId
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, { activeLedgerId: ledger.id, familyLedgerId: ledger.id }, { merge: true });

  return {
    ...ledger,
    members: {
      ...ledger.members,
      [user.uid]: member,
    },
  };
}

/**
 * Creates or re-activates and persists a family ledger in Firestore.
 * Strictly preserves the invite code, existing members, and history if the ledger already exists.
 */
export async function createAndSaveLedger(
  owner: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null },
  name?: string
): Promise<Ledger> {
  const ledgerRef = doc(db, 'ledgers', owner.uid);
  const snap = await getDoc(ledgerRef);

  let targetLedger: Ledger;
  if (snap.exists()) {
    targetLedger = reconcileOrPreserveLedger(snap.data() as Ledger, owner, name);
    await setDoc(ledgerRef, targetLedger, { merge: true });
  } else {
    targetLedger = createInitialLedger(owner, name);
    await setDoc(ledgerRef, targetLedger);
  }

  await ensureLedgerDefaults(targetLedger.id);
  await setDoc(
    doc(db, 'users', owner.uid),
    { activeLedgerId: targetLedger.id, familyLedgerId: targetLedger.id },
    { merge: true }
  );
  return targetLedger;
}

/**
 * Subscribes to real-time updates for a ledger document.
 */
export function subscribeToLedger(
  ledgerId: string,
  onUpdate: (ledger: Ledger | null) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, 'ledgers', ledgerId),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
      } else {
        onUpdate({ id: snap.id, ...snap.data() } as Ledger);
      }
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

/**
 * Retrieves the user's active ledger ID from their user profile document.
 */
export async function getUserActiveLedgerId(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return (snap.data() as { activeLedgerId?: string })?.activeLedgerId ?? null;
  } catch {
    return null;
  }
}

/**
 * Sets the user's active ledger ID in their user profile document.
 * When activating a ledger, also retains familyLedgerId so the user never loses their family ledger reference.
 */
export async function setUserActiveLedgerId(uid: string, ledgerId: string | null): Promise<void> {
  const updateData: Record<string, unknown> = { activeLedgerId: ledgerId };
  if (ledgerId) {
    updateData.familyLedgerId = ledgerId;
  }
  await setDoc(doc(db, 'users', uid), updateData, { merge: true });
}

/**
 * Retrieves the user's family ledger (owned or joined) even if activeLedgerId is currently null.
 */
export async function getUserFamilyLedger(uid: string): Promise<Ledger | null> {
  try {
    // 1. Check user profile for active or family ledger pointer
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const data = userSnap.data() as { activeLedgerId?: string; familyLedgerId?: string };
      const targetId = data.activeLedgerId || data.familyLedgerId;
      if (targetId) {
        const ledgerSnap = await getDoc(doc(db, 'ledgers', targetId));
        if (ledgerSnap.exists()) {
          const lData = ledgerSnap.data() as Ledger;
          if (lData.ownerUid === uid || lData.members?.[uid]) {
            return { ...lData, id: ledgerSnap.id };
          }
        }
      }
    }

    // 2. Fallback: check if user owns ledgers/{uid}
    const ownedSnap = await getDoc(doc(db, 'ledgers', uid));
    if (ownedSnap.exists()) {
      return { ...(ownedSnap.data() as Ledger), id: ownedSnap.id };
    }

    return null;
  } catch {
    return null;
  }
}
