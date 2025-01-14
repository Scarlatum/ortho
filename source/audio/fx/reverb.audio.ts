export function createReverb(audioContext: AudioContext, duration = 2.0) {

  const bufferSize = audioContext.sampleRate * duration; // Duration in seconds
  const impulseResponse = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);

  // Fill the buffer with random noise to simulate a reverb impulse response
  const leftChannel = impulseResponse.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    leftChannel[i] = Math.random();
  }

  // Create a ConvolverNode to apply the reverb
  const convolver = audioContext.createConvolver();
  convolver.buffer = impulseResponse;

  return convolver;

}