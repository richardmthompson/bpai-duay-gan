# Tag Taxonomy

A tag is one shared concept with a Thai and an English label. One list serves both communities. Each person ticks any tag as **Give** (I can share this) or **Learn** (I want this), and a match forms when one side's Give meets the other side's Learn on the same tag. The `tags` table in `CONTRACT.md` stores `id`, `label_en`, `label_th` and `sort_order`; the Category column below is a grouping for the picker and can be carried by `sort_order` alone, or by an additive `category` column if the picker wants headings.

This list started from the team's handwritten page (`tag-taxonomy.jpg`) and grew from research into what people actually do around Chiang Mai and what the two communities ask each other for. The strongest demand on both sides is language: Thais want spoken English with native speakers, and foreigners want spoken Thai, help with paperwork, and Thai friends. The activity tags give a match a concrete thing to do together.

## How to read the table

- **Core** marks the tags the onboarding picker should show first. They cover the demand the research found most often. Everything else sits behind a "more" control or lower in `sort_order`.
- **Usual direction** is who typically gives. It is a hint for demo data and for the ranking's sanity checks, not a rule. Every tag stays open in both directions.
- **Source**: *seed* = one of the twelve ids already live in `scripts/seed/tags/tags.json`, which the demo profiles, event tags and web mock reference; its label is kept verbatim from the seed. *page* = on the team's handwritten sheet; *research* = backed by a cited source in the research notes below; *local* = well known in Chiang Mai but not confirmed by a source this session.
- **Ids are the contract.** The twelve *seed* ids are canonical because data already references them. Everything else here is additive, which the team agreed needs no ceremony. Where this list and the seed named the same concept differently, the seed's id won: `thai-language`, `street-food`, `bureaucracy`, `temples` and `design` replaced this file's earlier slugs. The seed's umbrella tags `music` and `tech` stay alongside the finer tags beneath them.
- Of the handwritten page's ids, `tech-amazon` is relabelled as selling on Amazon, Etsy and Shopify (coding and tech have their own tags) and `business` as "Starting and running a business".
- Thai labels are a draft by a non-native writer. A Thai speaker should check register and wording before the seed runs.

## Language · ภาษา

| Tag id | English | Thai | Core | Usual direction | Source |
|---|---|---|---|---|---|
| thai-language | Thai language | ภาษาไทย | ✓ | Local gives | seed |
| thai-reading | Reading and writing Thai | อ่านและเขียนภาษาไทย |  | Local gives | research |
| kham-mueang | Northern Thai (Kham Mueang) | คำเมือง (ภาษาเหนือ) | ✓ | Local gives | research |
| english | English | ภาษาอังกฤษ | ✓ | Foreigner gives | seed |
| english-exams | English for IELTS / TOEIC | ภาษาอังกฤษสำหรับสอบ IELTS / TOEIC |  | Foreigner gives | research |
| business-english | Business English | ภาษาอังกฤษเพื่อธุรกิจ | ✓ | Foreigner gives | research |
| chinese | Chinese | ภาษาจีน |  | Either | research |
| japanese | Japanese | ภาษาญี่ปุ่น |  | Either | local |
| korean | Korean | ภาษาเกาหลี |  | Either | local |
| german | German | ภาษาเยอรมัน |  | Foreigner gives | local |
| french | French | ภาษาฝรั่งเศส |  | Foreigner gives | local |
| spanish | Spanish | ภาษาสเปน |  | Foreigner gives | local |

## Food and drink · อาหารและเครื่องดื่ม

