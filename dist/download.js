(()=>{
 let downloading=false;
 const links=[...document.querySelectorAll('a[href$="Windows-x64.zip"]')];
 const status=document.createElement('p');status.setAttribute('role','status');status.className='download-status';document.querySelector('.download-action').append(status);
 const digest=async buffer=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join('');
 links.forEach(link=>{link.href='#download';link.removeAttribute('download');link.addEventListener('click',async event=>{
  event.preventDefault();if(downloading)return;downloading=true;const labels=links.map(l=>l.innerHTML);links.forEach(l=>{l.setAttribute('aria-disabled','true');l.textContent='Подготовка…'});
  try{
   status.textContent='Загружаем приложение. Оставьте страницу открытой.';
   const response=await fetch('downloads/release.json',{cache:'no-store'});if(!response.ok)throw Error('manifest');const release=await response.json();let loaded=0;const chunks=[];
   for(const part of release.parts){const r=await fetch(new URL(part.url,new URL('downloads/',location.href)));if(!r.ok)throw Error('download');const reader=r.body.getReader(),pieces=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;pieces.push(value);length+=value.length;loaded+=value.length;const percent=Math.round(loaded/release.size_bytes*100);links.forEach(l=>l.textContent=`Загрузка ${percent}%`)}const buffer=new Uint8Array(length);let offset=0;for(const p of pieces){buffer.set(p,offset);offset+=p.length}if(length!==part.size_bytes||await digest(buffer)!==part.sha256)throw Error('checksum');chunks.push(buffer)}
   const blob=new Blob(chunks,{type:'application/zip'});if(blob.size!==release.size_bytes||await digest(await blob.arrayBuffer())!==release.sha256)throw Error('checksum');const url=URL.createObjectURL(blob);const save=document.createElement('a');save.href=url;save.download=release.filename;save.textContent='Сохранить архив повторно';status.replaceChildren('Архив готов. Если загрузка не началась: ',save);save.click();setTimeout(()=>URL.revokeObjectURL(url),300000);
  }catch(error){status.textContent='Загрузка прервалась. Нажмите «Скачать PLab», чтобы повторить.'}
  finally{downloading=false;links.forEach((l,i)=>{l.innerHTML=labels[i];l.removeAttribute('aria-disabled')})}
 })});
})();
