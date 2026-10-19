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
let isFinalResult: boolean = false;
let ended: boolean = false;
const recognizer = createSpeechRecognizer({
  windowObj: mockWin,
  lang: 'id-ID',
  onResult: (text, isFinal) => {
    transcriptResult = text;
    isFinalResult = isFinal;
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
    Object.assign([{ transcript: 'Makan siang tiga puluh lima ribu gopay' }], {
      isFinal: true,
    }),
  ],
};
(recognizer as any)._instance.onresult(mockEvent);
assert(
  transcriptResult === 'Makan siang tiga puluh lima ribu gopay',
  'Transcript should match speech event'
);
assert(Boolean(isFinalResult), 'isFinal should be true');

recognizer?.stop();
assert(recognizer?.isListening() === false, 'Recognizer should not be listening after stop');
assert(Boolean(ended), 'onEnd should have been called');

console.log('speechRecognition unit tests passed');