| Tag id | English | Thai | Core | Usual direction | Source |
|---|---|---|---|---|---|
| cooking | Cooking | ทำอาหาร | ✓ | Local gives | seed |
| northern-thai-food | Northern Thai dishes (khao soi, sai ua, nam prik noom) | อาหารเหนือ (ข้าวซอย ไส้อั่ว น้ำพริกหนุ่ม) | ✓ | Local gives | research |
| street-food | Street food | อาหารริมทาง | ✓ | Local gives | seed |
| fruit | Thai fruit | ผลไม้ไทย |  | Local gives | page |
| western-cooking | Western cooking | ทำอาหารฝรั่ง | ✓ | Foreigner gives | research |
| baking | Baking and pastry | ขนมอบและเบเกอรี่ |  | Foreigner gives | research |
| coffee | Specialty coffee and brewing | กาแฟพิเศษและการชงกาแฟ | ✓ | Either | research |
| craft-beer | Craft beer and homebrewing | คราฟต์เบียร์และการต้มเบียร์เอง |  | Either | research |
| vegetarian-vegan | Vegetarian and vegan food | อาหารมังสวิรัติและวีแกน |  | Either | local |

## Sport and outdoors · กีฬาและกิจกรรมกลางแจ้ง

| Tag id | English | Thai | Core | Usual direction | Source |
|---|---|---|---|---|---|
| muay-thai | Muay Thai | มวยไทย | ✓ | Local gives | seed |
| sepak-takraw | Sepak takraw | ตะกร้อ |  | Local gives | research |
| hiking | Hiking | เดินป่า | ✓ | Either | seed |
| running | Running and trail running | วิ่งและวิ่งเทรล |  | Either | research |
| cycling | Cycling and mountain biking | ปั่นจักรยานและจักรยานเสือภูเขา |  | Either | research |
| rock-climbing | Rock climbing | ปีนหน้าผา |  | Either | research |
| scooter | Riding a scooter | ขี่มอเตอร์ไซค์ | ✓ | Local gives | seed |
| motorbike-touring | Motorbike touring (Mae Hong Son loop) | ทัวร์มอเตอร์ไซค์ (ลูปแม่ฮ่องสอน) |  | Either | research |
| football | Football and futsal | ฟุตบอลและฟุตซอล |  | Either | local |
| badminton | Badminton | แบดมินตัน |  | Either | local |
| swimming | Swimming | ว่ายน้ำ |  | Either | local |
| golf | Golf | กอล์ฟ |  | Either | local |
| gym-fitness | Gym and fitness training | ฟิตเนสและการออกกำลังกาย | ✓ | Either | research |
| yoga | Yoga | โยคะ |  | Either | research |

## Arts, crafts and music · ศิลปะ งานฝีมือ และดนตรี

| Tag id | English | Thai | Core | Usual direction | Source |
|---|---|---|---|---|---|
| umbrella-painting | Bo Sang umbrellas and saa paper | ร่มบ่อสร้างและกระดาษสา |  | Local gives | research |
| woodcarving | Woodcarving and lacquerware | แกะสลักไม้และเครื่องเขิน |  | Local gives | research |
| silverwork | Silverwork (Wualai) | เครื่องเงินวัวลาย |  | Local gives | research |
| ceramics | Ceramics and celadon | เซรามิกและศิลาดล |  | Either | research |
| textiles-dye | Weaving and natural dyeing | ทอผ้าและย้อมสีธรรมชาติ |  | Local gives | research |
| lanterns-krathong | Making lanterns, krathong and tung | ทำโคม กระทง และตุง | ✓ | Local gives | research |
| thai-dance | Northern Thai dance | ฟ้อนพื้นเมืองล้านนา |  | Local gives | research |
| thai-music | Northern Thai instruments (salo, saw, sueng) | ดนตรีพื้นเมืองล้านนา (สะล้อ ซอ ซึง) |  | Local gives | research |
| music | Music | ดนตรี | ✓ | Either | seed |
| guitar | Guitar | กีตาร์ | ✓ | Either | research |
| piano | Piano and keyboard | เปียโนและคีย์บอร์ด |  | Either | research |
| jam-sessions | Jam sessions and live music | แจมดนตรีและดนตรีสด |  | Either | research |
| karaoke | Karaoke | คาราโอเกะ | ✓ | Local gives | page |
| photography | Photography | ถ่ายภาพ | ✓ | Either | research |
| drawing-painting | Drawing and painting | วาดรูปและระบายสี |  | Either | local |

## Culture and everyday life · วัฒนธรรมและชีวิตประจำวัน

