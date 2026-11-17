// Landscape documentation screenshots from the real production build.
// Uses an in-memory demo database (local progress is never touched) and the running FastAPI.
// The tutor step makes one real Gemini request when LLM_ENABLED=true and a key is configured.
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,seedDatabase} from '../server/src/database.js';
import {createApp} from '../server/src/app.js';
import {createModelClient} from '../server/src/modelClient.js';
import {upgradeDemoDiagnoses} from '../server/src/runtime.js';
process.loadEnvFile('server/.env');
const db=openDatabase(':memory:');seedDatabase(db);
await upgradeDemoDiagnoses(db,createModelClient());
const server=createApp(db);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const folder=resolve('snapshots'); mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1.5});
const captures=[];
const base='http://127.0.0.1:'+server.address().port;
const RAW_TEX=/\\(frac|sqrt|begin|end|times|circ|left|right|text)\b|\$[^$\s][^$]*\$|\*\*[^*]+\*\*|\[\[/;
async function capture(file,title,url,{keepScroll=false}={}) {
 if(url) await page.goto(url.startsWith('http')?url:base+url);
 await page.locator('body').waitFor();
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForTimeout(700);
 const text=await page.evaluate(()=>{const c=document.body.cloneNode(true);c.querySelectorAll('.sr-only,textarea,input').forEach(n=>n.remove());return c.innerText;});
 // Stop rather than capture a secret accidentally exposed by a view.
 for(const secret of [process.env.GEMINI_API_KEY,process.env.AI_SERVICE_KEY,process.env.ADMIN_PASSWORD]) if(secret && text.includes(secret)) throw Error('Sensitive content detected; screenshot cancelled');
 // Application views must never show LaTeX/Markdown source (Swagger is a third-party page).
 if(!page.url().includes(':8000/') && RAW_TEX.test(text)) throw Error(`Raw LaTeX/Markdown visible in ${file}: ${text.match(RAW_TEX)[0]}`);
 if(!keepScroll && !url) await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:resolve(folder,file),fullPage:false});
 captures.push({file,title,url:page.url(),viewport:'1600×1000',pixels:'2400×1500'});
}
async function login(role){
 await page.goto(base+'/login');
 await page.getByRole('button',{name:role,exact:true}).click();
 await page.waitForURL(role==='Guru'?'**/guru':role==='Admin'?'**/admin':'**/dashboard');
}
async function scrollTo(locator,offset){
 await locator.evaluate((el,offset)=>window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-offset,behavior:'instant'}),offset);
}
async function startPretest(topic){
 await page.goto(`${base}/kuis?subject=${topic}&mode=pretest`);
 await page.getByRole('button',{name:/Mulai \/ lanjutkan pretest/}).click();
 await page.waitForURL('**/kuis/kerjakan/**');
 const id=page.url().split('/').pop();
 return page.evaluate(async id=>(await fetch('/api/assessments/'+id)).json(),id);
}
async function answer(index,option){
 await page.getByRole('button',{name:`Ke soal ${index+1}`,exact:true}).click();
 await page.getByRole('radio').nth(option).click();
 await page.getByText('Tersimpan di server').waitFor();
}
try {
 await capture('01-login.png','Masuk dan pilihan peran','/login');
 await login('Siswa');
 await capture('02-student-light.png','Jalur belajar siswa');
 await page.getByRole('button',{name:'Aktifkan mode gelap'}).click();
 await capture('03-student-dark.png','Jalur belajar dalam mode gelap');
 await page.getByRole('button',{name:'Aktifkan mode terang'}).click();
 await capture('04-catalog.png','Katalog matematika XI','/katalog');
 await capture('05-lesson.png','Materi penguatan dengan notasi matematika terformat','/materi/geometri');
 await page.getByRole('textbox',{name:'Pertanyaan pendamping belajar'}).fill('Bagaimana menghitung panjang garis singgung dari titik luar? Beri contoh singkat dengan rumus.');
 await page.getByRole('button',{name:'Kirim pertanyaan'}).click();
 await page.locator('.chat-bubble.assistant .formatted-message').last().waitFor({timeout:90000});
 await page.waitForFunction(()=>!document.body.innerText.includes('Menyiapkan penjelasan'));
 await page.waitForTimeout(900); // let the chat's smooth auto-scroll settle before positioning
 // Keep the tutor card whole: align the reinforcement panel above it and show the answer's start.
 await scrollTo(page.locator('.lesson-rail > .card').first(),28);
 // Start at the question, but move far enough that the first typeset formula of the answer is visible.
 await page.locator('.chat-messages').evaluate(box=>{const top=el=>el.getBoundingClientRect().top-box.getBoundingClientRect().top+box.scrollTop;const question=[...box.querySelectorAll('.chat-bubble.user')].pop()??box.lastElementChild;const formula=box.querySelector('.formatted-message .katex-display, .formatted-message .katex .sqrt, .formatted-message .katex .mfrac, .formatted-message .katex .msupsub');const start=top(question)-6;const need=formula?top(formula)+formula.getBoundingClientRect().height+28-box.clientHeight:0;box.scrollTop=Math.max(0,start,need);});
 await capture('06-live-tutor.png','Pendamping konsep melalui backend dan Gemini, rumus dirender KaTeX',null,{keepScroll:true});
 await capture('07-assessment.png','Asesmen CDA','/kuis');
 const bootstrap=await page.evaluate(async()=> (await fetch('/api/bootstrap')).json());
 const resultId=bootstrap.progress.history[0]?.id;
 await page.getByRole('button',{name:'Keluar akun'}).click();
 // A fresh synthetic student in the isolated database shows the live quiz view.
 await page.goto(base+'/register');
 await page.getByLabel('Nama lengkap',{exact:true}).fill('Sekar Ayu');
 await page.getByLabel('Email',{exact:true}).fill('sekar.demo@example.id');
 await page.getByLabel('Kata sandi',{exact:true}).fill('DemoRumus123!');
 await page.getByLabel('Asal sekolah',{exact:true}).fill('SMA Contoh');
 await page.getByLabel('Kode kelas',{exact:true}).fill('BRIDGE11');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Buat akun siswa'}).click();
 await page.waitForURL('**/dashboard');
 let quiz=await startPretest('fungsi');
 const inverse=quiz.questions.findIndex(q=>q.options.some(o=>/\(x [−+] \d+\)\/\d/.test(o)));
 for(let i=0;i<inverse;i++) await answer(i,(i+1)%4);
 await answer(inverse,1);
 await capture('08-quiz-fraction.png','Kuis: fungsi invers dengan pilihan pecahan terformat',null);
 for(let i=inverse+1;i<quiz.questions.length;i++) await answer(i,i%4);
 await page.getByRole('button',{name:'Kumpulkan asesmen',exact:true}).click();
 await page.getByRole('button',{name:'Ya, kumpulkan'}).click();
 await page.waitForURL('**/kuis/hasil/**');
 quiz=await startPretest('aljabar');
 const matrix=quiz.questions.findIndex(q=>q.options.every(o=>o.startsWith('[[')));
 for(let i=0;i<3;i++) if(i!==matrix) await answer(i,2);
 await page.getByRole('button',{name:`Ke soal ${matrix+1}`,exact:true}).click();
 await page.locator('.question-card h2 .katex').first().waitFor();
 await page.waitForFunction(()=>document.querySelector('.question-card h2 .katex .mtable'));
 await capture('09-quiz-matrix.png','Kuis: operasi matriks dengan notasi matriks',null);
 await page.goto(base+'/kuis/hasil/'+(await page.evaluate(async()=>(await (await fetch('/api/bootstrap')).json()).progress.history[0].id)));
 await page.getByRole('button',{name:'Buka pembahasan'}).click();
 const first=page.locator('.review-list article').filter({hasText:'∘'}).first();
 await first.locator('.katex').first().waitFor();
 await scrollTo(page.locator('.review-card'),24);
 await capture('10-quiz-review.png','Pembahasan: komposisi, pangkat, invers, dan pecahan',null,{keepScroll:true});
 await page.getByRole('button',{name:'Keluar akun'}).click();
 await login('Siswa');
 if(resultId) await capture('11-result.png','Hasil asesmen dan diagnosis tersimpan','/kuis/hasil/'+resultId);
 await capture('12-progress.png','Perbandingan pre/post dan progres','/progres');
 await capture('13-profile.png','Profil dan preferensi','/profil');
 await page.getByRole('button',{name:'Keluar akun'}).click();
 await login('Guru');
 await capture('14-teacher.png','Pengelolaan kelas dan peta penguasaan');
 await page.getByRole('button',{name:'Keluar akun'}).click();
 await login('Admin');
 await capture('15-admin.png','Administrasi pengguna dan kelas');
 await page.getByRole('button',{name:'Layanan diagnosis',exact:true}).click();
 await capture('16-system.png','Status integrasi PDINA dan Gemini');
 await capture('17-swagger.png','Dokumentasi FastAPI dan kontrak AI','http://127.0.0.1:8000/docs');
 writeFileSync(resolve(folder,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),syntheticDemoData:true,captures,diagrams:['18-architecture.png','19-ai-live.png']},null,2));
 // Remove screenshots from earlier numbering so the gallery and folder stay in sync.
 const keep=new Set([...captures.map(c=>c.file),'18-architecture.png','19-ai-live.png']);
 for(const file of readdirSync(folder)) if(file.endsWith('.png')&&!keep.has(file)) rmSync(resolve(folder,file));
 console.log(`Captured ${captures.length} landscape screenshots; no credentials or raw LaTeX visible.`);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));db.close();}
