// Cloud builds are deployed only to the personal server. GitHub Pages remains local-only.
export const cloudEnabled = import.meta.env.PUBLIC_GARDEN_CLOUD === 'true';
export class ApiError extends Error { constructor(message:string,public status:number){super(message);} }
export async function api(path:string,options:RequestInit={}) {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',...options.headers}});
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new ApiError(payload?.error||'请求未完成，请稍后重试。',response.status);
    if(!payload)throw new Error('服务器返回了无法识别的内容。');
    return payload;
  }catch(error){if(error instanceof Error&&error.name==='AbortError')throw new Error('连接超时，保存结果暂未确认，请刷新核对后重试。');throw error;}
  finally{clearTimeout(timeout);}
}
