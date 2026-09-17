(() => {
 const $=id=>document.getElementById(id),form=$('upload'),input=$('file'),zone=$('choose'),status=$('status'),send=$('send'),cancel=$('cancel');
 let file=null,xhr=null,started=0;
 const size=n=>n<1000?n+' B':n<1e6?(n/1000).toFixed(1)+' kB':(n/1e6).toFixed(1)+' MB';
 function message(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
 function select(files){if(xhr)return;if(files.length!==1){message('Please choose one file at a time.',true);return}const candidate=files[0];if(!candidate.size||candidate.size>50000000){file=null;input.value='';$('selection').hidden=true;send.disabled=true;message('Choose a file between 1 byte and 50 MB (50,000,000 bytes).',true);return}file=candidate;$('filename').textContent=file.name;$('filesize').textContent=size(file.size);$('selection').hidden=false;$('transfer').hidden=true;send.disabled=false;message('Ready to send. Your file will be delivered privately.')}
 function busy(active){send.disabled=active||!file;zone.disabled=active;input.disabled=active;$('remove').disabled=active;cancel.hidden=!active}
 zone.addEventListener('click',()=>input.click());input.addEventListener('change',()=>select(input.files));
 for(const name of ['dragenter','dragover'])zone.addEventListener(name,e=>{e.preventDefault();if(!xhr)zone.classList.add('dragging')});
 for(const name of ['dragleave','drop'])zone.addEventListener(name,e=>{e.preventDefault();zone.classList.remove('dragging')});
 zone.addEventListener('drop',e=>select(e.dataTransfer.files));
 document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
 $('remove').addEventListener('click',()=>{file=null;input.value='';$('selection').hidden=true;$('transfer').hidden=true;send.disabled=true;message('Choose a file to begin.')});
 cancel.addEventListener('click',()=>xhr?.abort());
 form.addEventListener('submit',e=>{
  e.preventDefault();if(!file||xhr)return;busy(true);$('transfer').hidden=false;$('progress').value=0;$('percentage').textContent='0%';$('phase').textContent='Uploading';$('transfer-detail').textContent='Preparing your delivery…';message('Keep this page open while your file is sent.');
  const request=new XMLHttpRequest();xhr=request;started=performance.now();request.open('POST','/drop/upload');request.timeout=125000;request.setRequestHeader('Content-Type','application/octet-stream');request.setRequestHeader('X-File-Name',encodeURIComponent(file.name));
  const fail=text=>{xhr=null;busy(false);$('phase').textContent='Not confirmed';message(text,true)};
  request.upload.onprogress=e=>{if(!e.lengthComputable)return;const percent=Math.min(100,Math.round(e.loaded/e.total*100)),elapsed=Math.max(.1,(performance.now()-started)/1000),rate=e.loaded/elapsed,remaining=rate?(e.total-e.loaded)/rate:0;$('progress').value=percent;$('percentage').textContent=percent+'%';$('transfer-detail').textContent=size(e.loaded)+' of '+size(e.total)+' · '+size(rate)+'/s'+(remaining>1?' · about '+Math.ceil(remaining)+'s left':'');if(percent===100){$('phase').textContent='Confirming receipt';message('Transfer complete. Waiting for the Pi to confirm storage.')}};
  request.onload=()=>{let result;try{result=JSON.parse(request.responseText)}catch{return fail('Browser verification expired. Reload this page and try again.')}if(request.status!==201)return fail(result.error||'The server could not accept this upload. Please retry.');if(!/^[a-f0-9]{32}$/.test(result.receipt)||result.bytes!==file.size)return fail('The server response could not be verified. Please check before retrying.');const receipt={receipt:result.receipt,name:file.name,bytes:result.bytes,at:Date.now()};try{sessionStorage.setItem('pi-upload-receipt',JSON.stringify(receipt))}catch{}xhr=null;$('progress').value=100;$('percentage').textContent='100%';message('Delivered. Returning to your dashboard…');window.location.assign('/#upload-receipt='+result.receipt)};
  request.onerror=()=>fail('Connection interrupted. Delivery was not confirmed; retry when connected.');request.ontimeout=()=>fail('Confirmation timed out. Delivery status is unknown; check before retrying.');request.onabort=()=>fail('Upload cancelled. No receipt was confirmed.');request.send(file);
 });
 window.addEventListener('beforeunload',e=>{if(xhr){e.preventDefault();e.returnValue=''}});
})();
