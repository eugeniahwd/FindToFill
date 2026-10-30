import {
  Station,
  Facility,
  Report,
  Review,
  StationLayout,
  User,
  Favorite,
  Stamp,
  QuickMessage,
} from '../types';

export const MOCK_USERS: User[] = [
  {
    id: 'user-commuter-01',
    email: 'commuter@findtofill.id',
    displayName: 'Budi Santoso',
    role: 'commuter',
  },
  {
    id: 'user-admin-01',
    email: 'admin@findtofill.id',
    displayName: 'Siti Rahma (Admin)',
    role: 'admin',
  },
];

// NOTE: Coordinates are approximate sample center points from OpenStreetMap and MUST be replaced with field survey coordinates.
export const MOCK_STATIONS: Station[] = [
  {
    id: 'station-manggarai',
    name: 'Manggarai',
    lines: ['Bogor Line', 'Cikarang Line', 'Airport Rail Link'],
    latitude: -6.20988,
    longitude: 106.85018,
    isPilot: true,
    isDemoData: true,
  },
  {
    id: 'station-tebet',
    name: 'Tebet',
    lines: ['Bogor Line'],
    latitude: -6.22664,
    longitude: 106.85827,
    isPilot: true,
    isDemoData: true,
  },
  {
    id: 'station-sudirman',
    name: 'Sudirman',
    lines: ['Cikarang Line'],
    latitude: -6.20241,
    longitude: 106.82361,
    isPilot: true,
    isDemoData: true,
  },
];

export const MOCK_LAYOUTS: StationLayout[] = [
  {
    id: 'layout-manggarai-l1',
    stationId: 'station-manggarai',
    level: 'L1 (Ground / Platform)',
    notes: 'Ground level platforms 1-8 and passenger concourse',
  },
  {
    id: 'layout-manggarai-l2',
    stationId: 'station-manggarai',
    level: 'L2 (Elevated Concourse)',
    notes: 'Main transfer concourse, ticket gates, waiting hall',
  },
  {
    id: 'layout-tebet-l1',
    stationId: 'station-tebet',
    level: 'L1 (Platform & Gate)',
    notes: 'Platform 1 & 2 passenger waiting area',
  },
  {
    id: 'layout-sudirman-l1',
    stationId: 'station-sudirman',
    level: 'L1 (Concourse & Platform)',
    notes: 'Tunnel connection to Dukuh Atas MRT and LRT',
  },
];

// NOTE: Facilities with realistic approximate placement within station perimeters
export const MOCK_FACILITIES: Facility[] = [
  // Manggarai (4 facilities)
  {
    id: 'fac-mri-01',
    stationId: 'station-manggarai',
    type: 'water',
    name: 'Water Station Concourse L2',
    platform: 'Near Gate Timur',
    locationDetail: 'Besamping eskalator peron 6-7, concourse lantai 2',
    level: 'L2 (Elevated Concourse)',
    latitude: -6.20982,
    longitude: 106.85022,
    layoutX: 52,
    layoutY: 42,
    isActive: true,
    isDemoData: true,
  },
  {
    id: 'fac-mri-02',
    stationId: 'station-manggarai',
    type: 'charging',
    name: 'Charging Corner Peron 1-2',
    platform: 'Platform 1-2',
    locationDetail: 'Pilar tengah dekat bangku tunggu arah Bogor',
    level: 'L1 (Ground / Platform)',
    latitude: -6.20972,
    longitude: 106.85012,
    layoutX: 28,
    layoutY: 65,
    isActive: true,
    isDemoData: true,
  },
  {
    id: 'fac-mri-03',
    stationId: 'station-manggarai',
    type: 'water',
    name: 'Water Station Peron 9-10',
    platform: 'Platform 9-10 (Lantai 3)',
    locationDetail: 'Dekat lift prioritas arah Bekasi / Cikarang',
    level: 'L2 (Elevated Concourse)',
    latitude: -6.20995,
    longitude: 106.85031,
    layoutX: 74,
    layoutY: 30,
    isActive: true,
    isDemoData: true,
  },
  {
    id: 'fac-mri-04',
    stationId: 'station-manggarai',
    type: 'charging',
    name: 'Charging Station Gate Barat',
    platform: 'Pintu Keluar Barat',
    locationDetail: 'Samping loket pembelian tiket harian',
    level: 'L1 (Ground / Platform)',
    latitude: -6.20961,
    longitude: 106.84998,
    layoutX: 18,
    layoutY: 82,
    isActive: true,
    isDemoData: true,
  },

  // Tebet (3 facilities)
  {
    id: 'fac-tbt-01',
    stationId: 'station-tebet',
    type: 'water',
    name: 'Water Dispenser Gate A',
    platform: 'Gate Keluar Timur (Arah Tebet Timur)',
    locationDetail: 'Di samping musholla stasiun, dekat pintu tap out',
    level: 'L1 (Platform & Gate)',
    latitude: -6.22661,
    longitude: 106.85822,
    layoutX: 45,
    layoutY: 38,
    isActive: true,
    isDemoData: true,
  },
  {
    id: 'fac-tbt-02',
    stationId: 'station-tebet',
    type: 'charging',
    name: 'Charging Box Peron 1',
    platform: 'Platform 1 (Arah Manggarai/Jakarta Kota)',
    locationDetail: 'Di bawah kanopi dekat ujung gerbong khusus wanita',
    level: 'L1 (Platform & Gate)',
    latitude: -6.22672,
    longitude: 106.85834,
    layoutX: 68,
    layoutY: 60,
    isActive: true,
    isDemoData: true,
  },
  {
    id: 'fac-tbt-03',
    stationId: 'station-tebet',
    type: 'water',
    name: 'Water Station Peron 2',
    platform: 'Platform 2 (Arah Bogor)',
    locationDetail: 'Tengah peron dekat tangga penyeberangan bawah',
    level: 'L1 (Platform & Gate)',
    latitude: -6.22652,
    longitude: 106.85815,
    layoutX: 30,
    layoutY: 72,
    isActive: true,
    isDemoData: true,
  },

  // Sudirman (3 facilities)
  {
    id: 'fac-sud-01',
    stationId: 'station-sudirman',
    type: 'water',
    name: 'Water Station Terowongan Kendal',
    platform: 'Pintu Masuk Terowongan',
    locationDetail: 'Depan area integrasi MRT Dukuh Atas, dekat Indomaret',
    level: 'L1 (Concourse & Platform)',
    latitude: -6.20235,
    longitude: 106.82355,
    layoutX: 55,
    layoutY: 45,
    isActive: true,
    isDemoData: true,
  },
  {
    id: 'fac-sud-02',
    stationId: 'station-sudirman',
    type: 'charging',
    name: 'Charging Tower Hall Tengah',
    platform: 'Concourse Tengah',
    locationDetail: 'Tiang silinder charging dekat Customer Care',
    level: 'L1 (Concourse & Platform)',
    latitude: -6.20248,
    longitude: 106.82368,
    layoutX: 40,
    layoutY: 58,
    isActive: true,
    isDemoData: true,
  },
  {
    id: 'fac-sud-03',
    stationId: 'station-sudirman',
    type: 'water',
    name: 'Water Dispenser Peron Arah Manggarai',
    platform: 'Platform Jalur 2',
    locationDetail: 'Samping ruang pos kesehatan stasiun',
    level: 'L1 (Concourse & Platform)',
    latitude: -6.20228,
    longitude: 106.82348,
    layoutX: 75,
    layoutY: 68,
    isActive: true,
    isDemoData: true,
  },
];

