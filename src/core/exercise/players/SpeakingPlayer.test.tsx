/**
 * Issue #659 — a refused/unavailable microphone must say so.
 *
 * `startRecording` used to swallow every `getUserMedia` rejection in an empty
 * `catch {}`, so clicking the mic produced no visible change at all.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingPlayer } from './SpeakingPlayer';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

function renderPlayer() {
  act(() => {
    root.render(<SpeakingPlayer title="Đọc to đoạn văn" maxDuration={30} />);
  });
}

function clickMic() {
  const button = container.querySelector('button');
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button;
}

function errorText(): string | undefined {
  return container.querySelector('[data-testid="speaking-mic-error"]')?.textContent ?? undefined;
}

function stubMediaDevices(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
  vi.stubGlobal('MediaRecorder', class {});
}

/**
 * A MediaRecorder stand-in whose `stop()` synchronously delivers `chunk` and
 * then fires `onstop`, mirroring the real event order.
 */
function stubRecorder({
  chunk,
  mimeType = 'audio/webm',
  supported = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'],
}: {
  chunk: Blob | null;
  mimeType?: string;
  supported?: string[];
}) {
  const track = { stop: vi.fn() };
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: () => Promise.resolve({ getTracks: () => [track] } as never) },
    configurable: true,
  });

  const instances: Array<Record<string, unknown>> = [];
  class FakeRecorder {
    static isTypeSupported = (type: string) => supported.includes(type);
    state = 'recording';
    mimeType = mimeType;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    options: { mimeType?: string } | undefined;
    constructor(_stream: unknown, options?: { mimeType?: string }) {
      this.options = options;
      instances.push(this as never);
    }
    start() {}
    stop() {
      this.state = 'inactive';
      if (chunk) this.ondataavailable?.({ data: chunk });
      this.onstop?.();
    }
  }
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  return { instances, track };
}

function playButton(): HTMLButtonElement | null {
  return container.querySelector('button');
}

describe('SpeakingPlayer — microphone failures are reported (issue #659)', () => {
  it('renders no error before the first attempt', () => {
    renderPlayer();

    expect(errorText()).toBeUndefined();
  });

  it('explains a denied permission instead of failing silently', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    stubMediaDevices(() => Promise.reject(denied));
    renderPlayer();

    clickMic();
    await act(async () => undefined);

    expect(errorText()).toContain('chặn quyền dùng micro');
  });

  it('explains a missing microphone device', async () => {
    const missing = Object.assign(new Error('none'), { name: 'NotFoundError' });
    stubMediaDevices(() => Promise.reject(missing));
    renderPlayer();

    clickMic();
    await act(async () => undefined);

    expect(errorText()).toContain('Không tìm thấy micro');
  });

  it('explains an insecure context where getUserMedia is unavailable', async () => {
    renderPlayer();

    clickMic();
    await act(async () => undefined);

    expect(errorText()).toContain('HTTPS');
  });

  it('keeps the mic button clickable while showing the error', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    stubMediaDevices(() => Promise.reject(denied));
    renderPlayer();

    const button = clickMic();
    await act(async () => undefined);

    expect(button?.disabled).toBe(false);
  });
});

describe('SpeakingPlayer — a take must be real and playable', () => {
  /** Record then stop, leaving the component showing the finished take. */
  async function recordAndStop() {
    renderPlayer();
    clickMic();
    await act(async () => undefined);
    clickMic(); // same button, now "stop"
    await act(async () => undefined);
  }

  it('labels the blob with the container the browser actually produced', async () => {
    // Safari records MP4; hardcoding "audio/webm" produced a blob <audio>
    // refused to decode, so playback silently did nothing.
    const { instances } = stubRecorder({
      chunk: new Blob(['x'], { type: 'audio/mp4' }),
      mimeType: 'audio/mp4',
      supported: ['audio/mp4'],
    });
    const answers: unknown[] = [];
    act(() => {
      root.render(
        <SpeakingPlayer title="Đọc to" maxDuration={30} onAnswerChange={(a) => answers.push(a)} />,
      );
    });
    clickMic();
    await act(async () => undefined);
    clickMic();
    await act(async () => undefined);

    expect(instances[0].options).toEqual({ mimeType: 'audio/mp4' });
    expect(answers.at(-1)).toMatchObject({ audioRef: expect.stringContaining('blob:') });
  });

  it('reports a take that captured no bytes instead of offering dead playback', async () => {
    stubRecorder({ chunk: null });
    await recordAndStop();

    expect(errorText()).toContain('Không thu được âm thanh');
    expect(container.querySelector('audio')).toBeNull();
  });

  it('shows the captured size so "did it record?" is answerable', async () => {
    stubRecorder({ chunk: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) });
    await recordAndStop();

    expect(container.textContent).toContain('Đã ghi nhận');
    expect(container.textContent).toContain('KB');
    expect(container.querySelector('audio')).toBeTruthy();
  });

  it('surfaces a playback failure instead of pretending it is playing', async () => {
    stubRecorder({ chunk: new Blob([new Uint8Array(2048)], { type: 'audio/webm' }) });
    await recordAndStop();

    const audio = container.querySelector('audio') as HTMLAudioElement;
    audio.play = () => Promise.reject(new Error('cannot decode'));

    act(() => {
      playButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => undefined);

    expect(errorText()).toContain('Không phát lại được');
  });

  it('releases the microphone track once the take is finished', async () => {
    const { track } = stubRecorder({ chunk: new Blob([new Uint8Array(1024)]) });
    await recordAndStop();

    expect(track.stop).toHaveBeenCalled();
  });
});

