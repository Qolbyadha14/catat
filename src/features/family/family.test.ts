import { formatWhatsAppInviteText, generateInviteCode, createInitialLedger } from '../../lib/ledgerService';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

// Test 1: generateInviteCode length & charset
const code = generateInviteCode(6);
assert(code.length === 6, 'generates 6 chars');
assert(/^[2-9A-Z]+$/.test(code), 'contains no ambiguous chars');

// Test 2: WhatsApp invite text
const inviteText = formatWhatsAppInviteText('Keluarga Kami', 'ABC234', 'https://catat-8897d.web.app');
assert(inviteText.includes('Keluarga Kami'), 'includes ledger name');
assert(inviteText.includes('ABC234'), 'includes invite code');
assert(inviteText.includes('https://catat-8897d.web.app/join?code=ABC234'), 'includes proper join URL');

// Test 3: createInitialLedger
const initial = createInitialLedger({ uid: 'u1', displayName: 'Budi Santoso', email: 'budi@test.com' });
assert(initial.ownerUid === 'u1', 'sets ownerUid');
assert(initial.members['u1']?.name === 'Budi Santoso', 'sets owner member');
assert(initial.members['u1']?.role === 'owner', 'sets owner role');

console.log('Family feature unit tests pass');
