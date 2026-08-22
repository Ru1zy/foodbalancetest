import fs from 'fs';
import path from 'path';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // fix gradient in pages
  if (content.includes('bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-8 text-gray-800 dark:text-slate-200')) {
    content = content.replace(
      'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-8 text-gray-800 dark:text-slate-200',
      'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-8 text-gray-800 dark:text-slate-200'
    );
    changed = true;
  }

  // KitchenExport.tsx
  if (content.includes('bg-blue-50 px-5 py-4 text-sm text-blue-900 border border-blue-100')) {
    content = content.replace(
      'bg-blue-50 px-5 py-4 text-sm text-blue-900 border border-blue-100',
      'bg-blue-50 dark:bg-blue-900/30 px-5 py-4 text-sm text-blue-900 dark:text-blue-200 border border-blue-100 dark:border-blue-800'
    );
    changed = true;
  }

  // settings/sheets/page.tsx
  if (content.includes('bg-blue-50 p-5 text-sm text-slate-700 dark:text-slate-300')) {
    content = content.replace(
      'bg-blue-50 p-5 text-sm text-slate-700 dark:text-slate-300',
      'bg-blue-50 dark:bg-slate-800/50 p-5 text-sm text-slate-700 dark:text-slate-300'
    );
    changed = true;
  }

  // GoogleDriveAutomation.tsx
  if (content.includes('bg-emerald-100 text-emerald-700')) {
    content = content.replace(
      'bg-emerald-100 text-emerald-700',
      'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
    );
    changed = true;
  }
  if (content.includes('bg-amber-100 text-amber-800')) {
    content = content.replace(
      'bg-amber-100 text-amber-800',
      'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400'
    );
    changed = true;
  }
  if (content.includes('bg-emerald-50 text-emerald-800')) {
    content = content.replace(
      'bg-emerald-50 text-emerald-800',
      'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400'
    );
    changed = true;
  }
  if (content.includes('bg-amber-50 px-4 py-3 text-sm text-amber-900')) {
    content = content.replaceAll(
      'bg-amber-50 px-4 py-3 text-sm text-amber-900',
      'bg-amber-50 dark:bg-amber-900/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-400'
    );
    changed = true;
  }
  if (content.includes('bg-red-50 px-4 py-3 text-sm text-red-800')) {
    content = content.replaceAll(
      'bg-red-50 px-4 py-3 text-sm text-red-800',
      'bg-red-50 dark:bg-red-900/40 px-4 py-3 text-sm text-red-800 dark:text-red-400'
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
  }
}

const files = [
  'app/admin/orders/page.tsx',
  'app/admin/orders/KitchenExport.tsx',
  'app/admin/settings/sheets/page.tsx',
  'app/admin/settings/sheets/GoogleDriveAutomation.tsx',
  'app/admin/today/page.tsx',
  'app/admin/clients/page.tsx',
  'app/admin/menu/page.tsx',
  'app/admin/tariffs/page.tsx',
  'app/admin/pending-payments/page.tsx'
];

for (const file of files) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    fixFile(fullPath);
  }
}