// Helper to generate past dates relative to now
const nowMs = Date.now();
const minutesAgo = (min: number) => new Date(nowMs - min * 60 * 1000).toISOString();
const hoursAgo = (hr: number) => new Date(nowMs - hr * 60 * 60 * 1000).toISOString();
const daysAgo = (day: number) => new Date(nowMs - day * 24 * 60 * 60 * 1000).toISOString();

// Reports: Mix of all four statuses and some older than 7 days (>7 days should resolve to "unknown")
export const MOCK_REPORTS: Report[] = [
  // Manggarai Water L2: Active 'available' (reported 15 minutes ago)
  {
    id: 'rep-01',
    facilityId: 'fac-mri-01',
    userId: 'user-commuter-01',
    userName: 'Budi Santoso',
    status: 'available',
    photoUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
    note: 'Air mengalir kencang dan dingin. Galon baru diganti.',
    createdAt: minutesAgo(15),
  },
  // Manggarai Charging Peron 1-2: Active 'empty' (reported 2 hours ago - port charging loose/mati)
  {
    id: 'rep-02',
    facilityId: 'fac-mri-02',
    userId: 'user-commuter-02',
    userName: 'Dewi Lestari',
    status: 'empty',
    photoUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80',
    note: 'Kabel tidak ada daya masuk di port sebelah kiri.',
    createdAt: hoursAgo(2),
  },
  // Manggarai Water Peron 9-10: Active 'under_maintenance' (reported 1 day ago)
  {
    id: 'rep-03',
    facilityId: 'fac-mri-03',
    userId: 'user-commuter-03',
    userName: 'Rian Pratama',
    status: 'under_maintenance',
    photoUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=600&q=80',
    note: 'Ada teknisi sedang cek filter dispenser.',
    createdAt: daysAgo(1),
  },
  // Manggarai Charging Gate Barat: OLD report from 10 days ago (older than 7 days -> SHOULD BE "No recent report")
  {
    id: 'rep-04',
    facilityId: 'fac-mri-04',
    userId: 'user-commuter-01',
    userName: 'Budi Santoso',
    status: 'available',
    photoUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80',
    note: 'Semua 4 colokan berfungsi normal.',
    createdAt: daysAgo(10), // > 7 days old
  },

  // Tebet Water Gate A: Active 'available' (reported 45 minutes ago)
  {
    id: 'rep-05',
    facilityId: 'fac-tbt-01',
    userId: 'user-commuter-04',
    userName: 'Annisa Fitri',
    status: 'available',
    photoUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
    note: 'Air bersih dan berfungsi baik.',
    createdAt: minutesAgo(45),
  },
  // Tebet Charging Peron 1: Active 'broken' (reported 4 hours ago)
  {
    id: 'rep-06',
    facilityId: 'fac-tbt-02',
    userId: 'user-commuter-01',
    userName: 'Budi Santoso',
    status: 'broken',
    photoUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80',
    note: 'Stop kontak patah dan korsleting, tidak bisa dipakai.',
    createdAt: hoursAgo(4),
  },
  // Tebet Water Peron 2: OLD report (14 days ago) -> "No recent report"
  {
    id: 'rep-07',
    facilityId: 'fac-tbt-03',
    userId: 'user-commuter-02',
    userName: 'Dewi Lestari',
    status: 'available',
    photoUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
    note: 'Laporan lama.',
    createdAt: daysAgo(14),
  },

  // Sudirman Water Terowongan Kendal: Active 'available' (reported 1 hour ago)
  {
    id: 'rep-08',
    facilityId: 'fac-sud-01',
    userId: 'user-commuter-05',
    userName: 'Fajar Nugraha',
    status: 'available',
    photoUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
    note: 'Dispenser jernih, segar sekali sehabis transit.',
    createdAt: hoursAgo(1),
  },
  // Sudirman Charging Hall Tengah: Active 'available' (reported 3 hours ago)
  {
    id: 'rep-09',
    facilityId: 'fac-sud-02',
    userId: 'user-commuter-01',
    userName: 'Budi Santoso',
    status: 'available',
    photoUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80',
    note: 'Fast charging berfungsi di 2 port Type-C.',
    createdAt: hoursAgo(3),
  },
  // Sudirman Water Jalur 2: Active 'empty' (air habis, reported 5 hours ago)
  {
    id: 'rep-10',
    facilityId: 'fac-sud-03',
    userId: 'user-commuter-03',
    userName: 'Rian Pratama',
    status: 'empty',
    photoUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=600&q=80',
    note: 'Air habis, lampu indikator merah berkedip.',
    createdAt: hoursAgo(5),
  },
];

