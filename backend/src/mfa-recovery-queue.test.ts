import { describe, it, expect } from "vitest";
import { recoveryQueueQuery, recoveryQueuePage } from "./mfa-recovery-queue.js";
const id=n=>`${String(n).padStart(8,"0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
const row=n=>({user_id:id(n),requested_role:"customer" as const,created_at:"2026-11-23T00:00:00Z"});
describe("owner MFA recovery queue validation",()=>{
 it("defaults to a small, bounded read page",()=>{
   expect(recoveryQueueQuery.parse({})).toEqual({limit:25});
   expect(recoveryQueueQuery.parse({limit:"50"}).limit).toBe(50);
 });
 it("rejects arbitrary filters, sensitive fields and unbounded scans",()=>{
   for(const input of [{limit:51},{limit:-1},{limit:"not-a-number"},{user_id:id(1)},{status:"closed"},{after:"bad"},{limit:10.5}])
     expect(recoveryQueueQuery.safeParse(input).success).toBe(false);
 });
 it("uses a stable cursor only when more records exist",()=>{
   const page=recoveryQueuePage([row(1),row(2),row(3)],2);
   expect(page.cases).toEqual([row(1),row(2)]);
   expect(page.nextCursor).toBe(id(2));
   expect(recoveryQueuePage([row(3)],2).nextCursor).toBeNull();
 });
 it("rejects malformed page size or excessive provider response",()=>{
   expect(()=>recoveryQueuePage([row(1)],0)).toThrow("invalid_recovery_queue_limit");
   expect(()=>recoveryQueuePage([row(1),row(2),row(3)],1)).toThrow("invalid_recovery_queue_page");
 });
});
