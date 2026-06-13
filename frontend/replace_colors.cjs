const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

const files = walkSync('./src');

const replacements = [
  { regex: /bg-\[\#0a0a0f\]/g, replacement: 'bg-gray-50' },
  { regex: /bg-\[\#111118\]/g, replacement: 'bg-white' },
  { regex: /bg-\[\#1a1a27\]/g, replacement: 'bg-white' },
  { regex: /bg-\[\#242436\]/g, replacement: 'bg-gray-50' },
  { regex: /bg-\[\#2e2e48\]/g, replacement: 'bg-gray-100' },
  { regex: /bg-\[\#3d3d5c\]/g, replacement: 'bg-gray-200' },
  
  { regex: /border-\[\#242436\]/g, replacement: 'border-gray-200' },
  { regex: /border-\[\#1a1a27\]/g, replacement: 'border-gray-200' },
  { regex: /border-\[\#3d3d5c\]/g, replacement: 'border-gray-300' },
  
  { regex: /text-\[\#e8e8f5\]/g, replacement: 'text-gray-900' },
  { regex: /text-white/g, replacement: 'text-gray-900' },
  { regex: /text-\[\#c4c4e0\]/g, replacement: 'text-gray-800' },
  { regex: /text-\[\#9999cc\]/g, replacement: 'text-gray-600' },
  { regex: /text-\[\#6b6b99\]/g, replacement: 'text-gray-500' },
  { regex: /text-\[\#3d3d5c\]/g, replacement: 'text-gray-400' },

  { regex: /hover:bg-\[\#242436\]/g, replacement: 'hover:bg-gray-50' },
  { regex: /hover:bg-\[\#1a1a27\]/g, replacement: 'hover:bg-gray-100' },
  { regex: /hover:text-white/g, replacement: 'hover:text-gray-900' },

  { regex: /text-emerald-400/g, replacement: 'text-emerald-700' },
  { regex: /text-red-400/g, replacement: 'text-red-600' },
  { regex: /text-amber-400/g, replacement: 'text-amber-600' },
  { regex: /text-blue-400/g, replacement: 'text-blue-600' },

  { regex: /bg-emerald-950\/60/g, replacement: 'bg-emerald-100' },
  { regex: /bg-red-950\/60/g, replacement: 'bg-red-100' },
  { regex: /bg-amber-950\/60/g, replacement: 'bg-amber-100' },
  { regex: /bg-emerald-500\/10/g, replacement: 'bg-emerald-50' },
  { regex: /bg-amber-500\/10/g, replacement: 'bg-amber-50' },

  { regex: /hover:bg-emerald-500\/20/g, replacement: 'hover:bg-emerald-100' },
  { regex: /hover:bg-amber-500\/20/g, replacement: 'hover:bg-amber-100' },
  { regex: /border-emerald-500\/30/g, replacement: 'border-emerald-200' },
  { regex: /border-amber-500\/30/g, replacement: 'border-amber-200' },

  { regex: /border-red-800\/60/g, replacement: 'border-red-300' },
  { regex: /divide-\[\#242436\]/g, replacement: 'divide-gray-200' },
  { regex: /divide-\[\#1a1a27\]/g, replacement: 'divide-gray-100' },
  { regex: /divide-\[\#3d3d5c\]/g, replacement: 'divide-gray-200' }
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  replacements.forEach(r => {
    content = content.replace(r.regex, r.replacement);
  });
  fs.writeFileSync(file, content);
});
console.log('Colors replaced');
