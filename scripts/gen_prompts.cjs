#!/usr/bin/env node
'use strict'
const fs = require('fs'), path = require('path')

// Read characters from characters.json — single source of truth for instruments
const CHARACTERS = require(path.join(__dirname, '..', 'characters.json'))

const PRE = 'masterpiece, best quality, absurdres, uncensored, flat color, afkArenaStyle, h4desstyle, ultrasharpdskStyle'
const SUF = 'simple background, cel shading, dark outlines, afkArenaStyle, h4desstyle, ultrasharpdskstyle'
const NEG = 'bad anatomy, bad hands, missing fingers, extra digits, fewer digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, blurry, text, error, missing limb, floating limbs, disconnected limbs, malformed hands, long neck, mutated, ugly, deformed, (nsfw:1.3), realistic, photo, photography, 3d render'

// ── INSTRUMENT VISUAL FRAGMENTS ──
// Each maps an instrument/kit/vocal_style value (from characters.json public_metadata)
// to the visual fragment that goes after the outfit/accessories block in the prompt.
// "item" describes the prop; "pose" describes how the character interacts with it.
const INST = {
  // ── MELODY: instruments ───────────────────────────────────────────────
  'Acoustic Guitar':         { item: 'acoustic guitar held in hands',                          pose: 'cradling acoustic guitar, fingerpicking pose, intimate connection with instrument' },
  'Piano':                   { item: 'upright piano in front of her, hands on the keys',       pose: 'seated at piano, hands gliding over keys, focused musical expression' },
  'Distorted Electric Guitar':{ item: 'electric guitar with heavy distortion, guitar strap over shoulder', pose: 'aggressive shred pose, full body into the riff, hair flying' },
  'Clean Electric Guitar':   { item: 'clean-tone electric guitar, guitar strap over shoulder', pose: 'smooth melodic playing stance, fingers walking the fretboard' },
  'Bass Guitar':             { item: 'sleek bass guitar, slap position implied',               pose: 'slap bass stance, body swaying, deeply in the groove' },
  'Piano Synth':             { item: 'analog synthesizer keyboard, retro synth setup',          pose: 'hands gliding across the synth keys, head bobbing in the groove' },
  'Slide Guitar':            { item: 'acoustic guitar with slide ring on finger',              pose: 'intimate connection with instrument, eyes closed feeling the slide notes' },
  'Saxophone':               { item: 'tenor or alto saxophone held with elegant confidence',   pose: 'saxophone raised, eyes closed, completely in the feel' },
  'Violin':                  { item: 'violin held under chin with bow drawn',                  pose: 'theatrical violin playing pose, drama and precision combined' },

  // ── RHYTHM: drum kits ─────────────────────────────────────────────────
  'Acoustic Drums':          { item: 'standard acoustic drum kit, drumsticks',                 pose: 'behind drum kit, sticks raised mid-hit, energetic stance' },
  'Heavy Acoustic':          { item: 'heavy acoustic drum kit with double bass pedals, drumsticks', pose: 'powerful drumming stance, sticks blurred in motion, hair flying' },
  'Percussion Ensemble':     { item: 'percussion ensemble with bongos, congas and hand drums', pose: 'hands striking the drum heads, rhythmic flow, deep groove' },
  'Electronic Drums':        { item: 'electronic drum pads, modern futuristic kit',            pose: 'mid-strike on the electronic pads, sleek modern posture' },
  'Minimal Kit':             { item: 'minimal jazz drum kit, wire brushes',                    pose: 'behind minimal kit, brush held lightly, composed upright posture' },

  // ── VOCALS: vocal styles ──────────────────────────────────────────────
  'Sung':                    { item: 'handheld microphone',                                    pose: 'mic held confidently, melodic delivery, owning the stage' },
  'Shouted':                 { item: 'mic clenched in fist',                                   pose: 'screaming into the mic, veins showing, fierce raw delivery' },
  'Breathy':                 { item: 'microphone close to lips',                               pose: 'intimate breathy delivery, eyes half-closed, soulful' },
  'Whispered':               { item: 'vintage microphone very close to lips',                  pose: 'whispering into mic, eyes closed feeling every word' },
  'Operatic':                { item: 'theatrical dramatic microphone',                         pose: 'arms spread wide, operatic dramatic delivery, commanding the room' },
}