| Tag id | English | Thai | Core | Usual direction | Source |
|---|---|---|---|---|---|
| temples | Temples & culture | วัดและวัฒนธรรม | ✓ | Local gives | seed |
| meditation | Meditation | นั่งสมาธิ | ✓ | Local gives | page |
| festivals | Festivals (Yi Peng, Loy Krathong, Songkran) | เทศกาล (ยี่เป็ง ลอยกระทง สงกรานต์) | ✓ | Local gives | research |
| lanna-history | Lanna history and Chiang Mai stories | ประวัติศาสตร์ล้านนาและเรื่องเล่าเชียงใหม่ |  | Local gives | research |
| thai-etiquette | Thai social etiquette and customs | มารยาทและธรรมเนียมไทย | ✓ | Local gives | research |
| western-culture | Western customs and culture | วัฒนธรรมและธรรมเนียมตะวันตก |  | Foreigner gives | research |
| thai-massage | Thai massage and herbal compress | นวดไทยและลูกประคบ |  | Local gives | research |
| gardening | Gardening and growing Thai herbs | ปลูกต้นไม้และสมุนไพร |  | Either | local |
| pets-animals | Pets and animal rescue | สัตว์เลี้ยงและการช่วยเหลือสัตว์ |  | Either | local |
| kids-family | Kids' activities and family life | กิจกรรมสำหรับเด็กและครอบครัว |  | Either | local |
| board-games | Board games | บอร์ดเกม |  | Either | research |

## Getting things done in Thailand · ใช้ชีวิตในเมืองไทย

| Tag id | English | Thai | Core | Usual direction | Source |
|---|---|---|---|---|---|
| bureaucracy | Visas & paperwork | วีซ่าและเอกสารราชการ | ✓ | Local gives | seed |
| licence-bank | Driving licence and bank account | ใบขับขี่และการเปิดบัญชีธนาคาร | ✓ | Local gives | research |
| renting | Renting a home and negotiating | เช่าบ้านและการต่อรองราคา |  | Local gives | research |
| healthcare | Finding doctors and dentists | หาหมอและหมอฟัน |  | Local gives | research |
| thai-apps | Thai apps (LINE, Grab, PromptPay) | แอปไทย (LINE, Grab, พร้อมเพย์) | ✓ | Local gives | local |
| thai-work-culture | Thai workplace culture | วัฒนธรรมการทำงานแบบไทย |  | Local gives | research |
| study-work-abroad | Studying or working abroad | เรียนต่อหรือทำงานต่างประเทศ | ✓ | Foreigner gives | research |
| foreign-visas | Visas for other countries | วีซ่าไปต่างประเทศ |  | Foreigner gives | research |

## Business and digital · ธุรกิจและดิจิทัล

| Tag id | English | Thai | Core | Usual direction | Source |
|---|---|---|---|---|---|
| business | Starting and running a business | ทำธุรกิจ | ✓ | Either | page |
| thai-biz-market | Thai business market | ตลาดธุรกิจไทย |  | Local gives | page |
| other-markets | Overseas markets | ตลาดต่างประเทศ |  | Foreigner gives | page |
| shopee-lazada | Selling on Shopee / Lazada / TikTok Shop | ขายของบน Shopee / Lazada / TikTok Shop | ✓ | Local gives | page |
| tech-amazon | Selling on Amazon / Etsy / Shopify | ขายของบน Amazon / Etsy / Shopify | ✓ | Foreigner gives | page |
| live-selling | Facebook and TikTok live selling | ไลฟ์ขายของ |  | Local gives | local |
| digital-marketing | Digital marketing and social media | การตลาดออนไลน์และโซเชียลมีเดีย | ✓ | Either | research |
| tech | Tech & computers | เทคโนโลยีและคอมพิวเตอร์ | ✓ | Either | seed |
| coding | Coding and web development | เขียนโปรแกรมและทำเว็บไซต์ | ✓ | Either | research |
| ai-tools | AI tools for work (ChatGPT, Claude) | ใช้ AI ช่วยทำงาน (ChatGPT, Claude) | ✓ | Either | research |
| freelancing-remote | Freelancing and remote work (Upwork) | ฟรีแลนซ์และทำงานทางไกล (Upwork) | ✓ | Foreigner gives | research |
| content-creation | Video and content creation | ทำวิดีโอและคอนเทนต์ |  | Either | local |
| investing | Investing and personal finance | การลงทุนและการเงินส่วนตัว |  | Either | research |
| design | Design & crafts | งานออกแบบและงานฝีมือ | ✓ | Either | seed |
| tourism-hospitality | Tourism and hospitality business | ธุรกิจท่องเที่ยวและโรงแรม |  | Either | local |
| cafe-restaurant | Running a café or restaurant | เปิดคาเฟ่หรือร้านอาหาร |  | Either | research |

