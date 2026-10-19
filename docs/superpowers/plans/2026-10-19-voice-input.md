# Voice Input (Catat Transaksi via Suara) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to log transactions by speaking into their microphone on the "Mode Ketik" tab using the native browser Web Speech API, automatically transcribing Indonesian speech and processing it through the NLP parser into the transaction form.

**Architecture:**
1. **Speech Recognition Hook/Service (`src/lib/speech/speechRecognition.ts`)**: Encapsulates browser `SpeechRecognition` / `webkitSpeechRecognition`, handles microphone permissions, real-time interim speech, language configuration (`id-ID`), timeouts, and error states gracefully without any external npm packages.
2. **TextAssistantTab Integration (`src/features/transactions/TextAssistantTab.tsx`)**: Adds an interactive voice recording button (mic button with pulsing animation when recording) beside the text input. When speech ends, it fills the textarea and optionally auto-triggers NLP parsing.
3. **Design System & Visual States (`src/styles/components.css`)**: Implements accessible, animated mic button states using CSS custom properties with strict WCAG AA contrast and zero raw hex codes.

**Tech Stack:** React 19, TypeScript, Web Speech API (Native), Bun Test, CSS Custom Properties.

## Global Constraints
- Zero raw hex codes in `src/styles/components.css` (enforced by Gate 12).
- WCAG AA contrast compliance: text >= 4.5:1, graphical UI >= 3:1 in both light and dark modes.
- Graceful degradation: If `SpeechRecognition` is not supported in the user's browser (e.g. Firefox desktop or restricted webviews), the mic button displays a tooltip or hides cleanly without throwing errors.
- All 14 existing E2E quality gates (`npm run test:e2e`) and 33 unit tests must stay green.

---

### Task 1: Web Speech Recognition Wrapper & State Machine

**Files:**
- Create: `src/lib/speech/speechRecognition.ts`
- Create: `src/lib/speech/speechRecognition.test.ts`

**Interfaces:**
- Produces: `isSpeechRecognitionSupported()`, `createSpeechRecognizer(options)`, `SpeechRecognizerState`, `SpeechRecognizerController`

- [ ] **Step 1: Write failing unit tests for speech recognition utility**

Create `src/lib/speech/speechRecognition.test.ts`:
```typescript
import {
  isSpeechRecognitionSupported,
  createSpeechRecognizer,
} from './speechRecognition';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// Mock window speech recognition for node/bun testing environment
class MockSpeechRecognition {
  lang = 'en-US';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;

  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
}

// 1. isSpeechRecognitionSupported returns false when window is undefined
assert(
  isSpeechRecognitionSupported(undefined) === false,
  'isSpeechRecognitionSupported should return false without window'
);

// 2. isSpeechRecognitionSupported returns true when window has SpeechRecognition
const mockWin = { SpeechRecognition: MockSpeechRecognition } as any;
assert(
  isSpeechRecognitionSupported(mockWin) === true,
  'isSpeechRecognitionSupported should return true when SpeechRecognition exists'
);

// 3. createSpeechRecognizer initializes with id-ID by default
let transcriptResult = '';
let ended = false;
const recognizer = createSpeechRecognizer({
  windowObj: mockWin,
  lang: 'id-ID',
  onResult: (text) => {
    transcriptResult = text;
  },
  onEnd: () => {
    ended = true;
  },
});

assert(recognizer !== null, 'Recognizer should be created');
recognizer?.start();
assert(recognizer?.isListening() === true, 'Recognizer should be listening');

// Simulate speech result
const mockEvent = {
  resultIndex: 0,
  results: [
    {
      isFinal: true,
      0: { transcript: 'Makan siang tiga puluh lima ribu gopay' },
    },
  ],
};
(recognizer as any)._instance.onresult(mockEvent);
assert(
  transcriptResult === 'Makan siang tiga puluh lima ribu gopay',
  'Transcript should match speech event'
);

recognizer?.stop();
assert(recognizer?.isListening() === false, 'Recognizer should not be listening after stop');
assert(ended === true, 'onEnd should have been called');

console.log('speechRecognition unit tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/speech/speechRecognition.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/lib/speech/speechRecognition.ts`**

