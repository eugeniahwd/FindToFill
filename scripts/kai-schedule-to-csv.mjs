// Converts `pdftotext -raw` output of the KAI Commuter "Jadwal Commuter Line Jabodetabek" PDF
// (GAPEKA 2026) into rows for supabase/seed/schedules.csv, for the pilot stations only.
//
// Usage:
//   pdftotext -raw "Jadwal Commuter Line Jabodetabek - ....pdf" jabo_raw.txt
//   node scripts/kai-schedule-to-csv.mjs jabo_raw.txt supabase/seed/schedules.csv report.txt
// Use -raw: the -layout mode mixes neighbouring rows of this PDF. Read the report before
// committing: rows marked CHECK or SKIPPED need a look at the PDF.
//
// The raw text drops empty cells, so a train's times are mapped onto the station sequence of its
// own route (origin -> destination, via Manggarai or via Pasar Senen). Every row is checked:
// token count must equal the route length, and times must not go backwards.

import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, outPath, reportPath, timetablePath] = process.argv;
if (!inPath || !outPath) {
  console.error(
    'usage: node scripts/kai-schedule-to-csv.mjs <jabo_raw.txt> <out.csv> [<report.txt>] [<timetable.json>]',
  );
  process.exit(1);
}

const PILOT = { MRI: 'Manggarai', TEB: 'Tebet', SUD: 'Sudirman' };
// Display names of the stations a train can come from just before a pilot station.
const STATION_NAMES = {
  CW: 'Cawang',
  TEB: 'Tebet',
  MRI: 'Manggarai',
  CKI: 'Cikini',
  MTR: 'Matraman',
  SUD: 'Sudirman',
  SUDB: 'Sudirman Baru',
};
// Rows that start before 03:00 belong to the previous service day.
const SERVICE_DAY_START_MIN = 180;
const WEEKEND_CANCELLED = 'Sabtu/Minggu/Libur Nasional Batal';

// Station order per branch, in the direction of travel.
const BOGOR_N = {
  BOO: 'BOO CLT BJD CTA DP DPB POC UI UP LNA TNT PSM PSMB DRN CW TEB MRI CKI GDD GMR JUA SW MGB JAY JAKK',
  NMO: 'NMO CBN PDRG CTA DP DPB POC UI UP LNA TNT PSM PSMB DRN CW TEB MRI CKI GDD GMR JUA SW MGB JAY JAKK',
};
const rev = (s) => s.split(' ').reverse().join(' ');
const BOGOR_S = { BOO: rev(BOGOR_N.BOO), NMO: rev(BOGOR_N.NMO) };
const BEKASI_W = {
  MRI: 'CKR TLM CIT TB BKST BKS KRI CUK KLDB BUA KLD JNG MTR MRI SUD SUDB THB DU AK KPB JAKK',
  PSE: 'CKR TLM CIT TB BKST BKS KRI CUK KLDB BUA KLD JNG POK KMT GST PSE KMO RJW KPB JAKK',
};
const BEKASI_E = { MRI: rev(BEKASI_W.MRI), PSE: rev(BEKASI_W.PSE) };

// The four tables we need, identified by their header line (station codes).
const TABLES = [
  {
    key: 'bogor-north',
    header: 'NMO CBN PDRG BOO CLT BJD CTA DP DPB POC UI UP LNA TNT PSM PSMB DRN CW TEB MRI CKI GDD GMR JUA SW MGB JAY JAKK',
    line: 'Bogor Line',
    direction: { MRI: 'Jakarta Kota', TEB: 'Manggarai/Jakarta Kota' },
    route: (codes) => pickBranch(BOGOR_N, codes),
  },
  {
    key: 'bogor-south',
    header: 'JAKK JAY MGB SW JUA GMR GDD CKI MRI TEB CW DRN PSMB PSM TNT LNA UP UI POC DPB DP CTA BJD CLT BOO PDRG CBN NMO',
    line: 'Bogor Line',
    direction: { MRI: 'Bogor/Depok/Nambo', TEB: 'Bogor/Depok/Nambo' },
    route: (codes) => pickBranch(BOGOR_S, codes),
  },
  {
    key: 'bekasi-west',
    header: 'CKR TLM CIT TB BKST BKS KRI CUK KLDB BUA KLD JNG POK KMT GST PSE KMO RJW MTR MRI SUD SUDB THB DU AK KPB JAKK',
    line: 'Cikarang Line',
    direction: { MRI: 'Tanah Abang/Kampung Bandan', SUD: 'Tanah Abang/Kampung Bandan' },
    route: (codes) => (codes.includes('PSE') ? BEKASI_W.PSE : BEKASI_W.MRI),
  },
  {
    key: 'bekasi-east',
    header: 'JAKK KPB AK DU THB SUDB SUD MRI MTR RJW KMO PSE GST KMT POK JNG KLD BUA KLDB CUK KRI BKS BKST TB CIT TLM CKR',
    line: 'Cikarang Line',
    direction: { MRI: 'Bekasi/Cikarang', SUD: 'Manggarai/Bekasi/Cikarang' },
    route: (codes) => (codes.includes('PSE') ? BEKASI_E.PSE : BEKASI_E.MRI),
  },
];

