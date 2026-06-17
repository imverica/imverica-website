// Single source of truth for client reviews — shared by the homepage
// Testimonials section (rotates the freshest 6) and the full /testimonials page
// ("read more reviews"). REAL reviews from the Imverica Google Business Profile,
// lightly trimmed to complete sentences; meaning unchanged. First names only.
// UPL-safe: feedback is about document-preparation service quality, never legal
// advice or guaranteed outcomes.
//
// When the live Google reviews endpoint (/api/google-reviews) is configured it
// overrides this pool automatically; until then these real reviews show.

export interface Review {
  body: string;
  name: string;
  meta: string;
  stars: 4 | 5;
}

// The public Google reviews link (owner's verified Google Business Profile).
// Single source — feeds the homepage section, the /testimonials page, and is
// kept in sync with admin-order.js's review-request email fallback.
export const GOOGLE_REVIEWS_URL = 'https://maps.app.goo.gl/gEGYUtF817aDtW6U7';

// Newest first — the homepage shows the leading 6, the rest live on /testimonials.
export const REVIEWS: Review[] = [
  { stars: 5, name: 'Serdar',
    meta: 'USCIS I-765 · I-589 · Family',
    body: 'Thank you so much for helping our entire family! We contacted Imverica to prepare immigration forms — including I-765 and I-589 — for me, my wife, and our children. They were incredibly professional and punctual, and every document was prepared carefully.' },
  { stars: 5, name: 'Meilis',
    meta: 'USCIS I-589 · I-765',
    body: 'I had a great experience working with Imverica. They helped me prepare my immigration forms, including I-589 and I-765. Everything was explained clearly, the paperwork was completed carefully, and the process was much easier than expected.' },
  { stars: 5, name: 'Mike',
    meta: 'USCIS · Green card',
    body: 'Thank you very much for your help with the green-card forms. Everything was professional, honest, and fast. I will recommend you to my friends.' },
  { stars: 5, name: 'Ekaterina',
    meta: 'USCIS · U visa',
    body: 'Thank you for helping me prepare and organize my U-visa forms and supporting documents. The service was professional, high quality, affordable, and fast.' },
  { stars: 5, name: 'Alex',
    meta: 'USCIS · Immigration documents',
    body: 'A great experience with Imverica Legal Solutions. They guided me through the entire process, helped me complete all the paperwork correctly, answered all my questions, and made everything much easier than I expected.' },
  { stars: 5, name: 'Lili',
    meta: 'USCIS · Immigration documents',
    body: 'I am extremely satisfied with Imverica Legal Solutions. I have used their services more than once, and every time the experience has been outstanding — handled professionally and clearly.' },
  { stars: 5, name: 'Mariia',
    meta: 'Immigration documents',
    body: 'All the information I needed was conveyed very clearly and in an accessible way. It was easy and pleasant to communicate with the team — thank you for the attentive, professional service.' },
  { stars: 5, name: 'Elena',
    meta: 'Immigration documents',
    body: 'I’m very satisfied with the service. Always quick, clear, and worth it.' },
  { stars: 5, name: 'Pavlo',
    meta: 'USCIS · U4U re-parole',
    body: 'Huge thanks to Imverica Legal Solutions for their invaluable help with our U4U re-parole application! They are true professionals who genuinely care about their clients and were always in touch.' },
  { stars: 5, name: 'Mikhail',
    meta: 'USCIS · Immigration documents',
    body: 'I would like to thank the Imverica team for their professionalism and excellent service. Throughout the entire process, everything was handled clearly, efficiently, and in a timely manner.' },
  { stars: 5, name: 'Olga',
    meta: 'USCIS · Immigration documents',
    body: 'I’d like to express my gratitude to the Imverica team for their professional assistance and attentive attitude. All issues were resolved quickly, competently, and without unnecessary complications.' },
  { stars: 5, name: 'Aleks',
    meta: 'USCIS N-400 · Citizenship',
    body: 'I used Imverica to help with my citizenship application. Everything was prepared quickly, communication was easy, and the process went smoothly from start to finish. Very happy with the service.' },
  { stars: 5, name: 'Vladimir',
    meta: 'USCIS N-400 · Citizenship',
    body: 'Thank you for your help with completing my citizenship application. Everything was clear and professional.' },
  { stars: 5, name: 'Eva',
    meta: 'USCIS · Green card',
    body: 'Thank you for helping us prepare documents for our immigration case. Our green-card application had been pending with USCIS for over three years, and we didn’t know how to properly submit a status update.' },
  { stars: 5, name: 'Vitalii',
    meta: 'USCIS · Immigration documents',
    body: 'A really great company — they helped with so much! Highly recommended.' },
  { stars: 5, name: 'Aleksandr',
    meta: 'USCIS · Immigration forms',
    body: 'Thank you — the company helped me fill out the necessary immigration forms quickly and professionally! To anyone in need of this type of service, I recommend this company 10 out of 10.' },
  { stars: 5, name: 'Valentin',
    meta: 'USCIS · Immigration paperwork',
    body: 'Really happy I chose Imverica Legal Solutions for my immigration paperwork. They moved quickly, kept things on track, and delivered the results I was looking for — all at a price that felt reasonable for the quality of work.' },
  { stars: 5, name: 'Shroomly LLC',
    meta: 'Business · Employment green card',
    body: 'This company helped our employee prepare green-card application forms. The entire process was fast, affordable, and efficient. We highly recommend them.' }
];
