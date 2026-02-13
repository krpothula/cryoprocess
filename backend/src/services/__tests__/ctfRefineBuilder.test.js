/**
 * Exhaustive CTF Refine Builder Tests
 * Tests all 81 fit_mode permutations + flag combos
 */

// Suppress logger
const logger = require('../../utils/logger');
logger.info = () => {};
logger.warn = () => {};
logger.debug = () => {};

const CTFRefineBuilder = require('../ctfRefineBuilder');

const project = {
  project_name: 'trail1_20260212',
  folder_name: 'trail1_20260212',
};
const user = { id: 1 };
const baseData = {
  particlesStar: '/shared/data/trail1_20260212/AutoRefine/Job011/_data.star',
  postProcessStar: '/shared/data/trail1_20260212/PostProcess/Job014/postprocess.star',
  numberOfMpiProcs: 1,
  threads: 1,
};
const outputDir = '/shared/data/trail1_20260212/CtfRefine/Job099';

const modes = ['No', 'Per-micrograph', 'Per-particle'];
const modeChar = (v) => v === 'Per-particle' ? 'p' : v === 'Per-micrograph' ? 'm' : 'f';

function buildCmd(data) {
  const builder = new CTFRefineBuilder(data, project, user);
  return builder.buildCommand(outputDir, 'Job099').join(' ');
}

let passed = 0;
let failed = 0;

// ─── Test 1: All 81 fit_mode combinations (3^4) ───
console.log('=== TEST 1: All 81 fit_mode combinations (ctfParameter=Yes) ===\n');

for (const phase of modes) {
  for (const defocus of modes) {
    for (const astig of modes) {
      for (const bfac of modes) {
        const expected = modeChar(phase) + modeChar(defocus) + modeChar(astig) + 'f' + modeChar(bfac);

        const data = {
          ...baseData,
          ctfParameter: 'Yes',
          fitPhaseShift: phase,
          fitDefocus: defocus,
          fitAstigmatism: astig,
          fitBFactor: bfac,
        };

        try {
          const cmdStr = buildCmd(data);
          const match = cmdStr.match(/--fit_mode\s+(\S+)/);
          const actual = match ? match[1] : null;

          if (actual !== expected) {
            console.log('FAIL phase=' + phase + ' def=' + defocus + ' astig=' + astig + ' bfac=' + bfac);
            console.log('  expected=' + expected + ' actual=' + actual);
            failed++;
          } else {
            const validChars = [...actual].every(c => 'fmp'.includes(c));
            if (actual.length !== 5 || actual[3] !== 'f' || !validChars) {
              console.log('FAIL FORMAT: ' + actual);
              failed++;
            } else {
              passed++;
            }
          }
        } catch (e) {
          console.log('ERROR: ' + e.message);
          failed++;
        }
      }
    }
  }
}

console.log('fit_mode: ' + passed + '/81 passed\n');

// ─── Test 2: ctfParameter=No ───
console.log('=== TEST 2: ctfParameter=No ===\n');

try {
  const cmdStr = buildCmd({ ...baseData, ctfParameter: 'No' });
  const hasFitDefocus = cmdStr.includes('--fit_defocus');
  const hasFitMode = cmdStr.includes('--fit_mode');
  if (!hasFitDefocus && !hasFitMode) {
    console.log('PASS: No --fit_defocus or --fit_mode');
    passed++;
  } else {
    console.log('FAIL: --fit_defocus=' + hasFitDefocus + ' --fit_mode=' + hasFitMode);
    failed++;
  }
} catch (e) { console.log('ERROR: ' + e.message); failed++; }

// ─── Test 3: Beam tilt + trefoil ───
console.log('\n=== TEST 3: Beam tilt + trefoil ===\n');

const btCases = [
  { bt: 'No',  tf: 'No',  expectBT: false, expectTF: false, name: 'both off' },
  { bt: 'Yes', tf: 'No',  expectBT: true,  expectTF: false, name: 'beamtilt only' },
  { bt: 'Yes', tf: 'Yes', expectBT: true,  expectTF: true,  name: 'beamtilt + trefoil' },
  { bt: 'No',  tf: 'Yes', expectBT: false, expectTF: false, name: 'trefoil without beamtilt (ignored)' },
];

for (const tc of btCases) {
  try {
    const cmdStr = buildCmd({ ...baseData, ctfParameter: 'No', estimateBeamtilt: tc.bt, estimateTreFoil: tc.tf });
    const hasBT = cmdStr.includes('--fit_beamtilt');
    const hasTF = cmdStr.includes('--odd_aberr_max_n');
    if (hasBT === tc.expectBT && hasTF === tc.expectTF) {
      console.log('PASS: ' + tc.name + ' -> beamtilt=' + hasBT + ' trefoil=' + hasTF);
      passed++;
    } else {
      console.log('FAIL: ' + tc.name + ' -> bt=' + hasBT + '(exp ' + tc.expectBT + ') tf=' + hasTF + '(exp ' + tc.expectTF + ')');
      failed++;
    }
  } catch (e) { console.log('ERROR ' + tc.name + ': ' + e.message); failed++; }
}

// ─── Test 4: 4th order aberrations ───
console.log('\n=== TEST 4: 4th order aberrations ===\n');

