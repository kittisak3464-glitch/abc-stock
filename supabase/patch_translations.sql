-- Patch 2026-08-01: secondary-language item names (Thai / Chinese / Burmese)
-- Shown as a smaller second line under the English catalog name wherever an
-- item name appears, when the viewer's UI language isn't English.
-- Admin can edit these later from Admin > Catalog if a translation needs fixing.

alter table public.catalog add column if not exists name_th text;
alter table public.catalog add column if not exists name_zh text;
alter table public.catalog add column if not exists name_my text;

update public.catalog set name_th = v.th, name_zh = v.zh, name_my = v.my
from (values
  ('A4 Paper',                  'กระดาษ A4',                 'A4纸',        'A4 စက္ကူ'),
  ('A4 Plastic for Cover',      'พลาสติกใส่ปกกระดาษ A4',      'A4文件塑料套', 'A4 စက္ကူအိတ်'),
  ('AA Battery',                'ถ่าน AA',                    'AA电池',      'AA ဘက်ထရီ'),
  ('AAA Battery',               'ถ่าน AAA',                   'AAA电池',     'AAA ဘက်ထရီ'),
  ('Air Gel',                   'เจลปรับอากาศ',               '空气清新啫喱', 'လေသန့်ဂျယ်လီ'),
  ('Air Spray',                 'สเปรย์ปรับอากาศ',            '空气清新喷雾', 'လေသန့်စပရေး'),
  ('Bath Towel',                'ผ้าเช็ดตัว',                 '浴巾',        'ရေချိုးတဝါ'),
  ('Bed Runner Big',            'ผ้าปูปลายเตียงใหญ่',         '大床尾巾',     'အိပ်ရာကြီး ခြေဖျားခင်း'),
  ('Bed Runner Small',          'ผ้าปูปลายเตียงเล็ก',         '小床尾巾',     'အိပ်ရာသေး ခြေဖျားခင်း'),
  ('Bed Sheet Big',             'ผ้าปูที่นอนใหญ่',            '大床单',       'အိပ်ရာခင်းကြီး'),
  ('Bed Sheet Small',           'ผ้าปูที่นอนเล็ก',            '小床单',       'အိပ်ရာခင်းသေး'),
  ('Bidet Cable',               'สายฉีดชำระ',                 '净身盆软管',   'ရေဖျန်းပိုက်ကြိုး'),
  ('Bidet Spray Nozzle',        'หัวฉีดชำระ',                 '净身喷头',     'ရေဖျန်းခေါင်း'),
  ('Black Tape',                'เทปดำ',                      '黑胶带',       'တိပ်နက်'),
  ('Broom',                     'ไม้กวาด',                    '扫帚',        'တံမြက်စည်း'),
  ('Bulb',                      'หลอดไฟ',                     '灯泡',        'မီးလုံး'),
  ('Coffee 3in1',               'กาแฟ 3 อิน 1',               '三合一咖啡',   'ကော်ဖီ (၃ အင် ၁)'),
  ('Comb',                      'หวี',                        '梳子',        'ဘီး'),
  ('Dish Washer Liquid',        'น้ำยาล้างจาน',               '洗碗液',       'ပန်းကန်ဆေးရည်'),
  ('Door Knob',                 'ลูกบิดประตู',                '门把手',       'တံခါးလက်ကိုင်'),
  ('Drinking Water',            'น้ำดื่ม',                    '饮用水',       'သောက်ရေ'),
  ('Duvet Big',                 'ผ้านวมใหญ่',                 '大被子',       'စောင်ကြီး'),
  ('Duvet Cover Big',           'ปลอกผ้านวมใหญ่',             '大被套',       'စောင်အိတ်ကြီး'),
  ('Duvet Cover Small',         'ปลอกผ้านวมเล็ก',             '小被套',       'စောင်အိတ်သေး'),
  ('Duvet Small',               'ผ้านวมเล็ก',                 '小被子',       'စောင်သေး'),
  ('Face Tissue',               'กระดาษทิชชู่',               '面巾纸',       'မျက်နှာသုတ်တစ်ရှူး'),
  ('Face Towel',                'ผ้าเช็ดหน้า',                '面巾',        'မျက်နှာသုတ်ပုဝါ'),
  ('Floor Cleaning Liquid',     'น้ำยาถูพื้น',                '地板清洁液',   'ကြမ်းပြင်ဆေးရည်'),
  ('Glass Cleaning Liquid',     'น้ำยาเช็ดกระจก',             '玻璃清洁液',   'ဖန်သားဆေးရည်'),
  ('Insect Spray',              'สเปรย์ฆ่าแมลง',              '杀虫喷雾',     'ပိုးသတ်ဆေးဖျန်း'),
  ('Light Socket (ขั้วหลอดไฟ)', 'ขั้วหลอดไฟ',                 '灯座',        'မီးလုံးခေါင်း'),
  ('Mattress Big',              'ที่นอนใหญ่',                 '大床垫',       'အိပ်ရာအိပ်ခံကြီး'),
  ('Mattress Small',            'ที่นอนเล็ก',                 '小床垫',       'အိပ်ရာအိပ်ခံသေး'),
  ('Mop',                       'ไม้ถูพื้น',                  '拖把',        'ကြမ်းသုတ်တံ'),
  ('Mop Fabric 60cm',           'ผ้าไม้ถูพื้น 60ซม',          '60厘米拖把布', 'ကြမ်းသုတ်အထည် ၆၀စင်တီ'),
  ('Pen',                       'ปากกา',                      '笔',          'ဘောပင်'),
  ('Pillow',                    'หมอน',                       '枕头',        'ခေါင်းအုံး'),
  ('Pillow Case',               'ปลอกหมอน',                   '枕套',        'ခေါင်းအုံးအိတ်'),
  ('Shampoo',                   'แชมพู',                      '洗发水',       'ခေါင်းလျှော်ရည်'),
  ('Shower Gel',                'ครีมอาบน้ำ',                 '沐浴露',       'ရေချိုးဆပ်ပြာရည်'),
  ('Shower Head',               'ฝักบัวอาบน้ำ',               '花洒喷头',     'ရေချိုးပန်းဂေါ်ခေါင်း'),
  ('Shower Holding',            'ที่ยึดฝักบัว',               '花洒支架',     'ရေချိုးပန်းဂေါ်ကိုင်း'),
  ('Shower Hose',               'สายฝักบัว',                  '花洒软管',     'ရေချိုးပန်းဂေါ်ပိုက်'),
  ('Shower Pipe Holder',        'ที่ยึดท่อฝักบัว',            '花洒管夹',     'ရေချိုးပိုက်ကိုင်း'),
  ('Toilet Brush',              'แปรงล้างห้องน้ำ',            '马桶刷',       'အိမ်သာဘရှ်'),
  ('Toilet Cleaning Liquid',    'น้ำยาล้างห้องน้ำ',           '马桶清洁液',   'အိမ်သာဆေးရည်'),
  ('Toilet Plunger',            'ที่สูบส้วม',                 '马桶疏通器',   'အိမ်သာစုပ်တံ'),
  ('Toilet Tissue',             'กระดาษชำระ',                 '卫生纸',       'အိမ်သာသုံးတစ်ရှူး'),
  ('Toothbrush',                'แปรงสีฟัน',                  '牙刷',        'သွားတိုက်ဘရှ်'),
  ('Trash Bag 18x20',           'ถุงขยะ 18x20',               '垃圾袋18x20',  'အမှိုက်ထုပ် 18x20'),
  ('Trash Bag 40x60',           'ถุงขยะ 40x60',               '垃圾袋40x60',  'အမှိုက်ထုပ် 40x60'),
  ('Washing Powder',            'ผงซักฟอก',                   '洗衣粉',       'ဆပ်ပြာမှုန့်'),
  ('Water Plastic Bag 8x16',    'ถุงพลาสติกใส่น้ำ 8x16',      '塑料水袋8x16', 'ရေထည့်အိတ် 8x16'),
  ('Water Tab',                 'ก๊อกน้ำ',                    '水龙头',       'ရေပိုက်ခေါင်း')
) as v(name, th, zh, my)
where public.catalog.name = v.name;
