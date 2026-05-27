export const playHangupSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    // Vietnam/Classic hangup tone is around 425Hz
    oscillator.frequency.value = 425;

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;
    
    // Play 3 short beeps: 0.2s on, 0.2s off
    // Beep 1
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gainNode.gain.setValueAtTime(0.3, now + 0.2);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.22);
    
    // Beep 2
    gainNode.gain.setValueAtTime(0, now + 0.4);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.42);
    gainNode.gain.setValueAtTime(0.3, now + 0.6);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.62);
    
    // Beep 3
    gainNode.gain.setValueAtTime(0, now + 0.8);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.82);
    gainNode.gain.setValueAtTime(0.3, now + 1.0);
    gainNode.gain.linearRampToValueAtTime(0, now + 1.02);

    oscillator.start(now);
    oscillator.stop(now + 1.1);

    // Auto cleanup context after sound finishes
    setTimeout(() => {
      if (ctx.state !== 'closed') {
        ctx.close().catch(console.error);
      }
    }, 1500);
  } catch (e) {
    console.error("Failed to play hangup sound:", e);
  }
};
