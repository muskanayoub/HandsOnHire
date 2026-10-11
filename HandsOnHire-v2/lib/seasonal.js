'use strict';
/** Seasonal demand alerts (J&K / Himalayan farm calendar). Month is 1-12. */

const ALERTS = {
  '1,2': {
    trades: ['carpenter', 'mason', 'artisan', 'mover'],
    en: 'Snow clearing and roof repair are in demand. Craft artisans are busy with winter orders.',
    hi: 'बर्फ़ हटाने और छत की मरम्मत का काम ज़्यादा है। शिल्पकारों के पास सर्दियों के ऑर्डर हैं।',
    ur: 'برف ہٹانے اور چھت کی مرمت کا کام زیادہ ہے۔ دستکاروں کے پاس سردیوں کے آرڈر ہیں۔',
    ks: 'برف ہٹاون تہ چھتچ مرمت چھِ زیادہ۔ دستکارن کن چھِ ہیمنتک آرڈر۔',
  },
  '3,4': {
    trades: ['farm', 'picker', 'gardener', 'painter'],
    en: 'Orchard pruning, paddy nurseries and spring sowing are starting. Homes get painted before tourist season.',
    hi: 'बाग़ों की छँटाई, धान की नर्सरी और बुआई शुरू हो रही है। पर्यटन सीज़न से पहले घरों की पुताई होती है।',
    ur: 'باغات کی کٹائی، دھان کی نرسری اور بوائی شروع ہو رہی ہے۔ سیاحتی سیزن سے پہلے گھروں کی رنگائی ہوتی ہے۔',
    ks: 'باغن ہند ٹھَپھ، دھانہ ہند نرسری تہ بہارک بیج شروع گژھان۔ سیاحتی سیزنہ برونہہ کنہِ چھِ گھر رنگاوان۔',
  },
  '5,6': {
    trades: ['farm', 'picker', 'homestay', 'tractor'],
    en: 'Paddy transplanting and cherry picking are on. Homestays are getting ready for tourists.',
    hi: 'धान की रोपाई और चेरी तोड़ाई का समय है। होमस्टे पर्यटकों के लिए तैयार हो रहे हैं।',
    ur: 'دھان کی روپائی اور چیری توڑنے کا وقت ہے۔ ہوم سٹے سیاحوں کے لیے تیار ہو رہے ہیں۔',
    ks: 'دھانہ ہند روپن تہ چیری چُنُن چھُ جاری۔ ہوم سٹے چھِ سیاحن خاطرٕ تیار گژھان۔',
  },
  '7,8': {
    trades: ['homestay', 'farm', 'picker', 'house'],
    en: 'Peak tourist season and hay-making. Apricot and cherry harvest continues.',
    hi: 'पर्यटन का चरम मौसम और घास कटाई। खुबानी और चेरी की फ़सल जारी है।',
    ur: 'سیاحت کا عروج اور گھاس کٹائی۔ خوبانی اور چیری کی فصل جاری ہے۔',
    ks: 'سیاحتک عروج تہ گاس کٹن۔ خوبانی تہ چیریک فصل چھُ جاری۔',
  },
  '9': {
    trades: ['picker', 'farm', 'tractor', 'mover'],
    en: 'Apple and walnut harvest is starting. Paddy harvest needs extra hands.',
    hi: 'सेब और अखरोट की तुड़ाई शुरू हो रही है। धान कटाई के लिए मज़दूर चाहिए।',
    ur: 'سیب اور اخروٹ کی چنائی شروع ہو رہی ہے۔ دھان کی کٹائی کے لیے مزدور درکار ہیں۔',
    ks: 'سیب تہ اخروٹ چُنُن چھُ شروع۔ دھانہ کٹائی خاطرٕ چھِ مزدور ضروری۔',
  },
  '10': {
    trades: ['picker', 'farm', 'mover', 'tractor'],
    en: 'Apple harvest is at its peak and saffron picking starts at Pampore. Packers and loaders are needed.',
    hi: 'सेब की तुड़ाई चरम पर है और पंपोर में केसर तोड़ाई शुरू हो रही है। पैकिंग और लोडिंग के लिए लोग चाहिए।',
    ur: 'سیب کی چنائی عروج پر ہے اور پانپور میں زعفران کی چنائی شروع ہو رہی ہے۔ پیکنگ اور لوڈنگ کے لیے لوگ درکار ہیں۔',
    ks: 'سیب چُنُن چھُ عروجس پؠٹھ تہ پامپورس منٛز زعفرانچ چُنائی چھِ شروع۔ پیکنگ تہ لوڈنگ خاطرٕ چھِ لوکھ ضروری۔',
  },
  '11': {
    trades: ['farm', 'mover', 'mason', 'carpenter'],
    en: 'Saffron harvest peaks and apples are being packed. Homes are being readied for winter.',
    hi: 'केसर तोड़ाई चरम पर है और सेब की पैकिंग चल रही है। घरों को सर्दी के लिए तैयार किया जा रहा है।',
    ur: 'زعفران کی چنائی عروج پر ہے اور سیب کی پیکنگ جاری ہے۔ گھروں کو سردی کے لیے تیار کیا جا رہا ہے۔',
    ks: 'زعفرانچ چُنائی چھِ عروجس پؠٹھ تہ سیبن ہنز پیکنگ چھِ جاری۔ گھر چھِ ہیمنتک خاطرٕ تیار گژھان۔',
  },
  '12': {
    trades: ['mason', 'carpenter', 'electrician', 'plumber'],
    en: 'Winter preparation: roof repair, firewood and heating fixes.',
    hi: 'सर्दी की तैयारी: छत की मरम्मत, लकड़ी और हीटिंग की मरम्मत।',
    ur: 'سردی کی تیاری: چھت کی مرمت، لکڑی اور ہیٹنگ کی مرمت۔',
    ks: 'ہیمنتک تیاری: چھتچ مرمت، ٹھیکرٕ تہ ہیٹنگچ مرمت۔',
  },
};

function seasonalFor(month) {
  for (const [months, alert] of Object.entries(ALERTS)) {
    if (months.split(',').map(Number).includes(month)) return alert;
  }
  return null;
}

module.exports = { seasonalFor };
