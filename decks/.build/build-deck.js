/**
 * Imverica investor pitch deck — builds /Users/Apple/Documents/Imverica website/decks/imverica-pitch.pptx
 *
 * Run: node build-deck.js
 *
 * Palette (from imverica.com brand):
 *   navy       #1A2E4A   primary, dark slides + headers
 *   navyDeep   #0F1C2F   navy hover / closing
 *   terracotta #C87A5C   accent, big numbers, callouts
 *   sage       #8A9A85   secondary accent
 *   gold       #C9A96E   subtle highlight (taglines)
 *   cream      #F8F5EF   content-slide background
 *   ink        #1A2238   body text
 *   muted      #6B7280   captions
 *   line       #D9D2C5   subtle dividers on cream
 */

const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const {
  FaScaleBalanced, FaGlobe, FaRobot, FaShieldHalved, FaFileLines, FaUsers,
  FaMicrochip, FaArrowTrendUp, FaBuildingColumns, FaHandshakeAngle,
  FaMessage, FaLanguage, FaCircleCheck, FaCircleXmark, FaTriangleExclamation,
  FaSackDollar, FaHourglassHalf, FaCloudArrowUp, FaLock
} = require('react-icons/fa6');

// ─── Palette ────────────────────────────────────────────────────────
const C = {
  navy:       '1A2E4A',
  navyDeep:   '0F1C2F',
  terracotta: 'C87A5C',
  terraDeep:  'B0644A',
  sage:       '8A9A85',
  gold:       'C9A96E',
  cream:      'F8F5EF',
  white:      'FFFFFF',
  ink:        '1A2238',
  muted:      '6B7280',
  line:       'D9D2C5'
};

// Font fallbacks — Playfair Display / Inter aren't in PowerPoint by default.
// Use widely-installed serif + sans pair that gives the same feel.
const FONT_DISPLAY = 'Georgia';            // Playfair-like serif
const FONT_BODY    = 'Helvetica Neue';     // Inter-like sans
const FONT_MONO    = 'Menlo';

