import {api, ApiError, cloudEnabled} from '../lib/cloud';
import { todayLocal, dayNumber, daysInclusive, validateRecords, parseBackup, makeBackup } from '../lib/cycle.mjs';

type RecordEntry = { id: string; start: string; end: string | null };
const STORAGE_KEY = 'yuan.cycle.records.v1';
const CAT_KEY = 'yuan.cycle.cat.v1';
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const field = (id: string) => element<HTMLInputElement>(id);
const dialog = (id: string) => element<HTMLDialogElement>(id);
let records: RecordEntry[] = [];
let currentToday = todayLocal();
let selectedDate = currentToday;
let visibleMonth = currentToday.slice(0, 7);
let lastRaw: string | null = null;
let storageReady = !cloudEnabled;
let cloudVersion = 0;
let cloudUser: string | null = null;
let cloudBusy = false;
let sessionEpoch = 0;
function cloudStatus(message:string){if(cloudEnabled)element('cloud-status').textContent=message;}
async function loadCloudRecords(){
  const epoch=sessionEpoch;
  const session=await api('/api/session');
  if(epoch!==sessionEpoch)return;
  cloudUser=session.user?.username ?? null;
  element('cloud-account').textContent=cloudUser ? `账号：${cloudUser}` : session.setupRequired ? '设置账号' : '登录';
  if(!cloudUser){clearCloudSession();cloudStatus(session.setupRequired?'请先设置私人账号':'登录后保存和查看记录');render();return;}
  const data=await api('/api/cycle');
  if(epoch!==sessionEpoch)return;
  records=validateRecords(data.records,currentToday) as RecordEntry[];cloudVersion=data.version;
  lastRaw=`cloud:${cloudVersion}`;storageReady=true;element('storage-alert').hidden=true;
  cloudStatus('已与服务器同步');render();
}
async function refreshCloud(){
  if(cloudBusy)return;
  cloudBusy=true;
  try{await loadCloudRecords();}catch(error){storageReady=false;cloudStatus('连接失败，点击同步重试');render();notify((error as Error).message);}finally{cloudBusy=false;}
}
let editedRecord: RecordEntry | null = null;
let undoSnapshot: RecordEntry[] | null = null;
let undoExpected: string | null = null;
let confirmAction: (() => Promise<boolean>) | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let catTimer: ReturnType<typeof setTimeout> | undefined;

