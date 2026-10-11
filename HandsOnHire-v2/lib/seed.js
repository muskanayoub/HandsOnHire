'use strict';
/**
 * Reference data + demo seed generator.
 * All demo workers use FICTIONAL names and placeholder phone numbers
 * (9000000001 onwards). Replace/clear them before any real deployment.
 */

const TRADES = [
  { id: 'farm',        en: 'Farm Labour',       hi: 'खेत मज़दूर',        ur: 'کھیت مزدور', ks: 'کھیتی مزدور' },
  { id: 'picker',      en: 'Orchard Picker',    hi: 'बाग़ तुड़ाई',        ur: 'باغ چنائی', ks: 'باغ چُنائی' },
  { id: 'tractor',     en: 'Tractor Operator',  hi: 'ट्रैक्टर चालक',      ur: 'ٹریکٹر ڈرائیور', ks: 'ٹریکٹر ڈرائیور' },
  { id: 'mason',       en: 'Mason',             hi: 'राजमिस्त्री',        ur: 'راج مستری', ks: 'مستری' },
  { id: 'electrician', en: 'Electrician',       hi: 'बिजली मिस्त्री',     ur: 'بجلی مستری', ks: 'بجلی مستری' },
  { id: 'plumber',     en: 'Plumber',           hi: 'प्लम्बर',            ur: 'پلمبر', ks: 'پلمبر' },
  { id: 'painter',     en: 'Painter',           hi: 'पेंटर',              ur: 'رنگ ساز', ks: 'رنگ ساز' },
  { id: 'carpenter',   en: 'Carpenter',         hi: 'बढ़ई',               ur: 'بڑھئی', ks: 'بڑھئی' },
  { id: 'artisan',     en: 'Craft Artisan',     hi: 'शिल्पकार',           ur: 'دستکار', ks: 'دستکار' },
  { id: 'homestay',    en: 'Homestay & Guide',  hi: 'होमस्टे व गाइड',     ur: 'ہوم سٹے اور گائیڈ', ks: 'ہوم سٹے تہ گائیڈ' },
  { id: 'house',       en: 'House Help',        hi: 'घरेलू सहायक',        ur: 'گھریلو مددگار', ks: 'گھریلو مددگار' },
  { id: 'mover',       en: 'Loader / Mover',    hi: 'लोडर / मज़दूर',      ur: 'لوڈر / مزدور', ks: 'لوڈر / مزدور' },
  { id: 'gardener',    en: 'Gardener',          hi: 'माली',               ur: 'مالی', ks: 'مالی' },
];

const DISTRICTS = [
  // Kashmir division
  { id: 'srinagar',  name: 'Srinagar',  state: 'J&K', villages: ['Nishat', 'Hazratbal', 'Zakura', 'Harwan'] },
  { id: 'budgam',    name: 'Budgam',    state: 'J&K', villages: ['Chadoora', 'Beerwah', 'Khag', 'Magam'] },
  { id: 'ganderbal', name: 'Ganderbal', state: 'J&K', villages: ['Kangan', 'Lar', 'Wayil', 'Safapora'] },
  { id: 'pulwama',   name: 'Pulwama',   state: 'J&K', villages: ['Pampore', 'Tral', 'Rajpora', 'Kakapora'] },
  { id: 'shopian',   name: 'Shopian',   state: 'J&K', villages: ['Zainapora', 'Keller', 'Imamsahib'] },
  { id: 'anantnag',  name: 'Anantnag',  state: 'J&K', villages: ['Bijbehara', 'Pahalgam', 'Achabal', 'Dooru'] },
  { id: 'kulgam',    name: 'Kulgam',    state: 'J&K', villages: ['Qaimoh', 'Devsar', 'Yaripora'] },
  { id: 'baramulla', name: 'Baramulla', state: 'J&K', villages: ['Sopore', 'Pattan', 'Tangmarg', 'Uri'] },
  { id: 'bandipora', name: 'Bandipora', state: 'J&K', villages: ['Hajin', 'Sumbal', 'Gurez'] },
  { id: 'kupwara',   name: 'Kupwara',   state: 'J&K', villages: ['Handwara', 'Lolab', 'Langate', 'Tangdhar'] },
  // Jammu division
  { id: 'jammu',     name: 'Jammu',     state: 'J&K', villages: ['Akhnoor', 'R.S. Pura', 'Bishnah'] },
  { id: 'kathua',    name: 'Kathua',    state: 'J&K', villages: ['Billawar', 'Hiranagar'] },
  { id: 'doda',      name: 'Doda',      state: 'J&K', villages: ['Bhaderwah', 'Thathri'] },
  { id: 'rajouri',   name: 'Rajouri',   state: 'J&K', villages: ['Nowshera', 'Sunderbani'] },
  // Other apple / farm belts
  { id: 'kullu',     name: 'Kullu',     state: 'Himachal Pradesh', villages: ['Naggar', 'Banjar'] },
  { id: 'shimla',    name: 'Shimla',    state: 'Himachal Pradesh', villages: ['Kotgarh', 'Rohru'] },
  { id: 'ludhiana',  name: 'Ludhiana',  state: 'Punjab', villages: ['Khanna', 'Jagraon'] },
];

