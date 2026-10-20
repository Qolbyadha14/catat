import React, { useState, useEffect } from 'react';
import {
  Users,
  BookOpen,
  RotateCcw,
  Search,
  CheckCircle,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { collection, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatTelemetryDateKey } from '../../lib/telemetry/telemetryService';
import { isShowcaseMode, MOCK_SHOWCASE_USER } from '../../lib/showcaseMockData';

interface UserRecord {
  uid: string;
  email?: string;
  displayName?: string;
  createdAt?: number;
  lastActiveAt?: number;
  todayScans?: number;
}

interface LedgerRecord {
  id: string;
  name?: string;
  inviteCode?: string;
  ownerUid?: string;
  memberCount?: number;
}

interface UsersLedgersTabProps {
  dailyLimit: number;
}

export const UsersLedgersTab: React.FC<UsersLedgersTabProps> = ({ dailyLimit }) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [ledgers, setLedgers] = useState<LedgerRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userSearch, setUserSearch] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const todayKey = formatTelemetryDateKey(new Date());

  const loadData = async () => {
    setLoading(true);
    if (isShowcaseMode()) {
      setUsers([
        {
          uid: MOCK_SHOWCASE_USER.uid,
          email: MOCK_SHOWCASE_USER.email || 'user@coreboy.test',
          displayName: MOCK_SHOWCASE_USER.displayName || 'Demo User',
          createdAt: Date.now() - 86400000 * 7,
          lastActiveAt: Date.now(),
          todayScans: 4,
        },
        {
          uid: 'user_sample_2',
          email: 'budi@example.com',
          displayName: 'Budi Santoso',
          createdAt: Date.now() - 86400000 * 14,
          lastActiveAt: Date.now() - 3600000 * 2,
          todayScans: 18,
        },
      ]);
      setLedgers([
        {
          id: 'ledger_fam_1',
          name: 'Kas Keluarga Santoso',
          inviteCode: 'FAM889',
          ownerUid: 'user_sample_2',
          memberCount: 3,
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch users
      const usersSnap = await getDocs(collection(db, 'users'));
      const loadedUsers: UserRecord[] = [];

      for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        const uid = userDoc.id;

        // Fetch usage for today if exists
        let todayScans = 0;
        try {
          const usageSnap = await getDocs(collection(db, 'scanUsage'));
          const usageDoc = usageSnap.docs.find((d) => d.id === `${uid}_${todayKey}`);
          if (usageDoc) {
            todayScans = usageDoc.data().count || 0;
          }
        } catch {
          // ignore usage check error
        }

        loadedUsers.push({
          uid,
          email: data.email || '',
          displayName: data.displayName || '',
          createdAt: data.createdAt || 0,
          lastActiveAt: data.lastActiveAt || 0,
          todayScans,
        });
      }
      setUsers(loadedUsers);

      // 2. Fetch collaborative ledgers
      const ledgersSnap = await getDocs(collection(db, 'ledgers'));
      const loadedLedgers: LedgerRecord[] = ledgersSnap.docs.map((d) => {
        const dData = d.data();
        return {
          id: d.id,
          name: dData.name || 'Buku Kas Keluarga',
          inviteCode: dData.inviteCode || '-',
          ownerUid: dData.ownerUid || '',
          memberCount: Array.isArray(dData.members) ? dData.members.length : 1,
        };
      });
      setLedgers(loadedLedgers);
    } catch (err) {
      console.warn('Gagal memuat direktori users & ledgers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResetQuota = async (targetUid: string, userIdentifier: string) => {
    const confirmReset = window.confirm(
      `Apakah Anda yakin ingin mereset kuota scan hari ini untuk ${userIdentifier}?`
    );
    if (!confirmReset) return;

    try {
      const usageRef = doc(db, 'scanUsage', `${targetUid}_${todayKey}`);
      await deleteDoc(usageRef);

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUid ? { ...u, todayScans: 0 } : u))
      );

      setStatusMessage(`Kuota hari ini untuk ${userIdentifier} berhasil direset ke 0.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      alert(`Gagal mereset kuota: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase().trim();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle size={15} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Section 1: Users Directory */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-stone-100">Direktori Pengguna ({users.length})</h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Cari pengguna..."
              className="w-full pl-8 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-stone-800 bg-stone-900/60 overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-950/90 border-b border-stone-800 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Terdaftar</th>
                  <th className="py-3 px-4">Terakhir Aktif</th>
                  <th className="py-3 px-4">Kuota Scan Hari Ini</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-stone-500">
                      Memuat daftar pengguna...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-stone-500">
                      Tidak ada pengguna yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const scans = u.todayScans || 0;
                    const percent = Math.min(100, Math.round((scans / dailyLimit) * 100));
                    const isNearLimit = scans >= dailyLimit * 0.8;

                    return (
                      <tr key={u.uid} className="hover:bg-stone-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-stone-200">{u.displayName || 'Pengguna Tanpa Nama'}</div>
                          <div className="text-[11px] text-stone-400 font-mono">{u.email || u.uid}</div>
                        </td>
                        <td className="py-3 px-4 text-stone-400">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="py-3 px-4 text-stone-400">
                          {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-medium ${isNearLimit ? 'text-amber-400' : 'text-stone-200'}`}>
                              {scans} / {dailyLimit}
                            </span>
                            <div className="w-16 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  scans >= dailyLimit ? 'bg-rose-500' : isNearLimit ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleResetQuota(u.uid, u.displayName || u.email || u.uid)}
                            title="Reset kuota scan hari ini"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 active:scale-95 transition-all cursor-pointer"
                          >
                            <RotateCcw size={12} /> Reset Kuota
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 2: Family Ledgers Directory */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-indigo-400" />
          <h3 className="text-sm font-bold text-stone-100">Buku Kas Keluarga ({ledgers.length})</h3>
        </div>

        <div className="rounded-2xl border border-stone-800 bg-stone-900/60 overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-950/90 border-b border-stone-800 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nama Buku Kas</th>
                  <th className="py-3 px-4">Kode Undangan</th>
                  <th className="py-3 px-4">Pemilik (Owner UID)</th>
                  <th className="py-3 px-4">Jumlah Anggota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-stone-500">
                      Memuat daftar buku kas...
                    </td>
                  </tr>
                ) : ledgers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-stone-500">
                      Belum ada buku kas keluarga yang dibuat.
                    </td>
                  </tr>
                ) : (
                  ledgers.map((l) => (
                    <tr key={l.id} className="hover:bg-stone-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-stone-200">{l.name}</td>
                      <td className="py-3 px-4 font-mono text-indigo-400 font-semibold">{l.inviteCode}</td>
                      <td className="py-3 px-4 font-mono text-stone-400">{l.ownerUid}</td>
                      <td className="py-3 px-4 text-stone-300">{l.memberCount} anggota</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