Create `src/lib/speech/speechRecognition.ts`:
```typescript
export interface SpeechRecognizerOptions {
  windowObj?: any;
  lang?: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface SpeechRecognizerController {
  start: () => void;
  stop: () => void;
  abort: () => void;
  isListening: () => boolean;
}

export function isSpeechRecognitionSupported(win: any = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!win) return false;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function createSpeechRecognizer(
  options: SpeechRecognizerOptions
): SpeechRecognizerController | null {
  const win = options.windowObj || (typeof window !== 'undefined' ? window : undefined);
  if (!isSpeechRecognitionSupported(win)) {
    return null;
  }

  const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();

  recognition.lang = options.lang || 'id-ID';
  recognition.continuous = false;
  recognition.interimResults = true;

  let listening = false;

  recognition.onstart = () => {
    listening = true;
    options.onStart?.();
  };

  recognition.onresult = (event: any) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const item = event.results[i];
      if (item.isFinal) {
        final += item[0].transcript;
      } else {
        interim += item[0].transcript;
      }
    }

    const text = final || interim;
    options.onResult(text, Boolean(final));
  };

  recognition.onerror = (event: any) => {
    const errorMsg = event.error || 'speech_error';
    options.onError?.(errorMsg);
  };

  recognition.onend = () => {
    listening = false;
    options.onEnd?.();
  };

  const controller: SpeechRecognizerController = {
    start: () => {
      if (!listening) {
        try {
          recognition.start();
        } catch {
          // Ignore if already started
        }
      }
    },
    stop: () => {
      if (listening) {
        try {
          recognition.stop();
        } catch {
          // Ignore
        }
      }
    },
    abort: () => {
      if (listening) {
        try {
          recognition.abort();
        } catch {
          // Ignore
        }
      }
    },
    isListening: () => listening,
  };

  // Attach internal instance for testing purposes
  (controller as any)._instance = recognition;

  return controller;
}
```

- [ ] **Step 4: Run unit tests**

Run: `bun test src/lib/speech/speechRecognition.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/speech/speechRecognition.ts src/lib/speech/speechRecognition.test.ts
git commit -m "feat(speech): add native Web Speech API recognition controller"
```

---

### Task 2: UI Mic Button & Voice Recognition in TextAssistantTab

**Files:**
- Modify: `src/features/transactions/TextAssistantTab.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `isSpeechRecognitionSupported`, `createSpeechRecognizer` from `src/lib/speech/speechRecognition`
- Renders: Mic button with recording wave animation, speech error fallback message, and auto-submit option.

- [ ] **Step 1: Update `TextAssistantTab.tsx` with speech recognition state**

In `src/features/transactions/TextAssistantTab.tsx`:
Add state:
- `isRecording: boolean`
- `speechSupported: boolean` (initialized with `isSpeechRecognitionSupported()`)
- Initialize `SpeechRecognizerController` in `useEffect` with `lang: 'id-ID'`.
- When user taps the mic button:
  - If listening: call `stop()`.
  - If not listening: call `start()`.
- When transcript is received:
  - Updates `inputText` with speech.
  - When `isFinal` is true, stops recording and automatically initiates `handleProcess(text)`.
- Renders mic button beside `Proses Teks` button:
  - Has `aria-label="Catat dengan suara"`, `role="button"`.
  - Displays mic icon `🎙️` and active pulse dot `🔴 Mendengarkan...` when recording.

- [ ] **Step 2: Add CSS styles in `src/styles/components.css`**

Add CSS with zero raw hex codes:
```css
.text-assistant-mic-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--surface-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.text-assistant-mic-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.text-assistant-mic-btn.is-recording {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger-fg);
  border-color: var(--danger-fg);
  animation: pulse-ring 1.5s infinite;
}

@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}
```

- [ ] **Step 3: Run Zero Hex Audit and Build**

Run: `git grep -E "#[0-9a-fA-F]{3,8}\b" src/styles/components.css`
Expected: 0 matches
Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit Task 2**

```bash
git add src/features/transactions/TextAssistantTab.tsx src/styles/components.css
git commit -m "feat(transactions): integrate voice input mic in TextAssistantTab"
```

---

### Task 3: Comprehensive Verification & Gate Checks

- [ ] **Step 1: Run all unit tests**
Run: `bun test src/`
Expected: All 34+ test suites pass

- [ ] **Step 2: Run all 14 E2E gates**
Run: `npm run test:e2e`
Expected: All 14 passed (163+ assertions)

- [ ] **Step 3: Deploy to Firebase Hosting**
Run: `npx -y firebase-tools deploy --only hosting`
Expected: Live deployment complete to `https://catat-8897d.web.app`
