/**
 * Assert that cmd array contains `--flag value` (or just `--flag` if value is undefined).
 */
function expectFlag(cmd, flag, value) {
  const idx = cmd.indexOf(flag);
  expect(idx).toBeGreaterThanOrEqual(0);
  if (value !== undefined) {
    expect(cmd[idx + 1]).toBe(String(value));
  }
}

/**
 * Assert that cmd array does NOT contain the given flag.
 */
function expectNoFlag(cmd, flag) {
  expect(cmd).not.toContain(flag);
}

/**
 * Assert that the RELION binary (e.g. 'relion_refine') appears in the command.
 * Checks both exact match and _mpi variant.
 */
function expectBinary(cmd, binary) {
  const found = cmd.some(
    token => token === binary || token === binary + '_mpi'
  );
  expect(found).toBe(true);
}

module.exports = { expectFlag, expectNoFlag, expectBinary };
