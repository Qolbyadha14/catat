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

export function isSpeechRecognitionSupported(
  win: any = typeof window !== 'undefined' ? window : undefined
): boolean {
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
          // Ignore if already started or permission prompt active
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

  // Attach internal instance for unit testing
  (controller as any)._instance = recognition;

  return controller;
}