const LANGUAGES = ['Kashmiri', 'Urdu', 'Hindi', 'English', 'Dogri', 'Punjabi', 'Pahari', 'Gojri'];

const KASHMIR = new Set(['srinagar', 'budgam', 'ganderbal', 'pulwama', 'shopian', 'anantnag', 'kulgam', 'baramulla', 'bandipora', 'kupwara']);
const LANG_BY_DISTRICT = {
  jammu: ['Dogri', 'Hindi'], kathua: ['Dogri', 'Hindi'], doda: ['Kashmiri', 'Hindi'],
  rajouri: ['Pahari', 'Urdu', 'Hindi'], kullu: ['Pahari', 'Hindi'], shimla: ['Pahari', 'Hindi'],
  ludhiana: ['Punjabi', 'Hindi'],
};

const NAMES = {
  kM: ['Ghulam Mohammad', 'Abdul Rashid', 'Mohammad Yousuf', 'Bashir Ahmad', 'Mushtaq Ahmad', 'Farooq Ahmad', 'Irfan', 'Tariq Ahmad', 'Showkat Ahmad', 'Nazir Ahmad', 'Javid Iqbal', 'Manzoor Ahmad', 'Riyaz Ahmad', 'Aijaz Ahmad', 'Zahoor Ahmad', 'Fayaz Ahmad', 'Altaf Hussain', 'Imtiyaz Ahmad', 'Sajad Ahmad', 'Mudasir'],
  kF: ['Haleema', 'Raja', 'Shameema', 'Zainab', 'Mehbooba', 'Fatima', 'Saleema', 'Tahira', 'Nusrat', 'Rukhsana', 'Shabnam', 'Gulshan', 'Hafiza', 'Sakeena'],
  kS: ['Dar', 'Bhat', 'Mir', 'Lone', 'Wani', 'Malik', 'Khan', 'Sheikh', 'Ganie', 'Rather', 'Najar', 'Shah', 'Parray', 'Mattoo'],
  kFS: ['Begum', 'Jan', 'Bano', 'Akhtar', 'Khatoon'],
  oM: ['Ramesh', 'Baldev', 'Kuldeep', 'Pawan', 'Rakesh', 'Harjinder', 'Lakhwinder', 'Tulsi Ram', 'Dev Raj', 'Sanjay', 'Mohan Lal', 'Vikram', 'Ashok', 'Rajinder'],
  oF: ['Sunita', 'Poonam', 'Kamla', 'Santosh', 'Meena', 'Anita', 'Reena', 'Shanti', 'Rekha', 'Savitri'],
  oS: ['Kumar', 'Singh', 'Sharma', 'Thakur', 'Raj', 'Verma', 'Chand', 'Mehta'],
  oFS: ['Devi', 'Kumari', 'Rani'],
};

