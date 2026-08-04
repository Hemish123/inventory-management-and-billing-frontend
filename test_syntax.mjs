import fs from 'fs';
import { parse } from '@babel/parser';
const code = fs.readFileSync('src/pages/retail/ProductsPage.jsx', 'utf-8');
try {
  parse(code, { sourceType: 'module', plugins: ['jsx'] });
  console.log('No syntax errors!');
} catch (e) {
  console.error('Syntax error:', e.message);
}