describe('SpeakingPlayer — playback scrubber', () => {
  async function recordFourSeconds() {
    vi.useFakeTimers();
    stubRecorder({ chunk: new Blob([new Uint8Array(8192)], { type: 'audio/webm' }) });
    renderPlayer();
    clickMic();
    await act(async () => undefined);
    // Four ticks of the 1s interval = a four-second take.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    clickMic();
    await act(async () => undefined);
    vi.useRealTimers();
  }

  function takeLength(): string | undefined {
    return container.querySelector('[data-testid="speaking-take-length"]')?.textContent ?? undefined;
  }

  function slider(): HTMLInputElement {
    return container.querySelector('input[type="range"]') as HTMLInputElement;
  }

  it('caps the scrubber at the recorded length, not maxDuration', async () => {
    await recordFourSeconds();

    // maxDuration is 30s; the take is 4s.
    expect(takeLength()).toBe('0:04');
    expect(slider().max).toBe('4');
  });

  it('starts the playhead at zero and advances it as the audio plays', async () => {
    await recordFourSeconds();

    expect(container.querySelector('[data-testid="speaking-progress"]')).toBeTruthy();
    expect(slider().value).toBe('0');

    const audio = container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'currentTime', { value: 2, configurable: true, writable: true });
    act(() => {
      audio.dispatchEvent(new Event('timeupdate'));
    });

    expect(slider().value).toBe('2');
    expect(container.textContent).toContain('0:02');
  });

  it('prefers a finite duration from the media element over the counted seconds', async () => {
    await recordFourSeconds();

    const audio = container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { value: 3.5, configurable: true, writable: true });
    act(() => {
      audio.dispatchEvent(new Event('durationchange'));
    });

    expect(takeLength()).toBe('0:03');
  });

  it('ignores the Infinity duration Chrome reports for recorder blobs', async () => {
    await recordFourSeconds();

    const audio = container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { value: Infinity, configurable: true, writable: true });
    act(() => {
      audio.dispatchEvent(new Event('durationchange'));
    });

    // Falls back to the 4s we counted rather than rendering "Infinity".
    expect(takeLength()).toBe('0:04');
  });

  it('rewinds to the start when playback finishes', async () => {
    await recordFourSeconds();

    const audio = container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'currentTime', { value: 4, configurable: true, writable: true });
    act(() => {
      audio.dispatchEvent(new Event('timeupdate'));
    });
    expect(slider().value).toBe('4');

    act(() => {
      audio.dispatchEvent(new Event('ended'));
    });

    expect(slider().value).toBe('0');
    expect(audio.currentTime).toBe(0);
  });

  it('resets the scrubber after a retake', async () => {
    await recordFourSeconds();
    expect(takeLength()).toBe('0:04');

    const retakeBtn = container.querySelectorAll('button')[1];
    act(() => {
      retakeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(container.textContent).toContain('Nhấn nút để bắt đầu ghi âm');
  });
});

describe('SpeakingPlayer — khối chờ ghi âm một hàng (Owner 8/8)', () => {
  it('đồng hồ trái — nút giữa — gợi ý phải, trên một grid 3 cột', () => {
    renderPlayer();

    const row = container.querySelector<HTMLElement>('.grid.w-full')!;
    expect(row.className).toContain('grid-cols-[1fr_auto_1fr]');
    // Thứ tự cột: [đồng hồ][nút][gợi ý]; đồng hồ bám mép phải cột trái,
    // gợi ý bám mép trái cột phải nên cả cụm ôm quanh nút chính giữa.
    const cells = Array.from(row.children) as HTMLElement[];
    expect(cells).toHaveLength(3);
    expect(cells[0].textContent).toContain('0:00');
    expect(cells[0].className).toContain('justify-self-end');
    expect(cells[1].tagName).toBe('BUTTON');
    expect(cells[2].textContent).toContain('Nhấn nút để bắt đầu ghi âm');
    expect(cells[2].className).toContain('justify-self-start');
  });
});