function prettyDate(iso: string, includeYear = false) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${includeYear ? `${y}年` : ''}${m}月${d}日`;
}
function notify(message: string, previous: RecordEntry[] | null = null) {
  clearTimeout(toastTimer); undoSnapshot = previous; undoExpected = lastRaw;
  element('toast-text').textContent = message;
  element('undo-action').hidden = previous === null;
  element('toast').hidden = false;
  toastTimer = setTimeout(() => { element('toast').hidden = true; undoSnapshot = null; }, previous ? 12000 : 6500);
}
function storageError(message: string) {
  storageReady = false; element('storage-alert').hidden = false;
  element('storage-alert').textContent = `${message}\n现有内容不会被覆盖。请先在「设置」中导出备份。`;
}
function loadRecords() {
  if(cloudEnabled)return;
  try {
    lastRaw = localStorage.getItem(STORAGE_KEY);
    records = lastRaw === null ? [] : parseBackup(lastRaw, currentToday);
    storageReady = true; element('storage-alert').hidden = true;
  } catch (error) { storageError(`暂时无法读取本地记录：${(error as Error).message}`); }
}
async function withRecordLock<T>(action: () => T): Promise<T> {
  if (!navigator.locks) throw new Error('这个浏览器暂不支持安全保存，请使用新版 Safari、Chrome 或 Edge。');
  return navigator.locks.request(STORAGE_KEY, action);
}
async function persist(next: RecordEntry[]): Promise<boolean> {
  if (!storageReady) { throw new Error(cloudEnabled?'请先登录并同步记录，再保存。':'当前无法安全保存，请先处理页面上的存储提示。'); }
  if(cloudEnabled){
    if(cloudBusy)throw new Error('正在同步，请稍后再试。');
    const clean=validateRecords(next,currentToday) as RecordEntry[];
    const epoch=sessionEpoch;cloudBusy=true;cloudStatus('正在保存…');
    try{
      const data=await api('/api/cycle',{method:'PUT',body:JSON.stringify({version:cloudVersion,records:clean})});
      if(epoch!==sessionEpoch)throw new Error('登录状态已经改变，请重新登录并同步。');
      records=validateRecords(data.records,currentToday) as RecordEntry[];cloudVersion=data.version;lastRaw=`cloud:${cloudVersion}`;
      render();cloudStatus('已保存到服务器');return true;
    }catch(error){
      if(error instanceof ApiError&&error.status===409){try{await loadCloudRecords();}catch{storageReady=false;cloudStatus('冲突后同步失败，点击同步重试');render();throw new Error('其他设备修改了记录，但最新内容暂时无法读取。请联网后点同步，再核对操作。');}throw new Error('记录已在其他设备改变，已同步最新内容。请核对后重新操作。');}
      if(error instanceof ApiError&&error.status===401){clearCloudSession();cloudStatus('登录已过期，请重新登录');}
      else cloudStatus('保存未确认，请点同步核对后重试');
      throw error;
    }finally{cloudBusy=false;}
  }
  const expectedRaw = lastRaw;
  try { return await withRecordLock(() => {
    if (localStorage.getItem(STORAGE_KEY) !== expectedRaw) {
      loadRecords(); render(); throw new Error('另一页面更新了记录，已同步。请检查后重新操作。');
    }
    const clean = validateRecords(next, currentToday) as RecordEntry[];
    const raw = JSON.stringify({version:1, records:clean});
    localStorage.setItem(STORAGE_KEY, raw);
    if (localStorage.getItem(STORAGE_KEY) !== raw) throw new Error('写入后未能读取，请检查浏览器存储权限。');
    records = clean; lastRaw = raw; render(); return true;
  }); } catch(error) { throw new Error(`没有保存成功：${(error as Error).message}`); }
}
function recordOn(date: string) {
  return records.find(record => record.start <= date && (record.end ?? currentToday) >= date);
}
function calendarDate(day: number) { return new Date(day * 86400000).toISOString().slice(0,10); }
function renderCalendar() {
  const [year,month] = visibleMonth.split('-').map(Number);
  element('month-title').textContent = `${year}年 ${month}月`;
  element<HTMLButtonElement>('previous-month').disabled = visibleMonth <= '1900-01';
  element<HTMLButtonElement>('next-month').disabled = visibleMonth >= currentToday.slice(0,7);
  const first = dayNumber(`${visibleMonth}-01`);
  const weekday = (new Date(first * 86400000).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year,month,0)).getUTCDate();
  const cells = Math.ceil((weekday+days)/7)*7;
  const grid = element('date-grid'); grid.replaceChildren();
  for (let index = 0; index < cells; index++) {
    const date = calendarDate(first-weekday+index);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'day';
    const span = document.createElement('span'); span.textContent = String(Number(date.slice(-2))); button.append(span);
    const record = recordOn(date);
    if (date.slice(0,7) !== visibleMonth) button.classList.add('outside');
    if (date === currentToday) button.classList.add('today');
    if (record) {
      button.classList.add('period');
      if (date === record.start) button.classList.add('range-start');
      if (date === (record.end ?? currentToday)) button.classList.add('range-end');
    }
    button.disabled = date > currentToday || date < '1900-01-01';
    button.setAttribute('aria-pressed',String(date === selectedDate));
    button.setAttribute('aria-label',`${prettyDate(date,true)}${date === currentToday ? '，今天' : ''}${record ? '，已记录经期' : ''}${date > currentToday ? '，未来日期不可记录' : ''}`);
    button.dataset.date = date;
    button.addEventListener('click', () => { selectedDate = date; visibleMonth = date.slice(0,7); render(); element<HTMLButtonElement>(`main-action`).focus({preventScroll:true}); });
    grid.append(button);
  }
}
function renderHistory() {
  const list = element('history-list'); list.replaceChildren();
  if (!records.length) { const empty = document.createElement('p'); empty.className = 'history-empty'; empty.textContent = '还没有记录。从一个日期开始就好。'; list.append(empty); return; }
  records.forEach((record, index) => {
    const button = document.createElement('button'); button.className = 'history-entry';
    const text = document.createElement('span'); const heading = document.createElement('strong');
    heading.textContent = `${prettyDate(record.start,true)} — ${record.end ? prettyDate(record.end, record.end.slice(0,4)!==record.start.slice(0,4)) : '进行中'}`;
    const small = document.createElement('small');
    const earlier = records[index+1];
    small.textContent = earlier ? `与上次开始相隔 ${dayNumber(record.start)-dayNumber(earlier.start)} 天` : '点这里修改日期';
    text.append(heading,small); const duration = document.createElement('span'); duration.textContent = `${record.end ? '' : '已记录 '}${daysInclusive(record.start, record.end ?? currentToday)} 天`;
    button.append(text,duration); button.addEventListener('click',()=> { dialog('history-dialog').close(); openEditor(record); }); list.append(button);
  });
}
function render() {
  const ongoing = records.find(record=>record.end === null);
  element('today-label').textContent = new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
  element('summary-title').textContent = ongoing ? `这次记录第 ${daysInclusive(ongoing.start,currentToday)} 天` : records.length ? '按自己的节奏来。' : '记下日期，就好。';
  element('summary-detail').textContent = ongoing ? `${prettyDate(ongoing.start)}开始，结束时再记一下。` : records.length ? `最近一次开始于 ${prettyDate(records[0].start,true)}。` : '开始和结束，都只需要轻点一下。';
  renderCalendar(); renderHistory();
  const selected = recordOn(selectedDate);
  element('selected-date-label').textContent = `${selectedDate === currentToday ? '今天 · ' : ''}${prettyDate(selectedDate,true)}`;
  element('selected-date-state').textContent = selected ? selected.end ? '已记录' : '这次经期中' : '未记录';
  const main = element<HTMLButtonElement>('main-action'); main.disabled = !storageReady;
  element('edit-selected').hidden = !selected || !storageReady;
  if (selected?.end) { main.textContent = '查看这次记录'; element('action-hint').textContent = '日期记错了，也可以随时修改。'; element('edit-selected').hidden = true; }
  else if (selected) { main.textContent = selectedDate === currentToday ? '今天结束了' : `结束于 ${prettyDate(selectedDate)}`; element('action-hint').textContent = '所选日期按本次经期的最后一天记录。'; }
  else if (ongoing || selectedDate < (records[0]?.start ?? '')) { main.textContent = '补记这段经期'; element('action-hint').textContent = '补记过去的一段经期，请填好开始和结束。'; }
  else { main.textContent = selectedDate === currentToday ? '经期开始了' : `开始于 ${prettyDate(selectedDate)}`; element('action-hint').textContent = '不需要填表，记下开始日期就好了。'; }
  element('record-count').textContent = records.length ? String(records.length) : '';
  for (const id of ['record-start','record-end']) field(id).max = currentToday;
  element<HTMLButtonElement>('add-record').disabled = !storageReady;
  element<HTMLButtonElement>('history-add').disabled = !storageReady;
}
function openEditor(record: RecordEntry | null = null) {
  if (!storageReady) { notify(cloudEnabled?'请先登录并同步记录。':'请先处理本地存储提示。'); return; }
  editedRecord = record ? {...record} : null;
  element('edit-title').textContent = record ? '修改这次记录' : '补记一段经期';
  field('record-start').value = record?.start ?? selectedDate;
  field('record-end').value = record?.end ?? '';
  element('edit-error').textContent = '';
  element('delete-record').hidden = !record;
  dialog('edit-dialog').showModal();
}
function confirm(title: string, description: string, label: string, action: () => Promise<boolean>, preview?: string) {
  element('confirm-title').textContent = title; element('confirm-description').textContent = description;
  element('confirm-yes').textContent = label; element('confirm-error').textContent = '';
  element('import-preview').hidden = !preview; element('import-preview').textContent = preview ?? '';
  confirmAction = action; dialog('confirm-dialog').showModal();
}
element('main-action').addEventListener('click',async()=> {
  const chosen = recordOn(selectedDate);
  if (chosen?.end) { openEditor(chosen); return; }
  if (!chosen && (records.some(record=>record.end===null) || selectedDate < (records[0]?.start ?? ''))) { openEditor(); return; }
  const previous = records.map(record=>({...record}));
  try {
    const next = chosen ? records.map(record=>record.id===chosen.id ? {...record,end:selectedDate} : record) : [...records,{id:crypto.randomUUID(),start:selectedDate,end:null}];
    if (await persist(next)) notify(chosen ? `已记下结束日期：${prettyDate(selectedDate)}` : `已记下开始日期：${prettyDate(selectedDate)}`,previous);
  } catch(error) { notify((error as Error).message); }
});
element('edit-selected').addEventListener('click',()=>openEditor(recordOn(selectedDate) ?? null));
element('add-record').addEventListener('click',()=>openEditor());
element('history-add').addEventListener('click',()=> {dialog('history-dialog').close();openEditor();});
element('open-history').addEventListener('click',()=>dialog('history-dialog').showModal());
element('record-form').addEventListener('submit',async event=> {
  event.preventDefault(); const previous=records.map(record=>({...record}));
  try {
    if (editedRecord && JSON.stringify(records.find(record=>record.id===editedRecord!.id))!==JSON.stringify(editedRecord)) throw new Error('这条记录已在其他页面修改，请关闭后重新打开。');
    const nextRecord: RecordEntry={id:editedRecord?.id ?? crypto.randomUUID(),start:field('record-start').value,end:field('record-end').value || null};
    const next=editedRecord ? records.map(record=>record.id===nextRecord.id ? nextRecord : record) : [...records,nextRecord];
    if (await persist(next)) { selectedDate=nextRecord.start; visibleMonth=selectedDate.slice(0,7); render(); dialog('edit-dialog').close(); notify('记录已保存。',previous); }
  } catch(error) { element('edit-error').textContent=(error as Error).message; }
});
element('delete-record').addEventListener('click',()=> {
  const target=editedRecord; if (!target) return;
  confirm('删除这次记录？',`${prettyDate(target.start,true)}开始的这条记录将被删除。`,'删除记录',async()=> {
    if (JSON.stringify(records.find(record=>record.id===target.id))!==JSON.stringify(target)) throw new Error('记录已经改变，请关闭后重新检查。');
    const previous=records.map(record=>({...record}));
    if (!await persist(records.filter(record=>record.id!==target.id))) return false;
    dialog('edit-dialog').close(); notify('已删除这次记录。',previous); return true;
  });
});
element('undo-action').addEventListener('click',async()=> {
  const previous=undoSnapshot; if (!previous) return;
  if (lastRaw!==undoExpected) { notify('记录已发生变化，不能撤销，请在历次记录里修改。'); return; }
  try { if (await persist(previous)) notify('已撤销刚才的操作。'); } catch(error) {notify((error as Error).message);}
});
function changeMonth(offset:number) {
  const [year,month]=visibleMonth.split('-').map(Number); const date=new Date(Date.UTC(year,month-1+offset,1));
  const next=date.toISOString().slice(0,7); if (next<'1900-01' || next>currentToday.slice(0,7)) return;
  visibleMonth=next; renderCalendar();
}
element('previous-month').addEventListener('click',()=>changeMonth(-1));
element('next-month').addEventListener('click',()=>changeMonth(1));
element('back-today').addEventListener('click',()=> { selectedDate=currentToday;visibleMonth=currentToday.slice(0,7);render(); });
for (const id of ['open-settings','open-backup']) element(id).addEventListener('click',()=> { element('backup-status').textContent='';dialog('settings-dialog').showModal(); });
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button=>button.addEventListener('click',()=>dialog(button.dataset.close!).close()));
element('confirm-cancel').addEventListener('click',()=>dialog('confirm-dialog').close());
element('confirm-yes').addEventListener('click',async()=> {try {if (await confirmAction?.()) dialog('confirm-dialog').close();}catch(error){element('confirm-error').textContent=(error as Error).message;}});
dialog('confirm-dialog').addEventListener('close',()=> {confirmAction=null;});
function download(text:string,filename:string) {
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
element('export-data').addEventListener('click',()=> {
  try {
    if (!storageReady && !cloudEnabled) {
      if (lastRaw===null) throw new Error('没有可读取的本地数据，暂时无法导出。');
      download(lastRaw,`月笺-原始数据-${currentToday}.json`);element('backup-status').textContent='已发起原始数据下载。此文件可能损坏，请保留用于恢复排查。';return;
    }
    if(cloudEnabled&&!storageReady)throw new Error('请先登录并同步，才能导出服务器记录。');
    download(makeBackup(records,currentToday),`月笺-备份-${currentToday}.json`);element('backup-status').textContent=`已发起 ${records.length} 条记录的下载，请确认备份文件已保存。`;
  } catch(error) {element('backup-status').textContent=(error as Error).message;}
});
element('import-data').addEventListener('click',()=>field('import-file').click());
field('import-file').addEventListener('change',async()=> {
  const file=field('import-file').files?.[0];field('import-file').value='';if (!file) return;
  try {
    if (!storageReady) throw new Error(cloudEnabled?'请先登录并同步，再恢复备份。':'请先导出并处理当前无法读取的本地数据，再恢复备份。');
    if(file.size>1024*1024) throw new Error('文件大于 1 MB，请选择本工具导出的备份文件。');
    const imported=parseBackup(await file.text(),currentToday) as RecordEntry[];
    const expectedRaw=lastRaw;
    const preview=imported.length ? `${imported.length} 条记录\n最早开始：${prettyDate(imported[imported.length-1].start,true)}\n最近开始：${prettyDate(imported[0].start,true)}` : '这个备份中没有记录。恢复后当前记录会清空。';
    confirm('恢复这份备份？',`恢复会替换${cloudEnabled?'当前账号':'这个浏览器'}现有的 ${records.length} 条记录。建议先导出当前记录。`,'恢复并替换',async()=> {
      if(lastRaw!==expectedRaw) throw new Error('本地记录已经改变，请取消并重新导入。');
      const previous=records.map(record=>({...record}));if(!await persist(imported)) return false;
      dialog('settings-dialog').close();notify(`已恢复 ${imported.length} 条记录。`,previous);return true;
    },preview);
  } catch(error) {element('backup-status').textContent=(error as Error).message;}
});
element('erase-data').addEventListener('click',()=> {
  const expectedRaw=lastRaw;
  if(cloudEnabled){
    if(!storageReady){notify('请先登录并同步。');return;}
    confirm('清空此账号的经期记录？','这会清空服务器上的经期记录，其他设备同步后也会清空。请先导出备份。','清空记录',async()=>{
      if(lastRaw!==expectedRaw)throw new Error('记录发生变化，请关闭后重新核对。');
      const previous=records.map(record=>({...record}));await persist([]);dialog('settings-dialog').close();notify('服务器记录已清空。',previous);return true;
    });return;
  }
  confirm('清除这台设备的记录？','此操作不能从页面撤销。请先导出备份；其他设备和已经下载的备份不会被删除。','清除记录',async()=> withRecordLock(() => {
    if(localStorage.getItem(STORAGE_KEY)!==expectedRaw) throw new Error('另一页面更改了记录，请取消后刷新再试。');
    localStorage.removeItem(STORAGE_KEY);lastRaw=null;records=[];storageReady=true;element('storage-alert').hidden=true;
    render();dialog('settings-dialog').close();notify('本地记录已清除。');return true;
  }));
});
try {field('cat-toggle').checked=localStorage.getItem(CAT_KEY)!=='off';}catch {/* Keep the default cat when preference storage is unavailable. */}
function renderCat(){element('cat-pet').hidden=!field('cat-toggle').checked;}
renderCat();
field('cat-toggle').addEventListener('change',()=> {renderCat();try{localStorage.setItem(CAT_KEY,field('cat-toggle').checked?'on':'off');}catch{notify('本次已切换；浏览器未允许保存偏好。');}});
const catMessages=['喵，我在这里。','今天也陪着你。','摸摸，慢慢来。','收到一份猫猫贴贴。'];let catCount=0;
element('cat-pet').addEventListener('click',()=> {clearTimeout(catTimer);element('cat-speech').textContent=catMessages[catCount++%catMessages.length];element('cat-pet').classList.remove('is-petted');requestAnimationFrame(()=>element('cat-pet').classList.add('is-petted'));catTimer=setTimeout(()=>element('cat-pet').classList.remove('is-petted'),2800);});
window.addEventListener('storage',event=> {
  if(cloudEnabled&&event.key==='garden.auth.changed'){clearCloudSession();}
  if(!cloudEnabled&&(event.key===STORAGE_KEY || event.key===null)){loadRecords();undoSnapshot=null;render();notify('已同步另一页面的记录变化。');}
  if(event.key===CAT_KEY || event.key===null){try{field('cat-toggle').checked=localStorage.getItem(CAT_KEY)!=='off';renderCat();}catch{/* Preference unavailable. */}}
});
function checkDate(){const date=todayLocal();if(date!==currentToday){const wasToday=selectedDate===currentToday;currentToday=date;if(wasToday){selectedDate=date;visibleMonth=date.slice(0,7);}loadRecords();render();}}
document.addEventListener('visibilitychange',()=> {if(!document.hidden) checkDate();});window.addEventListener('focus',checkDate);setInterval(checkDate,60000);
loadRecords();render();

if(cloudEnabled){
  element('cloud-refresh').addEventListener('click',()=>{if(document.querySelector('dialog[open]'))return;void refreshCloud();});
  const checkSession=async()=>{if(!document.querySelector('dialog[open]')){void refreshCloud();return;}try{const state=await api('/api/session');if(!state.user)clearCloudSession();}catch{/* Preserve edits, never infer logout from a network error. */}};
  window.addEventListener('focus',()=>void checkSession());
  window.addEventListener('pageshow',()=>void checkSession());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkSession();});
  if('BroadcastChannel' in window){const channel=new BroadcastChannel('garden-auth');channel.onmessage=event=>{if(event.data==='logout')clearCloudSession();};}
  void refreshCloud();
}

function clearCloudSession(){
  sessionEpoch++;records=[];lastRaw=null;cloudUser=null;storageReady=false;undoSnapshot=null;editedRecord=null;
  field('record-start').value='';field('record-end').value='';element('import-preview').textContent='';
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(sheet=>sheet.close());
  element('toast').hidden=true;element('cloud-account').textContent='登录';cloudStatus('请登录后查看私人记录');render();
}
