// P4-21 voice call proof, mutant shard 4/4 (carrier 2): the same script as scripts/test-studio-voice-call.mjs (sections A-D again, then every fourth mutant from #4), split so each process stays well under the gate's 600 s limit. Run all four to cover every mutant.
process.env.VOICE_TEST_MUTANT_SHARD = process.env.VOICE_TEST_MUTANT_SHARD || '4/4'
await import('./test-studio-voice-call.mjs')
