import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Ledger } from '../../lib/schemas';
import { ensureLedgerDefaults } from '../auth/seedDefaults';
import { isShowcaseMode } from '../../lib/showcaseMockData';
import {
  createAndSaveLedger,
  ensureInviteIndex,
  getUserActiveLedgerId,
  getUserFamilyLedger,
  rotateInviteCode,
  setUserActiveLedgerId,
  subscribeToLedger,
} from '../../lib/ledgerService';

interface LedgerSnapshot {
  id: string;
  ledger: Ledger | null;
}

/**
 * State buku kas keluarga: ledger aktif (real-time), ledger keluarga tersimpan, dan aksinya.
 * activeLedgerId null berarti buku kas pribadi.
 */
export function useFamilyLedger(user: User) {
  const uid = user.uid;
  const showcase = isShowcaseMode();

  // Profil untuk createAndSaveLedger/joinLedgerByCode. Fungsi itu membaca displayName/email,
  // jadi objek creator { uid, name } tidak cukup (nama anggota sebelumnya jatuh ke "Anggota").
  const ledgerProfile = useMemo(
    () => ({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL }),
    [user]
  );

  const [activeLedgerId, setActiveLedgerId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [savedFamilyLedger, setSavedFamilyLedger] = useState<Ledger | null>(null);
  const [isCreatingLedger, setIsCreatingLedger] = useState(false);

  // Pulihkan pilihan buku kas terakhir dan ledger keluarga yang tersimpan
  useEffect(() => {
    if (showcase) return;
    let cancelled = false;
    getUserActiveLedgerId(uid).then((storedId) => {
      if (!cancelled && storedId) setActiveLedgerId(storedId);
    });
    getUserFamilyLedger(uid).then((ledger) => {
      if (!cancelled && ledger) setSavedFamilyLedger(ledger);
    });
    return () => {
      cancelled = true;
    };
  }, [showcase, uid]);

  // Ikuti perubahan ledger aktif secara real-time
  useEffect(() => {
    if (!activeLedgerId) return;
    const ledgerId = activeLedgerId;
    ensureLedgerDefaults(ledgerId).catch(console.error);
    return subscribeToLedger(
      ledgerId,
      (ledger) => {
        setSnapshot({ id: ledgerId, ledger });
        if (ledger) setSavedFamilyLedger(ledger);
      },
      (err) => {
        // Bukan anggota lagi (atau ledger dihapus): kembali ke buku kas pribadi
        console.warn('[family] ledger aktif tidak bisa dibaca, kembali ke buku kas pribadi:', err.message);
        setActiveLedgerId(null);
      }
    );
  }, [activeLedgerId]);

  const activeLedger = activeLedgerId && snapshot?.id === activeLedgerId ? snapshot.ledger : null;

  // Ledger yang dibuat sebelum koleksi invites/ ada belum punya indeks kode.
  // Owner membuatnya saat membuka aplikasi; rules hanya mengizinkan owner.
  const ownedLedgerId = savedFamilyLedger?.ownerUid === uid ? savedFamilyLedger.id : null;
  const ownedInviteCode = ownedLedgerId ? savedFamilyLedger?.inviteCode ?? null : null;
  useEffect(() => {
    if (!ownedLedgerId || !ownedInviteCode || showcase) return;
    ensureInviteIndex(ownedLedgerId, ownedInviteCode).catch(console.error);
  }, [showcase, ownedLedgerId, ownedInviteCode]);

  const activate = (ledger: Ledger) => {
    setActiveLedgerId(ledger.id);
    setSnapshot({ id: ledger.id, ledger });
    setSavedFamilyLedger(ledger);
  };

  const createLedger = async () => {
    setIsCreatingLedger(true);
    try {
      activate(await createAndSaveLedger(ledgerProfile));
    } finally {
      setIsCreatingLedger(false);
    }
  };

  const switchToFamily = async () => {
    if (!savedFamilyLedger) return;
    await setUserActiveLedgerId(uid, savedFamilyLedger.id);
    activate(savedFamilyLedger);
  };

  const switchToPersonal = async () => {
    await setUserActiveLedgerId(uid, null);
    setActiveLedgerId(null);
  };

  const rotateCode = async () => {
    const ledger = savedFamilyLedger;
    if (!ledger || ledger.ownerUid !== uid) return;
    const newCode = await rotateInviteCode(ledger);
    // Jika ledger sedang aktif, subscribeToLedger juga akan mengirim kode baru
    setSavedFamilyLedger({ ...ledger, inviteCode: newCode });
  };

  return {
    activeLedgerId,
    activeLedger,
    savedFamilyLedger,
    isCreatingLedger,
    ledgerProfile,
    createLedger,
    switchToFamily,
    switchToPersonal,
    handleJoinSuccess: activate,
    rotateInviteCode: rotateCode,
  };
}