## Counts

| | Tags | Core |
|---|---|---|
| Language | 12 | 4 |
| Food and drink | 9 | 5 |
| Sport and outdoors | 14 | 4 |
| Arts, crafts and music | 15 | 5 |
| Culture and everyday life | 11 | 4 |
| Getting things done in Thailand | 8 | 4 |
| Business and digital | 16 | 9 |
| **Total** | **85** | **35** |

## Research notes

Two research passes fed this list. Evidence is strong for language and weak-to-moderate for everything else; no survey ranks what the two communities want from each other, so the Core column is a judgement call from how often a topic recurred.

**What Thais ask foreigners for.** Spoken English dominates. Pantip threads repeatedly ask where to practise speaking with foreigners in Chiang Mai (pantip.com/topic/32242380, /31013751, /38499397). Online selling for extra income is growing; the Revenue Department reports 56,091 small online traders newly registered (Thai Examiner, 15 Sep 2026). AI tools and digital skills are rising among young Thais (Bangkok Post, "How young Thais are learning to live and work with AI"). Other languages, freelancing, studying abroad and Western cooking appear but are not sourced.

**What foreigners ask Thais for.** Spoken Thai first: Tandem lists 471 users in Chiang Mai, and an Airbnb experience sells Kham Mueang lessons from a local. Paperwork second: 90-day reporting and TM30 carry 2,000 to 5,000 baht fines and agents charge 500 to 800 baht to file (Chiang Mai Ambassador; CMLocals). Making Thai friends is a recurring theme in nomad guides (Indie Traveller). Etiquette, festivals, cooking, licences, renting and healthcare are common newcomer questions but not sourced this session.

**Activities confirmed with a venue or schedule.** Crazy Horse Buttress climbing with CMRCA and Progression Vertical; Doi Suthep-Pui downhill trails; North Gate Jazz Co-op's free Tuesday jam; Wat Suan Dok monk chat Mon/Wed/Fri 5 to 7pm and its retreats; Old Medicine Hospital and ITM massage schools; Bo Sang umbrella and saa paper workshops; San Kamphaeng Road silk, silver, lacquer and celadon; Maled, Graph and Ministry of Roasters for coffee; Mug Craft for homebrew; Chiang Mai Board Games and the Friday Social Thai Language Exchange on Meetup; Punspace, Yellow and Alt_ChiangMai coworking.

**Existing exchange groups.** Language Exchange Chiang Mai (Facebook), Chiang Mai Social and Language Exchange at Bodhi Terrace (Eventbrite), Free Language Exchange Chiang Mai on Wednesdays and Saturdays, and a past Draper Startup House Saturday exchange. All swap Thai for English. None matches on other skills, which is the gap this app fills.

**Seasonal note.** Burning season, roughly February to April, cuts outdoor activity. Not modelled in the tags; worth a flag on events later.

## Open questions for the team

- The seed (`scripts/seed/tags/tags.json`) carries only the 35 Core rows, because the picker is a flat chip list with no headings or "more" control. The remaining rows wait here until the picker can group or fold them.
- `bureaucracy` and `licence-bank` must read as guidance from a friend, not agent services. The label says "guidance"; the picker copy should say it too.
- Thai labels need a native check, especially the practical and business rows.
- If the team wants category headings in the picker, add a `category` column to `tags`. That is additive under the contract's rules, so Shivam only needs telling.