function pickBranch(branches, codes) {
  // The branch that contains every named station (Nambo vs Bogor only differ south of Citayam).
  const fits = Object.values(branches).filter((b) => codes.every((c) => b.split(' ').includes(c)));
  return fits[0] ?? null;
}

// "1 1125 Dp - Jakk 04.05 ... [keterangan]" or "4 5505 - 5506 Ckr-Mri-Kpb - Kpb-Pse-Ckr 04.10 ..."
const ROW = /^(\d+) (\d{4}F?(?: - \d{4}F?)?) (.+?) ((?:\d{2}\.\d{2}|Ls)(?: (?:\d{2}\.\d{2}|Ls))*)(?: (.*))?$/;

function relasiCodes(relasi, tableKey) {
  // Bogor tables: "Dp - Jakk". Bekasi tables: "Bks-Mri-Ak", or two legs "Ckr-Mri-Kpb - Kpb-Pse-Ckr"
  // where only the first leg's times are in this table.
  const firstLeg = tableKey.startsWith('bekasi') ? relasi.split(' - ')[0] : relasi;
  return firstLeg.split(/\s*-\s*/).map((c) => c.trim().toUpperCase());
}

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

const lines = readFileSync(inPath, 'utf8').split(/\r?\n/);
const out = new Map(); // dedupe key -> row
const stops = []; // per-train pilot stops for the timetable JSON
const report = [];
const perTable = {};
let table = null;
let gapCount = 0;

for (const raw of lines) {
  const text = raw.trim();
  const header = TABLES.find((t) => t.header === text);
  if (header) {
    table = header;
    continue;
  }
  if (/^[A-Z]{2,4}( [A-Z]{2,4}){5,}$/.test(text)) {
    table = null; // another line's table (Rangkasbitung, Tangerang, ...)
    continue;
  }
  if (!table) continue;
  const m = ROW.exec(text);
  if (!m) continue;

  const [, rowNo, trainNo, relasi, timesStr, note = ''] = m;
  const stats = (perTable[table.key] ??= { rows: 0, maxNo: 0, nos: new Set() });
  stats.rows += 1;
  stats.maxNo = Math.max(stats.maxNo, Number(rowNo));
  stats.nos.add(Number(rowNo));

  const tokens = timesStr.split(' ');
  const codes = relasiCodes(relasi, table.key);
  const branch = table.route(codes);
  if (!branch) {
    report.push(`[${table.key}] KA ${trainNo} ${relasi}: no route contains ${codes.join(',')}`);
    continue;
  }
  const seq = branch.split(' ');
  const origin = codes[0];
  const dest = codes[codes.length - 1];
  let start = seq.indexOf(origin);
  const end = seq.indexOf(dest);
  let notBoardingAt = null;

  if (start < 0 || end < 0 || end <= start) {
    report.push(`[${table.key}] KA ${trainNo} ${relasi}: origin/destination not on route`);
    continue;
  }
  let path = seq.slice(start, end + 1);
  if (tokens.length === path.length + 1 && /Mulai melayani pengguna dari St\./.test(note) && start > 0) {
    // The times start one station earlier, where passengers may not board yet (e.g. KA 5701).
    start -= 1;
    notBoardingAt = seq[start];
    path = seq.slice(start, end + 1);
  } else if (tokens.length > path.length && tokens.length <= end + 1) {
    // More times than the relasi's origin allows (KA 1175F "Clt - Jakk" has a Bogor time in the
    // PDF). The destination is the reliable end, so align the times backwards from it.
    start = end + 1 - tokens.length;
    path = seq.slice(start, end + 1);
    report.push(
      `[${table.key}] KA ${trainNo} ${relasi}: ${tokens.length} times, aligned from the destination (first time at ${seq[start]}) - CHECK`,
    );
  }
  if (tokens.length !== path.length) {
    report.push(
      `[${table.key}] KA ${trainNo} ${relasi}: ${tokens.length} times for ${path.length} stations (${path.join(' ')}) - SKIPPED`,
    );
    continue;
  }

  // Times must not go backwards (allowing one wrap past midnight).
  // mins[i]: minutes from 00:00 of the service day (after-midnight times > 1440), null for "Ls".
  let prev = null;
  const firstTime = tokens.find((t) => t !== 'Ls');
  let wrapped = firstTime !== undefined && toMin(firstTime) < SERVICE_DAY_START_MIN;
  let bad = false;
  const mins = tokens.map((t) => {
    if (t === 'Ls') return null;
    let v = toMin(t) + (wrapped ? 24 * 60 : 0);
    if (prev !== null && v < prev) {
      if (!wrapped && prev - v > 12 * 60) {
        wrapped = true;
        v += 24 * 60;
      } else {
        bad = true;
      }
    }
    prev = v;
    return v;
  });
  if (bad) {
    report.push(`[${table.key}] KA ${trainNo} ${relasi}: times go backwards - SKIPPED`);
    continue;
  }

  const dayTypes = note.includes(WEEKEND_CANCELLED) ? ['weekday'] : ['weekday', 'weekend'];
  if (note && !note.includes(WEEKEND_CANCELLED) && !/Full Racket/.test(note)) {
    report.push(`[${table.key}] KA ${trainNo} ${relasi}: note kept for review: "${note}"`);
  }

  // Neighbouring pilot stations are a few minutes apart: catches a time shifted by one column.
  const pilotTimes = path
    .map((code, i) => ({ code, t: tokens[i] }))
    .filter((p) => p.code in PILOT && p.t !== 'Ls');
  for (let k = 1; k < pilotTimes.length; k += 1) {
    const gap = (toMin(pilotTimes[k].t) - toMin(pilotTimes[k - 1].t) + 24 * 60) % (24 * 60);
    gapCount += 1;
    if (gap < 1 || gap > 10) {
      report.push(
        `[${table.key}] KA ${trainNo}: ${pilotTimes[k - 1].code} ${pilotTimes[k - 1].t} -> ${pilotTimes[k].code} ${pilotTimes[k].t} is ${gap} min - CHECK`,
      );
    }
  }

  path.forEach((code, i) => {
    if (!(code in table.direction)) return;
    const t = tokens[i];
    if (t === 'Ls') return; // passes without stopping
    if (i === path.length - 1) return; // terminates here: no departure
    if (code === notBoardingAt) return;

    // The nearest earlier stop with a time (a non-boarding first stop still marks where the train is).
    let prevStop = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (mins[j] === null) continue;
      const name = STATION_NAMES[path[j]];
      if (!name) {
        console.error(`KA ${trainNo}: no display name for previous station ${path[j]}`);
        process.exit(1);
      }
      prevStop = { code: path[j], name, minute: mins[j] };
      break;
    }
    stops.push({
      train: trainNo,
      relasi,
      station: PILOT[code],
      line: table.line,
      direction: table.direction[code],
      days: dayTypes,
      minute: mins[i],
      prev: prevStop,
    });

    for (const day of dayTypes) {
      const row = {
        station_name: PILOT[code],
        line: table.line,
        direction: table.direction[code],
        day_type: day,
        departure_time: t.replace('.', ':'),
        trainNo,
      };
      const key = `${row.station_name}|${row.line}|${row.direction}|${row.day_type}|${row.departure_time}`;
      if (out.has(key)) {
        report.push(`duplicate departure merged: ${key} (KA ${out.get(key).trainNo} and ${trainNo})`);
      } else {
        out.set(key, row);
      }
    }
  });
}