// trade -> [count, rate range, women probability, preferred districts, exp range]
const PLAN = {
  farm:        [9, [450, 600], 0.4,  null, [1, 20]],
  picker:      [8, [500, 700], 0.3,  ['shopian', 'pulwama', 'baramulla', 'kullu', 'shimla', 'kupwara'], [1, 15]],
  tractor:     [4, [900, 1500], 0,   ['budgam', 'pulwama', 'jammu', 'ludhiana', 'kathua'], [3, 20]],
  mason:       [6, [700, 900], 0,    null, [3, 25]],
  electrician: [4, [750, 1000], 0,   null, [2, 18]],
  plumber:     [3, [650, 850], 0,    null, [2, 18]],
  painter:     [4, [600, 800], 0,    null, [2, 15]],
  carpenter:   [5, [750, 950], 0,    null, [3, 25]],
  artisan:     [6, [500, 900], 0.5,  ['srinagar', 'budgam', 'ganderbal', 'anantnag'], [4, 30]],
  homestay:    [5, [600, 1000], 0.4, ['anantnag', 'ganderbal', 'baramulla', 'kupwara', 'doda', 'kullu'], [1, 12]],
  house:       [5, [350, 500], 1,    null, [1, 20]],
  mover:       [4, [500, 700], 0,    null, [1, 15]],
  gardener:    [3, [450, 600], 0.4,  null, [2, 20]],
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeed() {
  const rnd = mulberry32(20261031);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const used = new Set();
  const workers = [];
  let n = 0;

  for (const [trade, [count, rate, womenP, prefer, exp]] of Object.entries(PLAN)) {
    for (let i = 0; i < count; i++) {
      n++;
      const wantedId = prefer ? pick(prefer) : null;
      const district = wantedId ? DISTRICTS.find((d) => d.id === wantedId) : pick(DISTRICTS);
      const kashmiri = KASHMIR.has(district.id) || district.id === 'doda';
      const female = rnd() < womenP;

      let name;
      for (let tries = 0; tries < 40; tries++) {
        const first = pick(female ? (kashmiri ? NAMES.kF : NAMES.oF) : (kashmiri ? NAMES.kM : NAMES.oM));
        const last = pick(female ? (kashmiri ? NAMES.kFS : NAMES.oFS) : (kashmiri ? NAMES.kS : NAMES.oS));
        name = `${first} ${last}`;
        if (!used.has(name)) break;
      }
      used.add(name);

      let languages = kashmiri && district.id !== 'doda'
        ? ['Kashmiri', 'Urdu'] : (LANG_BY_DISTRICT[district.id] || ['Hindi']).slice();
      if (kashmiri && rnd() > 0.45) languages.push('Hindi');
      if ((trade === 'homestay' || trade === 'artisan') && rnd() > 0.4) languages.push('English');

      const verified = rnd() < 0.5;
      const baseCount = verified ? between(8, 45) : between(0, 12);
      const baseRating = baseCount === 0 ? 0 : Math.round((3.6 + rnd() * 1.3) * 10) / 10;

      workers.push({
        id: 's' + n,
        demo: true,
        name,
        trade,
        district: district.id,
        village: pick(district.villages),
        phone: '90000' + String(n).padStart(5, '0'), // placeholder, not a real person
        rate: Math.round(between(rate[0], rate[1]) / 10) * 10,
        experience: between(exp[0], exp[1]),
        languages,
        verified,
        underReview: false,
        baseRating,
        baseCount,
        joined: '2026-09-' + String(between(1, 28)).padStart(2, '0'),
      });
    }
  }
  return workers;
}

module.exports = { TRADES, DISTRICTS, LANGUAGES, buildSeed };
