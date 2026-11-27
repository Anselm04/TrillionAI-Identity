/** Single-flight dependency readiness. A timed-out non-cooperative probe
 * retains its slot until settlement: repeated requests cannot pile up work.
 * No result is cached beyond the active probe; liveness is independent. */
export function createReadinessCheck(probe:(signal:AbortSignal)=>Promise<boolean>,deadlineMs=2000){
 if(!Number.isSafeInteger(deadlineMs)||deadlineMs<=0)throw Error("invalid_readiness_deadline");
 let active:Promise<boolean>|null=null;
 return function check():Promise<boolean>{
  if(active)return active;
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>;
  let timedOut=false;
  const deadline=new Promise<boolean>(resolve=>{
   timer=setTimeout(()=>{timedOut=true;resolve(false);controller.abort();},deadlineMs);
  });
  const work=Promise.resolve().then(()=>probe(controller.signal)).then(ok=>!timedOut&&ok===true,()=>false);
  const result=Promise.race([deadline,work]);
  active=result;
  void work.then(()=>{
   clearTimeout(timer);
   if(active===result)active=null;
  });
  return result;
 };
}
