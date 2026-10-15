/* SIPANDAI XLSX exporter v4.10 — Office Open XML, tanpa dependensi eksternal.
 * Semua teks disimpan sebagai inlineStr; NIS dan kode yang diawali nol tetap teks.
 * Tidak ada formula dan tidak ada pembacaan/penyimpanan data ke server. */
(function(root){
'use strict';
const encoder=new TextEncoder();
const bytes=s=>encoder.encode(s);
const escapeXml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
const crcTable=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);crcTable[i]=c>>>0;}
function crc32(u8){let c=0xFFFFFFFF;for(const b of u8)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function colRef(index){let n=index+1,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
function utf8Zip(files){
 const local=[],central=[];let offset=0;
 for(const file of files){
  const name=bytes(file.path),content=bytes(file.text),crc=crc32(content);
  const header=new Uint8Array(30+name.length),dv=new DataView(header.buffer);
  dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);
  dv.setUint16(6,0x0800,true); // UTF-8 filenames
  dv.setUint32(14,crc,true);dv.setUint32(18,content.length,true);dv.setUint32(22,content.length,true);
  dv.setUint16(26,name.length,true);header.set(name,30);
  const c=new Uint8Array(46+name.length),cdv=new DataView(c.buffer);
  cdv.setUint32(0,0x02014b50,true);cdv.setUint16(4,20,true);cdv.setUint16(6,20,true);
  cdv.setUint16(8,0x0800,true);cdv.setUint32(16,crc,true);
  cdv.setUint32(20,content.length,true);cdv.setUint32(24,content.length,true);
  cdv.setUint16(28,name.length,true);cdv.setUint32(42,offset,true);c.set(name,46);
  local.push(header,content);central.push(c);offset+=header.length+content.length;
 }
 const csize=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
 e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);
 e.setUint32(12,csize,true);e.setUint32(16,offset,true);
 const total=offset+csize+end.length,out=new Uint8Array(total);let ptr=0;
 for(const block of [...local,...central,end]){out.set(block,ptr);ptr+=block.length;}
 return out;
}
function sheetName(value,used){
 let name=String(value||'Sheet').replace(/[\\/:?*\[\]]/g,' ').replace(/[\x00-\x1f]/g,'').replace(/^'+|'+$/g,'').trim().slice(0,31)||'Sheet';
 const initial=name;let j=2;
 while(used.has(name.toLowerCase())){const suffix=' '+j++;name=initial.slice(0,31-suffix.length)+suffix;}
 used.add(name.toLowerCase());return name;
}
function workbook(sheets){
 if(!Array.isArray(sheets)||!sheets.length)throw new Error('Tidak ada data tabel untuk Excel.');
 if(sheets.length>100)throw new Error('Jumlah sheet melewati batas.');
 const used=new Set();
 const pages=sheets.map((sheet,i)=>{
  const name=sheetName(sheet.name||sheet.title||'Tabel',used),header=sheet.headers||[],rows=sheet.rows||[];
  if(!Array.isArray(header)||!header.length||header.length>400||rows.length>20000)throw new Error('Ukuran tabel Excel tidak didukung.');
  const body=[header,...rows].map((row,r)=>{
   if(!Array.isArray(row))throw new Error('Baris Excel tidak valid.');
   const cols=row.map((v,c)=>{
    if(v===null||v===undefined||v==='')return '';
    const cell=colRef(c)+(r+1),style=r===0?' s="1"':'';
    if(r>0&&typeof v==='number'&&Number.isFinite(v))return `<c r="${cell}"${style}><v>${v}</v></c>`;
    return `<c r="${cell}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
   }).join('');
   return `<row r="${r+1}">${cols}</row>`;
  }).join('');
  const filters=`<autoFilter ref="A1:${colRef(header.length-1)}${rows.length+1}"/>`;
  const widths=header.map((h,c)=>{
    const width=c===0?7:/^nis$/i.test(String(h))?18:/nama siswa|nama mapel/i.test(String(h))?31:/umpan balik|keterangan/i.test(String(h))?36:Math.min(25,Math.max(12,String(h).length+3));
    return `<col min="${c+1}" max="${c+1}" width="${width}" customWidth="1"/>`;
  }).join('');
  return {name,path:`xl/worksheets/sheet${i+1}.xml`,xml:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${body}</sheetData>${filters}</worksheet>`};
 });
 const workbookXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${pages.map((p,i)=>`<sheet name="${escapeXml(p.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
 const relations=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${pages.map((p,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${pages.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176C59"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>`;
 const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${pages.map((p,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
 return utf8Zip([
  {path:'[Content_Types].xml',text:types},
  {path:'_rels/.rels',text:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
  {path:'xl/workbook.xml',text:workbookXml},
  {path:'xl/_rels/workbook.xml.rels',text:relations},
  {path:'xl/styles.xml',text:styles},
  ...pages.map(p=>({path:p.path,text:p.xml}))
 ]);
}
root.SipandaiXlsx=workbook;
})(typeof window!=='undefined'?window:globalThis);
