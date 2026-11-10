/**
 * Wrap headerless PCM in a RIFF/WAVE container.
 *
 * Gemini is the only voice that returns raw PCM, and a browser cannot play it.
 * Done by hand rather than with ffmpeg because ffmpeg does not exist in the
 * serverless runtime — and for uncompressed PCM the "transcode" is genuinely
 * just a 44-byte header in front of bytes we already have.
 */
export function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = (channels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.byteLength, 4)   // file size minus the first 8 bytes
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)                   // PCM fmt chunk size
  header.writeUInt16LE(1, 20)                    // audio format: 1 = PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.byteLength, 40)

  return Buffer.concat([header, pcm])
}
