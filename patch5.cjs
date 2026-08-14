const fs = require('fs');
let code = fs.readFileSync('src/lib/firestoreUtils.ts', 'utf8');

if (!code.includes('invalidateCache')) {
  code = code.replace(
    /const CACHE_DURATION = 5 \* 60 \* 1000; \/\/ 5 minutes/,
    `const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function invalidateCache(colName: string) {
  Object.keys(memoryCache).forEach(key => {
    if (key.startsWith(\`docs:\${colName}\`) || key.startsWith(\`doc:\${colName}\`)) {
      delete memoryCache[key];
    }
  });
}`
  );
  
  // Add invalidateCache to safeAddDoc
  code = code.replace(
    /export async function safeAddDoc\(colRef: any, data: any\): Promise<any> \{\n  const colName = getCollectionName\(colRef\);\n  try \{/,
    `export async function safeAddDoc(colRef: any, data: any): Promise<any> {\n  const colName = getCollectionName(colRef);\n  invalidateCache(colName);\n  try {`
  );
  
  // Add invalidateCache to safeUpdateDoc
  code = code.replace(
    /export async function safeUpdateDoc\(docRef: any, data: any\): Promise<any> \{\n  const colName = getCollectionName\(docRef\);\n  const docId = getDocId\(docRef\);\n  try \{/,
    `export async function safeUpdateDoc(docRef: any, data: any): Promise<any> {\n  const colName = getCollectionName(docRef);\n  const docId = getDocId(docRef);\n  invalidateCache(colName);\n  try {`
  );
  
  // Add invalidateCache to safeDeleteDoc
  code = code.replace(
    /export async function safeDeleteDoc\(docRef: any\): Promise<any> \{\n  const colName = getCollectionName\(docRef\);\n  const docId = getDocId\(docRef\);\n  try \{/,
    `export async function safeDeleteDoc(docRef: any): Promise<any> {\n  const colName = getCollectionName(docRef);\n  const docId = getDocId(docRef);\n  invalidateCache(colName);\n  try {`
  );

  // Add invalidateCache to safeSetDoc
  code = code.replace(
    /export async function safeSetDoc\(docRef: any, data: any, options\?: any\): Promise<any> \{\n  const colName = getCollectionName\(docRef\);\n  const docId = getDocId\(docRef\);\n  try \{/,
    `export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<any> {\n  const colName = getCollectionName(docRef);\n  const docId = getDocId(docRef);\n  invalidateCache(colName);\n  try {`
  );

  fs.writeFileSync('src/lib/firestoreUtils.ts', code);
}