export const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev-01',
    facilityId: 'fac-mri-01',
    userId: 'user-commuter-01',
    userName: 'Budi Santoso',
    rating: 5,
    comment: 'Kualitas air sangat segar dan tidak berbau. Posisi strategis dekat gate!',
    createdAt: daysAgo(2),
  },
  {
    id: 'rev-02',
    facilityId: 'fac-mri-01',
    userId: 'user-commuter-02',
    userName: 'Dewi Lestari',
    rating: 4,
    comment: 'Bagus dan dingin, hanya saja antrean sering panjang saat jam pulang kerja.',
    createdAt: daysAgo(3),
  },
  {
    id: 'rev-03',
    facilityId: 'fac-tbt-01',
    userId: 'user-commuter-04',
    userName: 'Annisa Fitri',
    rating: 5,
    comment: 'Sangat membantu hemat pengeluaran beli air minum kemasan. Dispenser bersih terawat.',
    createdAt: daysAgo(1),
  },
  {
    id: 'rev-04',
    facilityId: 'fac-sud-01',
    userId: 'user-commuter-05',
    userName: 'Fajar Nugraha',
    rating: 5,
    comment: 'Airnya jernih dan dingin! Tempat refill terbaik di Sudirman.',
    createdAt: daysAgo(1),
  },
  {
    id: 'rev-05',
    facilityId: 'fac-sud-03',
    userId: 'user-commuter-03',
    userName: 'Rian Pratama',
    rating: 2,
    comment: 'Sering kehabisan air di sore hari. Perlu penambahan frekuensi penggantian galon.',
    createdAt: daysAgo(4),
  },
];

export const MOCK_FAVORITES: Favorite[] = [
  {
    userId: 'user-commuter-01',
    stationId: 'station-manggarai',
    createdAt: daysAgo(5),
  },
  {
    userId: 'user-commuter-01',
    stationId: 'station-sudirman',
    createdAt: daysAgo(2),
  },
];

export const MOCK_STAMPS: Stamp[] = [
  {
    userId: 'user-commuter-01',
    facilityId: 'fac-mri-01',
    stationId: 'station-manggarai',
    stampedAt: daysAgo(5),
  },
  {
    userId: 'user-commuter-01',
    facilityId: 'fac-sud-01',
    stationId: 'station-sudirman',
    stampedAt: daysAgo(2),
  },
];

export const QUICK_MESSAGES: QuickMessage[] = [
  {
    id: 'nearest_water',
    text: 'Carikan stasiun dengan dispenser terdekat dari lokasiku sekarang',
  },
  {
    id: 'nearest_charging',
    text: 'Cari charging station terdekat dari lokasiku sekarang',
  },
  {
    id: 'facility_working',
    text: 'Apakah fasilitas di stasiun ini masih berfungsi?',
  },
  {
    id: 'time_to_refill',
    text: 'Sempat isi air sebelum kereta berikutnya datang?',
  },
  {
    id: 'review_summary',
    text: 'Rangkum ulasan air di stasiun ini',
  },
];
