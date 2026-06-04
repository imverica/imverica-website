'use strict';

const fs = require('fs');
const path = require('path');

function findCourtTemplate(slug) {
  const rootFromFunction = path.resolve(__dirname, '..', '..', '..');
  const dirs = [
    path.join(process.cwd(), 'assets/form-cache/ca-court'),
    path.join(__dirname, 'assets/form-cache/ca-court'),
    path.join(rootFromFunction, 'assets/form-cache/ca-court')
  ];
  for (const dir of dirs) {
    const file = path.join(dir, `${slug}.pdf`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

module.exports = { findCourtTemplate };
