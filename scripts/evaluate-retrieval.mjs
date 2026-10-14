import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { SemanticIndex } from '../src/retrieval.mjs';
import {prepareSupport} from '../src/support.mjs';
const meta=JSON.parse(await readFile('data/articles.json','utf8'));
const articles=await Promise.all(meta.map(async a=>({...a,content:await readFile(a.path,'utf8')})));
const cases=JSON.parse(await readFile('data/retrieval-cases.json','utf8'));
const index=new SemanticIndex();
const data=JSON.parse(await readFile('data/demo.json','utf8'));
await index.rebuild(articles);
const results=[];
for(const item of cases){const result=await index.search(item.question,articles);const actual=result.matches[0]?.id??null;const prepared=prepareSupport({data,articles,userId:'user-lena',message:item.question,retrieved:result.matches});const routed=prepared.sources[0]?.id??null;results.push({...item,actual,passed:actual===item.expected,routed,routing_passed:routed===item.expected,top_score:result.top_score,method:result.method});console.log(`${actual===item.expected?'PASS':'FAIL'} top-1 ${item.expected??'abstain'} -> ${actual??'abstain'}; final source ${routed??'abstain'} · ${result.top_score?.toFixed(3)} · ${item.question}`);}
const record={at:new Date().toISOString(),model:index.status(articles).model,min_score:index.minScore,index:index.status(articles),purpose:'Small development set for retrieval calibration, not an independent benchmark or end-to-end answer accuracy. Final-source routing additionally uses explicit domain intent among retrieved sources.',passed:results.filter(r=>r.passed).length,routing_passed:results.filter(r=>r.routing_passed).length,total:results.length,results};
await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/retrieval-evaluation.json',JSON.stringify(record,null,2)+'\n');
console.log(`${record.passed}/${record.total} retrieval cases. Evidence: docs/evidence/retrieval-evaluation.json`);