for (const t of TABLES) {
  const s = perTable[t.key];
  if (!s) {
    report.push(`[${t.key}] table NOT FOUND`);
    continue;
  }
  const missing = [];
  for (let n = 1; n <= s.maxNo; n += 1) if (!s.nos.has(n)) missing.push(n);
  report.push(`[${t.key}] parsed ${s.rows} rows, numbered 1..${s.maxNo}${missing.length ? `, MISSING ${missing.join(',')}` : ''}`);
}

const order = (r) => [r.station_name, r.line, r.direction, r.day_type, r.departure_time].join('|');
const rows = [...out.values()].sort((a, b) => order(a).localeCompare(order(b)));
const csv = ['station_name,line,direction,day_type,departure_time']
  .concat(rows.map((r) => [r.station_name, r.line, r.direction, r.day_type, r.departure_time].join(',')))
  .join('\n');
writeFileSync(outPath, `${csv}\n`);

const summary = {};
for (const r of rows) {
  const k = `${r.station_name} | ${r.line} | ${r.direction} | ${r.day_type}`;
  summary[k] = (summary[k] ?? 0) + 1;
}
report.push(`checked ${gapCount} gaps between neighbouring pilot stations`);
report.push('', 'Rows per station / line / direction / day:');
for (const [k, n] of Object.entries(summary)) report.push(`  ${k}: ${n}`);
report.push(`TOTAL ${rows.length}`);

if (timetablePath) {
  const key = (s) => [s.station, s.line, s.direction].join('|');
  stops.sort((a, b) => key(a).localeCompare(key(b)) || a.minute - b.minute);
  const timetable = {
    source: 'Jadwal Commuter Line Jabodetabek - Update 1 Desember 2026 (GAPEKA 2026)',
    validFrom: '2026-12-01',
    stops,
  };
  writeFileSync(timetablePath, `${JSON.stringify(timetable)}\n`);
  report.push(`timetable: ${stops.length} stops -> ${timetablePath}`);
}

const text = report.join('\n');
if (reportPath) writeFileSync(reportPath, `${text}\n`);
console.log(text);