for (const aberr of ['Yes', 'No']) {
  try {
    const cmdStr = buildCmd({ ...baseData, ctfParameter: 'No', aberrations: aberr });
    const has = cmdStr.includes('--fit_aberr');
    const expected = aberr === 'Yes';
    if (has === expected) {
      console.log('PASS: aberrations=' + aberr + ' -> --fit_aberr=' + has);
      passed++;
    } else {
      console.log('FAIL: aberrations=' + aberr + ' -> ' + has + ' (expected ' + expected + ')');
      failed++;
    }
  } catch (e) { console.log('ERROR: ' + e.message); failed++; }
}

// ─── Test 5: Anisotropic magnification ───
console.log('\n=== TEST 5: Anisotropic magnification ===\n');

for (const mag of ['Yes', 'No']) {
  try {
    const cmdStr = buildCmd({ ...baseData, ctfParameter: 'No', estimateMagnification: mag });
    const hasAniso = cmdStr.includes('--fit_aniso');
    const hasKmin = cmdStr.includes('--kmin_mag');
    const expected = mag === 'Yes';
    if (hasAniso === expected && hasKmin === expected) {
      console.log('PASS: mag=' + mag + ' -> --fit_aniso=' + hasAniso + ' --kmin_mag=' + hasKmin);
      passed++;
    } else {
      console.log('FAIL: mag=' + mag + ' -> aniso=' + hasAniso + ' kmin=' + hasKmin);
      failed++;
    }
  } catch (e) { console.log('ERROR: ' + e.message); failed++; }
}

// ─── Test 6: MPI launcher ───
console.log('\n=== TEST 6: MPI launcher ===\n');

for (const mpi of [1, 4]) {
  try {
    const cmdStr = buildCmd({ ...baseData, ctfParameter: 'No', numberOfMpiProcs: mpi });
    const hasMpi = cmdStr.includes('mpirun') || cmdStr.includes('srun');
    const expected = mpi > 1;
    if (hasMpi === expected) {
      console.log('PASS: mpi=' + mpi + ' -> launcher=' + hasMpi);
      passed++;
    } else {
      console.log('FAIL: mpi=' + mpi + ' -> launcher=' + hasMpi + ' (expected ' + expected + ')');
      failed++;
    }
  } catch (e) { console.log('ERROR: ' + e.message); failed++; }
}

// ─── Test 7: Min resolution propagation ───
console.log('\n=== TEST 7: Min resolution propagation ===\n');

for (const minRes of [20, 30, 50]) {
  try {
    const cmdStr = buildCmd({
      ...baseData,
      ctfParameter: 'Yes', fitDefocus: 'Per-particle',
      estimateBeamtilt: 'Yes',
      estimateMagnification: 'Yes',
      minResolutionFits: minRes,
    });
    const defMatch = cmdStr.match(/--kmin_defocus\s+(\S+)/);
    const tiltMatch = cmdStr.match(/--kmin_tilt\s+(\S+)/);
    const magMatch = cmdStr.match(/--kmin_mag\s+(\S+)/);
    const ok = defMatch && defMatch[1] === String(minRes)
            && tiltMatch && tiltMatch[1] === String(minRes)
            && magMatch && magMatch[1] === String(minRes);
    if (ok) {
      console.log('PASS: minRes=' + minRes + ' -> defocus=' + defMatch[1] + ' tilt=' + tiltMatch[1] + ' mag=' + magMatch[1]);
      passed++;
    } else {
      console.log('FAIL: minRes=' + minRes + ' -> def=' + (defMatch && defMatch[1]) + ' tilt=' + (tiltMatch && tiltMatch[1]) + ' mag=' + (magMatch && magMatch[1]));
      failed++;
    }
  } catch (e) { console.log('ERROR: ' + e.message); failed++; }
}

// ─── Test 8: All flags combined ───
console.log('\n=== TEST 8: All flags enabled together ===\n');

try {
  const cmdStr = buildCmd({
    ...baseData,
    ctfParameter: 'Yes',
    fitDefocus: 'Per-particle',
    fitAstigmatism: 'Per-micrograph',
    fitBFactor: 'Per-particle',
    fitPhaseShift: 'No',
    estimateBeamtilt: 'Yes',
    estimateTreFoil: 'Yes',
    aberrations: 'Yes',
    estimateMagnification: 'Yes',
    numberOfMpiProcs: 4,
    threads: 6,
    minResolutionFits: 25,
  });

  const checks = [
    ['--fit_defocus', true],
    ['--fit_mode fpmfp', true],
    ['--kmin_defocus 25', true],
    ['--fit_beamtilt', true],
    ['--kmin_tilt 25', true],
    ['--odd_aberr_max_n 3', true],
    ['--fit_aberr', true],
    ['--fit_aniso', true],
    ['--kmin_mag 25', true],
    ['--j 6', true],
  ];

  let allOk = true;
  for (const [flag, expected] of checks) {
    const has = cmdStr.includes(flag);
    if (has !== expected) {
      console.log('FAIL: ' + flag + ' -> ' + has + ' (expected ' + expected + ')');
      allOk = false;
    }
  }

  if (allOk) {
    console.log('PASS: All flags present in combined command');
    console.log('  cmd: ' + cmdStr);
    passed++;
  } else {
    console.log('  cmd: ' + cmdStr);
    failed++;
  }
} catch (e) { console.log('ERROR: ' + e.message); failed++; }

// ─── Summary ───
console.log('\n' + '='.repeat(70));
console.log('TOTAL: ' + passed + ' passed, ' + failed + ' failed out of ' + (passed + failed));
if (failed === 0) {
  console.log('ALL ' + passed + ' TESTS PASSED');
} else {
  console.log(failed + ' FAILURES');
  process.exit(1);
}