// ─── Icon rasterizer ────────────────────────────────────────────────
async function iconPng(IconComponent, color = '#FFFFFF', size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

// ─── Slide helpers ──────────────────────────────────────────────────
// LAYOUT_WIDE: 13.333" × 7.5" — wider canvas reads more "deck" than 16:9.
function pres() {
  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE';
  p.author = 'Imverica Legal Solutions';
  p.company = 'Imverica LLC';
  p.title = 'Imverica — Investor Pitch';
  p.subject = 'Tech-enabled multilingual legal document services';
  return p;
}

// Numbered circular badge used as a visual motif across all content slides.
function addBadge(slide, num, x = 0.6, y = 0.55, color = C.terracotta) {
  slide.addShape('ellipse', {
    x, y, w: 0.55, h: 0.55, fill: { color }, line: { type: 'none' }
  });
  slide.addText(num, {
    x, y, w: 0.55, h: 0.55,
    fontSize: 20, bold: true, color: C.white,
    fontFace: FONT_DISPLAY, align: 'center', valign: 'middle', margin: 0
  });
}

// Page-number tag, lower-right of every content slide.
function addFooterPage(slide, n, total) {
  slide.addText(`${n} / ${total}`, {
    x: 12.3, y: 7.1, w: 0.8, h: 0.3,
    fontSize: 9, color: C.muted, fontFace: FONT_BODY,
    align: 'right', valign: 'middle', charSpacing: 2
  });
  slide.addText('IMVERICA', {
    x: 0.6, y: 7.1, w: 2, h: 0.3,
    fontSize: 9, color: C.muted, fontFace: FONT_BODY,
    bold: true, charSpacing: 6
  });
}

function setCream(slide) { slide.background = { color: C.cream }; }
function setNavy(slide)  { slide.background = { color: C.navy }; }

// Big stat block helper — used on Market + Problem slides.
function bigStat(slide, x, y, w, valueText, label, valueColor = C.terracotta) {
  slide.addText(valueText, {
    x, y, w, h: 1.4,
    fontSize: 64, bold: true, color: valueColor,
    fontFace: FONT_DISPLAY, align: 'left', valign: 'top', margin: 0
  });
  slide.addText(label, {
    x, y: y + 1.45, w, h: 0.6,
    fontSize: 12, color: C.ink, fontFace: FONT_BODY,
    align: 'left', valign: 'top', margin: 0
  });
}

// ─── Build ──────────────────────────────────────────────────────────
async function build() {
  const p = pres();
  const TOTAL = 12;

  // Pre-rasterize icons we'll reuse
  const icons = {
    scale_white:   await iconPng(FaScaleBalanced, '#FFFFFF', 384),
    scale_terra:   await iconPng(FaScaleBalanced, '#C87A5C', 384),
    globe_navy:    await iconPng(FaGlobe, '#1A2E4A', 384),
    robot_navy:    await iconPng(FaRobot, '#1A2E4A', 384),
    file_navy:     await iconPng(FaFileLines, '#1A2E4A', 384),
    shield_navy:   await iconPng(FaShieldHalved, '#1A2E4A', 384),
    users_navy:    await iconPng(FaUsers, '#1A2E4A', 384),
    chip_terra:    await iconPng(FaMicrochip, '#C87A5C', 384),
    trend_terra:   await iconPng(FaArrowTrendUp, '#C87A5C', 384),
    bank_terra:    await iconPng(FaBuildingColumns, '#C87A5C', 384),
    hands_white:   await iconPng(FaHandshakeAngle, '#FFFFFF', 384),
    msg_sage:      await iconPng(FaMessage, '#8A9A85', 384),
    lang_sage:     await iconPng(FaLanguage, '#8A9A85', 384),
    check_sage:    await iconPng(FaCircleCheck, '#8A9A85', 384),
    cross_terra:   await iconPng(FaCircleXmark, '#C87A5C', 384),
    warn_gold:     await iconPng(FaTriangleExclamation, '#C9A96E', 384),
    money_gold:    await iconPng(FaSackDollar, '#C9A96E', 384),
    hour_terra:    await iconPng(FaHourglassHalf, '#C87A5C', 384),
    cloud_navy:    await iconPng(FaCloudArrowUp, '#1A2E4A', 384),
    lock_navy:     await iconPng(FaLock, '#1A2E4A', 384),
  };

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 1 — Title
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide();
    setNavy(s);

    // Vertical sage stripe on left edge as visual motif
    s.addShape('rect', { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: C.sage }, line: { type: 'none' } });

    // Scale icon top-right
    s.addImage({ data: icons.scale_white, x: 11.6, y: 0.7, w: 1.1, h: 1.1 });

    // Eyebrow
    s.addText('CALIFORNIA LDA · IMMIGRATION CONSULTANT', {
      x: 1.0, y: 1.8, w: 10, h: 0.4,
      fontSize: 12, color: C.gold, fontFace: FONT_BODY,
      bold: true, charSpacing: 8
    });

    // Wordmark
    s.addText('Imverica', {
      x: 1.0, y: 2.3, w: 11, h: 1.8,
      fontSize: 96, bold: true, color: C.white,
      fontFace: FONT_DISPLAY, italic: false, margin: 0
    });

    // Tagline (rich text — gold accent on "tech-enabled")
    s.addText([
      { text: 'Legal paperwork, ', options: { color: C.white } },
      { text: 'tech-enabled', options: { color: C.gold, bold: true } },
      { text: '.', options: { color: C.white } }
    ], {
      x: 1.0, y: 4.0, w: 11, h: 0.8,
      fontSize: 28, fontFace: FONT_DISPLAY, italic: true, margin: 0
    });

    // Sub-tagline
    s.addText('Multilingual document preparation + supervising attorneys — for the immigrant communities of Northern California.', {
      x: 1.0, y: 4.9, w: 10.5, h: 0.55,
      fontSize: 14, color: 'D9D2C5', fontFace: FONT_BODY,
      italic: false, margin: 0
    });

    // Credibility line — operator's track record
    s.addText([
      { text: 'Built by an operator with ', options: { color: 'D9D2C5' } },
      { text: '11+ years', options: { color: C.gold, bold: true } },
      { text: ' of USCIS petition experience, trained under a licensed immigration attorney.', options: { color: 'D9D2C5' } }
    ], {
      x: 1.0, y: 5.5, w: 11.0, h: 0.5,
      fontSize: 13, fontFace: FONT_BODY, italic: true, margin: 0
    });

    // Contact line at bottom
    s.addText('imverica.com   ·   +1 (916) 399-3992   ·   Sacramento, CA', {
      x: 1.0, y: 6.7, w: 11, h: 0.4,
      fontSize: 11, color: C.gold, fontFace: FONT_BODY,
      charSpacing: 4
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 2 — Problem
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide(); setCream(s);
    addBadge(s, '01');

    s.addText('The problem', {
      x: 1.3, y: 0.5, w: 8, h: 0.7,
      fontSize: 36, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('Immigration paperwork breaks people — financially, legally, linguistically.', {
      x: 0.6, y: 1.4, w: 10, h: 0.5,
      fontSize: 14, color: C.muted, fontFace: FONT_BODY, italic: true, margin: 0
    });

    // Three stat columns
    bigStat(s, 0.6,  2.4, 4.0, '$5,000+',  'Average attorney retainer for a single USCIS petition. Out of reach for most immigrants.');
    bigStat(s, 4.8,  2.4, 4.0, '40%',      'Of pro se USCIS filings are denied or RFE’d for preventable form errors.', C.navy);
    bigStat(s, 9.0,  2.4, 4.0, '4',        'Languages spoken across Northern California immigrant communities — most legal tools serve one.', C.sage);

    // Bottom band — short narrative
    s.addShape('rect', {
      x: 0.6, y: 5.4, w: 12.1, h: 1.4,
      fill: { color: C.white }, line: { color: C.line, width: 1 }
    });
    s.addImage({ data: icons.warn_gold, x: 0.9, y: 5.7, w: 0.7, h: 0.7 });
    s.addText('The gap is real.', {
      x: 1.8, y: 5.55, w: 11, h: 0.45,
      fontSize: 16, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('DIY filing software is cheap but lonely — it speaks one language and abandons you at the hard parts. Attorneys are thorough but priced for a different decade. Between them, millions of qualified applicants stall out — or never start.', {
      x: 1.8, y: 6.0, w: 10.8, h: 0.85,
      fontSize: 11.5, color: C.ink, fontFace: FONT_BODY, margin: 0
    });

    addFooterPage(s, 2, TOTAL);
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 3 — Solution
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide(); setCream(s);
    addBadge(s, '02');

    s.addText('The solution', {
      x: 1.3, y: 0.5, w: 8, h: 0.7,
      fontSize: 36, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('A licensed Legal Document Assistant, an AI-assisted intake, four languages — and supervising attorneys when the case calls for one.', {
      x: 0.6, y: 1.4, w: 12, h: 0.85,
      fontSize: 15, color: C.muted, fontFace: FONT_BODY, italic: true, margin: 0
    });

    // Headline statement — large
    s.addText([
      { text: 'A bridge between ', options: { color: C.ink } },
      { text: '$50 software', options: { color: C.terracotta, bold: true } },
      { text: ' and ', options: { color: C.ink } },
      { text: '$5,000 attorneys', options: { color: C.navy, bold: true } },
      { text: '.', options: { color: C.ink } }
    ], {
      x: 0.6, y: 2.6, w: 12.1, h: 1.2,
      fontSize: 36, fontFace: FONT_DISPLAY, margin: 0
    });

    // Three pillars
    const pillars = [
      { icon: icons.lang_sage,  title: 'Multilingual',     body: 'English · Русский · Українська · Español. Every form, every channel, in the client’s language.' },
      { icon: icons.robot_navy, title: 'AI-assisted',      body: 'Claude Opus 4.7 with 30K-token cached catalog. Faster intake, fewer dropped applications.' },
      { icon: icons.scale_terra, title: 'Human-supervised', body: 'Founder trained under a licensed immigration attorney. 11+ years filing USCIS petitions. Supervising attorneys on call.' }
    ];
    pillars.forEach((p, i) => {
      const x = 0.6 + i * 4.2;
      s.addShape('rect', { x, y: 4.3, w: 4.0, h: 2.4, fill: { color: C.white }, line: { color: C.line, width: 1 } });
      s.addImage({ data: p.icon, x: x + 0.3, y: 4.55, w: 0.55, h: 0.55 });
      s.addText(p.title, {
        x: x + 1.0, y: 4.55, w: 2.9, h: 0.45,
        fontSize: 16, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
      });
      s.addText(p.body, {
        x: x + 0.3, y: 5.2, w: 3.5, h: 1.4,
        fontSize: 11.5, color: C.ink, fontFace: FONT_BODY, valign: 'top', margin: 0
      });
    });

    addFooterPage(s, 3, TOTAL);
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 4 — Product
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide(); setCream(s);
    addBadge(s, '03');

    s.addText('The product', {
      x: 1.3, y: 0.5, w: 8, h: 0.7,
      fontSize: 36, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('A full intake-to-filing platform — already live at imverica.com.', {
      x: 0.6, y: 1.4, w: 12, h: 0.5,
      fontSize: 14, color: C.muted, fontFace: FONT_BODY, italic: true, margin: 0
    });

    const features = [
      { icon: icons.robot_navy,  title: 'AI Intake & Chat',     body: 'Claude Opus 4.7 with prompt caching. Refuses UPL, escalates legal questions to attorneys.', x: 0.6, y: 2.3 },
      { icon: icons.msg_sage,    title: 'Telegram Bot',          body: '4-language conversational intake. Meets clients where they already are.', x: 6.95, y: 2.3 },
      { icon: icons.file_navy,   title: 'USCIS Form Automation', body: 'I-485 + 30 forms with schema-driven rendering. Pre-fills 80% of fields from one intake.', x: 0.6, y: 4.55 },
      { icon: icons.shield_navy, title: 'Encrypted Portal',      body: 'AES-256 client messaging + per-client Google Drive folders. Gmail-reply bridge for staff.', x: 6.95, y: 4.55 }
    ];
    features.forEach((f) => {
      s.addShape('rect', { x: f.x, y: f.y, w: 6.05, h: 2.05, fill: { color: C.white }, line: { color: C.line, width: 1 } });
      s.addImage({ data: f.icon, x: f.x + 0.35, y: f.y + 0.35, w: 0.7, h: 0.7 });
      s.addText(f.title, {
        x: f.x + 1.3, y: f.y + 0.3, w: 4.5, h: 0.5,
        fontSize: 18, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
      });
      s.addText(f.body, {
        x: f.x + 1.3, y: f.y + 0.85, w: 4.6, h: 1.1,
        fontSize: 11.5, color: C.ink, fontFace: FONT_BODY, valign: 'top', margin: 0
      });
    });

    addFooterPage(s, 4, TOTAL);
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 5 — Market
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide(); setCream(s);
    addBadge(s, '04');

    s.addText('The market', {
      x: 1.3, y: 0.5, w: 8, h: 0.7,
      fontSize: 36, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('California: the largest immigrant population in the United States — and the most underserved.', {
      x: 0.6, y: 1.4, w: 12, h: 0.5,
      fontSize: 14, color: C.muted, fontFace: FONT_BODY, italic: true, margin: 0
    });

    bigStat(s, 0.6,  2.4, 4.0, '11M',  'California immigrants — 27% of the state’s population.', C.navy);
    bigStat(s, 4.8,  2.4, 4.0, '8M',   'USCIS applications filed nationwide every year.', C.terracotta);
    bigStat(s, 9.0,  2.4, 4.0, '$1.4B', 'Annual addressable market for LDA-style document services in CA.', C.sage);

    // Native bar chart — applications by category
    s.addChart('bar', [{
      name: 'Filings',
      labels: ['Family-based\npetitions', 'Naturalization', 'Asylum / Refugee', 'Adjustment of\nstatus', 'EOIR\nimmigration court'],
      values: [770, 980, 240, 700, 350]
    }], {
      x: 0.6, y: 4.7, w: 12.1, h: 2.2,
      barDir: 'col',
      chartColors: [C.terracotta],
      catAxisLabelColor: C.ink, catAxisLabelFontFace: FONT_BODY, catAxisLabelFontSize: 9,
      valAxisLabelColor: C.muted, valAxisLabelFontFace: FONT_BODY, valAxisLabelFontSize: 9,
      valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: 'none' },
      showValue: true, dataLabelPosition: 'outEnd',
      dataLabelColor: C.ink, dataLabelFontFace: FONT_BODY, dataLabelFontSize: 9,
      showLegend: false,
      showTitle: true, title: 'USCIS + EOIR — annual filings, thousands (USCIS FY data)',
      titleColor: C.muted, titleFontFace: FONT_BODY, titleFontSize: 10
    });

    addFooterPage(s, 5, TOTAL);
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 6 — Business model
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide(); setCream(s);
    addBadge(s, '05');

    s.addText('Business model', {
      x: 1.3, y: 0.5, w: 10, h: 0.7,
      fontSize: 36, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('Fixed-price packages. Transparent. Repeat-client compounding.', {
      x: 0.6, y: 1.4, w: 12, h: 0.5,
      fontSize: 14, color: C.muted, fontFace: FONT_BODY, italic: true, margin: 0
    });

    // 4 pricing tiers as vertical cards
    const tiers = [
      { name: 'Translations',     price: '$45',     unit: '/ page',     color: C.sage,       items: ['USCIS-certified translation', 'Certificate of accuracy', '48-hour turnaround'] },
      { name: 'CA Court forms',   price: '$295',    unit: '/ matter',   color: C.gold,       items: ['Divorce, custody, eviction', 'E-filing assistance', 'Hearing-date tracking'] },
      { name: 'USCIS petition',   price: '$895',    unit: '/ filing',   color: C.terracotta, items: ['I-130 / I-485 / N-400', 'Document prep & QA', 'RFE response support'] },
      { name: 'Complex case',     price: '$1,495',  unit: '/ filing',   color: C.navy,       items: ['Asylum / VAWA / U-visa', 'Attorney supervision', 'Hearing prep'] }
    ];
    tiers.forEach((t, i) => {
      const x = 0.6 + i * 3.1;
      const cardW = 2.85, cardH = 4.0;
      s.addShape('rect', { x, y: 2.4, w: cardW, h: cardH, fill: { color: C.white }, line: { color: C.line, width: 1 } });
      // Top color band as label (full-width INSIDE the card, not a free-floating bar)
      s.addShape('rect', { x, y: 2.4, w: cardW, h: 0.45, fill: { color: t.color }, line: { type: 'none' } });
      s.addText(t.name, {
        x: x + 0.2, y: 2.4, w: cardW - 0.4, h: 0.45,
        fontSize: 12, bold: true, color: C.white, fontFace: FONT_BODY,
        valign: 'middle', margin: 0, charSpacing: 4
      });
      // Price
      s.addText(t.price, {
        x: x + 0.2, y: 3.05, w: cardW - 0.4, h: 0.9,
        fontSize: 40, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
      });
      s.addText(t.unit, {
        x: x + 0.2, y: 3.95, w: cardW - 0.4, h: 0.35,
        fontSize: 11, color: C.muted, fontFace: FONT_BODY, margin: 0
      });
      // Items
      const itemRuns = t.items.map((it, idx) => ({
        text: it,
        options: { bullet: { code: '25CF' }, breakLine: idx < t.items.length - 1 }
      }));
      s.addText(itemRuns, {
        x: x + 0.2, y: 4.45, w: cardW - 0.4, h: 1.85,
        fontSize: 10.5, color: C.ink, fontFace: FONT_BODY,
        valign: 'top', paraSpaceAfter: 4, margin: 0
      });
    });

    // Unit economics strip below
    s.addShape('rect', { x: 0.6, y: 6.55, w: 12.1, h: 0.65, fill: { color: C.navy }, line: { type: 'none' } });
    s.addText([
      { text: '70% gross margin', options: { color: C.gold, bold: true } },
      { text: '   ·   ', options: { color: 'D9D2C5' } },
      { text: 'tech-enabled fulfillment', options: { color: C.white } },
      { text: '   ·   ', options: { color: 'D9D2C5' } },
      { text: 'repeat-client compounding through families', options: { color: C.white } }
    ], {
      x: 0.6, y: 6.55, w: 12.1, h: 0.65,
      fontSize: 12, fontFace: FONT_BODY, align: 'center', valign: 'middle', margin: 0
    });

    addFooterPage(s, 6, TOTAL);
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 7 — Traction
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide(); setCream(s);
    addBadge(s, '06');

    s.addText('Built & live', {
      x: 1.3, y: 0.5, w: 8, h: 0.7,
      fontSize: 36, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('We didn’t pitch this — we shipped it.', {
      x: 0.6, y: 1.4, w: 12, h: 0.5,
      fontSize: 14, color: C.muted, fontFace: FONT_BODY, italic: true, margin: 0
    });

    // 4 milestone cards in a row
    const wins = [
      { stat: '229',   label: 'live pages',          sub: 'across 4 languages on imverica.com' },
      { stat: '30+',   label: 'USCIS forms',         sub: 'mapped + schema-driven rendering' },
      { stat: '4',     label: 'channel intake',       sub: 'web · Telegram · WhatsApp-ready · email' },
      { stat: '<60s',  label: 'time-to-first-quote', sub: 'AI-assisted intake → priced + scheduled' }
    ];
    wins.forEach((w, i) => {
      const x = 0.6 + i * 3.1;
      s.addShape('rect', { x, y: 2.3, w: 2.85, h: 2.0, fill: { color: C.navy }, line: { type: 'none' } });
      s.addText(w.stat, {
        x: x + 0.2, y: 2.4, w: 2.6, h: 1.0,
        fontSize: 56, bold: true, color: C.gold, fontFace: FONT_DISPLAY, margin: 0
      });
      s.addText(w.label, {
        x: x + 0.2, y: 3.4, w: 2.6, h: 0.35,
        fontSize: 12, bold: true, color: C.white, fontFace: FONT_BODY, margin: 0, charSpacing: 2
      });
      s.addText(w.sub, {
        x: x + 0.2, y: 3.8, w: 2.6, h: 0.4,
        fontSize: 10, color: 'D9D2C5', fontFace: FONT_BODY, margin: 0
      });
    });

    // What's shipping next — checklist
    const ships = [
      'Per-client Google Drive folders — live',
      'Encrypted client portal + Gmail-reply bridge — live',
      'Multilingual Telegram bot — live',
      'Stripe pricing tiers — wired',
      'iOS / Android app shells — in review'
    ];
    s.addShape('rect', { x: 0.6, y: 4.6, w: 12.1, h: 2.3, fill: { color: C.white }, line: { color: C.line, width: 1 } });
    s.addText('What’s already shipped', {
      x: 0.85, y: 4.75, w: 11.5, h: 0.4,
      fontSize: 14, bold: true, color: C.ink, fontFace: FONT_DISPLAY,
      charSpacing: 2, margin: 0
    });
    ships.forEach((line, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.85 + col * 6.0;
      const y = 5.2 + row * 0.5;
      s.addImage({ data: icons.check_sage, x, y: y + 0.05, w: 0.3, h: 0.3 });
      s.addText(line, {
        x: x + 0.4, y, w: 5.5, h: 0.4,
        fontSize: 11.5, color: C.ink, fontFace: FONT_BODY, valign: 'middle', margin: 0
      });
    });

    addFooterPage(s, 7, TOTAL);
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 8 — Tech moat
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide(); setCream(s);
    addBadge(s, '07');

    s.addText('Tech moat', {
      x: 1.3, y: 0.5, w: 8, h: 0.7,
      fontSize: 36, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('What we built can’t be copy-pasted in a weekend.', {
      x: 0.6, y: 1.4, w: 12, h: 0.5,
      fontSize: 14, color: C.muted, fontFace: FONT_BODY, italic: true, margin: 0
    });

    const moat = [
      { icon: icons.chip_terra, title: '30K-token cached AI catalog',  body: 'Claude Opus 4.7 with explicit cache_control — every conversation reads from a curated, attorney-reviewed knowledge base at ~10% the price of a fresh prompt.' },
      { icon: icons.file_navy, title: 'USCIS schema engine',            body: 'Every required field across 30+ forms encoded as a typed schema. New forms ship in days, not months. The same intake feeds every form.' },
      { icon: icons.lock_navy, title: 'Encrypted client data at rest', body: 'AES-256-GCM per-record encryption with key separation. Client PII never lives in plaintext on disk — survives any blob-store breach.' },
      { icon: icons.cloud_navy, title: 'Per-client Drive isolation',   body: 'Service-account JWT auth → folder per client → folder per order. Documents auto-organized; the operator never sees the bytes.' }
    ];
    moat.forEach((m, i) => {
      const x = 0.6 + (i % 2) * 6.2;
      const y = 2.3 + Math.floor(i / 2) * 2.25;
      s.addShape('rect', { x, y, w: 5.95, h: 2.05, fill: { color: C.white }, line: { color: C.line, width: 1 } });
      // Left accent bar
      s.addShape('rect', { x, y, w: 0.08, h: 2.05, fill: { color: C.terracotta }, line: { type: 'none' } });
      s.addImage({ data: m.icon, x: x + 0.35, y: y + 0.3, w: 0.65, h: 0.65 });
      s.addText(m.title, {
        x: x + 1.2, y: y + 0.25, w: 4.7, h: 0.6,
        fontSize: 15, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
      });
      s.addText(m.body, {
        x: x + 1.2, y: y + 0.85, w: 4.7, h: 1.15,
        fontSize: 10.5, color: C.ink, fontFace: FONT_BODY, valign: 'top', margin: 0
      });
    });

    addFooterPage(s, 8, TOTAL);
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 9 — Competition matrix
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide(); setCream(s);
    addBadge(s, '08');

    s.addText('Competition', {
      x: 1.3, y: 0.5, w: 8, h: 0.7,
      fontSize: 36, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('We sit between the two extremes — and take the best of both.', {
      x: 0.6, y: 1.4, w: 12, h: 0.5,
      fontSize: 14, color: C.muted, fontFace: FONT_BODY, italic: true, margin: 0
    });

    // 3-column comparison
    const cols = [
      { title: 'DIY Software',    sub: 'Boundless, Borderwise', price: '$50–$300',  bg: 'EFEAE0', accent: C.muted,      score: { language:'EN only', humans:'None', advice:'None', forms:'10–20', errors:'High' } },
      { title: 'Imverica',         sub: 'You are here',          price: '$45–$1,495', bg: C.navy,   accent: C.gold,       score: { language:'4 langs', humans:'LDA + atty', advice:'Supervised', forms:'30+',   errors:'Low' }, highlight: true },
      { title: 'Attorney',         sub: 'Solo or firm',          price: '$3K–$15K',  bg: 'EFEAE0', accent: C.muted,      score: { language:'EN/ES',   humans:'Always',     advice:'Full',       forms:'All',    errors:'Lowest' } }
    ];
    cols.forEach((c, i) => {
      const x = 0.6 + i * 4.13;
      const cardW = 4.0, cardH = 4.6;
      s.addShape('rect', { x, y: 2.3, w: cardW, h: cardH, fill: { color: c.bg }, line: { color: C.line, width: 1 } });
      const titleColor = c.highlight ? C.white : C.ink;
      const subColor   = c.highlight ? C.gold : C.muted;
      const bodyColor  = c.highlight ? C.white : C.ink;
      s.addText(c.title, {
        x: x + 0.25, y: 2.45, w: cardW - 0.5, h: 0.55,
        fontSize: 22, bold: true, color: titleColor, fontFace: FONT_DISPLAY, margin: 0
      });
      s.addText(c.sub, {
        x: x + 0.25, y: 3.0, w: cardW - 0.5, h: 0.35,
        fontSize: 10, color: subColor, fontFace: FONT_BODY, italic: true, charSpacing: 2, margin: 0
      });
      s.addText(c.price, {
        x: x + 0.25, y: 3.4, w: cardW - 0.5, h: 0.55,
        fontSize: 18, bold: true, color: c.highlight ? C.gold : C.terracotta, fontFace: FONT_DISPLAY, margin: 0
      });
      // Divider line under price (subtle, not full-width)
      s.addShape('rect', { x: x + 0.25, y: 4.05, w: cardW - 0.5, h: 0.015,
        fill: { color: c.highlight ? '3A4D6E' : C.line }, line: { type: 'none' } });
      // Rows
      const labels = ['Languages', 'Humans', 'Legal advice', 'Forms supported', 'Error rate'];
      const keys = ['language', 'humans', 'advice', 'forms', 'errors'];
      labels.forEach((lab, idx) => {
        const ry = 4.18 + idx * 0.42;
        s.addText(lab, {
          x: x + 0.25, y: ry, w: 1.85, h: 0.35,
          fontSize: 10, color: c.highlight ? 'D9D2C5' : C.muted, fontFace: FONT_BODY,
          valign: 'middle', margin: 0
        });
        s.addText(c.score[keys[idx]], {
          x: x + 2.1, y: ry, w: cardW - 2.35, h: 0.35,
          fontSize: 10.5, bold: true, color: bodyColor, fontFace: FONT_BODY,
          align: 'right', valign: 'middle', margin: 0
        });
      });
    });

    addFooterPage(s, 9, TOTAL);
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 10 — Team
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide(); setCream(s);
    addBadge(s, '09');

    s.addText('Team & supervision', {
      x: 1.3, y: 0.5, w: 10, h: 0.7,
      fontSize: 36, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('Operators close to the community + the legal scaffolding to back them.', {
      x: 0.6, y: 1.4, w: 12, h: 0.5,
      fontSize: 14, color: C.muted, fontFace: FONT_BODY, italic: true, margin: 0
    });

    // Founder card (left, large)
    s.addShape('rect', { x: 0.6, y: 2.3, w: 6.0, h: 4.6, fill: { color: C.white }, line: { color: C.line, width: 1 } });
    s.addShape('ellipse', { x: 0.95, y: 2.6, w: 1.4, h: 1.4, fill: { color: C.navy }, line: { type: 'none' } });
    s.addText('FK', {
      x: 0.95, y: 2.6, w: 1.4, h: 1.4,
      fontSize: 36, bold: true, color: C.gold, fontFace: FONT_DISPLAY,
      align: 'center', valign: 'middle', margin: 0
    });
    s.addText('Farruh Kochkarov', {
      x: 2.55, y: 2.65, w: 4.0, h: 0.55,
      fontSize: 22, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('Founder · LDA · Immigration Consultant', {
      x: 2.55, y: 3.2, w: 4.0, h: 0.35,
      fontSize: 11, color: C.terracotta, fontFace: FONT_BODY, italic: true, charSpacing: 2, margin: 0
    });

    // Credential strip — three big numbers stacked
    const creds = [
      { stat: '11+',   label: 'years filing USCIS petitions' },
      { stat: 'Atty',  label: 'trained under a licensed immigration attorney' },
      { stat: 'CA',    label: 'registered LDA + immigration consultant' }
    ];
    creds.forEach((c, i) => {
      const cy = 4.15 + i * 0.85;
      s.addText(c.stat, {
        x: 0.95, y: cy, w: 1.6, h: 0.65,
        fontSize: 26, bold: true, color: C.terracotta, fontFace: FONT_DISPLAY,
        valign: 'middle', margin: 0
      });
      s.addText(c.label, {
        x: 2.55, y: cy, w: 4.0, h: 0.65,
        fontSize: 11, color: C.ink, fontFace: FONT_BODY,
        valign: 'middle', margin: 0
      });
    });

    // Supervising attorneys card (right)
    s.addShape('rect', { x: 6.85, y: 2.3, w: 5.85, h: 4.6, fill: { color: C.navy }, line: { type: 'none' } });
    s.addImage({ data: icons.scale_white, x: 7.2, y: 2.6, w: 0.8, h: 0.8 });
    s.addText('Supervising attorneys', {
      x: 8.2, y: 2.6, w: 4.3, h: 0.55,
      fontSize: 18, bold: true, color: C.white, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('When the case needs a lawyer.', {
      x: 8.2, y: 3.15, w: 4.3, h: 0.35,
      fontSize: 11, color: C.gold, fontFace: FONT_BODY, italic: true, margin: 0
    });
    const aspects = [
      'Cases requiring legal advice escalate from intake to a licensed CA / federal attorney within 24 hours.',
      'Our AI assistant is hard-coded to refuse legal advice and route the question to a human.',
      'Compliance with California Business & Professions Code §6400–6415 (LDA) and §22440 (immigration consultant).'
    ];
    aspects.forEach((a, i) => {
      s.addImage({ data: icons.check_sage, x: 7.2, y: 3.85 + i * 0.95, w: 0.3, h: 0.3 });
      s.addText(a, {
        x: 7.6, y: 3.8 + i * 0.95, w: 4.95, h: 0.85,
        fontSize: 11, color: 'D9D2C5', fontFace: FONT_BODY, valign: 'top', margin: 0
      });
    });

    addFooterPage(s, 10, TOTAL);
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 11 — Roadmap
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide(); setCream(s);
    addBadge(s, '10');

    s.addText('Roadmap', {
      x: 1.3, y: 0.5, w: 8, h: 0.7,
      fontSize: 36, bold: true, color: C.ink, fontFace: FONT_DISPLAY, margin: 0
    });
    s.addText('From shipped MVP to scaled regional operator in 12 months.', {
      x: 0.6, y: 1.4, w: 12, h: 0.5,
      fontSize: 14, color: C.muted, fontFace: FONT_BODY, italic: true, margin: 0
    });

    // Horizontal timeline with 4 stages
    const phases = [
      { quarter: 'NOW',  title: 'Live & accepting clients', body: 'Web + Telegram + AI intake operating. Manual quote / contract / fulfillment flow.', color: C.sage },
      { quarter: 'Q3',   title: 'Mobile apps + WhatsApp',   body: 'iOS / Android app store submission. WhatsApp Business as primary channel for LATAM.', color: C.gold },
      { quarter: 'Q4',   title: 'Stripe + bookings',         body: 'Full self-serve checkout. Calendar-linked attorney consultations. First paid ads.', color: C.terracotta },
      { quarter: 'Q1’26', title: '50 clients / month',         body: 'Operational target. Second LDA hired. Partnerships with Sacramento community orgs.', color: C.navy }
    ];

    // Timeline base line
    s.addShape('rect', { x: 0.85, y: 3.7, w: 11.5, h: 0.04, fill: { color: C.line }, line: { type: 'none' } });

    phases.forEach((ph, i) => {
      const x = 0.6 + i * 3.1;
      const cardW = 2.85;
      // Quarter circle marker on timeline
      s.addShape('ellipse', { x: x + cardW/2 - 0.32, y: 3.4, w: 0.64, h: 0.64, fill: { color: ph.color }, line: { type: 'none' } });
      s.addText(ph.quarter, {
        x: x + cardW/2 - 0.5, y: 3.4, w: 1.0, h: 0.64,
        fontSize: 11, bold: true, color: C.white, fontFace: FONT_BODY,
        align: 'center', valign: 'middle', margin: 0
      });
      // Card below
      s.addShape('rect', { x, y: 4.45, w: cardW, h: 2.45, fill: { color: C.white }, line: { color: C.line, width: 1 } });
      s.addShape('rect', { x, y: 4.45, w: cardW, h: 0.08, fill: { color: ph.color }, line: { type: 'none' } });
      s.addText(ph.title, {
        x: x + 0.2, y: 4.65, w: cardW - 0.4, h: 0.95,
        fontSize: 14, bold: true, color: C.ink, fontFace: FONT_DISPLAY, valign: 'top', margin: 0
      });
      s.addText(ph.body, {
        x: x + 0.2, y: 5.6, w: cardW - 0.4, h: 1.2,
        fontSize: 10.5, color: C.ink, fontFace: FONT_BODY, valign: 'top', margin: 0
      });
    });

    addFooterPage(s, 11, TOTAL);
  }

  // ──────────────────────────────────────────────────────────────────
  // SLIDE 12 — Closing / Ask
  // ──────────────────────────────────────────────────────────────────
  {
    const s = p.addSlide();
    setNavy(s);

    // Sage stripe again (mirror title slide)
    s.addShape('rect', { x: 12.98, y: 0, w: 0.35, h: 7.5, fill: { color: C.sage }, line: { type: 'none' } });

    s.addText('Let’s', {
      x: 1.0, y: 1.6, w: 12, h: 1.5,
      fontSize: 96, bold: true, color: C.white, fontFace: FONT_DISPLAY, italic: true, margin: 0
    });
    s.addText('build it together.', {
      x: 1.0, y: 2.8, w: 12, h: 1.5,
      fontSize: 96, bold: true, color: C.gold, fontFace: FONT_DISPLAY, italic: true, margin: 0
    });

    s.addText('We’re raising a friendly first round to fund mobile app launch, paid acquisition in Sacramento + Bay Area, and our second LDA hire. Reach out if you serve immigrant communities, build legal-tech, or simply want this to exist.', {
      x: 1.0, y: 4.7, w: 11.0, h: 1.4,
      fontSize: 14, color: 'D9D2C5', fontFace: FONT_BODY, italic: false, valign: 'top', margin: 0
    });

    // Contact strip
    s.addShape('rect', { x: 1.0, y: 6.3, w: 11.0, h: 0.7, fill: { color: 'FFFFFF', transparency: 90 }, line: { color: C.gold, width: 1 } });
    s.addText([
      { text: 'imverica.com', options: { color: C.gold, bold: true } },
      { text: '       ', options: { color: C.white } },
      { text: '+1 (916) 399-3992', options: { color: C.white } },
      { text: '       ', options: { color: C.white } },
      { text: 'info@imverica.com', options: { color: C.white } }
    ], {
      x: 1.0, y: 6.3, w: 11.0, h: 0.7,
      fontSize: 14, fontFace: FONT_BODY, align: 'center', valign: 'middle', margin: 0, charSpacing: 4
    });
  }

  // ─── Write ────────────────────────────────────────────────────────
  const outPath = path.resolve(__dirname, '..', 'imverica-pitch.pptx');
  await p.writeFile({ fileName: outPath });
  console.log('✓ Wrote', outPath);

  // Strip macOS Gatekeeper quarantine — Node writes inherit the parent
  // process's quarantine attribute, which makes PowerPoint refuse to open
  // the file with a generic "couldn't open" error.
  if (process.platform === 'darwin') {
    try {
      require('child_process').execFileSync('xattr', ['-d', 'com.apple.quarantine', outPath], { stdio: 'ignore' });
    } catch (_) { /* attribute may already be absent — harmless */ }
  }
}

build().catch((err) => {
  console.error('BUILD FAILED:', err && err.stack || err);
  process.exit(1);
});
