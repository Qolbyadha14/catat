import { doc, getDoc, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
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
    // 32 karakter membagi 2^32 tanpa sisa, jadi modulo tidak menimbulkan bias
    const values = crypto.getRandomValues(new Uint32Array(length));
    let result = '';
    for (const value of values) {
      result += INVITE_CHARS[value % charsLen];
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
  name?: string,
  inviteCode: string = generateInviteCode(6)
): Ledger {
  const now = Date.now();
  const ownerName = owner.displayName?.trim() || owner.email?.split('@')[0] || 'Keluarga';
  const ledgerName = name?.trim() || `Keluarga ${ownerName}`;

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
    inviteCode: existing.inviteCode || generateInviteCode(6),
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

const MAX_INVITE_CODE_ATTEMPTS = 5;

/**
 * Fetches a ledger by its document ID. Throws permission-denied for non-members.
 */
export async function getLedgerById(ledgerId: string): Promise<Ledger | null> {
  const snap = await getDoc(doc(db, 'ledgers', ledgerId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Ledger), id: snap.id };
}

/**
 * Generates a random invite code that is not yet registered in invites/{code}.
 */
export async function generateUnusedInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
    const code = generateInviteCode(6);
    const snap = await getDoc(doc(db, 'invites', code));
    if (!snap.exists()) return code;
  }
  throw new Error('Gagal membuat kode undangan unik. Silakan coba lagi.');
}

/**
 * Registers invites/{inviteCode} -> ledgerId when it is missing.
 * Only the ledger owner passes the rules; ledgers created before invites/ existed heal here.
 */
export async function ensureInviteIndex(ledgerId: string, inviteCode: string): Promise<void> {
  const ref = doc(db, 'invites', inviteCode);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, { ledgerId, createdAt: Date.now() });
}

/**
 * Replaces the ledger invite code. The old code stops working immediately.
 */
export async function rotateInviteCode(ledger: Ledger): Promise<string> {
  const newCode = await generateUnusedInviteCode();
  const oldInviteRef = doc(db, 'invites', ledger.inviteCode);
  const oldInvite = await getDoc(oldInviteRef);
  const now = Date.now();

  const batch = writeBatch(db);
  batch.update(doc(db, 'ledgers', ledger.id), { inviteCode: newCode, updatedAt: now });
  batch.set(doc(db, 'invites', newCode), { ledgerId: ledger.id, createdAt: now });
  // Rules delete membaca resource.data.ledgerId, jadi hanya hapus indeks lama yang memang ada
  if (oldInvite.exists() && oldInvite.data().ledgerId === ledger.id) {
    batch.delete(oldInviteRef);
  }
  await batch.commit();
  return newCode;
}

/**
 * Joins the current user into a ledger using an invite code.
 * Non-members cannot read the ledger, so the member entry is written with a field-path update
 * and the rules verify joinCode against the ledger's current inviteCode.
 */
export async function joinLedgerByCode(
  code: string,
  user: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null }
): Promise<Ledger> {
  const cleanCode = code.trim().toUpperCase();
  const inviteSnap = await getDoc(doc(db, 'invites', cleanCode));
  if (!inviteSnap.exists()) {
    throw new Error('Kode undangan tidak ditemukan atau sudah diganti.');
  }
  const { ledgerId } = inviteSnap.data() as { ledgerId: string };

  // Owner dan anggota lama bisa membaca ledger; jangan timpa entry mereka (role owner bisa hilang)
  const existing = await getLedgerById(ledgerId).catch(() => null);
  if (!existing?.members?.[user.uid]) {
    const member: Record<string, unknown> = {
      uid: user.uid,
      name: user.displayName?.trim() || user.email?.split('@')[0] || 'Anggota',
      email: user.email || '',
      role: 'member',
      joinedAt: Date.now(),
      joinCode: cleanCode,
    };
    // Firestore menolak nilai undefined
    if (user.photoURL) member.photoURL = user.photoURL;

    try {
      await updateDoc(doc(db, 'ledgers', ledgerId), {
        [`members.${user.uid}`]: member,
        updatedAt: Date.now(),
      });
    } catch {
      throw new Error('Gagal bergabung. Kode undangan mungkin sudah diganti oleh pemilik buku kas.');
    }
  }

  await setDoc(doc(db, 'users', user.uid), { activeLedgerId: ledgerId, familyLedgerId: ledgerId }, { merge: true });

  const ledger = await getLedgerById(ledgerId);
  if (!ledger) {
    throw new Error('Buku kas tidak ditemukan.');
  }
  return ledger;
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
    await ensureInviteIndex(targetLedger.id, targetLedger.inviteCode);
  } else {
    const inviteCode = await generateUnusedInviteCode();
    targetLedger = createInitialLedger(owner, name, inviteCode);
    const batch = writeBatch(db);
    batch.set(ledgerRef, targetLedger);
    batch.set(doc(db, 'invites', inviteCode), { ledgerId: targetLedger.id, createdAt: Date.now() });
    await batch.commit();
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
