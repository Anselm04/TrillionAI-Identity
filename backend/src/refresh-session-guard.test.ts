import { describe,it,expect } from "vitest";
import {refreshedSessionBinding as binding,refreshedSessionDecision as decision}
  from "./refresh-session-guard.js";

const user="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const session="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function jwt(claims: Record<string,unknown>){
  return "header."+Buffer.from(JSON.stringify(claims)).toString("base64url")+".signature";
}
const good=jwt({sub:user,session_id:session,aud:"authenticated"});
const valid={accessToken:good,refreshUserId:user,verifiedUserId:user,verifiedEmailConfirmed:true};
describe("refreshed bearer session binding",()=>{
  it("binds the independently verified user and actual JWT session",()=>{
    expect(binding(valid)).toEqual({userId:user,sessionId:session});
  });
  it("rejects provider refresh/user mismatch and unverified email",()=>{
    expect(binding({...valid,refreshUserId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"})).toBeNull();
    expect(binding({...valid,verifiedUserId:undefined})).toBeNull();
    expect(binding({...valid,verifiedEmailConfirmed:false})).toBeNull();
  });
  it("rejects arbitrary session claims, client-bound JWTs and invalid tokens",()=>{
    expect(binding({...valid,accessToken:jwt({sub:user})})).toBeNull();
    expect(binding({...valid,accessToken:jwt({sub:user,session_id:"forged"})})).toBeNull();
    expect(binding({...valid,accessToken:jwt({sub:user,session_id:session,client_id:"external-app"})})).toBeNull();
    expect(binding({...valid,accessToken:"not-a-jwt"})).toBeNull();
  });
  it("refuses revoked and unavailable DB inventory, including undefined responses",()=>{
    expect(decision(true,false)).toBe("active");
    expect(decision(false,false)).toBe("revoked");
    for(const value of [undefined,null,{},1,"true"])expect(decision(value,false)).toBe("unavailable");
    expect(decision(true,true)).toBe("unavailable");
  });
});