// ── ARCHETYPE TEMPLATES ──
// Each template returns the prompt body up through the outfit/accessories block.
// Then INST[instrument] is appended (item + pose), then SUF closes it.
// The expression/energy/outfit/accessories are still archetype-specific (= personality of the genre/role).
const T = {
  rhythm_rock:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, intense focused expression, powerful confident energy, ${d.mod}, band tee, ripped jeans, leather boots, studded belt, drumsticks tucked behind ear, leather wristbands, silver chains`,
  rhythm_punk:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, snarling defiant expression, rebellious fierce energy, ${d.mod}, ripped fishnet shirt, leather jacket covered in patches, combat boots, torn tights, safety pins on jacket, spiked choker, multiple ear piercings, chain belt`,
  rhythm_grunge:      (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, detached melancholic expression, brooding distant gaze, ${d.mod}, oversized flannel shirt open over faded band tee, worn ripped jeans, old converse, worn leather bracelet, simple rings, old wristwatch`,
  rhythm_heavy_metal: (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, fierce intense expression, commanding powerful energy, ${d.mod}, black band tee with logo, black skinny jeans, boots with buckles, leather vest with patches, spiked wristbands both arms, pentagram pendant, skull rings, black nail polish`,
  rhythm_funk:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, confident joyful expression, soulful groove energy, ${d.mod}, colorful wide-leg pants, vibrant crop top, platform shoes, chunky gold chains, large hoop earrings, stacked colorful bracelets`,
  rhythm_blues:       (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, soulful warm expression, emotionally present storytelling gaze, ${d.mod}, vintage suit jacket over collared shirt, suspenders, worn dress shoes, vintage pocket watch, simple gold ring, folded handkerchief`,
  rhythm_jazz:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, serene focused expression, intellectual composed energy, ${d.mod}, tailored blazer over silk blouse, high-waisted wide trousers, low heels, pearl stud earrings, delicate chain necklace, slim watch`,
  rhythm_psychedelic: (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, dreamy transcendent expression, eyes half closed in trance, ${d.mod}, flowing bohemian layers, tie-dye cosmic prints, sheer fabrics, crystal pendants, feather earrings, multiple rings, third eye bindhi gem`,
  rhythm_prog_rock:   (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, intense calculating expression, focused mathematical precision, ${d.mod}, tailored dark asymmetric ensemble, architectural cut clothing, unusual geometric timepiece, minimal architectural jewelry`,

  melody_rock:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, passionate powerful expression, soaring emotional energy, ${d.mod}, worn leather jacket, vintage band tee, skinny jeans, ankle boots, pick necklace, silver rings, wristband`,
  melody_punk:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, aggressive sneering expression, raw defiant energy, ${d.mod}, DIY jacket covered in patches and pins, ripped tights, plaid skirt, boots, safety pins on jacket, studded belt, spiked bracelet, gauged ears`,
  melody_grunge:      (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, anguished raw expression, emotionally exposed vulnerability, ${d.mod}, oversized flannel over torn tee, ripped jeans, beat up boots, worn rubber bracelets, cheap rings, frayed friendship bracelet`,
  melody_heavy_metal: (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, fierce commanding expression, epic power energy, ${d.mod}, black leather jacket with studs, band tee, black jeans, heavy boots, spiked wristbands, skull pendant, rings on every finger, battle jacket`,
  melody_funk:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, smooth confident expression, locked in the pocket energy, ${d.mod}, 70s inspired wide collar shirt, high-waist flares, platform shoes, chunky gold rings, layered gold chains, funky oversized glasses`,
  melody_blues:       (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, deeply soulful expression, emotional truthful storytelling, ${d.mod}, simple vintage dress or blouse, timeless classic style, simple gold earrings, worn bracelet`,
  melody_jazz:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, sophisticated cool expression, fluid improvisational energy, ${d.mod}, elegant evening blazer, silk turtleneck, tailored wide trousers, pearl earrings, subtle gold necklace, elegant slim watch`,
  melody_psychedelic: (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, transcendent visionary expression, cosmic channeling energy, ${d.mod}, cosmic flowing robes with patterns, layered sheer fabrics, psychedelic prints, large crystal pendant, gem-encrusted rings, star hairpins`,
  melody_prog_rock:   (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, intense artistic vision, mathematical beauty in expression, ${d.mod}, theatrical asymmetric dark ensemble, dramatic architectural cut, unusual artistic statement jewelry, geometric pieces`,

  vocals_rock:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, powerful commanding expression, passionate energy, ${d.mod}, leather pants, bold statement top, rock goddess stage outfit, boots, chunky silver jewelry, dramatic rings, layered necklaces`,
  vocals_punk:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, screaming raw expression, furious revolutionary energy, ${d.mod}, DIY punk jacket with patches, ripped clothes, fishnet, boots, chains everywhere, spiked collar, safety pins, multiple piercings`,
  vocals_grunge:      (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, anguished raw expression, emotionally exposed vulnerability, ${d.mod}, oversized vintage tee, flannel tied around waist, worn jeans, old shoes, minimal worn jewelry, old bracelet`,
  vocals_heavy_metal: (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, fierce warrior expression, epic commanding power, ${d.mod}, armor-inspired black leather stage costume, dramatic details, epic statement necklace, warrior-inspired accessories, dark nail polish`,
  vocals_funk:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, joyful magnetic expression, confident soulful energy, ${d.mod}, sequined or colorful stage outfit, 70s soul inspired, sparkle and soul, chunky gold jewelry, statement earrings, sequins`,
  vocals_blues:       (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, deep sorrow and beauty combined, truthful emotional storytelling, ${d.mod}, vintage elegant dress, timeless classic beauty, period-appropriate, vintage pearl jewelry, classic elegance`,
  vocals_jazz:        (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, sultry sophisticated expression, intimate storytelling warmth, ${d.mod}, elegant jazz club gown or sophisticated tailored suit, pearl necklace, elegant drop earrings, satin gloves`,
  vocals_psychedelic: (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, transcendent visionary expression, cosmic channeling, ${d.mod}, flowing cosmic robes, nature and cosmos inspired, sheer layers, large crystals, feather pieces, cosmic gem collection`,
  vocals_prog_rock:   (d) => `${PRE}, 1girl, solo, ${d.hair}, ${d.color} hair, ${d.skin} skin, theatrical dramatic expression, epic storytelling intensity, ${d.mod}, theatrical dramatic stage costume, artistic and unusual, dramatic statement artistic pieces`,
}

const ARCHETYPES = {
  rhythm_rock:'The Rock Drummer', rhythm_punk:'The Punk Drummer', rhythm_grunge:'The Grunge Drummer',
  rhythm_heavy_metal:'The Metal Drummer', rhythm_funk:'The Funk Drummer', rhythm_blues:'The Blues Drummer',
  rhythm_jazz:'The Jazz Drummer', rhythm_psychedelic:'The Psychedelic Drummer', rhythm_prog_rock:'The Prog Drummer',
  melody_rock:'The Rock Guitarist', melody_punk:'The Punk Guitarist', melody_grunge:'The Grunge Guitarist',
  melody_heavy_metal:'The Metal Shredder', melody_funk:'The Funk Bassist', melody_blues:'The Blues Slide Guitarist',
  melody_jazz:'The Jazz Saxophonist', melody_psychedelic:'The Psychedelic Keys Player', melody_prog_rock:'The Prog Multi-Instrumentalist',
  vocals_rock:'The Rock Vocalist', vocals_punk:'The Punk Screamer', vocals_grunge:'The Grunge Singer',
  vocals_heavy_metal:'The Metal Vocalist', vocals_funk:'The Funk Soul Singer', vocals_blues:'The Blues Singer',
  vocals_jazz:'The Jazz Vocalist', vocals_psychedelic:'The Psychedelic Voice', vocals_prog_rock:'The Prog Vocalist',
}

// Per-character look data: [archetype_key, num, hair, color, skin, mod]
// (Instrument is no longer hardcoded — it's pulled from characters.json by id.)
const CHARS = [
// ── RHYTHM ROCK (001-030) ─────────────────────────────────────────────────────
['rhythm_rock',1,'messy short hair','bleached blonde with dark roots','olive','groovy, solid'],
['rhythm_rock',2,'sleek ponytail with flyaways','auburn','pale','groovy, solid'],
['rhythm_rock',3,'sleek ponytail with flyaways','black','warm brown','tight, powerful'],
['rhythm_rock',4,'wild curly hair','dark brown','warm brown','raw, pounding'],
['rhythm_rock',5,'choppy layers','bleached blonde with dark roots','pale','groovy, solid'],
['rhythm_rock',6,'wild curly hair','dark brown','tan','heavy, driving'],
['rhythm_rock',7,'wild curly hair','dark brown','warm brown','tight, powerful'],
['rhythm_rock',8,'sleek ponytail with flyaways','bleached blonde with dark roots','olive','heavy, driving'],
['rhythm_rock',9,'messy short hair','auburn','pale','tight, powerful'],
['rhythm_rock',10,'messy short hair','bleached blonde with dark roots','olive','tight, powerful'],
['rhythm_rock',11,'sleek ponytail with flyaways','auburn','pale','raw, pounding'],
['rhythm_rock',12,'sleek ponytail with flyaways','black','warm brown','groovy, solid'],
['rhythm_rock',13,'wild curly hair','dark brown','warm brown','groovy, solid'],
['rhythm_rock',14,'choppy layers','bleached blonde with dark roots','pale','tight, powerful'],
['rhythm_rock',15,'wild curly hair','dark brown','tan','heavy, driving'],
['rhythm_rock',16,'wild curly hair','dark brown','warm brown','tight, powerful'],
['rhythm_rock',17,'sleek ponytail with flyaways','bleached blonde with dark roots','olive','groovy, solid'],
['rhythm_rock',18,'messy short hair','auburn','pale','heavy, driving'],
['rhythm_rock',19,'wild curly hair','black','olive','raw, pounding'],
['rhythm_rock',20,'sleek ponytail with flyaways','auburn','pale','tight, powerful'],
['rhythm_rock',21,'sleek ponytail with flyaways','black','warm brown','tight, powerful'],
['rhythm_rock',22,'wild curly hair','dark brown','warm brown','raw, pounding'],
['rhythm_rock',23,'choppy layers','bleached blonde with dark roots','pale','groovy, solid'],
['rhythm_rock',24,'wild curly hair','dark brown','tan','tight, powerful'],
['rhythm_rock',25,'wild curly hair','dark brown','warm brown','heavy, driving'],
['rhythm_rock',26,'sleek ponytail with flyaways','bleached blonde with dark roots','olive','tight, powerful'],
['rhythm_rock',27,'messy short hair','auburn','pale','tight, powerful'],
['rhythm_rock',28,'wild curly hair','black','olive','tight, powerful'],
['rhythm_rock',29,'wild curly hair','bleached blonde with dark roots','warm brown','raw, pounding'],
['rhythm_rock',30,'sleek ponytail with flyaways','black','warm brown','raw, pounding'],
// ── RHYTHM PUNK ──
['rhythm_punk',31,'shaved sides long top','hot pink','pale','fast, aggressive'],
['rhythm_punk',32,'shaved sides long top','bleached white','fair','tight, explosive'],
['rhythm_punk',33,'shaved sides long top','black and neon','pale','tight, explosive'],
['rhythm_punk',34,'tall mohawk','hot pink','fair','tight, explosive'],
['rhythm_punk',35,'half-shaved head','electric blue','pale','tight, explosive'],
['rhythm_punk',36,'shaved sides long top','hot pink','pale','tight, explosive'],
['rhythm_punk',37,'liberty spikes','electric blue','fair','relentless, chaotic'],
['rhythm_punk',38,'half-shaved head','hot pink','fair','fast, aggressive'],
['rhythm_punk',39,'half-shaved head','neon green','fair','fast, aggressive'],
['rhythm_punk',40,'shaved sides long top','hot pink','pale','relentless, chaotic'],
['rhythm_punk',41,'shaved sides long top','bleached white','fair','fast, aggressive'],
['rhythm_punk',42,'shaved sides long top','black and neon','pale','tight, explosive'],
['rhythm_punk',43,'tall mohawk','hot pink','fair','relentless, chaotic'],
['rhythm_punk',44,'half-shaved head','electric blue','pale','relentless, chaotic'],
['rhythm_punk',45,'shaved sides long top','hot pink','pale','fast, aggressive'],
['rhythm_punk',46,'liberty spikes','electric blue','fair','relentless, chaotic'],
['rhythm_punk',47,'half-shaved head','hot pink','fair','fast, aggressive'],
['rhythm_punk',48,'half-shaved head','neon green','fair','relentless, chaotic'],
['rhythm_punk',49,'tall mohawk','hot pink','fair','fast, aggressive'],
['rhythm_punk',50,'shaved sides long top','bleached white','fair','fast, aggressive'],
['rhythm_punk',51,'shaved sides long top','black and neon','pale','tight, explosive'],
['rhythm_punk',52,'tall mohawk','hot pink','fair','fast, aggressive'],
// ── RHYTHM GRUNGE ──
['rhythm_grunge',53,'tangled waves','faded black','fair','lazy, heavy'],
['rhythm_grunge',54,'tangled waves','faded black','fair','brooding, dark'],
['rhythm_grunge',55,'long greasy hair','dark brown','pale sallow','brooding, dark'],
['rhythm_grunge',56,'tangled waves','dirty blonde','pale sallow','lazy, heavy'],
['rhythm_grunge',57,'wild unkempt curtains','faded black','fair','muddy, raw'],
['rhythm_grunge',58,'long greasy hair','dirty blonde','fair','muddy, raw'],
['rhythm_grunge',59,'tangled waves','faded black','pale sallow','brooding, dark'],
['rhythm_grunge',60,'tangled waves','dark brown','pale sallow','brooding, dark'],
['rhythm_grunge',61,'tangled waves','mousy brown','pale sallow','brooding, dark'],
['rhythm_grunge',62,'tangled waves','faded black','fair','brooding, dark'],
['rhythm_grunge',63,'tangled waves','faded black','fair','brooding, dark'],
['rhythm_grunge',64,'long greasy hair','dark brown','pale sallow','lazy, heavy'],
['rhythm_grunge',65,'tangled waves','dirty blonde','pale sallow','brooding, dark'],
['rhythm_grunge',66,'wild unkempt curtains','faded black','fair','brooding, dark'],
['rhythm_grunge',67,'long greasy hair','dirty blonde','fair','lazy, heavy'],
['rhythm_grunge',68,'tangled waves','faded black','pale sallow','muddy, raw'],
['rhythm_grunge',69,'tangled waves','dirty blonde','pale sallow','brooding, dark'],
['rhythm_grunge',70,'tangled waves','mousy brown','pale sallow','brooding, dark'],
// ── RHYTHM HEAVY METAL ──
['rhythm_heavy_metal',71,'thick dreadlocks','near-black dark brown','pale','machine-gun, relentless'],
['rhythm_heavy_metal',72,'thick dreadlocks','jet black','fair','machine-gun, relentless'],
['rhythm_heavy_metal',73,'wild headbanging hair mid-motion','dark blood red','olive','thunderous, precise'],
['rhythm_heavy_metal',74,'long straight hair flying','near-black dark brown','olive','epic, powerful'],
['rhythm_heavy_metal',75,'long straight hair flying','near-black dark brown','fair','epic, powerful'],
['rhythm_heavy_metal',76,'wild headbanging hair mid-motion','near-black dark brown','olive','thunderous, precise'],
['rhythm_heavy_metal',77,'thick dreadlocks','dark blood red','pale','thunderous, precise'],
['rhythm_heavy_metal',78,'long straight hair flying','jet black','pale','thunderous, precise'],
['rhythm_heavy_metal',79,'wild headbanging hair mid-motion','near-black dark brown','pale','epic, powerful'],
['rhythm_heavy_metal',80,'thick dreadlocks','near-black dark brown','pale','thunderous, precise'],
['rhythm_heavy_metal',81,'thick dreadlocks','jet black','fair','epic, powerful'],
['rhythm_heavy_metal',82,'wild headbanging hair mid-motion','dark blood red','olive','thunderous, precise'],
['rhythm_heavy_metal',83,'long straight hair flying','near-black dark brown','olive','epic, powerful'],
['rhythm_heavy_metal',84,'long straight hair flying','near-black dark brown','fair','thunderous, precise'],
['rhythm_heavy_metal',85,'wild headbanging hair mid-motion','near-black dark brown','olive','machine-gun, relentless'],
// ── RHYTHM FUNK ──
['rhythm_funk',86,'thick locs','natural black','rich dark','groovy, tight'],
['rhythm_funk',87,'thick locs','dark brown','warm mahogany','groovy, tight'],
['rhythm_funk',88,'thick locs','rich brown with golden highlights','rich dark','syncopated, soulful'],
['rhythm_funk',89,'voluminous afro puffs','natural black','warm mahogany','syncopated, soulful'],
['rhythm_funk',90,'voluminous afro puffs','dark brown','rich dark','syncopated, soulful'],
['rhythm_funk',91,'big natural curls','rich brown with golden highlights','deep brown','syncopated, soulful'],
['rhythm_funk',92,'voluminous afro puffs','rich brown with golden highlights','deep brown','syncopated, soulful'],
['rhythm_funk',93,'big natural curls','natural black','deep brown','funky, deep'],
['rhythm_funk',94,'thick locs','dark brown','deep brown','groovy, tight'],
['rhythm_funk',95,'thick locs','natural black','rich dark','funky, deep'],
// ── RHYTHM BLUES ──
['rhythm_blues',96,'finger waves','dark warm brown','rich dark','shuffling, warm'],
['rhythm_blues',97,'natural short curls','dark warm brown','deep ebony','shuffling, warm'],
['rhythm_blues',98,'natural short curls','natural black','deep ebony','shuffling, warm'],
['rhythm_blues',99,'simple natural style','salt and pepper','deep ebony','deep, slow'],
['rhythm_blues',100,'finger waves','dark warm brown','rich dark','shuffling, warm'],
['rhythm_blues',101,'natural short curls','salt and pepper','rich dark','deep, slow'],
['rhythm_blues',102,'natural short curls','dark warm brown','rich dark','deep, slow'],
['rhythm_blues',103,'natural short curls','salt and pepper','warm brown','swinging, laid-back'],
// ── RHYTHM JAZZ ──
['rhythm_jazz',104,'short natural coils','deep dark brown','caramel','floating, light'],
['rhythm_jazz',105,'short natural coils','glossy black','warm brown','subtle, complex'],
['rhythm_jazz',106,'elegant updo','glossy black','caramel','subtle, complex'],
['rhythm_jazz',107,'elegant updo','glossy black','caramel','delicate, swinging'],
['rhythm_jazz',108,'sleek sophisticated bob','glossy black','caramel','floating, light'],
// ── RHYTHM PSYCHEDELIC ──
['rhythm_psychedelic',109,'huge ethereal cloud of hair','deep violet','iridescent luminous','otherworldly, pulsing'],
['rhythm_psychedelic',110,'cosmic braids with gems','cosmic blue and purple','pale ethereal','otherworldly, pulsing'],
// ── RHYTHM PROG ROCK ──
['rhythm_prog_rock',111,'precise architectural short cut','dark brown','olive','complex, shifting'],
// ── MELODY ROCK ──
['melody_rock',1,'wild tousled rock hair','platinum blonde','pale','melodic, emotional'],
['melody_rock',2,'dramatic layered waves','jet black','tan','dark, heavy'],
['melody_rock',3,'wild tousled rock hair','warm brown','olive','melodic, emotional'],
['melody_rock',4,'volumious messy mane','jet black','pale','melodic, emotional'],
['melody_rock',5,'volumious messy mane','platinum blonde','tan','melodic, emotional'],
['melody_rock',6,'wild tousled rock hair','dark auburn red','pale','dark, heavy'],
['melody_rock',7,'wild tousled rock hair','platinum blonde','tan','raw, energetic'],
['melody_rock',8,'dramatic layered waves','platinum blonde','pale','melodic, emotional'],
['melody_rock',9,'wild tousled rock hair','platinum blonde','olive','powerful, anthemic'],
['melody_rock',10,'wild tousled rock hair','platinum blonde','pale','dark, heavy'],
['melody_rock',11,'dramatic layered waves','jet black','tan','powerful, anthemic'],
['melody_rock',12,'wild tousled rock hair','warm brown','olive','raw, energetic'],
['melody_rock',13,'volumious messy mane','jet black','pale','raw, energetic'],
['melody_rock',14,'volumious messy mane','platinum blonde','tan','powerful, anthemic'],
['melody_rock',15,'wild tousled rock hair','dark auburn red','pale','powerful, anthemic'],
['melody_rock',16,'wild tousled rock hair','platinum blonde','tan','raw, energetic'],
['melody_rock',17,'dramatic layered waves','platinum blonde','pale','dark, heavy'],
['melody_rock',18,'wild tousled rock hair','platinum blonde','olive','dark, heavy'],
['melody_rock',19,'dramatic layered waves','jet black','tan','raw, energetic'],
['melody_rock',20,'dramatic layered waves','jet black','tan','dark, heavy'],
['melody_rock',21,'wild tousled rock hair','warm brown','olive','raw, energetic'],
['melody_rock',22,'volumious messy mane','jet black','pale','powerful, anthemic'],
['melody_rock',23,'volumious messy mane','platinum blonde','tan','raw, energetic'],
['melody_rock',24,'wild tousled rock hair','dark auburn red','pale','powerful, anthemic'],
['melody_rock',25,'wild tousled rock hair','platinum blonde','tan','powerful, anthemic'],
['melody_rock',26,'dramatic layered waves','platinum blonde','pale','raw, energetic'],
['melody_rock',27,'wild tousled rock hair','platinum blonde','olive','melodic, emotional'],
['melody_rock',28,'dramatic layered waves','jet black','tan','melodic, emotional'],
['melody_rock',29,'wild tousled rock hair','dark auburn red','pale','melodic, emotional'],
['melody_rock',30,'wild tousled rock hair','warm brown','olive','melodic, emotional'],
// ── MELODY PUNK ──
['melody_punk',31,'tall mohawk','bright orange','pale','rebellious, fast'],
['melody_punk',32,'shaved sides with colorful top','black and white','pale','rebellious, fast'],
['melody_punk',33,'shaved sides with colorful top','neon yellow','fair','rebellious, fast'],
['melody_punk',34,'tall mohawk','electric red','fair','fierce, defiant'],
['melody_punk',35,'shaved sides with colorful top','bright orange','pale','rebellious, fast'],
['melody_punk',36,'liberty spikes','electric red','pale','rebellious, fast'],
['melody_punk',37,'tall mohawk','electric red','fair','fierce, defiant'],
['melody_punk',38,'liberty spikes','black and white','fair','fierce, defiant'],
['melody_punk',39,'liberty spikes','neon yellow','fair','fierce, defiant'],
['melody_punk',40,'tall mohawk','bright orange','pale','rebellious, fast'],
['melody_punk',41,'shaved sides with colorful top','black and white','pale','fierce, defiant'],
['melody_punk',42,'shaved sides with colorful top','neon yellow','fair','rebellious, fast'],
['melody_punk',43,'tall mohawk','electric red','fair','rebellious, fast'],
['melody_punk',44,'shaved sides with colorful top','bright orange','pale','rebellious, fast'],
['melody_punk',45,'liberty spikes','electric red','pale','rebellious, fast'],
['melody_punk',46,'tall mohawk','electric red','fair','angry, raw'],
['melody_punk',47,'liberty spikes','black and white','fair','fierce, defiant'],
['melody_punk',48,'liberty spikes','neon yellow','fair','angry, raw'],
['melody_punk',49,'tall mohawk','neon yellow','pale','fierce, defiant'],
['melody_punk',50,'shaved sides with colorful top','black and white','pale','angry, raw'],
['melody_punk',51,'shaved sides with colorful top','neon yellow','fair','rebellious, fast'],
['melody_punk',52,'tall mohawk','electric red','fair','angry, raw'],
// ── MELODY GRUNGE ──
['melody_grunge',53,'tangled waves','faded dark brown','fair','dark, brooding'],
['melody_grunge',54,'messy curtain bangs','faded dark brown','fair','heavy, sludgy'],
['melody_grunge',55,'tangled waves','faded dark brown','pale sallow','heavy, sludgy'],
['melody_grunge',56,'messy curtain bangs','murky black','fair','heavy, sludgy'],
['melody_grunge',57,'messy curtain bangs','murky black','pale sallow','raw, dirty'],
['melody_grunge',58,'tangled waves','faded dark brown','fair','dark, brooding'],
['melody_grunge',59,'messy curtain bangs','faded dark brown','fair','heavy, sludgy'],
['melody_grunge',60,'tangled waves','faded dark brown','fair','raw, dirty'],
['melody_grunge',61,'long unwashed disheveled hair','murky black','pale sallow','raw, dirty'],
['melody_grunge',62,'tangled waves','faded dark brown','fair','raw, dirty'],
['melody_grunge',63,'messy curtain bangs','faded dark brown','fair','raw, dirty'],
['melody_grunge',64,'tangled waves','faded dark brown','pale sallow','dark, brooding'],
['melody_grunge',65,'messy curtain bangs','murky black','fair','dark, brooding'],
['melody_grunge',66,'messy curtain bangs','murky black','pale sallow','heavy, sludgy'],
['melody_grunge',67,'tangled waves','faded dark brown','fair','raw, dirty'],
['melody_grunge',68,'messy curtain bangs','faded dark brown','fair','heavy, sludgy'],
['melody_grunge',69,'messy curtain bangs','faded dark brown','fair','dark, brooding'],
['melody_grunge',70,'long unwashed disheveled hair','murky black','pale sallow','dark, brooding'],
// ── MELODY HEAVY METAL ──
['melody_heavy_metal',71,'mid-headbang hair in motion','dark silver','pale','powerful, relentless'],
['melody_heavy_metal',72,'mid-headbang hair in motion','dark silver','fair','dark, aggressive'],
['melody_heavy_metal',73,'thick wild mane','dark silver','pale','powerful, relentless'],
['melody_heavy_metal',74,'thick wild mane','dark silver','fair','brutal, epic'],
['melody_heavy_metal',75,'thick wild mane','blood red highlights','fair','powerful, relentless'],
['melody_heavy_metal',76,'mid-headbang hair in motion','dark silver','olive','powerful, relentless'],
['melody_heavy_metal',77,'mid-headbang hair in motion','dark silver','fair','dark, aggressive'],
['melody_heavy_metal',78,'long flowing dramatic hair','dark silver','pale','dark, aggressive'],
['melody_heavy_metal',79,'thick wild mane','jet black','fair','dark, aggressive'],
['melody_heavy_metal',80,'mid-headbang hair in motion','dark silver','pale','dark, aggressive'],
['melody_heavy_metal',81,'mid-headbang hair in motion','dark silver','fair','dark, aggressive'],
['melody_heavy_metal',82,'thick wild mane','dark silver','pale','powerful, relentless'],
['melody_heavy_metal',83,'thick wild mane','dark silver','fair','powerful, relentless'],
['melody_heavy_metal',84,'thick wild mane','blood red highlights','fair','powerful, relentless'],
['melody_heavy_metal',85,'mid-headbang hair in motion','dark silver','olive','brutal, epic'],
// ── MELODY FUNK ──
['melody_funk',86,'voluminous natural afro','warm dark brown','deep brown','groovy, smooth'],
['melody_funk',87,'thick protective braids','rich brown with copper highlights','warm mahogany','groovy, smooth'],
['melody_funk',88,'thick protective braids','rich brown with copper highlights','deep brown','groovy, smooth'],
['melody_funk',89,'voluminous natural afro','rich brown with copper highlights','deep brown','bouncy, playful'],
['melody_funk',90,'voluminous natural afro','rich brown with copper highlights','deep brown','groovy, smooth'],
['melody_funk',91,'thick protective braids','rich brown with copper highlights','warm mahogany','bouncy, playful'],
['melody_funk',92,'big natural puffs','natural black','warm mahogany','warm, deep'],
['melody_funk',93,'thick protective braids','natural black','warm mahogany','groovy, smooth'],
['melody_funk',94,'big natural puffs','natural black','warm mahogany','groovy, smooth'],
['melody_funk',95,'voluminous natural afro','warm dark brown','deep brown','bouncy, playful'],
// ── MELODY BLUES ──
['melody_blues',96,'short practical natural','grey-streaked black','warm brown','deep, mournful'],
['melody_blues',97,'natural simple style','warm dark brown','rich dark','warm, raw'],
['melody_blues',98,'natural simple style','warm dark brown','rich dark','deep, mournful'],
['melody_blues',99,'short practical natural','grey-streaked black','deep ebony','deep, mournful'],
['melody_blues',100,'natural simple style','warm dark brown','warm brown','deep, mournful'],
['melody_blues',101,'short practical natural','grey-streaked black','rich dark','soulful, emotional'],
['melody_blues',102,'pinned back elegant','grey-streaked black','warm brown','deep, mournful'],
['melody_blues',103,'pinned back elegant','grey-streaked black','deep ebony','warm, raw'],
// ── MELODY JAZZ ──
['melody_jazz',104,'elegant vintage updo','glossy jet black','olive','sophisticated, smooth'],
['melody_jazz',105,'sleek sophisticated bob','glossy jet black','olive','sophisticated, smooth'],
['melody_jazz',106,'elegant vintage updo','deep dark brown','warm caramel','sophisticated, smooth'],
['melody_jazz',107,'structured natural','glossy jet black','warm brown','complex, nuanced'],
['melody_jazz',108,'sleek sophisticated bob','glossy jet black','olive','sophisticated, smooth'],
// ── MELODY PSYCHEDELIC ──
['melody_psychedelic',109,'flowing decorated with gems and flowers','cosmic silver','pale ethereal','trippy, cosmic'],
['melody_psychedelic',110,'flowing decorated with gems and flowers','iridescent rainbow','pale ethereal','ethereal, otherworldly'],
// ── MELODY PROG ROCK ──
['melody_prog_rock',111,'architectural precision cut','dark auburn','olive','cerebral, layered'],
// ── VOCALS ROCK ──
['vocals_rock',1,'wild dramatic rock hair','dark auburn red','pale','energy, rebellion'],
['vocals_rock',2,'voluminous tousled mane','platinum blonde','olive','energy, rebellion'],
['vocals_rock',3,'wild dramatic rock hair','deep burgundy','pale','energy, rebellion'],
['vocals_rock',4,'voluminous tousled mane','jet black','tan','energy, rebellion'],
['vocals_rock',5,'wild dramatic rock hair','platinum blonde','olive','passion, power'],
['vocals_rock',6,'wild dramatic rock hair','dark auburn red','pale','energy, rebellion'],
['vocals_rock',7,'voluminous tousled mane','platinum blonde','pale','hope, defiance'],
['vocals_rock',8,'wild dramatic rock hair','dark auburn red','pale','passion, power'],
['vocals_rock',9,'wild dramatic rock hair','deep burgundy','tan','passion, power'],
['vocals_rock',10,'wild dramatic rock hair','dark auburn red','pale','energy, rebellion'],
['vocals_rock',11,'voluminous tousled mane','platinum blonde','olive','energy, rebellion'],
['vocals_rock',12,'wild dramatic rock hair','deep burgundy','pale','passion, power'],
['vocals_rock',13,'voluminous tousled mane','jet black','tan','hope, defiance'],
['vocals_rock',14,'wild dramatic rock hair','platinum blonde','olive','passion, power'],
['vocals_rock',15,'wild dramatic rock hair','dark auburn red','pale','hope, defiance'],
['vocals_rock',16,'voluminous tousled mane','platinum blonde','pale','passion, power'],
['vocals_rock',17,'wild dramatic rock hair','dark auburn red','pale','energy, rebellion'],
['vocals_rock',18,'wild dramatic rock hair','deep burgundy','tan','hope, defiance'],
['vocals_rock',19,'voluminous tousled mane','deep burgundy','pale','energy, rebellion'],
['vocals_rock',20,'voluminous tousled mane','platinum blonde','olive','hope, defiance'],
['vocals_rock',21,'wild dramatic rock hair','deep burgundy','pale','passion, power'],
['vocals_rock',22,'voluminous tousled mane','jet black','tan','hope, defiance'],
['vocals_rock',23,'wild dramatic rock hair','platinum blonde','olive','energy, rebellion'],
['vocals_rock',24,'wild dramatic rock hair','dark auburn red','pale','passion, power'],
['vocals_rock',25,'voluminous tousled mane','platinum blonde','pale','passion, power'],
['vocals_rock',26,'wild dramatic rock hair','dark auburn red','pale','energy, rebellion'],
['vocals_rock',27,'wild dramatic rock hair','deep burgundy','tan','passion, power'],
['vocals_rock',28,'voluminous tousled mane','deep burgundy','pale','energy, rebellion'],
['vocals_rock',29,'wild dramatic rock hair','deep burgundy','olive','energy, rebellion'],
['vocals_rock',30,'wild dramatic rock hair','deep burgundy','pale','hope, defiance'],
// ── VOCALS PUNK ──
['vocals_punk',31,'half-shaved','hot pink','fair','anger, defiance'],
['vocals_punk',32,'mohawk','acid green','pale','urgency, frustration'],
['vocals_punk',33,'mohawk','neon orange','pale','anger, defiance'],
['vocals_punk',34,'shaved with colorful top','acid green','pale','rage, rebellion'],
['vocals_punk',35,'shaved with colorful top','hot pink','fair','urgency, frustration'],
['vocals_punk',36,'liberty spikes','electric blue','fair','anger, defiance'],
['vocals_punk',37,'half-shaved','neon orange','pale','urgency, frustration'],
['vocals_punk',38,'liberty spikes','electric blue','fair','urgency, frustration'],
['vocals_punk',39,'liberty spikes','electric blue','fair','urgency, frustration'],
['vocals_punk',40,'half-shaved','hot pink','fair','urgency, frustration'],
['vocals_punk',41,'mohawk','acid green','pale','urgency, frustration'],
['vocals_punk',42,'mohawk','neon orange','pale','rage, rebellion'],
['vocals_punk',43,'shaved with colorful top','acid green','pale','anger, defiance'],
['vocals_punk',44,'shaved with colorful top','hot pink','fair','anger, defiance'],
['vocals_punk',45,'liberty spikes','electric blue','fair','anger, defiance'],
['vocals_punk',46,'half-shaved','neon orange','pale','urgency, frustration'],
['vocals_punk',47,'liberty spikes','electric blue','fair','anger, defiance'],
['vocals_punk',48,'liberty spikes','electric blue','fair','urgency, frustration'],
['vocals_punk',49,'shaved with colorful top','neon orange','pale','anger, defiance'],
['vocals_punk',50,'mohawk','acid green','pale','rage, rebellion'],
['vocals_punk',51,'mohawk','neon orange','pale','anger, defiance'],
['vocals_punk',52,'shaved with colorful top','acid green','pale','anger, defiance'],
// ── VOCALS GRUNGE ──
['vocals_grunge',53,'tangled waves over face','washed out black','fair sallow','despair, apathy'],
['vocals_grunge',54,'long messy unwashed hair','washed out black','pale','despair, apathy'],
['vocals_grunge',55,'tangled waves over face','washed out black','fair sallow','despair, apathy'],
['vocals_grunge',56,'tangled waves over face','faded brown','fair sallow','isolation, angst'],
['vocals_grunge',57,'tangled waves over face','dirty blonde','pale','numbness, frustration'],
['vocals_grunge',58,'tangled waves over face','washed out black','fair sallow','isolation, angst'],
['vocals_grunge',59,'tangled waves over face','washed out black','pale','despair, apathy'],
['vocals_grunge',60,'long messy unwashed hair','faded brown','pale','despair, apathy'],
['vocals_grunge',61,'tangled waves over face','dirty blonde','pale','despair, apathy'],
['vocals_grunge',62,'tangled waves over face','washed out black','fair sallow','numbness, frustration'],
['vocals_grunge',63,'long messy unwashed hair','washed out black','pale','numbness, frustration'],
['vocals_grunge',64,'tangled waves over face','washed out black','fair sallow','numbness, frustration'],
['vocals_grunge',65,'tangled waves over face','faded brown','fair sallow','despair, apathy'],
['vocals_grunge',66,'tangled waves over face','dirty blonde','pale','despair, apathy'],
['vocals_grunge',67,'tangled waves over face','washed out black','fair sallow','despair, apathy'],
['vocals_grunge',68,'tangled waves over face','washed out black','pale','despair, apathy'],
['vocals_grunge',69,'tangled waves over face','washed out black','fair sallow','isolation, angst'],
['vocals_grunge',70,'tangled waves over face','dirty blonde','pale','numbness, frustration'],
// ── VOCALS HEAVY METAL ──
['vocals_heavy_metal',71,'epic mane mid-motion','blood red','olive','fury, defiance'],
['vocals_heavy_metal',72,'epic mane mid-motion','blood red','olive','fury, defiance'],
['vocals_heavy_metal',73,'epic mane mid-motion','dark silver grey','pale','fury, defiance'],
['vocals_heavy_metal',74,'epic mane mid-motion','dark silver grey','fair','fury, defiance'],
['vocals_heavy_metal',75,'long dramatic flowing hair','dark silver grey','fair','rage, power'],
['vocals_heavy_metal',76,'epic mane mid-motion','blood red','fair','fury, defiance'],
['vocals_heavy_metal',77,'epic mane mid-motion','blood red','olive','fury, defiance'],
['vocals_heavy_metal',78,'epic mane mid-motion','dark silver grey','olive','epic, conquest'],
['vocals_heavy_metal',79,'epic mane mid-motion','dark silver grey','fair','epic, conquest'],
['vocals_heavy_metal',80,'epic mane mid-motion','blood red','olive','rage, power'],
['vocals_heavy_metal',81,'epic mane mid-motion','blood red','olive','epic, conquest'],
['vocals_heavy_metal',82,'epic mane mid-motion','dark silver grey','pale','epic, conquest'],
['vocals_heavy_metal',83,'epic mane mid-motion','dark silver grey','fair','rage, power'],
['vocals_heavy_metal',84,'long dramatic flowing hair','dark silver grey','fair','rage, power'],
['vocals_heavy_metal',85,'epic mane mid-motion','blood red','fair','epic, conquest'],
// ── VOCALS FUNK ──
['vocals_funk',86,'voluminous braids','natural black','warm mahogany','joy, confidence'],
['vocals_funk',87,'gorgeous natural puffs','natural black','warm mahogany','celebration, sensuality'],
['vocals_funk',88,'big natural afro','warm dark brown','deep brown','joy, confidence'],
['vocals_funk',89,'voluminous braids','rich brown gold','warm mahogany','joy, confidence'],
['vocals_funk',90,'big natural afro','natural black','warm mahogany','playfulness, soul'],
['vocals_funk',91,'gorgeous natural puffs','rich brown gold','rich dark','joy, confidence'],
['vocals_funk',92,'big natural afro','rich brown gold','deep brown','joy, confidence'],
['vocals_funk',93,'voluminous braids','rich brown gold','rich dark','playfulness, soul'],
['vocals_funk',94,'gorgeous natural puffs','natural black','warm mahogany','joy, confidence'],
['vocals_funk',95,'voluminous braids','natural black','warm mahogany','playfulness, soul'],
// ── VOCALS BLUES ──
['vocals_blues',96,'vintage elegant finger waves','salt and pepper','deep ebony','pain, resilience'],
['vocals_blues',97,'classic pinned style','warm dark brown','deep ebony','pain, resilience'],
['vocals_blues',98,'classic pinned style','warm dark brown','warm brown','pain, resilience'],
['vocals_blues',99,'vintage elegant finger waves','salt and pepper','rich dark','loss, hope'],
['vocals_blues',100,'natural simple','natural black','rich dark','sorrow, longing'],
['vocals_blues',101,'vintage elegant finger waves','salt and pepper','rich dark','pain, resilience'],
['vocals_blues',102,'vintage elegant finger waves','salt and pepper','warm brown','sorrow, longing'],
['vocals_blues',103,'classic pinned style','warm dark brown','rich dark','loss, hope'],
// ── VOCALS JAZZ ──
['vocals_jazz',104,'classic finger waves','deep warm brown','warm caramel','nostalgia, desire'],
['vocals_jazz',105,'sleek vintage updo','deep warm brown','warm caramel','melancholy, beauty'],
['vocals_jazz',106,'sleek vintage updo','glossy jet black','olive','longing, sophistication'],
['vocals_jazz',107,'classic finger waves','glossy jet black','olive','longing, sophistication'],
['vocals_jazz',108,'sleek vintage updo','deep warm brown','warm caramel','longing, sophistication'],
// ── VOCALS PSYCHEDELIC ──
['vocals_psychedelic',109,'adorned with flowers and crystals','cosmic silver blue','luminous otherworldly','wonder, transcendence'],
['vocals_psychedelic',110,'enormous flowing cosmic hair','cosmic silver blue','pale ethereal','cosmic, dissolution'],
// ── VOCALS PROG ROCK ──
['vocals_prog_rock',111,'dramatic theatrical style','deep auburn','olive','awe, complexity'],
]

// Index characters by id for fast lookup of true instrument
const charById = Object.fromEntries(CHARACTERS.map(c => [c.id, c]))

const results = CHARS.map(([archKey, num, hair, color, skin, mod]) => {
  const numStr = String(num).padStart(3, '0')
  const id = `${archKey}_${numStr}`
  const builder = T[archKey]
  if (!builder) { console.error('Missing template for', archKey); process.exit(1) }

  // Pull true instrument from characters.json
  const ch = charById[id]
  if (!ch) { console.error('Character not found in characters.json:', id); process.exit(1) }
  const instKey = ch.public_metadata.kit_type || ch.public_metadata.instrument || ch.public_metadata.vocal_style
  const inst = INST[instKey]
  if (!inst) { console.error('No INST mapping for', instKey, 'on', id); process.exit(1) }

  const body = builder({ hair, color, skin, mod })
  const positive_prompt = `${body}, ${inst.item}, ${inst.pose}, ${SUF}`

  return {
    id,
    positive_prompt,
    negative_prompt: NEG,
    archetype: ARCHETYPES[archKey] || archKey,
    instrument: instKey, // for transparency
  }
})

const out = path.join(__dirname, '..', 'public', 'art_prompts.json')
fs.writeFileSync(out, JSON.stringify(results, null, 2), 'utf8')
console.log(`✓ Generated ${results.length} prompts → ${out}`)

// Print a summary of instruments per archetype
const byArch = {}
results.forEach(r => {
  byArch[r.archetype] = byArch[r.archetype] || {}
  byArch[r.archetype][r.instrument] = (byArch[r.archetype][r.instrument] || 0) + 1
})
console.log('\nInstrument distribution:')
Object.entries(byArch).forEach(([arch, insts]) => {
  console.log(`  ${arch}:`)
  Object.entries(insts).forEach(([i, n]) => console.log(`    ${i}: ${n}`))
})
